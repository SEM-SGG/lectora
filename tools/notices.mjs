// Drittkomponenten, die in die verteilten HTML-Dateien gelangen, mit Version, Lizenz und dem Lizenztext aus dem installierten Paket.
// Eine Quelle für zwei Ausgaben:
//   - den Lizenzkommentar am Anfang jeder gebauten HTML-Datei (build.mjs ruft noticesComment() auf)
//   - THIRD-PARTY-NOTICES.md im Repository (node tools/notices.mjs --write; --check meldet eine veraltete Datei)
// Neue Bibliothek, neue Schrift oder neues Icon-Paket: hier eintragen, dann --write.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NM = (p) => path.join(ROOT, 'node_modules', p);
const pkg = (name) => JSON.parse(fs.readFileSync(NM(name + '/package.json'), 'utf8'));
const text = (p) => fs.readFileSync(NM(p), 'utf8').replace(/\r\n?/g, '\n').trim();

/** pako: MIT (LICENSE) und die Zlib-Lizenz der Teile, die aus zlib übertragen sind (Kopf von lib/zlib/deflate.js, unverändert). */
function pakoText() {
  const head = fs.readFileSync(NM('pako/lib/zlib/deflate.js'), 'utf8').split('\n').filter(l => l.startsWith('//')).map(l => l.replace(/^\/\/ ?/, '')).join('\n').trim();
  if (!/Jean-loup Gailly and Mark Adler/.test(head) || !/may not be removed or altered/.test(head)) throw new Error('pako: Zlib-Lizenz im Kopf von lib/zlib/deflate.js nicht gefunden');
  return text('pako/LICENSE') + '\n\nZlib-Lizenz (Teile aus zlib, Kopf von pako/lib/zlib/*.js):\n\n' + head;
}
/** Nur der MIT-Teil der doppelt lizenzierten JSZip (Lectora nutzt JSZip unter MIT). */
function jszipMit() {
  const t = text('jszip/LICENSE.markdown');
  const a = t.indexOf('The MIT License'), b = t.indexOf('GPL version 3');
  if (a < 0 || b < 0) throw new Error('JSZip: MIT-Abschnitt in LICENSE.markdown nicht gefunden');
  return t.slice(0, a).trim() + '\n\n' + t.slice(a, b).replace(/=+\n/g, '').trim();
}
/** Lizenz der Schriften: Copyright-Zeile der Familie (die Datei listet jeden Schnitt) und der unveränderte Text der OFL. */
function ofl(pkgName) {
  const t = text(pkgName + '/LICENSE');
  const nl = t.indexOf('\n');
  const first = t.slice(0, nl), m = /^Copyright \d{4} IBM Corp\. All rights reserved\./.exec(first);
  if (!m) throw new Error(pkgName + ': unerwartete erste Zeile der Lizenz');
  return m[0] + '\n' + t.slice(nl).trim();
}

