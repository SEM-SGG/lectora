// Prüft: gleiche Schlüssel in de/fr/it, gleiche Platzhalter, keine leeren Texte, alle im Code verwendeten Schlüssel vorhanden, kein ß.
import fs from 'node:fs';
globalThis.DP = {};
for (const f of ['lang', 'i18n', 'rules', 'modal']) (0, eval)(fs.readFileSync(new URL('../src/' + f + '.js', import.meta.url), 'utf8'));
const { DICT } = DP.i18n; let bad = 0; const err = (m) => { console.log('FEHLER', m); bad++; };
const keys = Object.keys(DICT.de);
for (const l of ['fr', 'it']) {
  for (const k of keys) if (!(k in DICT[l])) err(l + ' fehlt: ' + k);
  for (const k of Object.keys(DICT[l])) if (!(k in DICT.de)) err(l + ' zu viel: ' + k);
}
const ph = (s) => (s.match(/\{\w+\}/g) || []).sort().join();
for (const k of keys) for (const l of ['de', 'fr', 'it']) {
  const v = DICT[l][k]; if (v == null) continue;
  if (!v.trim()) err(l + ' leer: ' + k);
  if (ph(v) !== ph(DICT.de[k])) err(l + ' Platzhalter weichen ab: ' + k);
  if (l !== 'de' && v === DICT.de[k] && v.length > 14 && !/^(Word|PDF|PowerPoint)/.test(v)) err(l + ' identisch mit de (unübersetzt?): ' + k + ' = ' + v);
}
if (/ß/.test(JSON.stringify(DICT.de).replace(/statt Eszett|ß»|«ß/g, ''))) err('de enthält ß');
for (const k of Object.keys(DICT.fr)) if (/[^ \s«(][;:!?](?=\s|$)/.test(DICT.fr[k].replace(/https?:\S+/g, '')) && !/\{\w+\}[:;]/.test(DICT.fr[k])) err('fr ohne geschütztes Leerzeichen vor Satzzeichen: ' + k + ' = ' + DICT.fr[k]);
// Schlüssel aus dem Code
const src = ['ui', 'rules', 'align', 'ai'].map(f => fs.readFileSync(new URL('../src/' + f + '.js', import.meta.url), 'utf8')).join('\n');
const used = new Set();
for (const m of src.matchAll(/\bt[n]?\(\s*'([\w.]+)'/g)) used.add(m[1]);
for (const m of src.matchAll(/key: '(f\.[\w.]+)'/g)) used.add(m[1]);
for (const m of src.matchAll(/'((?:ai\.err|chk|cmp|exp|docs|verdict)\.[\w.]+)'/g)) used.add(m[1]);
for (const c of DP.rules.CATALOG) { used.add('c.' + c.id + '.t'); used.add('c.' + c.id + '.d'); }
for (const c of DP.rules.CATS) used.add('cat.' + c);
for (const ty in DP.rules.SECTIONS) for (const s of DP.rules.SECTIONS[ty]) used.add('sec.' + ty + '.' + s.key);
const plural = new Set(); for (const m of src.matchAll(/\btn\(\s*'([\w.]+)'/g)) plural.add(m[1]);
for (const k of used) {
  if (plural.has(k)) { for (const s of ['.one', '.other']) if (!(k + s in DICT.de)) err('Pluralschlüssel fehlt: ' + k + s); continue; }
  if (/\.$/.test(k)) continue;
  if (!(k in DICT.de) && !keys.some(x => x.startsWith(k + '.'))) err('im Code verwendet, fehlt im Wörterbuch: ' + k);
}
// Befundschlüssel der Regeln: f.<ID> oder f.<ID>.<variante>
for (const m of src.matchAll(/mk\('([A-Z]\d\d)'(, (?:Object\.assign\()?\{ key: )?/g)) { if (!m[2] && !('f.' + m[1] in DICT.de) && !('f.' + m[1] + '.one' in DICT.de && 'f.' + m[1] + '.other' in DICT.de)) err('Befundtext fehlt: f.' + m[1]); }
for (const m of src.matchAll(/'(f\.[A-Z]\d\d(?:\.\w+)?)'/g)) if (!(m[1] in DICT.de)) err('Befundtext fehlt: ' + m[1]);
for (const k of keys) if (/^f\.[A-Z]\d\d\.one$/.test(k) && !(k.replace(/one$/, 'other') in DICT.de)) err('Pluralform fehlt: ' + k.replace(/one$/, 'other'));
// Modalklassen und Erklärungen der Modalvergleiche (X11) entstehen im Code aus DP.modal
for (const k of Object.keys(DP.modal.PAIR_SEV)) used.add('mod.why.' + k.replace('|', '_'));
for (const k of Object.keys(DP.modal.GROUP)) used.add('mod.' + k);
for (const w of ['fields', 'sr', 'abbr']) used.add('crit.custom.acts.why.' + w);
for (const m of ['pair', 'tri']) used.add('cmp.mode.' + m);
for (const k of used) if (/^(?:mod|crit\.custom\.acts\.why|cmp\.mode)\.\w/.test(k) && !(k in DICT.de)) err('dynamischer Schlüssel fehlt: ' + k);
const dyn = /^(lang|type|fmt|sev|src|nav|loc|c|f|sec|cat|verdict|ses\.p\d|docs\.fact\d|par|g)\b/;
const unused = keys.filter(k => !used.has(k) && !k.endsWith('.one') && !k.endsWith('.other') && !dyn.test(k));
console.log(keys.length, 'Schlüssel je Sprache;', used.size, 'im Code referenziert;', bad, 'Fehler');
if (unused.length) console.log('nicht referenziert:', unused.join(', '));
process.exit(bad ? 1 : 0);
