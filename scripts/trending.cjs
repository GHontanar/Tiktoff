// Lee las canciones en tendencia del TikTok Creative Center y escribe trending.json (solo título y artista, sin audio).
// La página no tiene API pública: se abre con un navegador y se recoge la respuesta que la propia página pide.
// Si algo falla o la lista sale vacía, no se toca trending.json y la app sigue usando la última lista buena.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const OUT = path.join(__dirname, '..', 'trending.json');
const PAGE = 'https://ads.tiktok.com/business/creativecenter/inspiration/popular/music/pc/es';
const API = /creative_radar_api\/v1\/popular_trend\/sound\/rank_list/;
const MIN_ITEMS = 5;

// Busca dentro del JSON la lista de canciones, sin depender de la forma exacta de la respuesta
function findSongs(node){
  if(Array.isArray(node)){
    if(node.length && node.every(x => x && typeof x === 'object' && typeof x.title === 'string')) return node;
    for(const x of node){ const r = findSongs(x); if(r) return r; }
  } else if(node && typeof node === 'object'){
    for(const k of Object.keys(node)){ const r = findSongs(node[k]); if(r) return r; }
  }
  return null;
}

async function grab(country){
  const browser = await chromium.launch();
  try{
    const page = await browser.newPage({locale: 'es-ES'});
    if(country) await page.route(API, route => {
      const u = new URL(route.request().url());
      u.searchParams.set('country_code', country); u.searchParams.set('period', '7'); u.searchParams.set('limit', '50');
      route.continue({url: u.toString()});
    });
    const got = page.waitForResponse(r => API.test(r.url()) && r.status() === 200, {timeout: 60000});
    await page.goto(PAGE, {waitUntil: 'domcontentloaded', timeout: 60000});
    const json = await (await got).json();
    const songs = findSongs(json) || [];
    return songs.map((s, i) => ({
      rank: s.rank || i + 1,
      title: s.title.trim(),
      artist: String(s.author || s.artist || '').trim(),
      tiktok: s.link || null
    })).filter(s => s.title);
  } finally { await browser.close(); }
}

(async () => {
  let items = [], region = 'ES';
  try{ items = await grab('ES'); }catch(e){ console.log('España:', e.message); }
  if(items.length < MIN_ITEMS){
    region = null;
    try{ items = await grab(null); }catch(e){ console.log('General:', e.message); }
  }
  if(items.length < MIN_ITEMS){ console.log(`Solo ${items.length} canciones: se deja la lista anterior.`); process.exitCode = 1; return; }
  const data = {updated: new Date().toISOString(), region, source: 'TikTok Creative Center', items: items.slice(0, 50)};
  fs.writeFileSync(OUT, JSON.stringify(data, null, 2) + '\n');
  console.log(`${items.length} canciones (${region || 'general'}).`);
})();
