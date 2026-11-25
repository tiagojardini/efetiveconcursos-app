// Teste no navegador: Chrome headless via CDP, sem dependências.
// Uso: npm run dev:estatico (em outro terminal) e depois npm run teste:navegador
import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const OUT = process.argv[2] || ".teste-navegador";
const BASE = "http://127.0.0.1:8788";
const CHROME = process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
mkdirSync(OUT, { recursive: true });
const prof = join(OUT, "perfil-" + Date.now());
const chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-port=9333", `--user-data-dir=${prof}`, "--no-first-run", "about:blank"], { stdio: "ignore" });
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
let alvos;
for (let i = 0; i < 40; i++) {
  try { alvos = await (await fetch("http://127.0.0.1:9333/json")).json(); if (alvos.find((t) => t.type === "page")) break; } catch {}
  await espera(250);
}
const page = alvos.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pend = {}; const erros = [];
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pend[d.id]) { pend[d.id](d); delete pend[d.id]; }
  if (d.method === "Runtime.exceptionThrown") erros.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
  if (d.method === "Runtime.consoleAPICalled" && d.params.type === "error") erros.push(d.params.args.map((a) => a.value || a.description).join(" "));
  if (d.method === "Log.entryAdded" && d.params.entry.level === "error") erros.push(d.params.entry.text + " " + (d.params.entry.url || ""));
};
const cdp = (method, params = {}) => new Promise((r) => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => { const r = await cdp("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) throw new Error(expr + " -> " + JSON.stringify(r.result.exceptionDetails)); return r.result.result.value; };
const foto = async (nome, cheia = false) => { const r = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: cheia }); writeFileSync(join(OUT, nome + ".png"), Buffer.from(r.result.data, "base64")); };
const ir = async (url) => { await cdp("Page.navigate", { url }); await espera(1200); };
const tela = (w, h, mobile) => cdp("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile });
const checa = [];
const ok = (cond, msg) => { checa.push(`${cond ? "OK  " : "FALHA"} ${msg}`); };

await cdp("Runtime.enable"); await cdp("Page.enable"); await cdp("Log.enable");
await tela(390, 844, true);

// 1. Primeiro acesso: montar o plano
await ir(BASE + "/curso/");
ok(await ev(`!!document.querySelector('#form-plano')`), "primeiro acesso abre 'Vamos montar seu plano'");
await foto("01-plano");
await ev(`(()=>{const f=document.querySelector('#form-plano');f.nome.value='Ana';f.inicio.value='2026-12-01';f.dispatchEvent(new Event('input'));return document.querySelector('#previa').textContent})()`)
  .then((t) => ok(/ter, 01\/12.*seg, 11\/01.*Sobram 9/.test(t), "prévia: " + t));
await ev(`document.querySelector('#form-plano button[type=submit]').click()`); await espera(500);
// 2. Hoje
const hoje = await ev(`document.querySelector('#app').innerText`);
ok(/Olá, Ana!/.test(hoje) && /Faltam \d+ dias/.test(hoje), "Hoje: saudação e prazo");
ok(/Hoje · Dia 1 de 30/i.test(hoje), "Hoje: Dia 1 de 30");
await foto("02-hoje");
// 3. Aula 1
await ev(`document.querySelector('a.btn.prim').click()`); await espera(1500);
ok(await ev(`!!document.querySelector('.day-art h2')`), "Aula 1 carregou: " + (await ev(`document.querySelector('.day-art h2')?.textContent`)));
ok(await ev(`document.querySelectorAll('.fc').length`) === 10, "10 flashcards");
ok(await ev(`document.querySelectorAll('[data-check] .opt').length`) > 0, "pausas 'pare e responda' renderizadas");
await foto("03-aula-topo");
// responde o quiz todo errando a 1ª
await ev(`(async()=>{for(let i=0;i<10;i++){const q=document.querySelectorAll('[data-quiz] .q')[i];const bs=q.querySelectorAll('.opt');(i===0?bs[bs.length-1]:bs[0]).click();await new Promise(r=>setTimeout(r,30));}})()`);
const placar = await ev(`document.querySelector('[data-score]').innerText`);
ok(/de 10 certas/.test(placar), "quiz respondido: " + placar.split("\n")[0]);
ok(await ev(`Object.keys(JSON.parse(localStorage.getItem('efetive:louveira-professor-2027:erros')||'{}')).length`) >= 1, "erro guardado em Meus erros");
await ev(`document.querySelector('[data-quiz]').scrollIntoView()`); await foto("04-quiz");
await ev(`document.querySelector('#concluir').click()`); await espera(500);
const hoje2 = await ev(`document.querySelector('#app').innerText`);
ok(/Dia 2 de 30/i.test(hoje2) && hoje2.includes("Seu plano começa ter, 01/12") && /1 de 30/.test(hoje2), "depois de concluir: Dia 2, 1 de 30 feitas, aviso de início do plano");
await foto("05-hoje-dia2");
// 4. Cronograma
await ev(`document.querySelector('.tab[data-aba=cronograma]').click()`); await espera(500);
const crono = await ev(`document.querySelector('#app').innerText`);
ok(/Dia 30 · seg, 11\/01/.test(crono), "Dia 30 cai em seg, 11/01");
ok((crono.match(/Abrir a aula/g) || []).length === 3, "3 aulas prontas no cronograma");
await foto("06-cronograma");
// 5. Aula ainda não pronta
await ir(BASE + "/curso/#aula-4"); await espera(300);
ok(/sendo preparada/.test(await ev(`document.querySelector('#app').innerText`)), "Dia 4 mostra 'sendo preparada'");
// 6. Meus erros
await ir(BASE + "/curso/#erros");
ok(/questão 1/.test(await ev(`document.querySelector('#app').innerText`)), "Meus erros lista a questão errada");
await foto("07-erros");
// 7. Mudar plano: começar tarde -> apertado
await ir(BASE + "/curso/#plano");
await ev(`(()=>{const f=document.querySelector('#form-plano');f.inicio.value='2027-01-10';f.dispatchEvent(new Event('input'))})()`);
ok(/até 3 aulas/.test(await ev(`document.querySelector('#previa').textContent`)), "plano apertado avisa 'até 3 aulas'");
// 8. Desktop
await tela(1280, 900, false);
await ir(BASE + "/curso/#hoje"); await foto("08-hoje-desktop");
// 9. Aula grátis
await tela(390, 844, true);
await ir(BASE + "/aula-gratis/"); await espera(800);
ok(await ev(`!!document.querySelector('.day-art h2')`), "aula grátis carrega a Aula 1");
await foto("09-aula-gratis");
await ev(`(async()=>{for(let i=0;i<10;i++){const q=document.querySelectorAll('[data-quiz] .q')[i];q.querySelectorAll('.opt')[0].click();await new Promise(r=>setTimeout(r,30));}})()`);
ok(await ev(`!!document.querySelector('#falta')`), "pergunta 'O que falta' aparece no fim do quiz");
await ev(`document.querySelector('#falta').scrollIntoView({block:'center'})`); await foto("10-pergunta");
// 10. Curso não deve carregar conteúdo fechado por /aberto
const st = await ev(`fetch('/aberto/louveira-professor-2027/dia-02.html').then(r=>r.status)`);
ok(st === 404, "Dia 2 não está na pasta aberta (status " + st + ")");

console.log(checa.join("\n"));
console.log(erros.length ? "ERROS NO CONSOLE:\n" + erros.join("\n") : "Console sem erros");
ws.close(); chrome.kill();
process.exit(0);
