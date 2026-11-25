"""Extrai as aulas da Renata (HTML gerado no Claude) para o formato do app.

Uso:
    python -I tools/extrair_caderno.py louveira-professor-2027 ARQUIVO.html [ARQUIVO2.html ...] --abertas 1

Aceita os dois formatos que a Renata usa:
  - caderno completo (várias aulas + constante PLAN), ex.: o caderno de Louveira;
  - uma aula por arquivo (constante N), ex.: louveira-aula-2.html da pasta do Drive.
O plano (campo "plano" do concurso.json) só é atualizado a partir de um caderno completo.

Para cada <article class="card day-art" id="dia-N"> gera:
  - dia-NN.html: o texto da aula, como a Renata escreveu (sem o box "Versão Premium");
  - dia-NN.json: passos, flashcards, quiz e "pare e responda" do dia.
Aulas abertas (amostra grátis) vão para public/aberto/<id>/.
As demais vão para public/curso/conteudo/<id>/, atrás do Cloudflare Access.

Nada dos arquivos é executado: as constantes JS são lidas como texto e convertidas em JSON.
"""
import argparse
import json
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent


def literal(js, nome):
    """Texto do literal atribuído a NOME (em `const NOME=` ou `, NOME=`), ou None."""
    m = re.search(r"(?:const\s+|,)\s*" + nome + r"\s*=\s*", js)
    if not m:
        return None
    i = m.end()
    abre = js[i]
    if abre == '"':
        return re.match(r'"(?:[^"\\]|\\.)*"', js[i:]).group(0)
    if abre not in "{[":
        return re.match(r"[^,;\n]+", js[i:]).group(0).strip()
    nivel, j, em_str = 0, i, None
    while j < len(js):
        c = js[j]
        if em_str:
            if c == "\\":
                j += 2
                continue
            if c == em_str:
                em_str = None
        elif c in "\"'":
            em_str = c
        elif c in "{[":
            nivel += 1
        elif c in "}]":
            nivel -= 1
            if nivel == 0:
                return js[i : j + 1]
        j += 1
    raise SystemExit(f"literal de {nome} não fecha")


def js_para_json(txt):
    """Põe aspas nas chaves sem aspas (c1:, 1:) fora das strings e lê como JSON."""
    out, i, em_str = [], 0, False
    while i < len(txt):
        c = txt[i]
        if em_str:
            out.append(c)
            if c == "\\":
                out.append(txt[i + 1])
                i += 2
                continue
            if c == '"':
                em_str = False
            i += 1
            continue
        if c == '"':
            em_str = True
            out.append(c)
            i += 1
            continue
        m = re.match(r"([A-Za-z_][A-Za-z0-9_]*|\d+)\s*:", txt[i:])
        if m and re.search(r"[{,]\s*$", "".join(out[-3:])):
            out.append('"' + m.group(1) + '":')
            i += m.end()
            continue
        out.append(c)
        i += 1
    return json.loads("".join(out))


def ler(html, nome, padrao=None):
    txt = literal(html, nome)
    return padrao if txt is None else js_para_json(txt)


def script_das_aulas(html):
    """O bloco <script> que define STEPS (ignora scripts da moldura do Claude)."""
    for bloco in re.findall(r"<script>(.*?)</script>", html, re.S):
        if re.search(r"(?:const\s+|,)\s*STEPS\s*=", bloco):
            return bloco
    raise SystemExit("nenhum <script> com STEPS encontrado")


def extrair(html, cfg, abertas, aberto, fechado):
    js = script_das_aulas(html)
    n_unico = ler(js, "N")
    plan = ler(js, "PLAN")
    if n_unico is None and plan is None:
        raise SystemExit("formato não reconhecido: sem PLAN (caderno) nem N (aula avulsa)")
    titles = ler(js, "TITLES", {})
    steps = ler(js, "STEPS", {})
    checks = ler(js, "CHECKS", {})
    flash = ler(js, "FLASH", {})
    quiz = ler(js, "QUIZ", {})
    if n_unico is not None:
        # aula avulsa: as listas já são do próprio dia
        k = str(n_unico)
        fonte = ler(js, "SOURCE", "")
        titles = {k: re.sub(r"^Dia \d+ · ", "", fonte) if fonte else f"Dia {k}"}
        steps, flash, quiz = {k: steps}, {k: flash}, {k: quiz}

    artigos = re.findall(r'<article class="card day-art" id="dia-(\d+)"[^>]*>(.*?)</article>', html, re.S)
    if not artigos:
        raise SystemExit("nenhuma aula (article.day-art) encontrada")

    prontas = set()
    for n_txt, corpo in artigos:
        n = int(n_txt)
        # Premium é Fase 2: não prometer na aula enquanto não estiver à venda.
        corpo = re.sub(r"\s*<div><b>Versão Premium</b>.*?</p></div>", "", corpo, flags=re.S)
        destino = aberto if n in abertas else fechado
        nn = f"dia-{n:02d}"
        (destino / f"{nn}.html").write_text(corpo.strip() + "\n", encoding="utf-8")
        dados = {
            "dia": n,
            "titulo": titles.get(str(n), f"Dia {n}"),
            "passos": steps.get(str(n), []),
            "flash": flash.get(str(n), []),
            "quiz": quiz.get(str(n), []),
            "checks": {k: checks[k] for k in re.findall(r'data-check="(\w+)"', corpo) if k in checks},
        }
        (destino / f"{nn}.json").write_text(json.dumps(dados, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        prontas.add(n)
        onde = "aberta" if n in abertas else "curso"
        print(f"{nn}: {onde} · {len(dados['quiz'])} questões · {len(dados['flash'])} flashcards · {len(dados['checks'])} pausas")

    if plan is not None:
        cfg["plano"] = [
            {"semana": semana, "dias": [
                {"dia": d[0], "area": d[1], "tema": d[2], "area2": d[3] or None, "tema2": d[4] or None}
                for d in dias
            ]}
            for semana, dias in plan
        ]
    return prontas


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("concurso", help="identificador, ex.: louveira-professor-2027")
    ap.add_argument("arquivos", nargs="+")
    ap.add_argument("--abertas", default="1", help="dias abertos, ex.: 1 ou 1,2")
    a = ap.parse_args()

    abertas = {int(x) for x in a.abertas.split(",") if x.strip()}
    aberto = RAIZ / "public" / "aberto" / a.concurso
    fechado = RAIZ / "public" / "curso" / "conteudo" / a.concurso
    aberto.mkdir(parents=True, exist_ok=True)
    fechado.mkdir(parents=True, exist_ok=True)
    cfg_path = aberto / "concurso.json"
    cfg = json.loads(cfg_path.read_text(encoding="utf-8")) if cfg_path.exists() else {}
    prontas = set(cfg.get("prontas", []))
    for arq in a.arquivos:
        prontas |= extrair(Path(arq).read_text(encoding="utf-8"), cfg, abertas, aberto, fechado)
    cfg["prontas"] = sorted(prontas)
    cfg["abertas"] = sorted(abertas)
    cfg_path.write_text(json.dumps(cfg, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    total = sum(len(s["dias"]) for s in cfg.get("plano", []))
    print(f"concurso.json: {total} dias no plano, prontas {cfg['prontas']}")


if __name__ == "__main__":
    sys.exit(main())
