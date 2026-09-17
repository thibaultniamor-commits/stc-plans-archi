// Banc d'essai : Chrome headless ouvre index.html et fait passer chaque format
// d'entree par le vrai chemin de l'outil — chargement, diagnostic, analyse.
// Les plans d'essai sont synthetiques : `python tests/fixtures.py` les genere
// dans tests/fx/, qui n'est pas versionne. Aucun plan reel ne doit y entrer.
//
//   python tests/fixtures.py && node tests/banc.mjs
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Usage : node tests/banc.mjs [index.html] [dossier des plans d'essai]
// Chrome est cherche dans CHROME_BIN, sinon a l'emplacement habituel sous Windows.
const ICI = dirname(fileURLToPath(import.meta.url));
const CHROME = process.env.CHROME_BIN
  || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUTIL = resolve(process.argv[2] || join(ICI, '..', 'index.html'));
const FX = resolve(process.argv[3] || join(ICI, 'fx'));

const profil = mkdtempSync(join(tmpdir(), 'stcbanc-'));
const chrome = spawn(CHROME, [
  '--headless=new', '--remote-debugging-port=9333', '--disable-gpu',
  '--no-first-run', '--no-default-browser-check', '--allow-file-access-from-files',
  '--user-data-dir=' + profil, '--window-size=1400,900', 'about:blank'
], { stdio: 'ignore' });

const dors = ms => new Promise(r => setTimeout(r, ms));

async function cible() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch('http://127.0.0.1:9333/json/list');
      const l = await r.json();
      const p = l.find(t => t.type === 'page');
      if (p) return p.webSocketDebuggerUrl;
    } catch (e) { /* pas encore la */ }
    await dors(250);
  }
  throw new Error('Chrome ne repond pas');
}

let ws, id = 0;
const attentes = new Map();
const erreurs = [];

function cdp(method, params = {}) {
  const n = ++id;
  ws.send(JSON.stringify({ id: n, method, params }));
  return new Promise((ok, ko) => {
    attentes.set(n, { ok, ko });
    setTimeout(() => { if (attentes.delete(n)) ko(new Error('timeout ' + method)); }, 120000);
  });
}

async function evalue(expr) {
  const r = await cdp('Runtime.evaluate', {
    expression: expr, awaitPromise: true, returnByValue: true, timeout: 90000
  });
  if (r.exceptionDetails) {
    const e = r.exceptionDetails;
    throw new Error('exception : ' + (e.exception?.description || e.text));
  }
  return r.result.value;
}

const cas = [];
let echecs = 0;
function verif(nom, ok, detail) {
  cas.push({ nom, ok, detail });
  if (!ok) echecs++;
  console.log((ok ? '  ok   ' : '  ECHEC') + '  ' + nom + (detail ? '   ' + detail : ''));
}

