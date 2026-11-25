import { test } from "node:test";
import assert from "node:assert/strict";
import { rotear } from "../functions/_middleware.js";

const R = "https://efetiveconcursos.com.br";
const C = "https://curso.efetiveconcursos.com.br";

test("raiz serve institucional, aula grátis e páginas legais", () => {
  for (const p of ["/", "/louveira/", "/privacidade/", "/termos/", "/assets/app.css", "/aberto/louveira-professor-2027/concurso.json"]) {
    assert.deepEqual(rotear(R + p), { tipo: "seguir" }, p);
  }
});

test("raiz manda /curso para o subdomínio", () => {
  assert.deepEqual(rotear(R + "/curso"), { tipo: "redirecionar", para: C + "/", status: 301 });
  assert.deepEqual(rotear(R + "/curso/"), { tipo: "redirecionar", para: C + "/", status: 301 });
  const conteudo = "/curso/conteudo/louveira-professor-2027/dia-02.html";
  assert.deepEqual(rotear(R + conteudo), { tipo: "redirecionar", para: C + conteudo, status: 301 });
});

test("/cursos não é confundido com /curso", () => {
  assert.equal(rotear(R + "/cursos").tipo, "seguir");
});

test("www vai para a raiz, mantendo o caminho", () => {
  assert.deepEqual(rotear("https://www.efetiveconcursos.com.br/louveira/?utm_source=ig"),
    { tipo: "redirecionar", para: R + "/louveira/?utm_source=ig", status: 301 });
});

test("curso. abre o app na raiz do host, sem indexar", () => {
  assert.deepEqual(rotear(C + "/"), { tipo: "reescrever", caminho: "/curso/", noindex: true });
  assert.equal(rotear(C + "/curso/").para, C + "/");
});

test("curso. serve o que o app busca", () => {
  for (const p of ["/curso/conteudo/louveira-professor-2027/dia-02.json", "/assets/app.js", "/marca/favicon.svg", "/aberto/louveira-professor-2027/concurso.json"]) {
    assert.deepEqual(rotear(C + p), { tipo: "seguir", noindex: true }, p);
  }
});

test("curso. manda páginas públicas para a raiz", () => {
  assert.deepEqual(rotear(C + "/louveira/"), { tipo: "redirecionar", para: R + "/louveira/", status: 302 });
  assert.equal(rotear(C + "/privacidade/").para, R + "/privacidade/");
});

test("*.pages.dev não serve o curso sem login", () => {
  const r = rotear("https://efetiveconcursos.pages.dev/curso/conteudo/louveira-professor-2027/dia-02.html");
  assert.equal(r.tipo, "redirecionar");
  assert.ok(r.para.startsWith(C));
  assert.equal(rotear("https://abc123.efetiveconcursos.pages.dev/curso/").para, C + "/");
});

test("localhost segue como está, para testar", () => {
  assert.deepEqual(rotear("http://127.0.0.1:8788/curso/"), { tipo: "seguir" });
  assert.deepEqual(rotear("http://localhost:8788/curso/conteudo/x.html"), { tipo: "seguir" });
});
