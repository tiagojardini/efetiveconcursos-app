// App da aluna: 3 telas (Hoje, Cronograma, Aula) + "Montar meu plano" + "Meus erros".
// Progresso salvo no navegador (decisão de 25/11: sincronizar PC e celular fica para depois).

import { montarCronograma, hojeISO, formatar, diasEntre, somarDias } from "./cronograma.js";
import { criarStore, carregarAula, montarAula, montarErros, contarErros, escapar } from "./aula.js";

const ID = document.body.dataset.concurso;
const app = document.getElementById("app");
const store = criarStore(`efetive:${ID}:`);
const NOMES_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const AREAS = { CE: "--ce", LP: "--lp", MAT: "--mat", RL: "--mat", INFO: "--info", REV: "--rev", SIM: "--rev" };
const ETAPAS = [
  { nome: "Semana 1", de: 1, ate: 7, ic: "i-book" },
  { nome: "Semana 2", de: 8, ate: 14, ic: "i-book" },
  { nome: "Semana 3", de: 15, ate: 21, ic: "i-rev" },
  { nome: "Reta final", de: 22, ate: 30, ic: "i-clip" },
];

let cfg, dias, total;

const ic = (id) => `<svg aria-hidden="true"><use href="#${id}"/></svg>`;
const area = (a) => (a ? `<span class="area" style="--c:var(${AREAS[a] || "--rev"})">${a}</span>` : "");
const perfil = () => store.get("perfil", null);
const feitos = () => store.get("feitos", {});
const pronta = (n) => (cfg.prontas || []).includes(n);
const cronograma = () => {
  const p = perfil();
  return p ? montarCronograma(total, p.inicio, p.dias, cfg.prova) : null;
};
const proxima = () => {
  const f = feitos();
  for (let n = 1; n <= total; n++) if (!f[n]) return n;
  return null;
};
const duracao = (d) => (d.area === "SIM" ? "3 horas" : d.area === "REV" && !d.area2 ? "Cerca de 2h" : "Cerca de 2h30");

function topo() {
  window.scrollTo({ top: 0 });
}

function marcarAba(aba) {
  document.querySelectorAll(".tab").forEach((t) => t.setAttribute("aria-current", t.dataset.aba === aba ? "page" : "false"));
}

function prazo() {
  const f = diasEntre(hojeISO(), cfg.prova);
  const data = formatar(cfg.prova, { ano: true }).split(", ")[1];
  if (f > 1) return `Prova em ${data}. Faltam ${f} dias.`;
  if (f === 1) return `Prova amanhã, ${data}. Descanse e confie no que estudou.`;
  if (f === 0) return `A prova é hoje. Boa prova!`;
  return `A prova foi em ${data}.`;
}

