// Banc de vérité terrain : mesure la justesse de la détection des espaces sur un
// plan réel, contre une liste de locaux relevée à la main sur le plan.
//
// Le fichier de vérité est un JSON hors dépôt (les plans réels ne sont jamais
// versionnés) :
//
//   { "plan":"Test.pdf", "page":1, "echelle":100,
//     "rooms":[ {"num":"317","name":"Bureau partagé 06","area_m2":76,
//                "cx":1042.4,"cy":344.4}, ... ] }
//
// cx,cy = un point sûr du local, en points PDF (origine en haut à gauche, comme
// pdf.js à l'échelle 1). En pratique : le centre de l'étiquette du local.
//
//   node tests/verite.mjs <index.html> <plan.pdf> <verite.json> [finesse] [sortie.json]
//
// Appariement : un local de la vérité est apparié au polygone détecté qui
// contient son point. Deux points dans un même polygone = fusion. Un point dans
// aucun polygone = manqué. Un polygone sans point = en trop (souvent une
// circulation, qui n'a pas d'étiquette — d'où le détail plutôt qu'un score seul).
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, resolve } from 'node:path';

const OUTIL = resolve(process.argv[2] || 'index.html');
const PLAN = resolve(process.argv[3]);
const VERITE = resolve(process.argv[4]);
const FINESSE = +(process.argv[5] || 4);
const SORTIE = process.argv[6] ? resolve(process.argv[6]) : null;
const PORT = +(process.env.PORT_CDP || 9344);

const dors = ms => new Promise(r => setTimeout(r, ms));
const V = JSON.parse(readFileSync(VERITE, 'utf8'));

function dansPoly(pt, poly) {
  let dedans = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > pt[1]) !== (yj > pt[1]) &&
        pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) dedans = !dedans;
  }
  return dedans;
}

async function analyser() {
  const profil = mkdtempSync(resolve(tmpdir(), 'stcver-'));
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
      setTimeout(() => { if (att.delete(n)) ko(new Error('timeout ' + m)); }, 600000);
    });
  };
  const ev = async e => {
    const r = await cdp('Runtime.evaluate',
      { expression: e, awaitPromise: true, returnByValue: true, timeout: 580000 });
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
    await ev(`window.__charge = async (chemin, nom) => {
      const r = await fetch('file:///' + chemin);
      return chargerPlan(new File([await r.blob()], nom));
    }; true`);
    const t0 = Date.now();
    await ev(`__charge(${JSON.stringify(PLAN.replace(/\\/g, '/'))}, ${JSON.stringify(basename(PLAN))})`);
    // le chargement enchaîne des rendus asynchrones : on attend que la page soit prête
    for (let i = 0; i < 120; i++) {
      if (await ev('!!(SRC && SRC.nPages)')) break;
      await dors(500);
    }
    const ech = V.echelle || 100;
    await ev(`lancerAnalyse(${(V.page || 1) - 1}, ${FINESSE}, ${ech})`);
    for (let i = 0; i < 240; i++) {
      if (await ev('!!D && !document.getElementById("calclay").classList.contains("on")')) break;
      await dors(500);
    }
    const ms = Date.now() - t0;
    const D = await ev('D ? {rooms:D.rooms, polys:D.polys, pairs:D.pairs.map(p=>' +
      '({ca:p.ca,cb:p.cb,len_m:p.len_m,stc:p.stc})), portes:(D.portes||[]).length,' +
      ' note:D.vision_note, clip:D.clip} : null');
    if (!D) throw new Error('analyse sans résultat');
    return { D, ms, erreurs };
  } finally {
    try { ws && ws.close(); } catch (e) { /* deja ferme */ }
    chrome.kill();
    await dors(400);
    try { rmSync(profil, { recursive: true, force: true }); } catch (e) { /* profil verrouille */ }
  }
}

// --- justesse des libellés ---
// Un nom lu sur des glyphes vectorisés garde des lettres de travers : le « l »
// et le « I » ont le même dessin, le « g » et le « 9 » se ressemblent. On
// compare donc à travers ces familles, comme le fait la classification du
// moteur, et on tolère une lettre fausse sur quatre.
const FLOUS = [['l', 'i', '1', '!', '|'], ['o', '0'], ['s', '5'],
               ['g', '9', 'q'], ['z', '2'], ['b', '6'], ['c', 'e']];
function flou(s) {
  let n = (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '');
  for (const f of FLOUS) n = n.replace(new RegExp('[' + f.join('') + ']', 'g'), f[0]);
  return n;
}
function lev(a, b) {
  const m = a.length, n = b.length;
  if (!m || !n) return Math.max(m, n);
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++)
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1,
                        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
function ressemble(lu, attendu) {
  const a = flou(lu), b = flou(attendu);
  if (!b) return null;
  if (!a) return 0;
  return Math.max(0, 1 - lev(a, b) / Math.max(a.length, b.length));
}

