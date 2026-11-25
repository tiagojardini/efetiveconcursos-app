# Efetive Concursos · app da aluna

Site do **Preparatório Professor Louveira-SP 2027**: a aula grátis e o curso com 3 telas (Hoje, Cronograma e Aula).
As decisões de produto estão no repo `concurso` (em `estrategia/docs/`, principalmente a decisão de plataforma de 24/11 e o corte de 25/11).

## O que já funciona

| Endereço | O que é | Quem vê |
|---|---|---|
| `/aula-gratis/` | Aula 1 completa, chamada "Quero o curso", botão de dúvida e a pergunta "O que falta para você fazer o curso completo?" no fim do quiz | Qualquer pessoa |
| `/curso/` | Montar o plano (data de início + dias da semana), Hoje, Cronograma, Aula e Meus erros | Só alunas liberadas no Cloudflare Access |
| `/` | Redireciona para `/aula-gratis/` | — |

- O cronograma é recalculado no navegador: 30 aulas distribuídas nos dias escolhidos, até a véspera da prova. Se não couber, as aulas se juntam em alguns dias e a tela avisa.
- O progresso fica no navegador (`localStorage`). **Sincronizar PC e celular ficou para depois** (corte de 25/11).
- Aulas prontas hoje: Dias 1 a 3. As outras aparecem como "chega antes da data marcada".

## Como rodar no computador

```bash
npm run dev:estatico        # serve a pasta public em http://127.0.0.1:8788
npm test                    # testes do cálculo do cronograma
npm run teste:navegador     # abre o Chrome headless, faz o fluxo inteiro e tira prints em .teste-navegador/
```

Abra `http://127.0.0.1:8788/curso/` e `http://127.0.0.1:8788/aula-gratis/`.

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
  aula-gratis/index.html          página pública da Aula 1
  curso/index.html                o app (3 telas)
  curso/conteudo/<concurso>/      aulas pagas: dia-NN.html (texto) + dia-NN.json (quiz, flashcards, roteiro)
  aberto/<concurso>/              concurso.json (plano, datas, links de venda) + aulas abertas
  assets/app.js                   telas e rotas
  assets/aula.js                  monta uma aula e liga quiz, flashcards, vídeos e erros
  assets/cronograma.js            cálculo das datas (testado em tests/)
  assets/app.css                  marca v0.5: verde, coral, Figtree
tools/extrair_caderno.py          converte o HTML da Renata para o formato acima
```

Cada concurso é uma pasta com o identificador do padrão de nome (`louveira-professor-2027`). Campinas entra como outra pasta.

## Antes de abrir a venda (01/12)

1. **Links de venda:** preencher `venda.checkout` (link da Hubla) e `venda.whatsapp` (só números, com 55 e DDD) em `public/aberto/louveira-professor-2027/concurso.json`. Sem eles, a aula grátis mostra "Link de compra em breve".
2. **Texto da aula grátis:** é rascunho. Revisar depois da resposta da Renata sobre aparecer na oferta (P15).
3. **Cloudflare Pages:** criar o projeto apontando para este repo, sem build, pasta de saída `public`. Ligar o domínio efetiveconcursos.com.br.
   ```bash
   npx wrangler pages deploy public --project-name efetiveconcursos
   ```
4. **Cloudflare Access:** em Zero Trust, criar uma aplicação *self-hosted* para `efetiveconcursos.com.br/curso`. Login por código de e-mail (One-time PIN), sessão de 30 dias, política "Allow" com a lista de e-mails das alunas. **Não** proteger `/aula-gratis` nem `/aberto`.
5. **Webhook Hubla → Access (quinta, 26/11):** Worker que recebe a venda (`x-hubla-token`), põe o e-mail na lista do Access e tira no reembolso ou chargeback. Enquanto não existir, liberar o e-mail à mão na lista do Access.
6. Rodar `npm run teste:navegador` e fazer o teste com 2 ou 3 professoras "não do computador".

## Fica para depois

- Progresso igual no PC e no celular (Worker + D1, validando o JWT do Access).
- Simulados com cronômetro, painel administrativo, PWA.
