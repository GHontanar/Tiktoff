// Lee las canciones en tendencia del TikTok Creative Center y escribe trending.json (solo título y artista, sin audio).
// La página no tiene API pública: se abre con un navegador y se recogen las respuestas JSON que la propia página pide.
// Si algo falla o la lista sale vacía, no se toca trending.json y la app sigue usando la última lista buena.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const OUT = path.join(__dirname, '..', 'trending.json');
const DEBUG_DIR = process.env.TRENDING_DEBUG_DIR || null;
const PAGE = 'https://ads.tiktok.com/business/creativecenter/inspiration/popular/music/pc/en';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const RANK_API = /popular_trend\/(sound|music)/;
const MIN_ITEMS = 5;

// Busca dentro del JSON la lista de canciones, sin depender de la forma exacta de la respuesta
function findSongs(node){
  if(Array.isArray(node)){
    if(node.length >= MIN_ITEMS && node.every(x => x && typeof x === 'object' && typeof x.title === 'string' && ('author' in x || 'artist' in x))) return node;
    for(const x of node){ const r = findSongs(x); if(r) return r; }
  } else if(node && typeof node === 'object'){
    for(const k of Object.keys(node)){ const r = findSongs(node[k]); if(r) return r; }
  }
  return null;
}

async function grab(country){
  const browser = await chromium.launch();
  const seen = [];
  try{
    const page = await browser.newPage({locale: 'es-ES', userAgent: UA, viewport: {width: 1366, height: 900}});
    if(country) await page.route(RANK_API, route => {
      const u = new URL(route.request().url());
      u.searchParams.set('country_code', country); u.searchParams.set('period', '7'); u.searchParams.set('limit', '50');
      route.continue({url: u.toString()});
    });
    let songs = null;
    page.on('response', async r => {
      const t = r.request().resourceType();
      if(t !== 'xhr' && t !== 'fetch') return;
      seen.push(`${r.status()} ${r.url().slice(0, 160)}`);
      if(songs) return;
      try{ const s = findSongs(await r.json()); if(s) songs = s; }catch(e){}
    });
    await page.goto(PAGE, {waitUntil: 'domcontentloaded', timeout: 60000});
    for(let i = 0; i < 40 && !songs; i++){
      await page.waitForTimeout(1500);
      if(i === 6) await page.mouse.wheel(0, 1500);
    }
    if(!songs){
      console.log(`Sin lista. URL final: ${page.url()} · título: ${await page.title()}`);
      console.log('Peticiones vistas:\n  ' + (seen.slice(0, 40).join('\n  ') || '(ninguna)'));
      if(DEBUG_DIR){
        fs.mkdirSync(DEBUG_DIR, {recursive: true});
        await page.screenshot({path: path.join(DEBUG_DIR, `pagina-${country || 'general'}.png`), fullPage: true}).catch(() => {});
      }
      return [];
    }
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
