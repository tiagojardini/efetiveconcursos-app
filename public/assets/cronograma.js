// Cálculo do cronograma da aluna: data de início + dias da semana -> data de cada aula.
// Datas sempre como texto "AAAA-MM-DD" e contas em UTC, para não depender de fuso.

const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const DIA_MS = 86400000;

export function paraData(iso) {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d));
}

export function paraISO(data) {
  return data.toISOString().slice(0, 10);
}

export function somarDias(iso, n) {
  return paraISO(new Date(paraData(iso).getTime() + n * DIA_MS));
}

export function diasEntre(deISO, ateISO) {
  return Math.round((paraData(ateISO) - paraData(deISO)) / DIA_MS);
}

export function hojeISO(agora = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${agora.getFullYear()}-${p(agora.getMonth() + 1)}-${p(agora.getDate())}`;
}

export function diaDaSemana(iso) {
  return paraData(iso).getUTCDay();
}

/** "seg, 30/11" */
export function formatar(iso, { ano = false } = {}) {
  const [a, m, d] = iso.split("-");
  return `${SEMANA[diaDaSemana(iso)]}, ${d}/${m}${ano ? "/" + a : ""}`;
}

/** Datas de estudo entre o início e a véspera da prova, nos dias da semana escolhidos (0 = domingo). */
export function datasDeEstudo(inicio, diasSemana, prova) {
  const datas = [];
  const set = new Set(diasSemana);
  for (let d = inicio; d < prova; d = somarDias(d, 1)) {
    if (set.has(diaDaSemana(d))) datas.push(d);
  }
  return datas;
}

/**
 * Distribui `total` aulas nas datas de estudo.
 * - Se há datas suficientes: uma aula por data, na ordem; as datas que sobram ficam para revisar.
 * - Se não há: espalha as aulas pelas datas disponíveis (alguns dias ficam com 2 ou mais aulas).
 * Devolve null quando não há nenhuma data de estudo.
 */
export function montarCronograma(total, inicio, diasSemana, prova) {
  const datas = datasDeEstudo(inicio, diasSemana, prova);
  if (!datas.length || total < 1) return null;
  const porAula = {};
  if (datas.length >= total) {
    for (let i = 1; i <= total; i++) porAula[i] = datas[i - 1];
  } else {
    for (let i = 1; i <= total; i++) porAula[i] = datas[Math.floor(((i - 1) * datas.length) / total)];
  }
  const ultima = porAula[total];
  const maxPorDia = Math.max(...Object.values(
    Object.values(porAula).reduce((acc, d) => ((acc[d] = (acc[d] || 0) + 1), acc), {})
  ));
  return {
    porAula,
    ultima,
    datasDisponiveis: datas.length,
    sobra: Math.max(0, datas.length - total),
    apertado: datas.length < total,
    maxPorDia,
  };
}
