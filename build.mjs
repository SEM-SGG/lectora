// Baut Lectora aus src/: Icons (Lucide), Schriften (IBM Plex), Beispieldokumente, Standardprofile (profile/), Styles und Skripte.
// Gestaltung nach dem Design System «Carbon» (design/carbon/tokens.css); die Tokens stehen statisch in src/styles.css.
//
// Drei Ausgaben aus derselben Quelle, unterschieden zur Laufzeit über DP.offline:
//   node build.mjs                               dist/index.html      Artefakt-Ausgabe (claude.ai): Bibliotheken von cdnjs mit Integritätsprüfung (SRI)
//   node build.mjs --local                       dist-local/          Testausgabe: dieselben Bibliotheken als Dateien in dist-local/vendor/
//   node build.mjs --offline                     dist-offline/Lectora-<Version>.html   Offline-Ausgabe: eine Datei, alles eingebettet;
//                                                einzige Verbindung: beim Start die Versionsabfrage (version.json im Repository)
//   node build.mjs --offline --no-update-check   dist-offline/Lectora-<Version>-ohne-Versionsabfrage.html   ohne diese Abfrage
//                                                (connect-src 'none', der Code der Abfrage fehlt); wird nicht veröffentlicht
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { noticesComment } from './tools/notices.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const rd = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const ARGS = process.argv.slice(2);
const KNOWN = ['--local', '--offline', '--no-update-check'];
for (const a of ARGS) if (!KNOWN.includes(a)) { console.error('Unbekannte Option: ' + a + ' (bekannt: ' + KNOWN.join(', ') + ')'); process.exit(2); }
const LOCAL = ARGS.includes('--local'), OFFLINE = ARGS.includes('--offline'), NO_UPDATE = ARGS.includes('--no-update-check');
if (NO_UPDATE && !OFFLINE) { console.error('--no-update-check gilt nur zusammen mit --offline'); process.exit(2); }
if (LOCAL && OFFLINE) { console.error('--local und --offline schliessen sich aus'); process.exit(2); }

/* ---------- Bibliotheken: aus den npm-Paketen (Versionen fest in package.json und package-lock.json), Byte für Byte geprüft ----------
   Die Hashwerte sind dieselben wie die Integritätsprüfung (SRI) der Artefakt-Ausgabe: Die Dateien auf cdnjs sind identisch mit den
   Dateien der npm-Pakete (test/cdn_test.py lädt sie über cdnjs). Ändert sich eine Version, schlägt der Build fehl, bis der neue
   Hashwert hier steht (und die Adresse auf cdnjs in CDN_PATH). */
const LIBFILES = {
  'jszip.min.js': { npm: 'jszip/dist/jszip.min.js', cdn: 'jszip/3.10.1/jszip.min.js', sha512: 'XMVd28F1oH/O71fzwBnV7HucLxVwtxf26XV8P4wPk26EDxuGZ91N8bsOttmnomcCD3CS5ZMRL50H0GgOHvegtg==' },
  'pdf.min.js': { npm: 'pdfjs-dist/build/pdf.min.js', cdn: 'pdf.js/3.11.174/pdf.min.js', sha512: 'q+4liFwdPC/bNdhUpZx6aXDx/h77yEQtn4I1slHydcbZK34nLaR3cAeYSJshoxIOq3mjEf7xJE8YWIUHMn+oCQ==' },
  'pdf.worker.min.js': { npm: 'pdfjs-dist/build/pdf.worker.min.js', cdn: 'pdf.js/3.11.174/pdf.worker.min.js', sha512: 'BbrZ76UNZq5BhH7LL7pn9A4TKQpQeNCHOo65/akfelcIBbcVvYWOFQKPXIrykE3qZxYjmDX573oa4Ywsc7rpTw==' },
  'pdf-lib.min.js': { npm: 'pdf-lib/dist/pdf-lib.min.js', cdn: 'pdf-lib/1.17.1/pdf-lib.min.js', sha512: 'z8IYLHO8bTgFqj+yrPyIJnzBDf7DDhWwiEsk4sY+Oe6J2M+WQequeGS7qioI5vT6rXgVRb4K1UVQC5ER7MKzKQ==' }
};
const libBuf = {};
for (const [f, L] of Object.entries(LIBFILES)) {
  const p = path.join(ROOT, 'node_modules', L.npm);
  if (!fs.existsSync(p)) { console.error('Fehlt: node_modules/' + L.npm + ' (zuerst npm ci)'); process.exit(1); }
  const b = fs.readFileSync(p), h = crypto.createHash('sha512').update(b).digest('base64');
  if (h !== L.sha512) { console.error('Hashwert stimmt nicht: node_modules/' + L.npm + '\n  erwartet sha512-' + L.sha512 + '\n  gefunden sha512-' + h); process.exit(1); }
  libBuf[f] = b;
}


