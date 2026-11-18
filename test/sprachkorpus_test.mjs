// Sprachkorpus für die Prüfungen X11 (Verbindlichkeit), X12 (zitierte Erlasse) und R04 (Abkürzungen von Erlassen):
// eigene und synthetische Satzpaare in DE, FR und IT (test/sprachkorpus/faelle.json), dazu ein Mustererlass in drei gleichwertigen
// Sprachfassungen, der nirgends anschlagen darf. Misst je Kriterium Präzision und Trefferquote und vergleicht sie mit
// test/sprachkorpus/basis.json. Fehler: ein Fall weicht ab, ohne als «bekannt» markiert zu sein, oder eine Kennzahl sinkt unter die Basis.
// Aufruf: node test/sprachkorpus_test.mjs [--basis-schreiben] [--alle] (--alle: auch die richtig beurteilten Fälle zeigen)
import fs from 'node:fs';
globalThis.DP = {};
for (const f of ['lang', 'erlasse', 'modal', 'rules', 'align']) (0, eval)(fs.readFileSync(new URL('../src/' + f + '.js', import.meta.url), 'utf8'));
const DIR = new URL('./sprachkorpus/', import.meta.url);
const K = JSON.parse(fs.readFileSync(new URL('faelle.json', DIR), 'utf8'));
const BASIS = new URL('basis.json', DIR);
const ALL = DP.rules.CATALOG.map(c => c.id);
const only = (...ids) => ({ off: new Set(ALL.filter(x => !ids.includes(x))), params: {} });
let uid = 0;
function doc(lang, paras) {
  paras = paras.map((p, i) => Object.assign({ i, level: 0, loc: {}, kind: 'p' }, typeof p === 'string' ? { text: p } : p));
  return { id: 'k' + (++uid), lang, format: 'docx', type: 'bericht', name: 'x', paras, meta: { words: 100, classification: null, headerFooter: '' } };
}
function compare(la, ta, lb, tb, settings) {
  const a = doc(la, [{ text: 'Titel', kind: 'title' }, ta]), b = doc(lb, [{ text: 'Titel', kind: 'title' }, tb]);
  return { f: DP.align.compare(a, b, settings).findings, b };
}
const r04 = (lang, text, kind) => DP.rules.runRules(doc(lang, [{ text, kind: kind || 'p' }]), only('R04')).findings;
const show = (fs) => fs.map(f => f.crit + ':' + f.sev + (f.key && f.key.split('.').length > 2 ? ':' + f.key.split('.').slice(2).join('.') : '') + (f.fix ? '→' + f.fix.repl : '')).join(' ') || '–';

const res = { X11: [], X12: [], R04: [] };
for (const c of K.X11) { const fs = compare(c.la, c.a, c.lb, c.b, only('X11')).f.filter(f => f.crit === 'X11'); res.X11.push({ c, got: fs.length > 0, out: show(fs), txt: c.la + '→' + c.lb + ' «' + c.a + '» / «' + c.b + '»' }); }
for (const c of K.X12) {
  const { f, b } = compare(c.la, c.a, c.lb, c.b, only('X12', 'R04', 'X04'));
  let fs = f.filter(x => x.crit === 'X12');
  if (c.r04) fs = fs.concat(DP.rules.runRules(b, only('R04')).findings);
  res.X12.push({ c, got: fs.length > 0, out: show(fs), txt: c.la + '→' + c.lb + ' «' + c.a + '» / «' + c.b + '»' });
}
for (const c of K.R04) { const fs = r04(c.lang, c.text, c.kind); res.R04.push({ c, got: fs.length > 0, out: show(fs), txt: c.lang + (c.kind === 'h' ? ' (Überschrift)' : '') + ' «' + c.text + '»' }); }
// Mustererlass: jede Bestimmung in drei Sprachpaaren (X11, X12) und in jeder Sprache für sich (R04); kein Befund erlaubt
for (const m of K.muster) {
  for (const [la, lb] of [['de', 'fr'], ['de', 'it'], ['fr', 'it']]) {
    const fs = compare(la, m[la], lb, m[lb], only('X11', 'X12', 'R04', 'X04')).f;
    for (const crit of ['X11', 'X12']) { const x = fs.filter(f => f.crit === crit); res[crit].push({ c: { id: m.id + '-' + la + lb, flag: false, note: 'Mustererlass' }, got: x.length > 0, out: show(x), txt: la + '→' + lb + ' «' + m[la] + '» / «' + m[lb] + '»' }); }
  }
  for (const l of ['de', 'fr', 'it']) { const x = r04(l, m[l]); res.R04.push({ c: { id: m.id + '-' + l, flag: false, note: 'Mustererlass' }, got: x.length > 0, out: show(x), txt: l + ' «' + m[l] + '»' }); }
}

