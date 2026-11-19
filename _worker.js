// Cloudflare Pages (modo "_worker.js"): serve o site normalmente e responde /tesouro com os preços do Tesouro Direto.
// Basta este arquivo na raiz do repositório (junto do index.html). Não precisa de pasta "functions".
const CSV = 'https://www.tesourotransparente.gov.br/ckan/dataset/df56aa42-484a-4a59-8184-7676580c81e3/resource/796d2059-14e9-44e3-80c9-2d9e30b405c1/download/PrecoTaxaTesouroDireto.csv';

const num = (s) => {
  const v = parseFloat(String(s || '').trim().replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(v) ? v : 0;
};
const iso = (d) => {
  const m = String(d || '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
};

function parseTail(texto) {
  const linhas = texto.split(/\r?\n/);
  linhas.shift(); // a primeira linha pode vir cortada
  const rows = [];
  for (const l of linhas) {
    const c = l.split(';');
    if (c.length < 8 || /^Tipo/i.test(c[0])) continue;
    const base = iso(c[2]), venc = iso(c[1]);
    if (!base || !venc) continue;
    rows.push({ t: c[0].trim(), v: venc, d: base, tc: num(c[3]), tv: num(c[4]), pc: num(c[5]), pv: num(c[6]), pb: num(c[7]) });
  }
  if (!rows.length) return null;
  const ultima = rows.reduce((m, r) => (r.d > m ? r.d : m), '');
  return { data: ultima, itens: rows.filter((r) => r.d === ultima).map(({ d, ...r }) => r) };
}

const json = (obj, status = 200, cache = 'public, max-age=1800') =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': cache },
  });

async function lerFinal(resp, max) {
  // guarda apenas os últimos "max" bytes, sem carregar o arquivo inteiro na memória
  const rd = resp.body.getReader();
  let partes = [], total = 0;
  for (;;) {
    const { done, value } = await rd.read();
    if (done) break;
    partes.push(value); total += value.length;
    while (partes.length > 1 && total - partes[0].length >= max) total -= partes.shift().length;
  }
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of partes) { out.set(p, o); o += p.length; }
  return new TextDecoder('utf-8').decode(out.length > max ? out.subarray(out.length - max) : out);
}

async function tesouro(request) {
  const cache = caches.default;
  const chave = new Request(new URL(request.url).origin + '/tesouro');
  const salvo = await cache.match(chave);
  if (salvo) return salvo;
  let r;
  try {
    r = await fetch(CSV, { headers: { Range: 'bytes=-100000', 'User-Agent': 'Mozilla/5.0 (compatible; WSGestao/1.0)' } });
  } catch (e) {
    return json({ erro: 'Falha ao acessar o Tesouro Transparente' }, 502, 'no-store');
  }
  if (r.status !== 206 && r.status !== 200) return json({ erro: 'Tesouro Transparente respondeu HTTP ' + r.status }, 502, 'no-store');
  const texto = await lerFinal(r, 100000);
  const dados = parseTail(texto);
  if (!dados) return json({ erro: 'Não consegui ler os preços' }, 502, 'no-store');
  const resp = json(dados);
  await cache.put(chave, resp.clone());
  return resp;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/tesouro' && request.method === 'GET') return tesouro(request);
    return env.ASSETS.fetch(request);
  },
};
