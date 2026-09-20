// Étage « stabilité » : le moteur repasse sur les plans d'essai synthétiques et
// on compare sa sortie à un étalon versionné (tests/baseline.json).
//
//   python tests/fixtures.py && node tests/stabilite.mjs
//   node tests/stabilite.mjs --update-baseline     # re-bénir après un changement voulu
//
// Ce que `banc.mjs` vérifie, ce sont des seuils — « au moins 12 locaux ». Un
// changement qui fait passer 18 locaux à 13 les passe tous, et personne ne le
// voit. L'étalon, lui, retient ce que le moteur *a répondu* : le compte exact
// des locaux, des cloisons et des portes, l'échelle déduite, le classement de
// chaque pièce. C'est ce qui attrape les effets de bord — un seuil déplacé pour
// un cas qui en abîme trois autres.
//
// L'étalon ne peut porter que sur des plans fabriqués : les plans réels ne sont
// jamais versionnés. `tests/fixtures.py` les régénère à l'identique, donc
// l'étalon est reproductible d'un poste à l'autre.
//
// Tolérances : les comptes et les catégories sont exacts, les surfaces à 3 %
// près — le rendu canevas d'un poste à l'autre déplace un pixel de bord, pas un
// local. Un écart de compte, de catégorie ou de nom est un échec.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2).filter(a => a !== '--update-baseline');
const BENIR = process.argv.includes('--update-baseline');
const OUTIL = resolve(args[0] || join(ICI, '..', 'index.html'));
const FX = resolve(args[1] || join(ICI, 'fx'));
const ETALON = join(ICI, 'baseline.json');
const PORT = +(process.env.PORT_CDP || 9355);

// Les plans d'essai analysables, et l'échelle à laquelle les ouvrir. Le PDF
// scanné et le PNG n'en sont pas : ils n'ont pas de géométrie à extraire.
const PLANS = [
  { fx: 'plan.pdf', echelle: 100 },
  { fx: 'plan.svg', echelle: 100 },
  { fx: 'plan.dxf', echelle: 100 },
  { fx: 'plan_metres.dxf', echelle: 100 },
  { fx: 'plan_poche.pdf', echelle: 100 },
  { fx: 'plan_poche_50.pdf', echelle: 50 }
];

const dors = ms => new Promise(r => setTimeout(r, ms));