// ---------- Montar meu plano ----------
function telaPlano({ primeira }) {
  marcarAba(primeira ? "hoje" : "cronograma");
  const p = perfil() || { nome: "", inicio: hojeISO(), dias: [1, 2, 3, 4, 5] };
  const maxInicio = somarDias(cfg.prova, -1);
  app.innerHTML = `
    <div class="saud"><h1>${primeira ? "Vamos montar seu plano" : "Mudar meu plano"}</h1>
      <p>${primeira ? "Leva um minuto. Você pode mudar depois." : "As aulas que você já fez continuam marcadas."}</p></div>
    <form id="form-plano" class="cartao" style="margin-top:18px" novalidate>
      <label class="campo"><span>Como você quer ser chamada?</span>
        <input type="text" name="nome" maxlength="40" autocomplete="given-name" placeholder="Seu primeiro nome" value="${escapar(p.nome || "")}"></label>
      <label class="campo"><span>Quando você começa?</span>
        <input type="date" name="inicio" required max="${maxInicio}" value="${p.inicio}"></label>
      <fieldset class="campo" style="border:0;padding:0;margin:0"><legend style="padding:0;margin-bottom:8px;font-weight:600;color:var(--titulo)">Em quais dias da semana você estuda?</legend>
        <div class="semana">${NOMES_SEMANA.map((d, i) => `<label><input type="checkbox" name="dias" value="${i}" ${p.dias.includes(i) ? "checked" : ""}>${d}</label>`).join("")}</div>
      </fieldset>
      <div id="previa" class="aviso" aria-live="polite"></div>
      <button class="btn prim" type="submit">Salvar meu plano</button>
      ${primeira ? "" : `<a class="btn link" href="#cronograma">Cancelar</a>`}
      <p class="muted">Seu progresso fica salvo neste aparelho. Por enquanto, estude sempre no mesmo celular ou computador.</p>
    </form>`;
  const form = app.querySelector("#form-plano");
  const ler = () => ({
    nome: form.nome.value.trim(),
    inicio: form.inicio.value,
    dias: [...form.querySelectorAll("input[name=dias]:checked")].map((i) => +i.value),
  });
  const previa = () => {
    const v = ler();
    const el = app.querySelector("#previa");
    const c = v.inicio ? montarCronograma(total, v.inicio, v.dias, cfg.prova) : null;
    const botao = form.querySelector("button[type=submit]");
    botao.disabled = !c;
    el.classList.toggle("alerta", !c || c.apertado);
    if (!v.dias.length) return (el.textContent = "Escolha pelo menos um dia da semana.");
    if (!c) return (el.textContent = "Escolha uma data de início antes da prova.");
    const inicio = `Sua primeira aula é ${formatar(c.porAula[1])} e a última, ${formatar(c.ultima)}.`;
    el.textContent = c.apertado
      ? `${inicio} Com esses dias, algumas datas ficam com até ${c.maxPorDia} aulas. Se puder, marque mais dias ou comece antes.`
      : c.sobra
        ? `${inicio} Sobram ${c.sobra} dias de estudo para revisar antes da prova.`
        : `${inicio} O plano termina na véspera da prova.`;
  };
  form.addEventListener("input", previa);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = ler();
    if (!montarCronograma(total, v.inicio, v.dias, cfg.prova)) return previa();
    store.set("perfil", v);
    location.hash = primeira ? "#hoje" : "#cronograma";
  });
  previa();
  topo();
}

// ---------- Hoje ----------
function telaHoje() {
  marcarAba("hoje");
  const p = perfil();
  const c = cronograma();
  const f = feitos();
  const n = proxima();
  const hoje = hojeISO();
  const feitas = Object.values(f).filter(Boolean).length;
  const nErros = contarErros(store);

  const etapas = ETAPAS.map((e) => {
    let st = "prox";
    let todas = true;
    for (let d = e.de; d <= e.ate; d++) if (!f[d]) todas = false;
    if (todas) st = "feito";
    else if (n && n >= e.de && n <= e.ate) st = "agora";
    return `<div class="etapa ${st === "prox" ? "prox" : ""}">${ic(e.ic).replace("<svg", '<svg class="ic"')}<span class="dot ${st}">${st === "feito" ? ic("i-check") : ""}</span><small>${e.nome}</small></div>`;
  }).join("") + `<div class="etapa prox">${ic("i-flag").replace("<svg", '<svg class="ic"')}<span class="dot prox"></span><small>Prova</small></div>`;

  let cartao;
  if (!n) {
    cartao = `<span class="label">Plano concluído</span>
      <div class="cartao"><h2>Você fechou as ${total} aulas.</h2>
      <p>Até a prova, revise as questões de “Meus erros” e os resumos de 1 minuto de cada aula.</p>
      <a class="btn prim" href="#erros">Revisar meus erros</a></div>`;
  } else {
    const d = dias[n];
    const data = c.porAula[n];
    let quando;
    if (data < hoje) quando = `Estava marcada para ${formatar(data)}. Sem problema: siga daqui.`;
    else if (data === hoje) quando = `Marcada para hoje, ${formatar(data)}.`;
    else if (hoje < p.inicio) quando = `Seu plano começa ${formatar(p.inicio)}. Esta aula está marcada para ${formatar(data)}.`;
    else quando = `Hoje é folga no seu plano. Esta aula está marcada para ${formatar(data)}.`;
    const botao = pronta(n)
      ? `<a class="btn prim" href="#aula-${n}">${data > hoje ? "Adiantar a aula" : "Começar a aula de hoje"}</a>`
      : `<p class="aviso">Esta aula está sendo preparada e chega antes da data marcada.</p><a class="btn sec" href="#cronograma">Ver o cronograma</a>`;
    cartao = `<span class="label">Hoje · Dia ${n} de ${total}</span>
      <div class="cartao"><span class="tag">${duracao(d)}</span>
        <h2>${area(d.area)}${escapar(d.tema)}</h2>
        ${d.tema2 ? `<p>${area(d.area2)}${escapar(d.tema2)}</p>` : ""}
        <p class="muted">${quando}</p>
        ${botao}</div>`;
  }

  app.innerHTML = `
    <div class="saud"><h1>Olá${p.nome ? ", " + escapar(p.nome) : ""}!</h1><p>${prazo()}</p></div>
    <span class="label">Acompanhe seu preparo</span>
    <div class="etapas">${etapas}</div>
    ${cartao}
    ${c.apertado ? `<p class="aviso alerta" style="margin-top:12px">Seu plano tem datas com até ${c.maxPorDia} aulas. <a href="#plano">Mudar meus dias</a></p>` : ""}
    <span class="label">Seu progresso</span>
    <div class="cartao"><p><b>${feitas} de ${total}</b> aulas feitas</p><div class="barra"><i style="width:${(100 * feitas) / total}%"></i></div></div>
    <div class="acoes" style="margin-top:12px">
      <button class="acao coral" data-ir="#erros">${ic("i-err")}<b>Meus erros</b><span>${nErros ? `${nErros} ${nErros === 1 ? "questão" : "questões"} para revisar` : "Nenhuma questão guardada"}</span></button>
      <button class="acao verde" data-ir="#cronograma">${ic("i-cal")}<b>Cronograma</b><span>Todas as aulas com as suas datas</span></button>
    </div>`;
  app.querySelectorAll("[data-ir]").forEach((b) => b.addEventListener("click", () => (location.hash = b.dataset.ir)));
  topo();
}

