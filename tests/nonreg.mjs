// Non-regression : le meme PDF passe dans deux builds successifs et on compare
// ce que l'analyse en tire, page par page. A lancer sur de vrais plans, qui
// restent sur le poste — rien n'est versionne ni envoye.
//
//   git show <tag>:index.html > /tmp/avant.html
//   node tests/nonreg.mjs <dossier> /tmp/avant.html index.html plan1.pdf plan2.pdf
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const DOSSIER0 = process.argv[2], AVANT0 = process.argv[3], APRES0 = process.argv[4];
const PLANS = process.argv.slice(5);
const dors = ms => new Promise(r => setTimeout(r, ms));

async function mesurer(outil, port, plans, dossier) {
  const profil = mkdtempSync(join(tmpdir(), 'stcnr-'));
  const chrome = spawn(process.env.CHROME_BIN
    || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
    '--headless=new', '--remote-debugging-port=' + port, '--disable-gpu', '--no-first-run',
    '--no-default-browser-check', '--allow-file-access-from-files',
    '--user-data-dir=' + profil, 'about:blank'], { stdio: 'ignore' });
  let ws, id = 0; const att = new Map();
  const cdp = (m, p = {}) => { const n = ++id; ws.send(JSON.stringify({ id: n, method: m, params: p }));
    return new Promise((ok, ko) => { att.set(n, { ok, ko });
      setTimeout(() => { if (att.delete(n)) ko(new Error('timeout ' + m)); }, 300000); }); };
  const ev = async e => { const r = await cdp('Runtime.evaluate',
      { expression: e, awaitPromise: true, returnByValue: true, timeout: 280000 });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value; };
  try {
    let u = null;
    for (let i = 0; i < 80 && !u; i++) {
      try { u = (await (await fetch('http://127.0.0.1:' + port + '/json/list')).json())
        .find(t => t.type === 'page')?.webSocketDebuggerUrl; } catch (e) {}
      if (!u) await dors(250);
    }
    ws = new WebSocket(u);
    await new Promise(r => ws.addEventListener('open', r));
    ws.addEventListener('message', e => { const m = JSON.parse(e.data);
      if (m.id && att.has(m.id)) { const a = att.get(m.id); att.delete(m.id);
        m.error ? a.ko(new Error(m.error.message)) : a.ok(m.result); } });
    await cdp('Runtime.enable'); await cdp('Page.enable');
    await cdp('Page.navigate', { url: 'file:///' + resolve(outil).replace(/\\/g, '/') });
    await dors(3000);
    await ev(`window.__fx = async n => new File([await (await fetch('file:///${dossier.replace(/\\/g,'/')}/'+n)).blob()], n); true;`);
    const res = {};
    for (const nom of plans) {
      try {
        await ev(`(async()=>{const f=await __fx(${JSON.stringify(nom)});
          if(typeof chargerPlan==='function') return chargerPlan(f); return chargerPDF(f);})()`);
        await dors(6000);
        const n = await ev('pdfDoc ? pdfDoc.numPages : 0');
        res[nom] = [];
        for (let p = 0; p < Math.min(n, 4); p++) {
          await ev(`lancerAnalyse(${p}, 4, 100)`);
          await dors(15000);
          res[nom].push(await ev(`D && D.rooms ? ({rooms:Object.keys(D.rooms).length,
            pairs:D.pairs.length, portes:(D.portes||[]).length,
            nommes:Object.values(D.rooms).filter(r=>r.name&&r.name!=='Espace non identifié').length,
            clip:D.clip.map(v=>Math.round(v))}) : 'echec'`));
          await ev('retourAccueil()');
        }
      } catch (e) { res[nom] = 'ERREUR ' + e.message.slice(0, 120); }
    }
    return res;
  } finally { try { ws?.close(); } catch (e) {} chrome.kill(); await dors(500);
    try { rmSync(profil, { recursive: true, force: true }); } catch (e) {} }
}

const DOSSIER = resolve(DOSSIER0);
const a = await mesurer(AVANT0, 9401, PLANS, DOSSIER);
const b = await mesurer(APRES0, 9402, PLANS, DOSSIER);
console.log('=== avant ==='); console.log(JSON.stringify(a, null, 1));
console.log('=== apres ==='); console.log(JSON.stringify(b, null, 1));
let diff = 0;
for (const k of Object.keys(a)) if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) { diff++; console.log('DIFFERENT : ' + k); }
console.log(diff ? diff + ' plan(s) different(s)' : 'identique sur tous les plans');
process.exit(0);