function mesurer(D) {
  const polys = D.polys, rooms = D.rooms;
  const parRoom = new Map();          // id détecté -> [locaux de la vérité]
  const lignes = [];
  for (const v of V.rooms) {
    const dedans = Object.keys(polys).filter(k => dansPoly([v.cx, v.cy], polys[k]));
    // un point peut tomber dans plusieurs polygones si l'un englobe l'autre :
    // on retient le plus petit, c'est le local, l'autre est son contenant.
    dedans.sort((a, b) => (rooms[a]?.area_det || 1e9) - (rooms[b]?.area_det || 1e9));
    const id = dedans[0] || null;
    if (id) parRoom.set(id, (parRoom.get(id) || []).concat([v]));
    lignes.push({ v, id, det: id ? rooms[id] : null });
  }
  let manques = 0, fusions = 0, ok = 0;
  const errs = [];
  for (const L of lignes) {
    if (!L.id) { manques++; L.etat = 'manqué'; continue; }
    if (parRoom.get(L.id).length > 1) { L.etat = 'fusion'; continue; }
    ok++; L.etat = 'ok';
    if (L.v.area_m2 && L.det?.area_det) {
      L.err = (L.det.area_det - L.v.area_m2) / L.v.area_m2;
      errs.push(L.err);
    }
    L.sim = L.v.name ? ressemble(L.det?.name, L.v.name) : null;
    L.numOk = L.v.num != null && String(L.det?.num) === String(L.v.num);
  }
  for (const [, vs] of parRoom) if (vs.length > 1) fusions += vs.length;
  const enTrop = Object.keys(rooms).filter(k => !parRoom.has(k));
  errs.sort((a, b) => a - b);
  const med = errs.length ? errs[errs.length >> 1] : NaN;
  const abs = errs.map(Math.abs).sort((a, b) => a - b);
  const sims = lignes.filter(L => L.sim != null).map(L => L.sim);
  return {
    lignes, manques, fusions, ok, enTrop,
    nDet: Object.keys(rooms).length, nVerite: V.rooms.length,
    errMed: med, errAbsMed: abs.length ? abs[abs.length >> 1] : NaN,
    err10: abs.filter(e => e > 0.10).length, nErr: errs.length,
    nNoms: sims.length, nomsBons: sims.filter(s => s >= 0.75).length,
    nomsVides: lignes.filter(L => L.sim === 0).length,
    numsBons: lignes.filter(L => L.numOk).length,
    simMoy: sims.length ? sims.reduce((a, b) => a + b, 0) / sims.length : NaN
  };
}

const pc = v => (isNaN(v) ? '—' : (v >= 0 ? '+' : '') + (v * 100).toFixed(1) + ' %');

const { D, ms, erreurs } = await analyser();
const M = mesurer(D);
console.log('\nPlan : ' + basename(PLAN) + ' page ' + (V.page || 1) +
  '   finesse ' + FINESSE + '   ' + (ms / 1000).toFixed(1) + ' s');
console.log(D.note + '\n');
console.log('  num      surface plan   détectée   écart     état');
for (const L of M.lignes.slice().sort((a, b) => (b.err ?? -9) - (a.err ?? -9)))
  console.log('  ' + (L.v.num + '        ').slice(0, 8) +
    (L.v.area_m2 == null ? '   —  ' : String(L.v.area_m2).padStart(6)) + ' m²   ' +
    (L.det ? String(L.det.area_det).padStart(6) + ' m²' : '        ') + '   ' +
    (L.err == null ? '      ' : pc(L.err).padStart(7)) + '   ' + L.etat +
    (L.etat === 'ok' ? '' : '  <<'));
console.log('\n  locaux de la vérité       ' + M.nVerite);
console.log('  appariés 1 pour 1         ' + M.ok);
console.log('  fusionnés (2 dans 1)      ' + M.fusions);
console.log('  manqués                   ' + M.manques);
console.log('  détectés au total         ' + M.nDet + '   (dont ' + M.enTrop.length +
  ' sans étiquette : circulations, escaliers, gaines…)');
console.log('  écart de surface médian    ' + pc(M.errMed) + '   (|écart| médian ' +
  pc(M.errAbsMed) + ')');
console.log('  locaux à plus de 10 %     ' + M.err10 + ' / ' + M.nErr);
console.log('  numéros justes            ' + M.numsBons + ' / ' + M.nVerite);
console.log('  noms reconnus             ' + M.nomsBons + ' / ' + M.nNoms +
  '   (ressemblance moyenne ' + (M.simMoy * 100).toFixed(0) + ' %, ' +
  M.nomsVides + ' non lus)');
console.log('  cloisons                  ' + D.pairs.length + '   portes ' + D.portes);
if (erreurs.length) console.log('  erreurs JS : ' + erreurs.slice(0, 3).join(' | '));

// les libellés les moins bien lus : c'est là qu'on voit ce que la
// reconnaissance de forme confond encore
const pires = M.lignes.filter(L => L.sim != null && L.sim < 0.75)
  .sort((a, b) => a.sim - b.sim);
if (pires.length) {
  console.log('\n  noms à revoir :');
  for (const L of pires.slice(0, 12))
    console.log('    ' + (L.v.num + '      ').slice(0, 7) +
      (L.sim * 100).toFixed(0).padStart(3) + ' %   plan « ' + L.v.name +
      ' »   lu « ' + (L.det?.name ?? '—') + ' »');
}

if (SORTIE) {
  writeFileSync(SORTIE, JSON.stringify({
    plan: basename(PLAN), finesse: FINESSE, ms, note: D.note,
    resume: {
      nVerite: M.nVerite, ok: M.ok, fusions: M.fusions, manques: M.manques,
      nDet: M.nDet, enTrop: M.enTrop.length, errMed: M.errMed,
      errAbsMed: M.errAbsMed, err10: M.err10, pairs: D.pairs.length, portes: D.portes,
      numsBons: M.numsBons, nomsBons: M.nomsBons, nNoms: M.nNoms, simMoy: M.simMoy
    },
    lignes: M.lignes.map(L => ({ num: L.v.num, etat: L.etat, decl: L.v.area_m2,
                                 det: L.det?.area_det ?? null, err: L.err ?? null,
                                 nom: L.det?.name ?? null, sim: L.sim ?? null }))
  }, null, 1));
  console.log('\n  écrit : ' + SORTIE);
}
process.exit(0);
