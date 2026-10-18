// Lee las canciones en tendencia del TikTok Creative Center y escribe trending.json (solo título y artista, sin audio).
// La página no tiene API pública: se abre con un navegador y se recogen las respuestas JSON que la propia página pide.
// Si algo falla o la lista sale vacía, no se toca trending.json y la app sigue usando la última lista buena.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const OUT = path.join(__dirname, '..', 'trending.json');
const DEBUG_DIR = process.env.TRENDING_DEBUG_DIR || null;
// TikTok movió el Creative Center a "TikTok One"; se prueban las direcciones posibles de la sección de canciones
const PAGES = [
  'https://ads.tiktok.com/creative/creativeCenter/trends/song?region={R}&period=7',
  'https://ads.tiktok.com/creative/creativeCenter/trends/music?region={R}&period=7',
  'https://ads.tiktok.com/business/creativecenter/inspiration/popular/music/pc/en?region={R}'
];
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const MIN_ITEMS = 5;

// Busca dentro del JSON la lista de canciones, sin depender de la forma exacta de la respuesta
const TITLE_KEYS = ['title', 'song_name', 'songName', 'music_name', 'musicName', 'name'];
const ARTIST_KEYS = ['author', 'artist', 'artist_name', 'artistName', 'author_name', 'authorName', 'singer', 'creator'];
const field = (o, keys) => { for(const k of keys){ const v = o[k]; if(typeof v === 'string' && v.trim()) return v.trim(); if(Array.isArray(v) && typeof v[0] === 'string') return v.join(', '); } return ''; };
const isSong = x => x && typeof x === 'object' && !Array.isArray(x) && field(x, TITLE_KEYS) && ARTIST_KEYS.some(k => k in x);
function findSongs(node){
  if(Array.isArray(node)){
    if(node.length >= MIN_ITEMS && node.every(isSong)) return node;
    for(const x of node){ const r = findSongs(x); if(r) return r; }
  } else if(node && typeof node === 'object'){
    for(const k of Object.keys(node)){ const r = findSongs(node[k]); if(r) return r; }
  }
  return null;
}

async function grab(pageUrl, country){
  const browser = await chromium.launch();
  const seen = [], samples = [];
  try{
    const page = await browser.newPage({locale: 'es-ES', userAgent: UA, viewport: {width: 1366, height: 900}});
    let songs = null;
    page.on('response', async r => {
      const t = r.request().resourceType();
      if(t !== 'xhr' && t !== 'fetch') return;
      const u = r.url();
      if(/byteoversea|tiktokv\.com/.test(u)) return;  // telemetría
      seen.push(`${r.status()} ${u.slice(0, 180)}`);
      if(songs) return;
      try{
        const txt = await r.text();
        if(/song|music|sound/i.test(u) && samples.length < 4) samples.push(`${u.slice(0, 140)}\n    ${txt.slice(0, 700)}`);
        const s = findSongs(JSON.parse(txt)); if(s) songs = s;
      }catch(e){}
    });
    await page.goto(pageUrl.replace('{R}', country || 'US'), {waitUntil: 'domcontentloaded', timeout: 60000});
    for(let i = 0; i < 20 && !songs; i++){
      await page.waitForTimeout(1500);
      if(i === 6) await page.mouse.wheel(0, 1500);
    }
    if(!songs){
      console.log(`Sin lista. URL final: ${page.url()} · título: ${await page.title()}`);
      console.log('Peticiones vistas:\n  ' + (seen.slice(0, 40).join('\n  ') || '(ninguna)'));
      if(samples.length) console.log('Respuestas con song/music/sound:\n  ' + samples.join('\n  '));
      if(DEBUG_DIR){
        fs.mkdirSync(DEBUG_DIR, {recursive: true});
        await page.screenshot({path: path.join(DEBUG_DIR, `pagina-${PAGES.indexOf(pageUrl)}-${country || 'general'}.png`), fullPage: true}).catch(() => {});
      }
      return [];
    }
    console.log(`Lista encontrada en ${page.url()}`);
    return songs.map((s, i) => ({
      rank: typeof s.rank === 'number' ? s.rank : i + 1,
      title: field(s, TITLE_KEYS),
      artist: field(s, ARTIST_KEYS),
      tiktok: typeof s.link === 'string' ? s.link : null
    })).filter(s => s.title);
  } finally { await browser.close(); }
}

(async () => {
  let items = [], region = null;
  outer: for(const country of ['ES', null]){
    for(const p of PAGES){
      try{ items = await grab(p, country); }catch(e){ console.log(`${p} (${country || 'general'}):`, e.message); items = []; }
      if(items.length >= MIN_ITEMS){ region = country; break outer; }
    }
  }
  if(items.length < MIN_ITEMS){ console.log(`Solo ${items.length} canciones: se deja la lista anterior.`); process.exitCode = 1; return; }
  const data = {updated: new Date().toISOString(), region, source: 'TikTok Creative Center', items: items.slice(0, 50)};
  fs.writeFileSync(OUT, JSON.stringify(data, null, 2) + '\n');
  console.log(`${items.length} canciones (${region || 'general'}).`);
})();