// ---------- Cronograma ----------
function telaCronograma() {
  marcarAba("cronograma");
  const p = perfil();
  const c = cronograma();
  const f = feitos();
  const n = proxima();
  const feitas = Object.values(f).filter(Boolean).length;
  const diasTxt = p.dias.map((i) => NOMES_SEMANA[i].toLowerCase()).join(", ");
  app.innerHTML = `
    <div class="saud"><h1>Seu cronograma</h1><p>${feitas} de ${total} aulas feitas · começa ${formatar(p.inicio)} · estuda ${diasTxt}</p></div>
    <div style="margin-top:14px"><a class="btn sec" href="#plano">Mudar data de início ou dias</a></div>
    ${cfg.plano
      .map(
        (s) => `<div class="sem"><h3>${escapar(s.semana)}</h3>${s.dias
          .map(
            (d) => `<div class="linha ${f[d.dia] ? "feito" : ""} ${d.dia === n ? "hoje" : ""}">
          <input type="checkbox" data-feito="${d.dia}" ${f[d.dia] ? "checked" : ""} aria-label="Dia ${d.dia} feito">
          <div><div class="q1">Dia ${d.dia} · <b>${formatar(c.porAula[d.dia])}</b>${d.dia === n ? " · próxima" : ""}</div>
          <div class="t">${area(d.area)}${escapar(d.tema)}${d.tema2 ? `<small>${area(d.area2)}${escapar(d.tema2)}</small>` : ""}</div>
          ${pronta(d.dia) ? `<a class="ir" href="#aula-${d.dia}">Abrir a aula →</a>` : `<span class="breve">Chega antes da data marcada</span>`}</div></div>`
          )
          .join("")}</div>`
      )
      .join("")}`;
  app.addEventListener("change", aoMarcar);
  topo();
}

function aoMarcar(e) {
  const d = e.target.dataset.feito;
  if (!d) return;
  const f = feitos();
  f[d] = e.target.checked;
  store.set("feitos", f);
  app.removeEventListener("change", aoMarcar);
  telaCronograma();
}

