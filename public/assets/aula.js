// Monta uma aula da Renata (dia-NN.html + dia-NN.json) e liga as partes interativas:
// roteiro do dia, "pare e responda", flashcards, vídeos, quiz e caderno de erros.
// Portado do caderno de Louveira, com o progresso guardado por concurso.

const L = "ABCDE";

/** Guarda valores no navegador com um prefixo por concurso. */
export function criarStore(prefixo) {
  return {
    get(k, d) {
      try {
        const v = localStorage.getItem(prefixo + k);
        return v ? JSON.parse(v) : d;
      } catch {
        return d;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem(prefixo + k, JSON.stringify(v));
      } catch {}
    },
  };
}

export function caminhoDaAula(cfg, n) {
  const nn = String(n).padStart(2, "0");
  const base = (cfg.abertas || []).includes(n) ? `/aberto/${cfg.id}` : `/curso/conteudo/${cfg.id}`;
  return { html: `${base}/dia-${nn}.html`, json: `${base}/dia-${nn}.json` };
}

export async function carregarAula(cfg, n) {
  const c = caminhoDaAula(cfg, n);
  const [rh, rj] = await Promise.all([fetch(c.html), fetch(c.json)]);
  if (!rh.ok || !rj.ok) throw new Error(`Aula ${n} não encontrada (${rh.status}/${rj.status})`);
  return { html: await rh.text(), dados: await rj.json() };
}

export function escapar(t) {
  return String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

/**
 * Põe a aula dentro de `el` e liga a interação.
 * opts.aoResponderQuiz(acertos, total) -> HTML extra depois do resultado (ex.: chamada de venda)
 * opts.aoMudar() -> chamado quando um erro entra ou sai (para atualizar contadores)
 */
export function montarAula(el, { html, dados }, store, opts = {}) {
  const n = dados.dia;
  el.innerHTML = `<article class="day-art" data-day="${n}">${html}</article>`;
  const $ = (s) => el.querySelector(s);
  const $$ = (s) => [...el.querySelectorAll(s)];

  // Roteiro do dia
  const ul = $("ul.steps");
  if (ul) {
    const lista = dados.passos || [];
    const desenhar = () => {
      const st = store.get("passos-" + n, {});
      const k = lista.filter((_, i) => st[i]).length;
      ul.innerHTML = lista
        .map((s, i) => `<li><label><input type="checkbox" data-step="${i}" ${st[i] ? "checked" : ""}><span>${s}</span></label></li>`)
        .join("");
      const txt = $("[data-steps-txt]");
      const bar = $("[data-steps-bar]");
      if (txt) txt.textContent = `${k} de ${lista.length} etapas do dia`;
      if (bar) bar.style.width = (100 * k) / (lista.length || 1) + "%";
    };
    desenhar();
    ul.addEventListener("change", (e) => {
      const i = e.target.dataset.step;
      if (i === undefined) return;
      const st = store.get("passos-" + n, {});
      st[i] = e.target.checked;
      store.set("passos-" + n, st);
      desenhar();
    });
  }

  // Pare e responda
  const checks = dados.checks || {};
  const desenharCheck = (box) => {
    const k = box.dataset.check;
    const q = checks[k];
    if (!q) return;
    const ans = store.get("pausas", {})[k];
    box.innerHTML =
      `<div class="ttl">${q.s}</div><div class="opts">` +
      q.o
        .map((o, j) => {
          let c = "opt";
          if (ans !== undefined) {
            if (j === q.a) c += " right";
            else if (j === ans) c += " wrong";
          }
          return `<button class="${c}" data-o="${j}" ${ans !== undefined ? "disabled" : ""}><b>${L[j]}</b><span>${o}</span></button>`;
        })
        .join("") +
      `</div>` +
      (ans !== undefined ? `<div class="exp"><b>${ans === q.a ? "Isso mesmo." : "Ainda não."}</b> ${q.e}</div>` : "");
  };
  $$("[data-check]").forEach((box) => {
    desenharCheck(box);
    box.addEventListener("click", (e) => {
      const b = e.target.closest(".opt");
      if (!b || b.disabled) return;
      const a = store.get("pausas", {});
      a[box.dataset.check] = Number(b.dataset.o);
      store.set("pausas", a);
      desenharCheck(box);
    });
  });

  // Flashcards
  $$(".flash").forEach((box) => {
    const F = dados.flash || [];
    box.innerHTML = F.map(
      ([f], i) => `<button class="fc" data-i="${i}" aria-pressed="false"><small>Pergunta ${i + 1}</small><span>${f}</span></button>`
    ).join("");
    box.addEventListener("click", (e) => {
      const c = e.target.closest(".fc");
      if (!c) return;
      const i = +c.dataset.i;
      const on = c.classList.toggle("on");
      c.setAttribute("aria-pressed", on);
      c.innerHTML = `<small>${on ? "Resposta" : "Pergunta"} ${i + 1}</small><span>${F[i][on ? 1 : 0]}</span>`;
    });
  });

  // Vídeos: YouTube abre dentro da aula; os demais abrem em outra aba
  $$(".video").forEach((v) => {
    const play = v.querySelector(".play");
    if (!play) return;
    play.addEventListener("click", () => {
      if (v.dataset.yt) {
        if (v.querySelector(".frame")) return;
        const f = document.createElement("div");
        f.className = "frame";
        f.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(v.dataset.yt)}?autoplay=1&rel=0" title="Vídeo da aula" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
        v.querySelector(".vh").after(f);
      } else {
        const url = v.dataset.link || v.querySelector("a[href]")?.href;
        if (url) window.open(url, "_blank", "noopener");
      }
    });
  });

  // Quiz
  const box = $("[data-quiz]");
  if (box) {
    const qs = dados.quiz || [];
    const chave = "quiz-" + n;
    const desenharQuiz = () => {
      const ans = store.get(chave, {});
      box.querySelector("[data-questions]").innerHTML = qs
        .map((q, i) => {
          const a = ans[i];
          return (
            `<div class="q"><div class="stem">${i + 1}. ${q.s}</div><div class="opts">` +
            q.o
              .map((o, j) => {
                let c = "opt";
                if (a !== undefined) {
                  if (j === q.a) c += " right";
                  else if (j === a) c += " wrong";
                }
                return `<button class="${c}" data-q="${i}" data-o="${j}" ${a !== undefined ? "disabled" : ""}><b>(${L[j]})</b><span>${o}</span></button>`;
              })
              .join("") +
            `</div>${a !== undefined ? `<div class="exp"><b>${a === q.a ? "Certo." : "Errado. Gabarito: " + L[q.a] + "."}</b> ${q.e}</div>` : ""}</div>`
          );
        })
        .join("");
      const resp = Object.keys(ans).length;
      const ac = Object.entries(ans).filter(([i, a]) => qs[i] && qs[i].a === a).length;
      box.querySelector("[data-score]").innerHTML = resp
        ? `${ac} de ${resp} certas<button class="small-btn" data-reset>Refazer o quiz</button>`
        : "";
      let res = "";
      if (resp === qs.length && qs.length) {
        const meta = Math.ceil(qs.length * 0.7);
        res =
          ac >= meta
            ? `<div class="result good"><b>${ac} de ${qs.length}. Meta batida.</b> ${opts.textoMeta || "Agora toque em “Concluir a aula”, no fim da página."}</div>`
            : `<div class="result low"><b>${ac} de ${qs.length}. Abaixo da meta de ${meta}.</b> Releia os trechos das questões que errou, revise os flashcards e refaça o quiz.</div>`;
        if (opts.aoResponderQuiz) res += opts.aoResponderQuiz(ac, qs.length);
      }
      box.querySelector("[data-result]").innerHTML = res;
    };
    desenharQuiz();
    box.addEventListener("click", (e) => {
      if (e.target.closest("[data-reset]")) {
        store.set(chave, {});
        desenharQuiz();
        return;
      }
      const b = e.target.closest(".opt");
      if (!b || b.disabled) return;
      const i = Number(b.dataset.q);
      const o = Number(b.dataset.o);
      const ans = store.get(chave, {});
      ans[i] = o;
      store.set(chave, ans);
      const q = qs[i];
      if (o !== q.a) {
        const w = store.get("erros", {});
        w[`${n}-${i}`] = { n, i, o, q, titulo: dados.titulo };
        store.set("erros", w);
        opts.aoMudar && opts.aoMudar();
      }
      desenharQuiz();
    });
  }

  // O caderno de erros por aula fica na tela "Meus erros" do app.
  $$("#errs").forEach((e) => e.closest(".part, article.card")?.remove());
}

