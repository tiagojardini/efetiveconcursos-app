// Direciona cada pedido pelo endereço (decisão de 25/11, repo concurso:
// estrategia/docs/2026-11-25-decisao-enderecos-site.md).
//
//   efetiveconcursos.com.br         institucional, aulas grátis (/louveira), /privacidade, /termos
//   curso.efetiveconcursos.com.br   o curso; o host inteiro fica atrás do Cloudflare Access
//   www.efetiveconcursos.com.br     vai para a raiz
//
// O cadeado é o Access, não este arquivo. Aqui só arrumamos os endereços e
// fechamos o *.pages.dev, que serviria /curso/ sem login.

export const RAIZ = "efetiveconcursos.com.br";
export const CURSO = "curso." + RAIZ;

// No host do curso, estes caminhos são servidos como estão (o app busca
// /curso/conteudo/..., /aberto/..., /assets/... e /marca/...).
const PASSAM_NO_CURSO = ["/curso/", "/assets/", "/marca/", "/aberto/"];

const ehCurso = (p) => p === "/curso" || p.startsWith("/curso/");
const local = (h) => h === "localhost" || h === "127.0.0.1";

/** Decide o que fazer com uma URL. Função pura, testada em tests/rotas.test.js. */
export function rotear(url) {
  const u = new URL(url);
  const host = u.hostname;
  const p = u.pathname;
  const resto = p + u.search;

  if (host === "www." + RAIZ) return { tipo: "redirecionar", para: `https://${RAIZ}${resto}`, status: 301 };

  if (host === CURSO) {
    if (p === "/") return { tipo: "reescrever", caminho: "/curso/", noindex: true };
    if (p === "/curso" || p === "/curso/" || p === "/curso/index.html") {
      return { tipo: "redirecionar", para: `https://${CURSO}/${u.search}`, status: 301 };
    }
    if (PASSAM_NO_CURSO.some((x) => p.startsWith(x))) return { tipo: "seguir", noindex: true };
    return { tipo: "redirecionar", para: `https://${RAIZ}${resto}`, status: 302 };
  }

  // Raiz, *.pages.dev e qualquer outro host: o curso mora em curso.
  // Em localhost (npm run dev) tudo segue como está, para testar.
  if (ehCurso(p) && !local(host)) {
    const destino = p === "/curso" || p === "/curso/" || p === "/curso/index.html" ? "/" + u.search : resto;
    return { tipo: "redirecionar", para: `https://${CURSO}${destino}`, status: 301 };
  }
  return { tipo: "seguir" };
}

export async function onRequest({ request, next, env }) {
  const r = rotear(request.url);
  if (r.tipo === "redirecionar") return Response.redirect(r.para, r.status);

  let resp = r.tipo === "reescrever"
    ? await env.ASSETS.fetch(new URL(r.caminho, request.url))
    : await next();

  if (r.noindex) {
    resp = new Response(resp.body, resp);
    resp.headers.set("X-Robots-Tag", "noindex");
  }
  return resp;
}