const fmt = (v) => v == null ? '–' : v.toFixed(3);
const stats = {}, fails = [];
for (const crit of Object.keys(res)) {
  const s = { faelle: 0, positiv: 0, tp: 0, fp: 0, fn: 0, tn: 0, bekannt: 0 };
  for (const r of res[crit]) {
    s.faelle++; if (r.c.flag) s.positiv++;
    const k = r.c.flag ? (r.got ? 'tp' : 'fn') : (r.got ? 'fp' : 'tn'); s[k]++;
    const wrong = k === 'fp' || k === 'fn';
    if (wrong && r.c.bekannt) s.bekannt++;
    if (wrong) console.log((r.c.bekannt ? 'bekannt ' : 'FEHLER  ') + (k === 'fp' ? 'Fehlalarm ' : 'verpasst  ') + r.c.id + ' [' + (r.c.note || '') + '] ' + r.txt + ' → ' + r.out + (r.c.bekannt ? ' (' + r.c.bekannt + ')' : ''));
    else if (process.argv.includes('--alle')) console.log('ok      ' + r.c.id + ' ' + r.txt + ' → ' + r.out);
    if (wrong && !r.c.bekannt) fails.push(r.c.id);
  }
  s.praezision = s.tp + s.fp ? s.tp / (s.tp + s.fp) : null; s.trefferquote = s.tp + s.fn ? s.tp / (s.tp + s.fn) : null;
  stats[crit] = s;
}
console.log('\n| Kriterium | Fälle | erwartete Befunde | richtig gemeldet | Fehlalarme | verpasst | Präzision | Trefferquote |\n|---|---:|---:|---:|---:|---:|---:|---:|');
for (const [c, s] of Object.entries(stats)) console.log(`| ${c} | ${s.faelle} | ${s.positiv} | ${s.tp} | ${s.fp} | ${s.fn} | ${fmt(s.praezision)} | ${fmt(s.trefferquote)} |`);
if (process.argv.includes('--basis-schreiben')) {
  const b = {}; for (const [c, s] of Object.entries(stats)) b[c] = { praezision: s.praezision, trefferquote: s.trefferquote, faelle: s.faelle };
  fs.writeFileSync(BASIS, JSON.stringify(b, null, 1) + '\n'); console.log('Basis geschrieben');
}
const basis = fs.existsSync(BASIS) ? JSON.parse(fs.readFileSync(BASIS, 'utf8')) : {};
for (const [c, b] of Object.entries(basis)) {
  const s = stats[c]; if (!s) { fails.push(c + ': fehlt'); continue; }
  if (b.praezision != null && (s.praezision == null || s.praezision < b.praezision - 1e-9)) fails.push(`${c}: Präzision ${fmt(s.praezision)} unter Basis ${fmt(b.praezision)}`);
  if (b.trefferquote != null && (s.trefferquote == null || s.trefferquote < b.trefferquote - 1e-9)) fails.push(`${c}: Trefferquote ${fmt(s.trefferquote)} unter Basis ${fmt(b.trefferquote)}`);
  if (s.faelle < b.faelle) fails.push(`${c}: ${s.faelle} Fälle, Basis ${b.faelle} (Fälle entfernt?)`);
}
console.log(fails.length ? '\n' + fails.length + ' Fehler: ' + fails.join(', ') : '\n0 Fehler');
process.exit(fails.length ? 1 : 0);