async function main() {
  const url = await cible();
  ws = new WebSocket(url);
  await new Promise(r => ws.addEventListener('open', r));
  ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id && attentes.has(m.id)) {
      const a = attentes.get(m.id); attentes.delete(m.id);
      m.error ? a.ko(new Error(m.error.message)) : a.ok(m.result);
      return;
    }
    if (m.method === 'Runtime.exceptionThrown')
      erreurs.push('exception: ' + (m.params.exceptionDetails.exception?.description
        || m.params.exceptionDetails.text));
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error')
      erreurs.push('console.error: ' + m.params.args.map(a => a.description || a.value).join(' '));
  });
  await cdp('Runtime.enable');
  await cdp('Page.enable');
  // fenetre fixe : les rangs de degarnissage de la barre d'outils s'y jouent
  await cdp('Emulation.setDeviceMetricsOverride',
    { width: 1500, height: 1000, deviceScaleFactor: 1, mobile: false });
  await cdp('Page.navigate', { url: 'file:///' + OUTIL.replace(/\\/g, '/') });
  await dors(2500);

  const aide = `
  window.__fx = async (nom) => {
    const r = await fetch('file:///${FX.replace(/\\/g, '/')}/' + nom);
    if(!r.ok) throw new Error('fixture introuvable : '+nom);
    return new File([await r.blob()], nom);
  };
  window.__etat = () => ({
    kind: SRC && SRC.kind, nPages: SRC && SRC.nPages,
    diags: DIAGS.map(d => d && d.niveau),
    badges: [...document.querySelectorAll('#vignettes .dg')].map(e => e.textContent),
    diagTxt: document.getElementById('diag_zone').textContent.slice(0, 60),
    btnA: document.getElementById('btnanalyser').style.display !== 'none',
    btnM: document.getElementById('btnmanuel').style.display !== 'none',
    statut: document.getElementById('acc_status').textContent,
    err: document.getElementById('acc_status').className === 'err'
  });
  // « visible » au sens strict : dans la fenetre ET atteignable au clic — c'est
  // ce qui attrape un menu rogne par un overflow:hidden.
  window.__visible = (sel) => {
    const n = document.querySelector(sel);
    if (!n) return false;
    const r = n.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return false;
    const e = document.elementFromPoint(x, y);
    return !!(e && (e === n || n.contains(e) || e.contains(n)));
  };
  window.__barre = () => {
    const zb = document.getElementById('zoombar');
    const mw = zb.querySelector('.menuwrap');
    return { debord: Math.round(mw.getBoundingClientRect().right
                                - zb.getBoundingClientRect().right) };
  };
  window.__plan = () => D ? ({
    rooms: Object.keys(D.rooms).length, pairs: D.pairs.length,
    portes: (D.portes||[]).length, note: D.vision_note, echelle: D.echelle,
    nomsLus: Object.values(D.rooms).filter(r=>r.name && r.name!=='Espace non identifié').length,
    exemples: Object.values(D.rooms).slice(0,3).map(r=>r.num+' / '+r.name),
    aireMed: (()=>{ const a=Object.values(D.rooms).map(r=>r.area_det).filter(v=>v>0).sort((x,y)=>x-y);
                    return a.length ? Math.round(a[a.length>>1]*10)/10 : 0; })(),
    editeur: document.getElementById('approot').style.display !== 'none',
    fond: (document.getElementById('bg').src||'').slice(0,22)
  }) : null;
  true;`;
  await evalue(aide);

  // 1 — la page se charge sans erreur
  verif('la page se charge sans erreur JS', erreurs.length === 0, erreurs.slice(0, 2).join(' | '));
  verif('la version est affichee',
    /^\d+\.\d+\.\d+$/.test(await evalue("document.getElementById('ver').textContent")),
    await evalue("document.getElementById('ver').textContent"));

  // 2 — PDF vectoriel
  await evalue("(async()=>chargerPlan(await __fx('plan.pdf')))()");
  await dors(1200);
  let e = await evalue('__etat()');
  verif('PDF vectoriel : diagnostic « vectoriel »', e.diags[0] === 'vectoriel', JSON.stringify(e.diags));
  verif('PDF vectoriel : badge sur la vignette', e.badges[0] === 'Vectoriel', JSON.stringify(e.badges));
  verif('PDF vectoriel : bouton Analyser propose', e.btnA && !e.btnM);
  await evalue("lancerAnalyse(0, 4, 100)");
  await dors(3000);
  let p = await evalue('__plan()');
  verif('PDF vectoriel : locaux detectes', p && p.rooms >= 12, JSON.stringify(p && {r:p.rooms,c:p.pairs,d:p.portes}));
  verif('PDF vectoriel : noms de locaux lus', p && p.nomsLus >= 10, p && ('' + p.nomsLus));
  verif('PDF vectoriel : echelle juste (local ~29 m2)', p && p.aireMed > 25 && p.aireMed < 32, p && (p.aireMed + ' m2'));
  // 2b — la barre d'outils et ses menus, qu'un overflow:hidden rognait
  verif('barre d’outils : le dernier groupe tient dans la barre',
    (await evalue('__barre()')).debord <= 0, JSON.stringify(await evalue('__barre()')));
  await evalue("document.getElementById('btn_autoconnect').click()");
  await dors(300);
  verif('Auto-connexion : le popover est visible et cliquable',
    await evalue(`__visible('#pop_ac button')`));
  await evalue("fermerMenus()");
  await evalue(`[...document.querySelectorAll('.menuwrap .tbtn')]
    .find(b=>b.textContent.includes('Page')).click()`);
  await dors(300);
  verif('Page / PDF : le menu est visible et cliquable',
    await evalue(`__visible('#m_page button')`));
  verif('Page / PDF : relancer l’analyse y est offert',
    await evalue(`__visible('#srvctl button')`));
  await evalue("fermerMenus()");
  // relance sur place : on observe pendant, puis apres
  await evalue("window.__relance = relancer(); true");
  await dors(400);
  const pendant = await evalue(`({voile: document.getElementById('calclay').classList.contains('on'),
    accueil: document.getElementById('accueil').style.display,
    etape: document.getElementById('calc_num').textContent})`);
  verif('relance : le voile s’affiche sans repasser par l’accueil',
    pendant.voile && pendant.accueil === 'none', JSON.stringify(pendant));
  await evalue("(async()=>{ await window.__relance; })()");
  await dors(500);
  const apres = await evalue(`({voile: document.getElementById('calclay').classList.contains('on'),
    accueil: document.getElementById('accueil').style.display,
    editeur: document.getElementById('approot').style.display})`);
  verif('relance : le voile se referme et l’éditeur reste en place',
    !apres.voile && apres.editeur !== 'none' && apres.accueil === 'none', JSON.stringify(apres));
  verif('relance : le plan est bien ré-analysé',
    await evalue("!!D && D.pairs.length>0"),
    JSON.stringify(await evalue('__plan() && {r:__plan().rooms, c:__plan().pairs}')));

  await evalue("retourAccueil()");

  // 3 — PDF scanne
  await evalue("(async()=>chargerPlan(await __fx('plan_scan.pdf')))()");
  await dors(2500);
  e = await evalue('__etat()');
  verif('PDF scanne : diagnostic « image »', e.diags[0] === 'image', JSON.stringify(e.diags));
  verif('PDF scanne : Analyser masque, trace manuel propose', !e.btnA && e.btnM);
  await evalue("lancerManuel()");
  await dors(2500);
  p = await evalue('__plan()');
  verif('PDF scanne : editeur ouvert en trace manuel',
    p && p.editeur && p.rooms === 0 && p.fond.startsWith('data:image/jpeg'), JSON.stringify(p && {e:p.editeur,f:p.fond}));
  await evalue("retourAccueil()");

  // 4 — SVG
  await evalue("(async()=>chargerPlan(await __fx('plan.svg')))()");
  await dors(1500);
  e = await evalue('__etat()');
  verif('SVG : reconnu comme source', e.kind === 'svg' && !e.err, e.statut);
  verif('SVG : diagnostic « vectoriel »', e.diags[0] === 'vectoriel', JSON.stringify(e.diags));
  await evalue("lancerAnalyse(0, 4, 100)");
  await dors(3000);
  p = await evalue('__plan()');
  verif('SVG : locaux detectes', p && p.rooms >= 12, JSON.stringify(p && {r:p.rooms,c:p.pairs}));
  verif('SVG : noms de locaux lus', p && p.nomsLus >= 10, p && ('' + p.nomsLus));
  verif('SVG : echelle juste (local ~29 m2)', p && p.aireMed > 25 && p.aireMed < 32, p && (p.aireMed + ' m2'));
  await evalue("retourAccueil()");

  // 5 — DXF
  await evalue("(async()=>chargerPlan(await __fx('plan.dxf')))()");
  await dors(2000);
  e = await evalue('__etat()');
  const dxf = await evalue("({unites: SRC.M.unitesAuto, mpu: SRC.M.mpu, choix: SRC.choix, n: SRC.M.liste.length})");
  verif('DXF : unites lues dans le fichier', dxf.mpu === 0.001, JSON.stringify({mpu:dxf.mpu}));
  verif('DXF : calque MUR reconnu', dxf.choix.MUR === 'mur', JSON.stringify(dxf.choix));
  verif('DXF : calque PORTE reconnu', dxf.choix.PORTE === 'porte', JSON.stringify(dxf.choix));
  verif('DXF : MOBILIER et texte ignores',
    dxf.choix.MOBILIER === 'ignore' && dxf.choix['A-TEXTE'] === 'ignore', JSON.stringify(dxf.choix));
  verif('DXF : diagnostic « vectoriel »', e.diags[0] === 'vectoriel', JSON.stringify(e.diags));
  await evalue("lancerAnalyse(0, 4, 100)");
  await dors(4000);
  p = await evalue('__plan()');
  verif('DXF : locaux detectes', p && p.rooms >= 12, JSON.stringify(p && {r:p.rooms,c:p.pairs,d:p.portes}));
  verif('DXF : noms de locaux lus', p && p.nomsLus >= 10, p && ('' + p.nomsLus));
  verif('DXF : echelle exacte (1/100)', p && p.echelle === 100, p && ('' + p.echelle));
  verif('DXF : echelle juste (local ~29 m2)', p && p.aireMed > 25 && p.aireMed < 32, p && (p.aireMed + ' m2'));
  await evalue("retourAccueil()");

  // 5b — retirer le calque de murs bloque l'analyse et le dit
  await evalue(`(()=>{ const i=SRC.M.liste.findIndex(l=>l.nom==='MUR');
    document.querySelector('#dxf_liste .lyr:nth-child('+(i+1)+') .segbtn[data-v="ignore"]').click(); })()`);
  await dors(1500);
  e = await evalue('__etat()');
  const av = await evalue("document.getElementById('dxf_avert').className");
  verif('DXF : sans calque de murs, Analyser est retire', !e.btnA, JSON.stringify({a:e.btnA,m:e.btnM}));
  verif('DXF : sans calque de murs, avertissement affiche', av === 'err', av);
  await evalue(`(()=>{ const i=SRC.M.liste.findIndex(l=>l.nom==='MUR');
    document.querySelector('#dxf_liste .lyr:nth-child('+(i+1)+') .segbtn[data-v="mur"]').click(); })()`);
  await dors(1500);
  e = await evalue('__etat()');
  verif('DXF : le calque remis, Analyser revient', e.btnA, JSON.stringify({a:e.btnA}));
  await evalue("retourAccueil()");

  // 6 — DXF en metres : meme resultat
  await evalue("(async()=>chargerPlan(await __fx('plan_metres.dxf')))()");
  await dors(2000);
  const dxf2 = await evalue("({mpu: SRC.M.mpu})");
  verif('DXF en metres : unites lues', dxf2.mpu === 1, JSON.stringify(dxf2));
  await evalue("lancerAnalyse(0, 4, 100)");
  await dors(4000);
  const p2 = await evalue('__plan()');
  verif('DXF en metres : memes locaux qu\'en mm', p2 && p2.rooms === p.rooms,
    JSON.stringify({mm: p && p.rooms, m: p2 && p2.rooms}));
  await evalue("retourAccueil()");

  // 7 — image
  await evalue("(async()=>chargerPlan(await __fx('plan.png')))()");
  await dors(1500);
  e = await evalue('__etat()');
  verif('Image : Analyser masque, trace manuel propose', !e.btnA && e.btnM, JSON.stringify(e));
  await evalue("lancerManuel()");
  await dors(1500);
  p = await evalue('__plan()');
  verif('Image : editeur ouvert sur le fond',
    p && p.editeur && p.rooms === 0 && p.fond.startsWith('data:image/jpeg'), JSON.stringify(p && {e:p.editeur,f:p.fond}));
  verif("Image : pas de relance d'analyse proposee",
    await evalue("document.getElementById('srvctl').style.display === 'none'"));

  // 8 — aucune erreur console pendant tout le parcours
  verif('aucune erreur JS sur tout le parcours', erreurs.length === 0,
    erreurs.slice(0, 3).join(' | '));

  console.log('\n' + (cas.length - echecs) + '/' + cas.length + ' verifications passees');
  return echecs;
}

let code = 1;
try { code = await main(); }
catch (e) { console.error('BANC INTERROMPU :', e.message); console.error(erreurs.slice(0, 5)); code = 1; }
finally {
  try { ws && ws.close(); } catch (e) {}
  chrome.kill();
  await dors(400);
  try { rmSync(profil, { recursive: true, force: true }); } catch (e) {}
  process.exit(code ? 1 : 0);
}