/* ---------- Icons (Lucide, Strichzeichnung 24 × 24): Schlüssel aus ui.js → Lucide-Datei ---------- */
const ICON_MAP = {
  description: 'file-text', fact_check: 'clipboard-check', compare_arrows: 'arrow-left-right', download: 'download', checklist: 'list-checks',
  upload_file: 'file-up', lock: 'lock', delete_sweep: 'eraser', close: 'x', check: 'check', check_circle: 'circle-check', error: 'octagon-alert',
  warning: 'triangle-alert', info: 'info', auto_awesome: 'sparkles', picture_as_pdf: 'file-type', article: 'file-text', slideshow: 'presentation',
  swap_horiz: 'arrow-left-right', delete: 'trash-2', undo: 'undo-2', visibility_off: 'eye-off', visibility: 'eye', content_copy: 'copy',
  arrow_forward: 'arrow-right', keyboard: 'keyboard', assignment_turned_in: 'clipboard-check', account_tree: 'list-tree', spellcheck: 'spell-check', format_quote: 'quote',
  link: 'link', accessibility_new: 'accessibility', psychology: 'brain', translate: 'languages', stop_circle: 'circle-stop', expand_more: 'chevron-down',
  edit: 'pencil', cloud_off: 'cloud-off', done_all: 'check-check', remove_done: 'list-x', rate_review: 'message-square', verified: 'badge-check',
  science: 'flask-conical', computer: 'monitor', edit_document: 'file-pen-line', summarize: 'clipboard-list', gpp_maybe: 'shield-alert', south: 'arrow-down',
  menu: 'menu', arrow_back: 'arrow-left', tune: 'sliders-horizontal', help: 'circle-help', unfold_more: 'chevrons-up-down', unfold_less: 'chevrons-down-up', view_column: 'columns-3',
  flag: 'flag', flag_off: 'flag-off', history: 'history', save: 'save', folder_open: 'folder-open', file_diff: 'file-diff', file_json: 'file-json',
  table: 'table', sort: 'arrow-down-wide-narrow', refresh: 'refresh-cw', wand: 'wand-sparkles', filter: 'list-filter', pin: 'pin', remove: 'circle-x'
};
// Frühere gefüllte Varianten zeigen auf dieselbe Strichzeichnung
for (const n of ['error', 'warning', 'info', 'check_circle', 'lock', 'verified']) ICON_MAP[n + '_fill'] = ICON_MAP[n];
const icons = {};
for (const [k, f] of Object.entries(ICON_MAP)) {
  const s = fs.readFileSync(path.join(ROOT, 'node_modules/lucide-static/icons', f + '.svg'), 'utf8');
  const m = /<svg[^>]*>([\s\S]*?)<\/svg>/.exec(s); if (!m) throw new Error('icon ' + f);
  icons[k] = m[1].replace(/\s*\n\s*/g, '').replace(/\s+\/>/g, '/>').trim();
}