/** Komponenten in der verteilten Datei. where: wo sie in den Ausgaben stecken. */
export function components() {
  const v = (n) => pkg(n).version;
  return [
    { name: 'JSZip', pkg: 'jszip', version: v('jszip'), license: 'MIT (gewählt aus «MIT OR GPL-3.0-or-later»)', where: 'Offline-Ausgabe: eingebettet. Artefakt: von cdnjs geladen (dieselbe Datei, mit Integritätsprüfung).',
      file: 'jszip/dist/jszip.min.js', body: jszipMit(),
      bundled: [
        { name: 'pako', version: v('pako') + ' (in JSZip gebündelt)', license: 'MIT AND Zlib', body: pakoText() },
        { name: 'lie', version: v('lie') + ' (in JSZip gebündelt)', license: 'MIT', body: text('lie/license.md').replace(/^#/, '') },
        { name: 'immediate', version: v('immediate') + ' (in JSZip gebündelt)', license: 'MIT', body: text('immediate/LICENSE.txt') },
        { name: 'setimmediate', version: v('setimmediate') + ' (in JSZip gebündelt)', license: 'MIT', body: text('setimmediate/LICENSE.txt') }] },
    { name: 'PDF.js (pdfjs-dist)', pkg: 'pdfjs-dist', version: v('pdfjs-dist'), license: 'Apache-2.0', where: 'Offline-Ausgabe: eingebettet (Bibliothek und Worker). Artefakt: von cdnjs geladen.',
      file: 'pdfjs-dist/build/pdf.min.js, pdfjs-dist/build/pdf.worker.min.js', body: text('pdfjs-dist/LICENSE') },
    { name: 'pdf-lib', pkg: 'pdf-lib', version: v('pdf-lib'), license: 'MIT', where: 'Offline-Ausgabe: eingebettet. Artefakt: von cdnjs geladen, erst beim Export mit Kommentaren.',
      file: 'pdf-lib/dist/pdf-lib.min.js', body: text('pdf-lib/LICENSE.md'),
      bundled: [
        { name: '@pdf-lib/standard-fonts', version: v('@pdf-lib/standard-fonts') + ' (in pdf-lib gebündelt)', license: 'MIT', body: text('@pdf-lib/standard-fonts/LICENSE.md') },
        { name: '@pdf-lib/upng', version: v('@pdf-lib/upng') + ' (in pdf-lib gebündelt)', license: 'MIT', body: text('@pdf-lib/upng/LICENSE') },
        { name: 'pako', version: v('pako') + ' (in pdf-lib gebündelt)', license: 'MIT AND Zlib', body: pakoText() },
        { name: 'tslib', version: '(in pdf-lib gebündelt)', license: 'Apache-2.0 laut Kopfzeile in der Datei', body: 'Copyright (c) Microsoft Corporation. All rights reserved. Der Lizenzkopf steht unverändert in pdf-lib.min.js; der Text der Apache License 2.0 steht oben bei PDF.js.' }] },
    { name: 'IBM Plex Sans', pkg: '@fontsource/ibm-plex-sans', version: v('@fontsource/ibm-plex-sans'), license: 'OFL-1.1', where: 'Alle Ausgaben: Schnitte 300, 400, 400 kursiv, 600 (Teilmenge latin, WOFF2) als data:-Adresse im Stilblock.', body: ofl('@fontsource/ibm-plex-sans') },
    { name: 'IBM Plex Serif', pkg: '@fontsource/ibm-plex-serif', version: v('@fontsource/ibm-plex-serif'), license: 'OFL-1.1', where: 'Alle Ausgaben: Schnitte 400 und 400 kursiv (latin, WOFF2).', body: ofl('@fontsource/ibm-plex-serif') },
    { name: 'IBM Plex Mono', pkg: '@fontsource/ibm-plex-mono', version: v('@fontsource/ibm-plex-mono'), license: 'OFL-1.1', where: 'Alle Ausgaben: Schnitt 400 (latin, WOFF2).', body: ofl('@fontsource/ibm-plex-mono') },
    { name: 'Lucide (lucide-static)', pkg: 'lucide-static', version: v('lucide-static'), license: 'ISC; Icons aus Feather zusätzlich MIT', where: 'Alle Ausgaben: Pfade der verwendeten Icons (Liste in build.mjs, ICON_MAP) als Text im Skript.', body: text('lucide-static/LICENSE') }
  ];
}

/** Nur für Entwicklung und Tests; nicht in den verteilten Dateien. */
export const DEV_ONLY = [
  ['axe-core', 'npm', 'MPL-2.0', 'Barrierefreiheitsprüfung in den Browser-Tests (wird nur in Testseiten eingespielt)'],
  ['Playwright', 'PyPI', 'Apache-2.0', 'Steuert Chromium in den Browser-Tests'],
  ['Chromium (über Playwright)', 'Playwright', 'BSD-3-Clause und weitere', 'Browser der Tests'],
  ['python-docx', 'PyPI', 'MIT', 'Erzeugt die synthetischen Word-Testdokumente, liest Exporte'],
  ['python-pptx', 'PyPI', 'MIT', 'Erzeugt die PowerPoint-Testdokumente, liest Exporte'],
  ['pypdf', 'PyPI', 'BSD-3-Clause', 'Liest PDF-Exporte, erzeugt PDF-Varianten der Testdokumente'],
  ['lxml', 'PyPI', 'BSD-3-Clause', 'XML-Prüfung der Office-Exporte'],
  ['Pillow', 'PyPI', 'MIT-CMU (HPND)', 'Bilder in Testdokumenten, Kontrastprüfung'],
  ['LibreOffice', 'Systempaket', 'MPL-2.0', 'Wandelt Testdokumente nach PDF, Rundlauf der Exporte'],
  ['poppler-utils', 'Systempaket', 'GPL-2.0-or-later', 'pdftoppm: Bildschirmfotos von PDF-Seiten in Tests'],
  ['qpdf', 'Systempaket', 'Apache-2.0', 'Strukturprüfung der PDF-Exporte']
];

/** Lizenzkommentar für den Anfang der HTML-Datei. Enthält keine Zeichenfolge, die einen HTML-Kommentar beendet. */
export function noticesComment(version) {
  const parts = ['Lectora ' + version + '. Diese Datei enthält Komponenten Dritter. Hier stehen ihre Lizenzhinweise.', 'Übersicht im Repository: THIRD-PARTY-NOTICES.md.', ''];
  for (const c of components()) {
    parts.push('=== ' + c.name + ' ' + c.version + ' — ' + c.license, c.body, '');
    for (const b of c.bundled || []) parts.push('--- ' + b.name + ' ' + b.version + ' — ' + b.license, b.body, '');
  }
  const s = parts.join('\n').replace(/--!?>/g, '- ->').replace(/<!--/g, '<! --');
  return '<!--\n' + s + '\n-->';
}

export function noticesMarkdown() {
  const L = ['# Komponenten Dritter', '',
    'Diese Datei wird erzeugt: `node tools/notices.mjs --write`. Nicht von Hand bearbeiten.', '',
    'Lectora selbst steht noch unter keiner Lizenz (siehe README). Die folgenden Komponenten gelangen in die verteilten HTML-Dateien. Jede gebaute Datei beginnt mit einem Kommentar, der dieselben Lizenztexte enthält.', '',
    '| Komponente | Version | Lizenz | Wo |', '| --- | --- | --- | --- |'];
  for (const c of components()) {
    L.push(`| ${c.name} | ${c.version} | ${c.license} | ${c.where} |`);
    for (const b of c.bundled || []) L.push(`| ↳ ${b.name} | ${b.version} | ${b.license} | in ${c.name} |`);
  }
  L.push('', 'Die Beispieldokumente in der Datei sind von Lectora selbst erzeugt (test/make_fixtures.py) und frei erfunden.', '',
    '## Nur für Entwicklung und Tests', '', 'Diese Werkzeuge gelangen nicht in die verteilten Dateien.', '', '| Komponente | Bezug | Lizenz | Zweck |', '| --- | --- | --- | --- |');
  for (const [n, s, l, z] of DEV_ONLY) L.push(`| ${n} | ${s} | ${l} | ${z} |`);
  L.push('', '## Lizenztexte', '');
  for (const c of components()) {
    L.push(`### ${c.name} ${c.version}`, '', '```text', c.body, '```', '');
    for (const b of c.bundled || []) L.push(`#### ${b.name} ${b.version}`, '', '```text', b.body, '```', '');
  }
  return L.join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const out = path.join(ROOT, 'THIRD-PARTY-NOTICES.md'), md = noticesMarkdown() + '\n';
  if (process.argv.includes('--write')) { fs.writeFileSync(out, md); console.log('geschrieben:', path.relative(ROOT, out)); }
  else if (process.argv.includes('--check')) {
    const cur = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
    if (cur !== md) { console.error('THIRD-PARTY-NOTICES.md ist veraltet: node tools/notices.mjs --write'); process.exit(1); }
    // Jedes Paket, aus dem build.mjs Dateien in die verteilten Ausgaben übernimmt, braucht einen Eintrag in components()
    const build = fs.readFileSync(path.join(ROOT, 'build.mjs'), 'utf8'), have = new Set(components().map(c => c.pkg));
    const used = new Set([...build.matchAll(/npm: '((?:@[^/']+\/)?[^/']+)\//g)].map(m => m[1]));
    for (const m of build.matchAll(/\['IBM Plex \w+', '([\w-]+)'/g)) used.add('@fontsource/' + m[1]);
    if (/lucide-static/.test(build)) used.add('lucide-static');
    const missing = [...used].filter(p => !have.has(p));
    if (missing.length) { console.error('Ohne Lizenzhinweis in tools/notices.mjs: ' + missing.join(', ')); process.exit(1); }
    // Jede gebaute Ausgabe beginnt mit den Hinweisen aller Komponenten
    for (const f of ['dist/index.html', 'dist-local/index.html'].concat(fs.existsSync(path.join(ROOT, 'dist-offline')) ? fs.readdirSync(path.join(ROOT, 'dist-offline')).map(x => 'dist-offline/' + x) : [])) {
      const p = path.join(ROOT, f); if (!fs.existsSync(p)) continue;
      const head = fs.readFileSync(p, 'utf8').slice(0, 200000), c = /^<!DOCTYPE html>\n<!--([\s\S]*?)-->/.exec(head);
      const gone = components().filter(x => !c || !c[1].includes('=== ' + x.name + ' ' + x.version));
      if (gone.length) { console.error(f + ': Lizenzhinweise fehlen für ' + gone.map(x => x.name).join(', ')); process.exit(1); }
    }
    console.log('THIRD-PARTY-NOTICES.md aktuell; jedes Paket der Ausgaben hat einen Hinweis (' + [...used].join(', ') + ')');
  } else process.stdout.write(md);
}