async function releve() {
  const profil = mkdtempSync(join(tmpdir(), 'stcstab-'));
  const chrome = spawn(process.env.CHROME_BIN
    || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
    '--headless=new', '--remote-debugging-port=' + PORT, '--disable-gpu',
    '--no-first-run', '--no-default-browser-check', '--allow-file-access-from-files',
    '--user-data-dir=' + profil, '--window-size=1500,1000', 'about:blank'
  ], { stdio: 'ignore' });
  let ws, id = 0; const att = new Map(); const erreurs = [];
  const cdp = (m, p = {}) => {
    const n = ++id; ws.send(JSON.stringify({ id: n, method: m, params: p }));
    return new Promise((ok, ko) => {
      att.set(n, { ok, ko });
      setTimeout(() => { if (att.delete(n)) ko(new Error('timeout ' + m)); }, 300000);
    });
  };
  const ev = async e => {
    const r = await cdp('Runtime.evaluate',
      { expression: e, awaitPromise: true, returnByValue: true, timeout: 280000 });
    if (r.exceptionDetails)
      throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  try {
    let u = null;
    for (let i = 0; i < 80 && !u; i++) {
      try {
        u = (await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json())
          .find(t => t.type === 'page')?.webSocketDebuggerUrl;
      } catch (e) { /* pas encore la */ }
      if (!u) await dors(250);
    }
    ws = new WebSocket(u);
    await new Promise(r => ws.addEventListener('open', r));
    ws.addEventListener('message', e => {
      const m = JSON.parse(e.data);
      if (m.id && att.has(m.id)) {
        const a = att.get(m.id); att.delete(m.id);
        m.error ? a.ko(new Error(m.error.message)) : a.ok(m.result);
        return;
      }
      if (m.method === 'Runtime.exceptionThrown')
        erreurs.push(m.params.exceptionDetails.exception?.description
          || m.params.exceptionDetails.text);
    });
    await cdp('Runtime.enable');
    await cdp('Page.navigate', { url: 'file:///' + OUTIL.replace(/\\/g, '/') });
    await dors(2500);
    await ev(`window.__fx = async (nom) => {
      const r = await fetch('file:///${FX.replace(/\\/g, '/')}/' + nom);
      if(!r.ok) throw new Error('fixture introuvable : ' + nom);
      return chargerPlan(new File([await r.blob()], nom));
    };
    // La signature d'une analyse : ce que le moteur a repondu, pas un seuil.
    window.__sig = () => {
      if(!D) return null;
      const rs = Object.values(D.rooms);
      const cats = {};
      for(const r of rs) cats[r.cat] = (cats[r.cat]||0) + 1;
      const aires = rs.map(r=>r.area_det).filter(v=>v>0).sort((a,b)=>a-b);
      return {
        note: D.vision_note, echelle: D.echelle,
        rooms: rs.length, pairs: D.pairs.length, portes: (D.portes||[]).length,
        nommes: rs.filter(r=>r.name && r.name!=='Espace non identifie'
                             && r.name!=='Espace non identifi\\u00e9').length,
        aireMed: aires.length ? Math.round(aires[aires.length>>1]*10)/10 : 0,
        aireTot: Math.round(rs.reduce((a,r)=>a+(r.area_det||0),0)*10)/10,
        cats,
        // ce qui fait la cible STC : le classement de chaque local, et sur quoi
        // il s'est decide. Trie par numero, pour ne pas dependre de l'ordre des
        // cellules, qui n'a pas de sens stable.
        locaux: rs.map(r=>({num:String(r.num), nom:r.name, cat:r.cat,
                            kw:r.kw??null, conf:r.conf??null,
                            aire:r.area_det}))
                  .sort((a,b)=>a.num.localeCompare(b.num) || a.nom.localeCompare(b.nom)),
        stc: (()=>{ const m={}; for(const p of D.pairs) m[p.stc]=(m[p.stc]||0)+1; return m; })()
      };
    };
    true;`);
    const out = {};
    for (const { fx, echelle } of PLANS) {
      if (!existsSync(join(FX, fx))) { out[fx] = { absent: true }; continue; }
      try {
        await ev(`__fx(${JSON.stringify(fx)})`);
        for (let i = 0; i < 60; i++) {
          if (await ev('!!(SRC && SRC.nPages)')) break;
          await dors(300);
        }
        await ev(`lancerAnalyse(0, 4, ${echelle})`);
        for (let i = 0; i < 200; i++) {
          if (await ev('!!D && !document.getElementById("calclay").classList.contains("on")')) break;
          await dors(400);
        }
        out[fx] = await ev('__sig()');
        await ev('retourAccueil()');
        await dors(400);
      } catch (e) { out[fx] = { erreur: String(e.message || e).slice(0, 160) }; }
    }
    return { out, erreurs };
  } finally {
    try { ws && ws.close(); } catch (e) { /* deja ferme */ }
    chrome.kill();
    await dors(400);
    try { rmSync(profil, { recursive: true, force: true }); } catch (e) { /* profil verrouille */ }
  }
}

