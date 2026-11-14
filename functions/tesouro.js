// Cloudflare Pages Function  →  endereço /tesouro
// Lê só o final do CSV oficial do Tesouro Transparente (arquivo grande, ordenado por data)
// e devolve os preços do último dia disponível, em JSON pequeno.
const CSV = 'https://www.tesourotransparente.gov.br/ckan/dataset/df56aa42-484a-4a59-8184-7676580c81e3/resource/796d2059-14e9-44e3-80c9-2d9e30b405c1/download/PrecoTaxaTesouroDireto.csv';

const num = (s) => {
  const v = parseFloat(String(s || '').trim().replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(v) ? v : 0;
};
const iso = (d) => {
  const m = String(d || '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
};

export function parseTail(texto) {
  const linhas = texto.split(/\r?\n/);
  linhas.shift(); // primeira linha pode vir cortada
  const rows = [];
  for (const l of linhas) {
    const c = l.split(';');
    if (c.length < 8) continue;
    const base = iso(c[2]), venc = iso(c[1]);
    if (!base || !venc || !c[0] || /^Tipo/i.test(c[0])) continue;
    rows.push({ t: c[0].trim(), v: venc, d: base, tc: num(c[3]), tv: num(c[4]), pc: num(c[5]), pv: num(c[6]), pb: num(c[7]) });
