// Statische Prüfung des gebauten Anwendungscodes (ohne die Bibliotheken): Netzwerk-, Speicher- und HTML-Schnittstellen nur an den
// erlaubten Stellen. Eine neue Stelle (ein fetch, ein localStorage, ein innerHTML …) lässt den Test scheitern, bis sie hier mit Grund
// eingetragen ist. Prüft jede gebaute Ausgabe (dist, dist-local, dist-offline). Aufruf: node test/statik_test.mjs → «0 Fehler».
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API = {
  fetch: /\bfetch\s*\(/g, xhr: /XMLHttpRequest/g, websocket: /WebSocket/g, eventsource: /EventSource/g, beacon: /sendBeacon/g,
  importScripts: /importScripts/g, worker: /new\s+(?:Shared)?Worker\s*\(/g, image: /new\s+Image\s*\(/g, src: /\.src\s*=/g, open: /window\.open\s*\(/g,
  navigate: /location\.(?:href\s*=|assign|replace)|location\s*=/g, localStorage: /localStorage/g, sessionStorage: /sessionStorage/g, indexedDB: /indexedDB/g,
  caches: /\bcaches\./g, cookie: /document\.cookie/g, serviceWorker: /serviceWorker/g, fileSystem: /show(?:Save|Open)FilePicker|showDirectoryPicker|navigator\.storage/g,
  broadcast: /BroadcastChannel|postMessage/g, history: /history\.(?:pushState|replaceState)/g, windowName: /window\.name\s*=/g,
  innerHTML: /\.innerHTML\s*=|\.outerHTML\s*=|insertAdjacentHTML|document\.write/g, eval: /\beval\s*\(|new\s+Function\s*\(/g
};
// Erlaubt: Modul → Schnittstelle → Anzahl, mit Grund
const ALLOWED = {
  'update.js': { fetch: 1 },                     // Versionsabfrage der Offline-Ausgabe (CSP: genau eine Adresse)
  'ui.js': { src: 3, worker: 1, innerHTML: 1 }   // Bibliotheken pdf.js, Worker, pdf-lib (Artefakt: mit Integritätsprüfung); blob:-Worker offline; Icons aus dem Build
};
let errors = 0, n = 0;
const files = ['dist/index.html', 'dist-local/index.html'].concat(fs.existsSync(path.join(ROOT, 'dist-offline')) ? fs.readdirSync(path.join(ROOT, 'dist-offline')).map(f => 'dist-offline/' + f) : []);
for (const f of files) {
  const p = path.join(ROOT, f); if (!fs.existsSync(p)) { console.log('FEHLER fehlt:', f, '(zuerst bauen)'); errors++; continue; }
  const html = fs.readFileSync(p, 'utf8');
  const a = html.indexOf('/* === lang.js === */'); if (a < 0) { console.log('FEHLER kein Anwendungscode in', f); errors++; continue; }
  const code = html.slice(a, html.indexOf('</script>', a));
  const mods = code.split(/\/\* === ([\w-]+\.js) === \*\//).slice(1);
  for (let i = 0; i < mods.length; i += 2) {
    // Kommentare zählen nicht (sie beschreiben, was der Code nicht tut)
    const name = mods[i], body = mods[i + 1].replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');
    for (const [k, rx] of Object.entries(API)) {
      const got = (body.match(rx) || []).length, want = (ALLOWED[name] || {})[k] || 0; n++;
      if (got !== want) { console.log(`FEHLER ${f}: ${name} ${k}: ${got} Stellen, erlaubt ${want}`); errors++; }
    }
  }
  if (f.startsWith('dist-offline/') && !/Content-Security-Policy/.test(html)) { console.log('FEHLER keine CSP in', f); errors++; }
  if (/-ohne-Versionsabfrage/.test(f) && /=== update\.js ===/.test(html)) { console.log('FEHLER Ausgabe ohne Versionsabfrage enthält update.js'); errors++; }
}
console.log(n, 'Prüfungen;', errors, 'Fehler');
process.exit(errors ? 1 : 0);