// --- comparaison ---
// Les comptes, les categories et les noms sont exacts ; les surfaces tolerent
// 3 %, parce qu'un pixel de bord se deplace d'un poste a l'autre.
const TOL_AIRE = 0.03;
const ecarts = [];
function dit(plan, quoi, avant, apres) {
  ecarts.push({ plan, quoi, avant, apres });
}
function proche(a, b) {
  if (typeof a !== 'number' || typeof b !== 'number') return a === b;
  if (a === b) return true;
  return Math.abs(a - b) <= TOL_AIRE * Math.max(Math.abs(a), Math.abs(b), 1);
}
function comparer(plan, av, ap) {
  if (!av || !ap) { dit(plan, 'analyse', av ? 'sortie' : 'rien', ap ? 'sortie' : 'rien'); return; }
  if (ap.erreur) { dit(plan, 'erreur', av.erreur ?? '—', ap.erreur); return; }
  for (const k of ['rooms', 'pairs', 'portes', 'nommes', 'echelle'])
    if (av[k] !== ap[k]) dit(plan, k, av[k], ap[k]);
  for (const k of ['aireMed', 'aireTot'])
    if (!proche(av[k], ap[k])) dit(plan, k, av[k], ap[k]);
  const cats = new Set([...Object.keys(av.cats || {}), ...Object.keys(ap.cats || {})]);
  for (const c of cats)
    if ((av.cats?.[c] | 0) !== (ap.cats?.[c] | 0))
      dit(plan, 'catégorie ' + c, av.cats?.[c] | 0, ap.cats?.[c] | 0);
  const stcs = new Set([...Object.keys(av.stc || {}), ...Object.keys(ap.stc || {})]);
  for (const v of stcs)
    if ((av.stc?.[v] | 0) !== (ap.stc?.[v] | 0))
      dit(plan, 'cloisons à STC ' + v, av.stc?.[v] | 0, ap.stc?.[v] | 0);
  // le detail local par local : c'est la qu'on lit *quel* local a bouge
  const cle = l => l.num + ' · ' + l.nom;
  const A = new Map((av.locaux || []).map(l => [cle(l), l]));
  const B = new Map((ap.locaux || []).map(l => [cle(l), l]));
  for (const [k, l] of A) {
    const m = B.get(k);
    if (!m) { dit(plan, 'local disparu', k + ' (' + l.cat + ')', '—'); continue; }
    if (l.cat !== m.cat) dit(plan, 'classement ' + k, l.cat + (l.kw ? ' « ' + l.kw + ' »' : ''),
                             m.cat + (m.kw ? ' « ' + m.kw + ' »' : ''));
    else if (!proche(l.aire, m.aire)) dit(plan, 'surface ' + k, l.aire, m.aire);
  }
  for (const [k, l] of B) if (!A.has(k)) dit(plan, 'local nouveau', '—', k + ' (' + l.cat + ')');
}

const { out, erreurs } = await releve();

for (const { fx } of PLANS) {
  const g = out[fx];
  if (!g) continue;
  if (g.absent) { console.log('  —      ' + fx + '   fixture absente'); continue; }
  if (g.erreur) { console.log('  ERREUR ' + fx + '   ' + g.erreur); continue; }
  console.log('  relevé ' + (fx + '                  ').slice(0, 20) +
    g.rooms + ' locaux   ' + g.pairs + ' cloisons   ' + g.portes + ' portes   1/' +
    g.echelle + '   ' + g.aireTot + ' m²');
}

if (BENIR) {
  writeFileSync(ETALON, JSON.stringify({
    outil: 'index.html', beni_le: new Date().toISOString().slice(0, 10),
    tolerance_aire: TOL_AIRE, plans: out
  }, null, 1) + '\n');
  console.log('\nÉtalon ré-béni : ' + ETALON);
  console.log('Relisez le diff avant de le commiter — il dit ce que le changement a fait.');
  process.exit(0);
}

if (!existsSync(ETALON)) {
  console.log('\nPas d\'étalon : lancez `node tests/stabilite.mjs --update-baseline`.');
  process.exit(1);
}
const ref = JSON.parse(readFileSync(ETALON, 'utf8'));
for (const { fx } of PLANS) {
  if (out[fx]?.absent) continue;
  comparer(fx, ref.plans?.[fx], out[fx]);
}
if (erreurs.length) {
  console.log('\n  erreurs JS pendant le relevé :');
  for (const e of erreurs.slice(0, 5)) console.log('    ' + e.slice(0, 160));
}
if (!ecarts.length && !erreurs.length) {
  console.log('\nStable : le moteur répond comme à l\'étalon du ' + (ref.beni_le || '?') + '.');
  process.exit(0);
}
console.log('\n' + ecarts.length + ' écart(s) avec l\'étalon du ' + (ref.beni_le || '?') + ' :');
for (const e of ecarts)
  console.log('  ' + (e.plan + '                 ').slice(0, 19) +
    (e.quoi + '                              ').slice(0, 30) +
    '  ' + e.avant + '  →  ' + e.apres);
console.log('\nSi ces écarts sont voulus : `node tests/stabilite.mjs --update-baseline`,');
console.log('puis commitez l\'étalon avec le changement qui l\'explique.');
process.exit(1);