// ---------- Aula ----------
async function telaAula(n) {
  marcarAba("aula");
  const d = dias[n];
  if (!d) return (location.hash = "#hoje");
  store.set("ultimaAula", n);
  const nav = `<div class="navaula">
      <button data-ir="#aula-${n - 1}" ${n <= 1 ? "disabled" : ""}>← Dia ${Math.max(1, n - 1)}</button>
      <button data-ir="#aula-${n + 1}" ${n >= total ? "disabled" : ""}>Dia ${Math.min(total, n + 1)} →</button></div>`;
  app.innerHTML = `${nav}<div id="aula"><p class="muted">Abrindo a aula…</p></div><div id="fim"></div>`;
  app.querySelectorAll("[data-ir]").forEach((b) => b.addEventListener("click", () => (location.hash = b.dataset.ir)));
  topo();
  const caixa = app.querySelector("#aula");
  if (!pronta(n)) {
    const c = cronograma();
    caixa.innerHTML = `<div class="cartao"><span class="label" style="margin:0">Dia ${n} · ${formatar(c.porAula[n])}</span>
      <h2>${area(d.area)}${escapar(d.tema)}</h2>${d.tema2 ? `<p>${area(d.area2)}${escapar(d.tema2)}</p>` : ""}
      <p class="aviso">Esta aula está sendo preparada e chega antes da data marcada.</p></div>`;
    return;
  }
  try {
    const aula = await carregarAula(cfg, n);
    if (location.hash !== `#aula-${n}`) return;
    montarAula(caixa, aula, store);
  } catch (err) {
    caixa.innerHTML = `<div class="cartao"><p>Não conseguimos abrir a aula. Confira a internet e tente de novo.</p>
      <button class="btn prim" id="tentar">Tentar de novo</button></div>`;
    caixa.querySelector("#tentar").addEventListener("click", () => telaAula(n));
    console.error(err);
    return;
  }
  desenharFim(n);
}

function desenharFim(n) {
  const fim = app.querySelector("#fim");
  if (!fim) return;
  const feita = !!feitos()[n];
  fim.innerHTML = feita
    ? `<div class="fim-aula"><p class="aviso">✓ Aula do Dia ${n} concluída.</p>
        <a class="btn prim" href="#hoje">Voltar para Hoje</a>
        <button class="btn link" id="desfazer">Desmarcar esta aula</button></div>`
    : `<div class="fim-aula"><button class="btn prim" id="concluir">Concluir a aula do Dia ${n}</button></div>`;
  fim.querySelector("#concluir")?.addEventListener("click", () => {
    const f = feitos();
    f[n] = true;
    store.set("feitos", f);
    location.hash = "#hoje";
  });
  fim.querySelector("#desfazer")?.addEventListener("click", () => {
    const f = feitos();
    delete f[n];
    store.set("feitos", f);
    desenharFim(n);
  });
}

// ---------- Meus erros ----------
function telaErros() {
  marcarAba("hoje");
  app.innerHTML = `
    <div class="saud"><h1>Meus erros</h1><p>Revise antes de cada revisão e de cada simulado. Quando dominar, tire da lista.</p></div>
    <div id="errs" style="margin-top:14px"></div>
    <a class="btn sec" href="#hoje" style="margin-top:12px">Voltar para Hoje</a>`;
  montarErros(app.querySelector("#errs"), store);
  topo();
}

// ---------- Rotas ----------
function rota() {
  app.removeEventListener("change", aoMarcar);
  const h = location.hash || "#hoje";
  if (!perfil()) return telaPlano({ primeira: true });
  if (h === "#plano") return telaPlano({ primeira: false });
  if (h === "#cronograma") return telaCronograma();
  if (h === "#erros") return telaErros();
  const m = /^#aula-(\d+)$/.exec(h);
  if (m) return telaAula(+m[1]);
  if (h === "#aula") return telaAula(proxima() || store.get("ultimaAula", 1));
  return telaHoje();
}

async function iniciar() {
  try {
    const r = await fetch(`/aberto/${ID}/concurso.json`);
    cfg = await r.json();
  } catch (e) {
    app.innerHTML = `<div class="cartao" style="margin-top:18px"><p>Não conseguimos abrir o curso. Confira a internet e recarregue a página.</p></div>`;
    return;
  }
  dias = {};
  cfg.plano.forEach((s) => s.dias.forEach((d) => (dias[d.dia] = d)));
  total = Object.keys(dias).length;
  document.querySelector(".topbar .nome").textContent = cfg.nomeCurto;
  document.querySelectorAll(".tab").forEach((t) =>
    t.addEventListener("click", () => {
      location.hash = t.dataset.aba === "aula" ? "#aula" : "#" + t.dataset.aba;
    })
  );
  addEventListener("hashchange", rota);
  rota();
}

iniciar();
