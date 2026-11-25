# Efetive Concursos · app da aluna

Site da Efetive Concursos: o institucional, a aula grátis de cada concurso e o curso com 3 telas (Hoje, Cronograma e Aula).
As decisões de produto estão no repo `concurso`, em `estrategia/docs/`. As principais são a decisão de plataforma de 24/11, o corte de 25/11 e a decisão de endereços de 25/11.

## O que já funciona

| Endereço | O que é | Quem vê |
|---|---|---|
| `efetiveconcursos.com.br` | Institucional: o que é a Efetive, concursos abertos, "Entrar no curso" | Qualquer pessoa |
| `efetiveconcursos.com.br/louveira/` | Aula 1 completa, chamada "Quero o curso", botão de dúvida e a pergunta "O que falta para você fazer o curso completo?" no fim do quiz | Qualquer pessoa |
| `efetiveconcursos.com.br/privacidade/` e `/termos/` | Rascunhos, revisar antes do anúncio | Qualquer pessoa |
| `curso.efetiveconcursos.com.br` | Montar o plano (data de início + dias da semana), Hoje, Cronograma, Aula e Meus erros | Só alunas liberadas no Cloudflare Access |
| `www.` | Vai para a raiz | — |

Quem decide o endereço é [functions/_middleware.js](functions/_middleware.js), testado em `tests/rotas.test.js`:
- No host `curso.`, `/` mostra o app (`public/curso/`).
- Na raiz e no `*.pages.dev`, `/curso/...` vai para o `curso.`. Assim, o endereço automático da Cloudflare não serve aula paga sem login.
- Em `localhost`, tudo segue como está.

O antigo `/aula-gratis/` leva para `/louveira/`.

- O cronograma é recalculado no navegador: 30 aulas distribuídas nos dias escolhidos, até a véspera da prova. Se não couber, as aulas se juntam em alguns dias e a tela avisa.
- O progresso fica no navegador (`localStorage`). **Sincronizar PC e celular ficou para depois** (corte de 25/11).
- Aulas prontas hoje: Dias 1 a 3. As outras aparecem como "chega antes da data marcada".

## Como rodar no computador

```bash
npm run dev:estatico        # serve a pasta public em http://127.0.0.1:8788
npm test                    # testes do cálculo do cronograma
npm run teste:navegador     # abre o Chrome headless, faz o fluxo inteiro e tira prints em .teste-navegador/
```

Abra `http://127.0.0.1:8788/`, `/louveira/` e `/curso/`. O `dev:estatico` não roda o `_middleware.js` nem o `_redirects`. Para isso, use `npm run dev` (wrangler).

## Como entra uma aula nova

A Renata salva cada aula como `louveira-aula-N.html` na pasta do Google Drive do projeto.

1. Baixe o arquivo para `.fonte/drive/` (a pasta fica fora do git).
2. Rode:
   ```bash
   python -I tools/extrair_caderno.py louveira-professor-2027 .fonte/drive/louveira-aula-4.html --abertas 1
   ```
3. Confira em `/curso/#aula-4` e faça o deploy.

O extrator lê os dois formatos que a Renata usa (uma aula por arquivo, ou o caderno completo com várias aulas). Ele só lê as constantes como texto; nada do arquivo é executado. Ele também remove o box "Versão Premium", que é Fase 2.

> **Atenção:** a Aula 1 que está no Drive (`Loveira_Aula1.html`, conferida em 23/11) é **mais antiga** que a do caderno publicado (conferida em 24/11). A versão no app veio do caderno. Pedir à Renata para salvar a Aula 1 atualizada no Drive.

## Estrutura

```
public/
  index.html                      institucional
  louveira/index.html             aula grátis de Louveira (Campinas vira /campinas/)
  privacidade/, termos/           páginas legais (rascunho)
  curso/index.html                o app (3 telas)
  curso/conteudo/<concurso>/      aulas pagas: dia-NN.html (texto) + dia-NN.json (quiz, flashcards, roteiro)
  aberto/<concurso>/              concurso.json (plano, datas, links de venda) + aulas abertas
  aberto/empresa.json             razão social, CNPJ, e-mail e WhatsApp (linha vazia não aparece)
  assets/empresa.js               preenche o rodapé das páginas públicas com o empresa.json
  assets/app.js                   telas e rotas
  assets/aula.js                  monta uma aula e liga quiz, flashcards, vídeos e erros
  assets/cronograma.js            cálculo das datas (testado em tests/)
  assets/app.css                  marca v0.5: verde, coral, Figtree
functions/_middleware.js          direciona pelo endereço (raiz, curso., www.)
tools/extrair_caderno.py          converte o HTML da Renata para o formato acima
```

Cada concurso é uma pasta com o identificador do padrão de nome (`louveira-professor-2027`). Campinas entra como outra pasta.

## Antes de abrir a venda (01/12)

1. **Dados da empresa:** ~~razão social, CNPJ e e-mail~~ preenchidos em 25/11. Falta o WhatsApp em `public/aberto/empresa.json` (só números, com 55 e DDD); enquanto vazio, o link não aparece. O e-mail `contato@efetiveconcursos.com.br` está direcionado para efetiveconcursos@gmail.com. Configuração feita pelo Email Routing (grátis) na Cloudflare.
2. **Links de venda:** preencher `venda.checkout` (link da Hubla) e `venda.whatsapp` (só números, com 55 e DDD) em `public/aberto/louveira-professor-2027/concurso.json`. Sem eles, a aula grátis mostra "Link de compra em breve".
3. **Textos em rascunho:** aula grátis e institucional (revisar depois da resposta da Renata sobre aparecer na oferta, P15), privacidade e termos (revisar e conferir com o produto na Hubla).
4. **Cloudflare Pages:** publicar da raiz do repo, para o wrangler levar a pasta `functions/` junto:
   ```bash
   npx wrangler pages deploy public --project-name efetiveconcursos
   ```
   Em *Custom domains*, adicionar `efetiveconcursos.com.br`, `www.efetiveconcursos.com.br` e `curso.efetiveconcursos.com.br`. Se o projeto for ligado ao GitHub em vez do wrangler, usar *build command* vazio, *output* `public` e *root* `/`.
5. **Cloudflare Access:** em Zero Trust, criar **uma** aplicação *self-hosted* com dois destinos:
   - `curso.efetiveconcursos.com.br`, com o caminho vazio (o host inteiro).
   - `efetiveconcursos.com.br/curso`, a reserva caso o redirecionamento falhe.

   Configurar login por código de e-mail (One-time PIN), sessão de 30 dias e a política "Allow" com a lista de e-mails das alunas. **Não** proteger a raiz, `/louveira`, `/privacidade`, `/termos` nem `/aberto`.
   - Em *Settings* do Pages, ligar o Access também nas *preview deployments*.
6. **Hubla:** o link de acesso do produto e a mensagem de boas-vindas apontam para `https://curso.efetiveconcursos.com.br`.
7. **Webhook Hubla → Access (quinta, 26/11):** Worker que recebe a venda (`x-hubla-token`), põe o e-mail na lista do Access e tira no reembolso ou chargeback. Enquanto não existir, liberar o e-mail à mão na lista do Access.
8. Rodar `npm run teste:navegador` e fazer o teste com 2 ou 3 professoras "não do computador".

## Fica para depois

- Progresso igual no PC e no celular (Worker + D1, validando o JWT do Access).
- Simulados com cronômetro, painel administrativo, PWA.
