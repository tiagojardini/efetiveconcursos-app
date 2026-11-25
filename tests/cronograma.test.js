import { test } from "node:test";
import assert from "node:assert/strict";
import { montarCronograma, datasDeEstudo, formatar, diasEntre, hojeISO } from "../public/assets/cronograma.js";

const PROVA = "2027-01-24";
const SEG_SEX = [1, 2, 3, 4, 5];

test("começando em 01/12, de seg a sex, as 30 aulas cabem antes da prova", () => {
  const c = montarCronograma(30, "2026-12-01", SEG_SEX, PROVA);
  assert.equal(c.porAula[1], "2026-12-01");
  assert.equal(c.apertado, false);
  assert.ok(c.ultima < PROVA);
  assert.equal(c.ultima, "2027-01-11"); // 30º dia útil a partir de 01/12
  assert.equal(c.maxPorDia, 1);
});

test("nenhuma aula cai em dia não escolhido nem no dia da prova", () => {
  const c = montarCronograma(30, "2026-11-25", [2, 4, 6], PROVA);
  for (const d of Object.values(c.porAula)) {
    assert.ok([2, 4, 6].includes(new Date(d + "T00:00:00Z").getUTCDay()), d);
    assert.ok(d < PROVA);
  }
});

test("começando tarde, as aulas se espalham e o plano avisa que está apertado", () => {
  const c = montarCronograma(30, "2027-01-10", SEG_SEX, PROVA);
  assert.equal(c.apertado, true);
  assert.equal(c.datasDisponiveis, 10);
  assert.equal(c.maxPorDia, 3);
  assert.ok(c.ultima < PROVA);
  // a ordem das aulas é mantida
  const datas = Object.values(c.porAula);
  assert.deepEqual([...datas].sort(), datas);
});

test("sem nenhuma data possível devolve null", () => {
  assert.equal(montarCronograma(30, "2027-01-24", SEG_SEX, PROVA), null);
  assert.equal(montarCronograma(30, "2026-12-01", [], PROVA), null);
});

test("véspera da prova entra, dia da prova não", () => {
  const d = datasDeEstudo("2027-01-22", [0, 1, 2, 3, 4, 5, 6], PROVA);
  assert.deepEqual(d, ["2027-01-22", "2027-01-23"]);
});

test("formatação e contagem de dias", () => {
  assert.equal(formatar("2026-11-30"), "seg, 30/11");
  assert.equal(formatar("2027-01-24", { ano: true }), "dom, 24/01/2027");
  assert.equal(diasEntre("2026-11-25", PROVA), 60);
  assert.equal(hojeISO(new Date(2026, 10, 5)), "2026-11-05");
});