/* ---------- Schriften: IBM Plex Sans, Serif und Mono (SIL OFL, unveränderte Teilmenge latin aus @fontsource), als data:-URI eingebettet ---------- */
const FACES = [
  ['IBM Plex Sans', 'ibm-plex-sans', 300, 'normal'], ['IBM Plex Sans', 'ibm-plex-sans', 400, 'normal'], ['IBM Plex Sans', 'ibm-plex-sans', 400, 'italic'], ['IBM Plex Sans', 'ibm-plex-sans', 600, 'normal'],
  ['IBM Plex Serif', 'ibm-plex-serif', 400, 'normal'], ['IBM Plex Serif', 'ibm-plex-serif', 400, 'italic'],
  ['IBM Plex Mono', 'ibm-plex-mono', 400, 'normal']
];
let fontBytes = 0;
const fontFace = FACES.map(([fam, pkg, w, st]) => {
  const buf = fs.readFileSync(path.join(ROOT, 'node_modules/@fontsource', pkg, 'files', `${pkg}-latin-${w}-${st}.woff2`)); fontBytes += buf.length;
  return `@font-face{font-family:'${fam}';font-style:${st};font-display:swap;font-weight:${w};src:url(data:font/woff2;base64,${buf.toString('base64')}) format('woff2');}`;
}).join('\n');

/* ---------- Beispieldokumente ---------- */
const demo = {};
for (const [k, f] of [['Weisung_Auskunftsgesuche_DE.docx', 'weisung_de_demo.docx'], ['Directive_demandes_de_renseignements_FR.docx', 'weisung_fr_errors.docx'], ['Direttiva_domande_di_informazioni_IT.docx', 'weisung_it_clean.docx']])
  demo[k] = fs.readFileSync(path.join(ROOT, 'test/fixtures', f)).toString('base64');

/* ---------- Standardprofile der Sektion (profile/*.json): im Format eines gespeicherten Prüfprofils, zusätzlich names {de, fr, it} ---------- */
const profiles = [];
for (const f of fs.readdirSync(path.join(ROOT, 'profile')).filter(f => f.endsWith('.json')).sort()) {
  const o = JSON.parse(rd('profile/' + f));
  if (o.format !== 'lectora-profil' || !o.settings || !o.names || !['de', 'fr', 'it'].every(l => typeof o.names[l] === 'string' && o.names[l].trim()))
    throw new Error('profile/' + f + ': kein Lectora-Profil mit names.de, names.fr und names.it');
  profiles.push({ id: f.replace(/\.json$/, ''), names: o.names, text: JSON.stringify(o) });
}

/* ---------- Version: aus package.json, Stand = Datum des Builds (JJJJ-MM-TT); im Code als DP.version und DP.buildDate ---------- */
const VERSION = JSON.parse(rd('package.json')).version;
// Stand: Datum des Builds; SOURCE_DATE_EPOCH (Sekunden) setzt ihn fest, für nachvollziehbare Builds
const BUILD_DATE = (process.env.SOURCE_DATE_EPOCH ? new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000) : new Date()).toISOString().slice(0, 10);
const vj = JSON.parse(rd('version.json'));
if (vj.version !== VERSION) { console.error('version.json (' + vj.version + ') und package.json (' + VERSION + ') stimmen nicht überein'); process.exit(1); }
// Versionsabfrage der Offline-Ausgabe: feste Adresse, im Code von src/update.js als Konstante; die CSP erlaubt genau diese Adresse
const UPDATE_CHECK = OFFLINE && !NO_UPDATE;
const VERSION_URL = 'https://sem-sgg.github.io/lectora/version.json';

