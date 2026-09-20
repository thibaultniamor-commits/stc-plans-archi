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

  // 2a — apercu au survol d'une vignette : voir la planche, et zoomer dedans,
  // avant de lancer le moteur. La vignette de 92 px ne dit pas quel niveau on tient.
  await evalue(`(()=>{ document.querySelector('#vignettes .pg')
    .dispatchEvent(new MouseEvent('mouseenter')); return true; })()`);
  await dors(1600);
  const ap1 = await evalue(`({on: document.getElementById('appop').classList.contains('on'),
    visible: __visible('#appop_vue'), w: document.getElementById('appop_cv').width,
    z: document.getElementById('appop_z').textContent, page: apPage})`);
  verif('Apercu : le survol d\u2019une vignette ouvre la fenetre',
    ap1.on && ap1.visible && ap1.page === 0, JSON.stringify(ap1));
  verif('Apercu : la planche y est rendue en grand', ap1.w >= 600, JSON.stringify({ w: ap1.w }));
  verif('Apercu : elle s\u2019ouvre ajustee a la fenetre', ap1.z === '100 %', ap1.z);
  await evalue(`(()=>{ const v=document.getElementById('appop_vue');
    const r=v.getBoundingClientRect();
    v.dispatchEvent(new WheelEvent('wheel', {deltaY:-600, cancelable:true, bubbles:true,
      clientX:r.left+r.width/2, clientY:r.top+r.height/2})); return true; })()`);
  await dors(1600);
  const ap2 = await evalue(`({z: document.getElementById('appop_z').textContent,
    w: document.getElementById('appop_cv').width, k: apZ/apFit()})`);
  verif('Apercu : la molette zoome', ap2.k > 1.4, JSON.stringify(ap2));
  verif('Apercu : le rendu se refait a la definition du zoom',
    ap2.w > ap1.w, JSON.stringify({ avant: ap1.w, apres: ap2.w }));
  await evalue("document.getElementById('appop_fit').click()");
  await dors(200);
  verif('Apercu : « Ajuster » revient a la planche entiere',
    (await evalue("document.getElementById('appop_z').textContent")) === '100 %',
    await evalue("document.getElementById('appop_z').textContent"));
  await evalue("window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))");
  await dors(200);
  verif('Apercu : Echap referme la fenetre',
    await evalue(`!document.getElementById('appop').classList.contains('on') && apPage===-1`));

  await evalue("lancerAnalyse(0, 4, 100)");
  await dors(3000);
  let p = await evalue('__plan()');
  verif('PDF vectoriel : locaux detectes', p && p.rooms >= 12, JSON.stringify(p && {r:p.rooms,c:p.pairs,d:p.portes}));
  verif('PDF vectoriel : noms de locaux lus', p && p.nomsLus >= 10, p && ('' + p.nomsLus));
  verif('PDF vectoriel : echelle juste (local ~29 m2)', p && p.aireMed > 25 && p.aireMed < 32, p && (p.aireMed + ' m2'));
  // 2b — reprendre un libelle detecte : c'est indispensable des lors que les
  // noms viennent d'une reconnaissance de forme, qui se trompe parfois
  const rn = await evalue(`(()=>{ const c=Object.keys(D.rooms)[0];
    selRoom=c; panel();
    renommerPiece(c,'name','Salle de contrôle'); renommerPiece(c,'num','999');
    const q=D.pairs.find(x=>String(x.ca)===String(c)||String(x.cb)===String(c));
    return {nom:D.rooms[c].name, num:D.rooms[c].num,
            surPaire:q?(String(q.ca)===String(c)?q.name_a:q.name_b):null,
            enregistre:(etatValidation().noms||{})[c]||null,
            champ:(document.getElementById('rname')||{}).value }; })()`);
  verif('Renommer : le libellé détecté est modifiable',
    rn.nom === 'Salle de contrôle' && rn.num === '999', JSON.stringify(rn));
  verif('Renommer : le nom suit jusque dans les cloisons',
    rn.surPaire === 'Salle de contrôle', JSON.stringify(rn.surPaire));
  verif('Renommer : le nom est gardé dans l’état enregistré',
    !!rn.enregistre && rn.enregistre.name === 'Salle de contrôle',
    JSON.stringify(rn.enregistre));
  await evalue("undo(); undo(); selRoom=null; panel(); true");
  await dors(200);
  verif('Renommer : l’annulation revient au libellé lu',
    (await evalue(`(()=>{ const c=Object.keys(D.rooms)[0];
       return D.rooms[c].name!=='Salle de contrôle'; })()`)),
    await evalue(`D.rooms[Object.keys(D.rooms)[0]].name`));
  // 2c — retirer une zone : le moteur sort toujours des cellules qui ne sont
  // pas des locaux (vide de mur, echancrure, cadre d'un numero). Suppr doit les
  // enlever du releve — sans les effacer : l'analyse, elle, les voit toujours.
  const zs = await evalue(`(()=>{
    const c=String(D.pairs[0].ca);
    const compte=()=>({polys:document.querySelectorAll('#ov polygon.room').length,
      lignes:cloisonRows().filter(r=>r.p && (String(r.p.ca)===c||String(r.p.cb)===c)).length,
      ml:Math.round(Object.values(quantitesParSTC()).reduce((a,q)=>a+q.ml,0)*10)/10});
    selRoom=c; selPair=selSeg=selPorte=null; render(); panel();
    const bouton=!!document.getElementById('rdel');
    const av=compte();
    window.dispatchEvent(new KeyboardEvent('keydown',{key:'Delete'}));
    const ap=compte();
    ap.marque=!!state.suppr[c]; ap.enregistre=!!(etatValidation().suppr||{})[c];
    ap.moteur=!!D.rooms[c]; ap.sel=selRoom;
    selRoom=null; panel();
    ap.retablir=!!document.getElementById('rzones');
    return {c, bouton, av, ap};
  })()`);
  verif('Zone : le panneau offre de la retirer', zs.bouton, JSON.stringify(zs.bouton));
  verif('Zone : Suppr la retire du plan', zs.ap.polys === zs.av.polys - 1,
    JSON.stringify({ av: zs.av.polys, ap: zs.ap.polys }));
  verif('Zone : ses cloisons sortent du metre',
    zs.av.lignes > 0 && zs.ap.lignes === 0 && zs.ap.ml < zs.av.ml,
    JSON.stringify({ av: zs.av, ap: zs.ap }));
  verif('Zone : le retrait est garde dans l\u2019etat enregistre',
    zs.ap.marque && zs.ap.enregistre, JSON.stringify(zs.ap));
  verif('Zone : le moteur la connait toujours', zs.ap.moteur, JSON.stringify(zs.ap.moteur));
  verif('Zone : le panneau propose de la retablir', zs.ap.retablir, JSON.stringify(zs.ap));
  await evalue("undo(); true");
  await dors(200);
  const zr = await evalue(`(()=>{ const c=String(D.pairs[0].ca);
    return {marque: !!state.suppr[c],
            polys: document.querySelectorAll('#ov polygon.room').length}; })()`);
  verif('Zone : Ctrl+Z la ramene',
    !zr.marque && zr.polys === zs.av.polys, JSON.stringify(zr));

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

  // 2c — murs pochés : le meme batiment, murs remplis sans aucun contour au trait
  await evalue("(async()=>chargerPlan(await __fx('plan_poche.pdf')))()");
  await dors(1800);
  e = await evalue('__etat()');
  verif('Poché : la page est reconnue analysable', e.btnA && !e.btnM, JSON.stringify(e.diags));
  const poch = await evalue(`(async()=>{ const x=await SRC.extraire(0);
    const p=MOTEUR.pochesDeMur(x.drawings, 2834.6457/100, new Set());
    return {n:p.length, ep:p.length?Math.round(p[0].epais_m*100)/100:null}; })()`);
  verif('Poché : les 11 murs en aplat sont releves', poch.n === 11, JSON.stringify(poch));
  verif('Poché : leur epaisseur est juste (0,15 m)',
    Math.abs(poch.ep - 0.15) < 0.02, poch.ep + ' m');
  await evalue("lancerAnalyse(0, 4, 100)");
  await dors(4000);
  p = await evalue('__plan()');
  verif('Poché : locaux detectes', p && p.rooms >= 16, JSON.stringify(p && {r:p.rooms,c:p.pairs,d:p.portes}));
  verif('Poché : noms de locaux lus', p && p.nomsLus >= 16, p && ('' + p.nomsLus));
  verif('Poché : echelle juste (local ~29 m2)', p && p.aireMed > 25 && p.aireMed < 32, p && (p.aireMed + ' m2'));
  verif('Poché : le mobilier n’est pas pris pour des murs',
    p && p.pairs >= 20 && p.pairs <= 40, p && ('' + p.pairs));
  verif('Poché : l’analyse le signale', /aplat plein/.test((p && p.note) || ''), p && p.note);
  await evalue("retourAccueil()");

  // 2d — echelle deduite des battants de porte
  for (const [fx, att] of [['plan_poche.pdf', 100], ['plan_poche_50.pdf', 50]]) {
    await evalue(`(async()=>chargerPlan(await __fx('${fx}')))()`);
    await dors(1800);
    const r = await evalue(`(async()=>{ const x=await SRC.extraire(0);
      return MOTEUR.echelleAuto(x.drawings, x.pw, x.ph, x.words); })()`);
    verif('Échelle : ' + fx + ' est reconnu 1/' + att,
      !!r && r.ech === att && r.sure === true, JSON.stringify(r));
    verif('Échelle : ' + fx + ' — le cartouche confirme',
      !!r && r.cartouche === att && r.accord === true,
      JSON.stringify({ c: r && r.cartouche }));
    await evalue("document.getElementById('echelle').value=333");
    await evalue("detecterEchelle()");
    await dors(3000);
    verif('Échelle : le bouton Détecter renseigne le champ',
      (await evalue("+document.getElementById('echelle').value")) === att,
      await evalue("document.getElementById('ech_note').textContent"));
    await evalue("retourAccueil()");
  }

  // 2e — lecture des etiquettes : numero, nom dessous, surface dessous.
  // Les cas durs viennent des glyphes vectorises : les chiffres y respirent plus
  // que les lettres (« 11 » sortait « 1 1 »), et le tiret d'un sous-local se perd.
  const mot = (s, x, y, h) => ({ s, x, y, x0: x - s.length * h * 0.3,
                                 x1: x + s.length * h * 0.3, y0: y - h / 2, h });
  const etiq = await evalue('MOTEUR.etiquettes(' + JSON.stringify([
    mot('317', 100, 100, 4.8),
    mot('Salle', 92, 110, 3.6), mot('de', 102, 110, 3.6), mot('réunion', 114, 110, 3.6),
    mot('1 1 m', 100, 117, 3.6),
    mot('305 - 1', 300, 100, 4.8), mot('Bureau', 300, 110, 3.6),
    mot('2400', 500, 100, 3.0)
  ]) + ')');
  const e317 = etiq.find(x => x.num === '317') || {};
  const e305 = etiq.find(x => x.num === '305-1') || {};
  verif('Étiquette : numero et nom apparies', e317.nom === 'Salle de réunion',
    JSON.stringify(e317));
  verif('Étiquette : « 1 1 m » est bien 11 m²', e317.aire === 11, JSON.stringify(e317.aire));
  verif('Étiquette : le sous-local garde son tiret', e305.nom === 'Bureau',
    JSON.stringify(e305));
  verif('Étiquette : une cote isolee n’en est pas une',
    !etiq.some(x => x.num === '2400'), JSON.stringify(etiq.map(x => x.num)));

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

  // 7b — classification : mots entiers, score, et le doute qui se voit
  // « bureau » est contenu dans « bureau partagé » : en sous-chaînes, et au
  // premier trouvé, un plateau partagé ressortait « privé ».
  const cl = await evalue(`(()=>{ const c=MOTEUR.classer;
    return {partage:c('Bureau partagé 06'), bureau:c('101 BUREAU'),
            pluriel:c('Bureaux'), tech:c('LOCAL TECHNIQUE'),
            inconnu:c('Zone de tri des colis'), flou:c('SaIIe de reunion')}; })()`);
  verif('Classer : « bureau partagé » n’est plus « privé »',
    cl.partage.cat === 'collaboratif' && cl.partage.kw === 'bureau partage',
    JSON.stringify(cl.partage));
  verif('Classer : « bureau » seul reste « privé »',
    cl.bureau.cat === 'prive' && cl.pluriel.cat === 'prive',
    JSON.stringify([cl.bureau.cat, cl.pluriel.cat]));
  verif('Classer : le mot-clé le plus précis gagne sur l’ordre des règles',
    cl.tech.cat === 'technique' && cl.tech.net === 1, JSON.stringify(cl.tech));
  verif('Classer : sans mot-clé, « privé » par défaut mais net = 0',
    cl.inconnu.cat === 'prive' && cl.inconnu.net === 0 && cl.inconnu.kw === null,
    JSON.stringify(cl.inconnu));
  verif('Classer : les familles de formes rattrapent « SaIIe »',
    cl.flou.cat === 'conference', JSON.stringify(cl.flou));

  // le doute se voit dans l'interface, et se reprend d'affilée
  await evalue("(async()=>chargerPlan(await __fx('plan.pdf')))()");
  await dors(1200);
  await evalue('lancerAnalyse(0, 4, 100)');
  await dors(3000);
  const dt = await evalue(`(()=>{
    const c=Object.keys(D.rooms)[0];
    selRoom=null; panel();
    const avant=categoriesARevoir().length;
    renommerPiece(c,'name','Zone de tri des colis');
    selRoom=null; panel();
    const apres=categoriesARevoir().length;
    const carte=!!document.querySelector('.conf-row[data-c]');
    state.catvu[c]=true;
    selRoom=null; panel();
    return {avant, apres, carte, arbitre:categoriesARevoir().length,
            conf:D.rooms[c].conf, kw:D.rooms[c].kw, cat:state.cats[c]}; })()`);
  verif('Confiance : un local sans mot-clé passe à 0 et entre dans la relecture',
    dt.conf === 0 && dt.kw === null && dt.apres === dt.avant + 1, JSON.stringify(dt));
  verif('Confiance : la carte « Catégorie à vérifier » s’affiche', dt.carte);
  verif('Confiance : une catégorie tranchée à la main sort de la liste',
    dt.arbitre === dt.apres - 1, JSON.stringify({apres: dt.apres, arbitre: dt.arbitre}));

  // 7c — exporter la vérité terrain : l'étalon du banc, écrit par l'outil
  const vt = await evalue(`(()=>{
    const V=veriteTerrain();
    const dans=(pt,poly)=>{ let d=false;
      for(let i=0,j=poly.length-1;i<poly.length;j=i++){
        const [xi,yi]=poly[i],[xj,yj]=poly[j];
        if((yi>pt[1])!==(yj>pt[1]) && pt[0]<(xj-xi)*(pt[1]-yi)/(yj-yi)+xi) d=!d; }
      return d; };
    let dedans=0;
    for(const c of Object.keys(D.polys)){
      const r=D.rooms[c]; if(!r) continue;
      const v=V.rooms.find(q=>q.num===String(r.num) && q.name===r.name);
      if(v && dans([v.cx,v.cy], D.polys[c])) dedans++;
    }
    return {n:V.rooms.length, dedans, pairs:V.pairs.length, portes:V.portes.length,
            page:V.page, echelle:V.echelle, plan:V.plan,
            cles:Object.keys(V.rooms[0]||{}).sort().join(',')}; })()`);
  verif('Vérité terrain : un local par zone du relevé', vt.n >= 12, JSON.stringify({n: vt.n}));
  verif('Vérité terrain : le point repère tombe dans la pièce',
    vt.dedans === vt.n, JSON.stringify({dedans: vt.dedans, sur: vt.n}));
  verif('Vérité terrain : les champs attendus par tests/verite.mjs',
    vt.cles === 'area_m2,area_source,cat,cx,cy,name,num', vt.cles);
  verif('Vérité terrain : cloisons, portes, page et échelle',
    vt.pairs > 0 && vt.page === 1 && vt.echelle === 100 && vt.plan === 'plan.pdf',
    JSON.stringify({p: vt.pairs, d: vt.portes, pg: vt.page, e: vt.echelle}));

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
