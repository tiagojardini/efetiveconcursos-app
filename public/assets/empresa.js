// Preenche os dados da empresa (public/aberto/empresa.json) nas páginas públicas.
// Campo vazio no JSON = a linha não aparece. Nada de "[preencher]" no ar.
//   [data-empresa="identificacao"]  razão social e CNPJ
//   [data-empresa="contato"]        WhatsApp e e-mail, como links
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export async function preencherEmpresa() {
  let e;
  try { e = await (await fetch("/aberto/empresa.json")).json(); } catch { return null; }

  const id = [e.razaoSocial, e.cnpj && `CNPJ ${e.cnpj}`].filter(Boolean).join(" · ");
  document.querySelectorAll('[data-empresa="identificacao"]').forEach((el) => {
    el.textContent = id;
    el.hidden = !id;
  });

  const links = [];
  if (e.whatsapp) links.push(`<a href="https://wa.me/${esc(e.whatsapp)}" target="_blank" rel="noopener">WhatsApp</a>`);
  if (e.email) links.push(`<a href="mailto:${esc(e.email)}">${esc(e.email)}</a>`);
  document.querySelectorAll('[data-empresa="contato"]').forEach((el) => {
    el.innerHTML = links.join(" · ");
    el.hidden = !links.length;
  });
  return e;
}