/* ---------- Zusammensetzen ---------- */
const esc = (s) => s.replace(/ /g, '\\u00a0').replace(/ /g, '\\u202f').replace(/‑/g, '\\u2011').replace(/­/g, '\\u00ad');
const MODULES = ['lang', 'erlasse', 'modal', 'i18n', 'parse', 'rules', 'align', 'recheck', 'profile', 'docx-export', 'annot-export', 'ai', 'duties'].concat(UPDATE_CHECK ? ['update'] : [], ['ui']);
if (UPDATE_CHECK && !rd('src/update.js').includes("'" + VERSION_URL + "'")) throw new Error('src/update.js: Adresse der Versionsabfrage weicht von build.mjs ab');
const js = MODULES.map(n => `/* === ${n}.js === */\n` + esc(rd(`src/${n}.js`))).join('\n').replace(/<\/script/gi, '<\\/script');
const css = fontFace + '\n' + rd('src/styles.css');
let html = rd('src/index.template.html');
const put = (mark, val) => { if (!html.includes(mark)) throw new Error('Platzhalter fehlt: ' + mark); html = html.split(mark).join(val); };
const sri = (f) => 'sha512-' + LIBFILES[f].sha512;
const CDN = 'https://cdnjs.cloudflare.com/ajax/libs/';
const LIBS = LOCAL
  ? { jszip: 'vendor/jszip.min.js', pdf: 'vendor/pdf.min.js', worker: 'vendor/pdf.worker.min.js', pdflib: 'vendor/pdf-lib.min.js' }
  : OFFLINE ? {}
  : { jszip: CDN + LIBFILES['jszip.min.js'].cdn, pdf: CDN + LIBFILES['pdf.min.js'].cdn, worker: CDN + LIBFILES['pdf.worker.min.js'].cdn, pdflib: CDN + LIBFILES['pdf-lib.min.js'].cdn };