export function contarErros(store) {
  return Object.keys(store.get("erros", {})).length;
}

/** Lista de erros guardados, com botão para tirar da lista. */
export function montarErros(el, store, aoMudar) {
  const desenhar = () => {
    const w = Object.entries(store.get("erros", {}))
      .map(([k, v]) => ({ k, ...v }))
      .sort((a, b) => a.n - b.n || a.i - b.i);
    el.innerHTML = w.length
      ? w
          .map(
            ({ k, n, i, o, q, titulo }) => `<div class="err"><div class="from">Dia ${n} · ${escapar(titulo || "")} · questão ${i + 1}</div>
      <div class="q" style="margin:6px 0"><div class="stem">${q.s}</div></div>
      <p style="margin:4px 0">Você marcou <b>(${L[o]})</b>. Gabarito: <b>(${L[q.a]}) ${q.o[q.a]}</b></p><div class="exp">${q.e}</div>
      <p style="margin:8px 0 0"><button class="small-btn" style="margin:0" data-done="${k}">Revisada, tirar da lista</button></p></div>`
          )
          .join("")
      : `<p class="empty">Nenhum erro guardado. Quando você errar uma questão do quiz, ela aparece aqui com o comentário.</p>`;
  };
  el.onclick = (e) => {
    const b = e.target.closest("[data-done]");
    if (!b) return;
    const w = store.get("erros", {});
    delete w[b.dataset.done];
    store.set("erros", w);
    desenhar();
    aoMudar && aoMudar();
  };
  desenhar();
}