const vendor = (f) => libBuf[f].toString('utf8').replace(/<\/script/gi, '<\\/script');
const DATA = `window.DP=window.DP||{};DP.version=${JSON.stringify(VERSION)};DP.buildDate=${JSON.stringify(BUILD_DATE)};DP.offline=${OFFLINE};DP.updateCheck=${UPDATE_CHECK};window.DP_ICONS=${JSON.stringify(icons)};window.DP_DEMO=${JSON.stringify(demo)};window.DP_PROFILES=${JSON.stringify(profiles)};window.DP_LIBS=${JSON.stringify(Object.assign({}, LIBS, LOCAL || OFFLINE ? {} : { pdfSri: sri('pdf.min.js'), workerSri: sri('pdf.worker.min.js'), pdflibSri: sri('pdf-lib.min.js') }))};`;
if (OFFLINE) {
  // Alle Bibliotheken als eingebettete Skripte; die Hilfsdatei von pdf.js (Worker) als Text, aus dem die Seite einen blob:-Worker startet
  for (const f of ['jszip.min.js', 'pdf.min.js', 'pdf-lib.min.js', 'pdf.worker.min.js']) if (/<!--/.test(libBuf[f].toString('utf8'))) throw new Error('<!-- in ' + f);
  put('<script src="vendor/jszip.min.js"></script>', '<script>' + vendor('jszip.min.js') + '</script>\n<script>' + vendor('pdf.min.js') + '</script>\n<script>' + vendor('pdf-lib.min.js') + '</script>\n<script type="text/plain" id="pdfWorkerSrc">' + vendor('pdf.worker.min.js') + '</script>');
} else put('<script src="vendor/jszip.min.js"></script>', LOCAL ? '<script src="vendor/jszip.min.js"></script>' : `<script src="${LIBS.jszip}" integrity="${sri('jszip.min.js')}" crossorigin="anonymous" referrerpolicy="no-referrer"></script>`);
put('/*__CSS__*/', css);
put('/*__DATA__*/', DATA);
put('/*__JS__*/', js);
if (OFFLINE) {
  // Sicherheitsrichtlinie (CSP) der Offline-Ausgabe: macht «nichts verlässt diesen Computer» überprüfbar. Jede Anweisung und ihr Grund:
  //   default-src 'none'    Grundsatz: nichts laden, nichts verbinden, was nicht unten ausdrücklich erlaubt ist (Bilder, Medien, Rahmen, Objekte, Manifest …)
  //   script-src 'sha256-…' nur die eingebetteten Skripte dieser Datei, je mit ihrem Hash; keine fremden Skripte, kein eval, keine Ereignisattribute
  //   style-src 'sha256-…'  nur der eingebettete Stilblock (Stile, die das Skript über style.setProperty setzt, sind davon nicht betroffen)
  //   img-src data:         das Favicon ist ein data:-SVG; sonst keine Bilder
  //   font-src data:        die Schriften IBM Plex stehen als data:-WOFF2 im Stilblock
  //   worker-src blob:      pdf.js liest PDF-Dateien in einem Worker; die Seite startet ihn aus dem eingebetteten Text über eine blob:-Adresse
  //   connect-src <Adresse> nur die Versionsabfrage: genau die Datei version.json im Repository (Quellausdruck mit Pfad, ohne Abfrageteil);
  //                         kein anderes fetch, kein XHR, kein WebSocket, kein Beacon. Mit --no-update-check: connect-src 'none'
  //   base-uri 'none'       kein <base>, das Adressen umlenken könnte (fällt nicht auf default-src zurück)
  //   form-action 'none'    kein Formular darf Daten absenden (fällt nicht auf default-src zurück)
  // Gespeicherte Dateien gehen über einen blob:-Link mit download-Attribut an den Browser: das ist ein Download, keine Verbindung.
  const hash = (body) => "'sha256-" + crypto.createHash('sha256').update(body, 'utf8').digest('base64') + "'";
  const scripts = [], styles = [];
  html.replace(/<script>([\s\S]*?)<\/script>/g, (_, b) => { scripts.push(hash(b)); return _; });
  html.replace(/<style>([\s\S]*?)<\/style>/g, (_, b) => { styles.push(hash(b)); return _; });
  // Ausserhalb der Skripte: keine Quelle ausser data: (Favicon, Schriften); kein src=, kein href= auf eine Adresse, kein url() ausser data:
  const markup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '<script></script>');
  if (/<script[^>]+src=|\s(?:src|href)="(?!data:|#)|url\((?!data:)/.test(markup)) throw new Error('externe Quelle in der Offline-Ausgabe');
  const CSP = ["default-src 'none'", 'script-src ' + scripts.join(' '), 'style-src ' + styles.join(' '), 'img-src data:', 'font-src data:', 'worker-src blob:', 'connect-src ' + (UPDATE_CHECK ? VERSION_URL : "'none'"), "base-uri 'none'", "form-action 'none'"].join('; ');
  put('<meta charset="utf-8">', '<meta charset="utf-8">\n<meta http-equiv="Content-Security-Policy" content="' + CSP + '">');
  put('<title>Lectora Dokumentenprüfung</title>', '<title>Lectora Dokumentenprüfung · Offline-Ausgabe ' + VERSION + '</title>');
}
// Lizenzhinweise der eingebetteten Komponenten (Bibliotheken, Schriften, Icons) am Anfang jeder Ausgabe
put('<!DOCTYPE html>\n', '<!DOCTYPE html>\n' + noticesComment(VERSION) + '\n');
const OUT = LOCAL ? 'dist-local' : OFFLINE ? 'dist-offline' : 'dist';
const FILE = OFFLINE ? 'Lectora-' + VERSION + (NO_UPDATE ? '-ohne-Versionsabfrage' : '') + '.html' : 'index.html';
fs.mkdirSync(path.join(ROOT, OUT, LOCAL ? 'vendor' : ''), { recursive: true });
fs.writeFileSync(path.join(ROOT, OUT, FILE), html);
if (LOCAL) for (const f of Object.keys(LIBFILES)) fs.writeFileSync(path.join(ROOT, OUT, 'vendor', f), libBuf[f]);
console.log(OUT + '/' + FILE, 'v' + VERSION, BUILD_DATE, (Buffer.byteLength(html) / 1024).toFixed(0) + ' KiB', '| icons', Object.keys(icons).length, '| fonts', FACES.length, (fontBytes / 1024).toFixed(0) + ' KiB', '| profiles', profiles.length, OFFLINE ? '| Versionsabfrage ' + (UPDATE_CHECK ? 'ja' : 'nein') : '');
