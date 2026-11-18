// Logiktests ohne Browser für das Paket «Arbeitswerkzeug»: Prüfprofil (Lesen, Prüfen, Übernehmen), Nachprüfung (Absätze und Befunde
// zuordnen, auch nach Verschieben, Umnummerieren und Änderungen im selben Absatz), Rahmen der Rückmeldung. Aufruf: node test/werkzeug_test.mjs
import fs from 'node:fs';
globalThis.DP = { version: '2.0.0' };
for (const f of ['lang', 'erlasse', 'modal', 'rules', 'align', 'recheck', 'profile']) (0, eval)(fs.readFileSync(new URL('../src/' + f + '.js', import.meta.url), 'utf8'));
const R = DP.rules, RC = DP.recheck, PF = DP.profile;
let bad = 0, n = 0;
const ok = (cond, msg) => { n++; if (!cond) { console.log('FEHLER', msg); bad++; } };
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), msg + ': ' + JSON.stringify(a) + ' statt ' + JSON.stringify(b));

/* ---------- 1. Profil ---------- */
const state = () => ({ settings: { off: new Set(), custom: '', termsText: '', terms: [], params: {}, actsText: '', acts: [] }, author: 'Lectora', expComments: true });
{
  const S = state();
  S.settings.off = new Set(['L06', 'T07']); S.settings.params = { 'L01.note': 28, 'S06.maxWords': 150 }; S.settings.termsText = 'Mitarbeiter => Mitarbeitende\nUserin';
  S.settings.actsText = '999.1; ABC; DEF; GHI'; S.settings.custom = 'Jede Massnahme nennt eine Stelle.'; S.author = 'Dana Muster'; S.expComments = false;
  const p = PF.build(S, 'Sektion Grundlagen', new Date('2026-11-18T10:00:00Z'));
  eq([p.format, p.schema, p.name, p.lectora, p.created], ['lectora-profil', 1, 'Sektion Grundlagen', '2.0.0', '2026-11-18T10:00:00.000Z'], 'Profil: Rahmen');
  eq(p.settings, { off: ['L06', 'T07'], params: { 'L01.note': 28 }, custom: 'Jede Massnahme nennt eine Stelle.', terms: 'Mitarbeiter => Mitarbeitende\nUserin', acts: '999.1; ABC; DEF; GHI', author: 'Dana Muster', comments: false }, 'Profil: Einstellungen (Standardwert S06 entfällt)');
  ok(!/paras|docs|name"\s*:\s*"weisung|quote/.test(JSON.stringify(p)), 'Profil enthält keine Dokumentinhalte');
  // Rundlauf: lesen und übernehmen ergibt denselben Stand
  const r = PF.parse(JSON.stringify(p));
  ok(r.ok, 'Profil: Rundlauf liest');
  const S2 = state(); PF.apply(S2, r.profile.settings);
  eq(PF.sig(S2), PF.sig(S), 'Profil: Rundlauf ergibt denselben Stand');
  eq([S2.settings.terms.length, S2.settings.acts.length, S2.author, S2.expComments], [2, 1, 'Dana Muster', false], 'Profil: abgeleitete Listen');
  ok(PF.sig(state()) === PF.defaultSig(), 'Profil: Ausgangszustand = Standard');
}
{
  // Nachsichtig: unbekannte Kriterien und Parameter übergangen und gezählt, Werte begrenzt, Texte gekürzt, falsche Typen übergangen
  const txt = JSON.stringify({ format: 'lectora-profil', schema: 1, name: '  Team\n  A  ', created: 'gestern', lectora: '9.9.9',
    settings: { off: ['L06', 'Z99', 42, 'L06'], params: { 'L01.note': 500, 'L01.warn': 12, 'S04.minWords': '1234', 'X99.foo': 3, 'D08.minPt': {} },
      custom: 'x'.repeat(5000), terms: 'a => b', acts: 12, author: '<b>Max</b>', comments: 'ja' } });
  const r = PF.parse(txt);
  ok(r.ok, 'nachsichtig: liest');
  const s = r.profile.settings, rep = r.report;
  eq(s.off, ['L06'], 'nachsichtig: nur bekannte Kriterien, ohne Doppel');
  eq(rep.unknownCrit, ['Z99', '42'], 'nachsichtig: unbekannte Kriterien gezählt');
  eq(rep.unknownParam, ['X99.foo'], 'nachsichtig: unbekannter Parameter gezählt');
  eq(s.params, { 'L01.note': 120, 'L01.warn': 120, 'S04.minWords': 1250 }, 'nachsichtig: Werte über clampParam, Warnschwelle nie unter Hinweisschwelle');
  ok(rep.clamped.includes('L01.note') && rep.clamped.includes('L01.warn') && rep.clamped.includes('S04.minWords') && rep.clamped.includes('D08.minPt'), 'nachsichtig: angepasste Werte gezählt ' + rep.clamped);
  eq([s.custom.length, rep.cut], [4000, ['custom']], 'nachsichtig: Text gekürzt');
  eq([s.acts, rep.badField.sort()], ['', ['acts', 'comments']], 'nachsichtig: falsche Typen übergangen');
  eq([s.author, r.profile.name, r.profile.created, r.profile.lectora], ['<b>Max</b>', 'Team A', null, '9.9.9'], 'nachsichtig: Text bleibt Text (kein Markup ausgewertet), Name vereinfacht, ungültiges Datum');
  ok(s.comments === true, 'nachsichtig: Kommentaroption bleibt beim Standard');
}
{
  // Streng: alles, was kein Lectora-Profil ist, wird abgewiesen
  const cases = [['{', 'json'], ['[]', 'format'], ['{"format":"andere"}', 'format'], ['{"format":"lectora-profil","schema":"1","settings":{}}', 'format'],
    ['{"format":"lectora-profil","schema":1}', 'shape'], ['{"format":"lectora-profil","schema":1,"settings":[]}', 'shape'], ['x'.repeat(PF.MAX_BYTES + 1), 'size'],
    [JSON.stringify({ format: 'lectora-rueckmeldung', schema: 1, entries: [] }), 'format']];
  for (const [t, e] of cases) { const r = PF.parse(t); eq([r.ok, r.err], [false, e], 'streng: ' + t.slice(0, 40)); }
  const nw = PF.parse(JSON.stringify({ format: 'lectora-profil', schema: 3, settings: { off: ['L06'], kuenftig: true } }));
  ok(nw.ok && nw.report.newer && nw.profile.settings.off[0] === 'L06', 'streng: neuere Schemaversion wird gelesen und gemeldet');
  ok(PF.looksLikeProfile('{\n "format": "lectora-profil"}') && !PF.looksLikeProfile('{"format":"lectora-rueckmeldung"}') && !PF.looksLikeProfile('PK\u0003\u0004'), 'Erkennung an der Ablagefläche');
  eq(PF.fileName('Sektion Grundlagen / Team 1'), 'Lectora-Profil_Sektion_Grundlagen_Team_1.json', 'Dateiname');
  const fb = PF.feedback([{ crit: 'L06' }], false, new Date('2026-11-18T10:00:00Z'));
  eq([fb.format, fb.schema, fb.lectora, fb.created, fb.excerpts, fb.entries.length], ['lectora-rueckmeldung', 1, '2.0.0', '2026-11-18', false, 1], 'Rückmeldung: Rahmen');
}

/* ---------- 2. Nachprüfung: Absätze zuordnen ---------- */
let uid = 0;
function doc(texts, extra) {
  const paras = texts.map(t => (typeof t === 'string' ? { text: t, kind: 'p' } : t)).map((p, i) => Object.assign({ i, level: p.kind === 'h' ? 1 : 0, loc: {} }, p));
  let sec = null; for (const p of paras) { if (p.kind === 'h') sec = p.i; else p.loc.sec = sec; }
  return Object.assign({ id: 'd' + (++uid), lang: 'de', format: 'docx', type: 'weisung', name: 'x', paras, meta: { words: 300, classification: null, headerFooter: '' } }, extra);
}
const H = (t) => ({ text: t, kind: 'h' });
const OLD = [H('1 Zweck'), 'Diese Weisung regelt die Bearbeitung von Gesuchen. Sie sollte einheitlich angewendet werden.',
  H('2 Geltungsbereich'), 'Die Weisung gilt für alle Mitarbeitenden. Die Kanzlei muss das Gesuch nicht nicht weiterleiten.',
  H('3 Kontakt'), 'Auskunft gibt die Sektion unter http://www.example.com/kontakt zur Verfügung.',
  H('4 Kosten'), 'Die Auskunft ist grundsätzlich kostenlos. TODO Artikel ergänzen. Im Jahr 2025 gingen 1250 Gesuche ein.',
  'Der Bericht nennt 96% der Fälle und eine Frist gemäß Beschluss.',
  'Die Gebühr beträgt höchstens 300 Franken und richtet sich nach dem Aufwand, wobei die Sektion vorher informiert und die Mitarbeiter*innen schult.'];
// Neue Fassung: Abschnitt «Kontakt» nach vorn verschoben, alle Nummern neu, im Kostenabsatz TODO gestrichen und eine Zahl geändert,
// Dopplung behoben, neuer Platzhalter, letzter Absatz völlig umgeschrieben (Befund dort zählt als erledigt und als neu)
const NEW = [H('1 Zweck'), 'Diese Weisung regelt die Bearbeitung von Gesuchen. Sie sollte einheitlich angewendet werden.',
  H('2 Kontakt'), 'Auskunft gibt die Sektion unter http://www.example.com/kontakt zur Verfügung.',
  H('3 Geltungsbereich'), 'Die Weisung gilt für alle Mitarbeitenden. Die Kanzlei muss das Gesuch nicht weiterleiten. Massgebend ist das Merkblatt vom [Datum].',
  H('4 Kosten'), 'Die Auskunft ist grundsätzlich kostenlos. Im Jahr 2025 gingen 1300 Gesuche ein.',
  'Der Bericht nennt 96% der Fälle und eine Frist gemäß Beschluss.',
  'Mitarbeiter*innen erhalten eine Schulung; Gebühren gibt es keine.'];
const A = doc(OLD), B = doc(NEW);
const map = Array.from(RC.mapParas(A.paras, B.paras));
eq(map, [0, 1, 4, 5, 2, 3, 6, 7, 8, -1], 'Absätze: verschoben, umnummeriert, geändert; stark umgeschrieben ohne Gegenstück');
// Wiederholte gleiche Absätze werden der Reihe nach zugeordnet
eq(Array.from(RC.mapParas(doc(['Siehe Anhang.', 'A b c d e.', 'Siehe Anhang.']).paras, doc(['A b c d e.', 'Siehe Anhang.', 'Siehe Anhang.']).paras)), [1, 0, 2], 'Absätze: Wiederholungen');
// Kurze, nur ähnliche Absätze verlangen mehr Übereinstimmung
eq(Array.from(RC.mapParas(doc(['Kosten']).paras, doc(['Termine']).paras)), [-1], 'Absätze: verschiedene kurze Absätze nicht zugeordnet');

/* ---------- 3. Nachprüfung: Befunde zuordnen ---------- */
const settings = { off: new Set(), params: {} };
const fa = R.runRules(A, settings).findings, fb = R.runRules(B, settings).findings;
const st = (f) => f.fix ? (f.dismissed ? 'rejected' : f.accepted ? 'accepted' : 'open') : (f.dismissed ? 'ignored' : 'open');
const lbl = (f) => f.crit + ':' + (f.quote || f.key);
const prev = { findings: fa.map(f => RC.slim(f, st(f), '')), paraMap: RC.mapParas(A.paras, B.paras), checked: new Set(R.runRules(A, settings).checked), pairs: new Set(), aiPairs: new Set(), paras: A.paras };
const cur = { findings: fb, checked: new Set(R.runRules(B, settings).checked), pairs: new Set(), aiPairs: new Set(), paras: B.paras, refText: () => '' };
const res = RC.classify(prev, cur);
const stayL = fb.filter(f => res.stay.has(f.id)).map(lbl).sort(), freshL = fb.filter(f => res.fresh.has(f.id)).map(lbl).sort(), doneL = res.resolved.map(lbl).sort();
console.log('Nachprüfung: geblieben', stayL.join(', '), '| neu', freshL.join(', '), '| erledigt', doneL.join(', '));
eq(doneL, ['L02:nicht nicht', 'L03:TODO'], 'erledigt: nur die behobenen Befunde');
eq(freshL, ['L03:[Datum]'], 'neu: nur der neue Platzhalter');
// Dieselbe Textstelle im stark umgeschriebenen Absatz steht noch im Dokument: geblieben, nie «erledigt und neu»
ok(stayL.includes('L05:Mitarbeiter*innen'), 'geblieben: gleiche Textstelle im umgeschriebenen Absatz (zweiter Durchgang)');
// Im Zweifel weiterhin erledigt und neu: andere Textstelle desselben Kriteriums im umgeschriebenen Absatz
{
  const a = doc(['Einleitung bleibt gleich.', 'Die Mitarbeiter*innen des Amtes prüfen jedes Gesuch sorgfältig und rasch.', 'Schluss bleibt gleich.']);
  const b = doc(['Einleitung bleibt gleich.', 'Für Anfragen sind die Kolleg*innen der Sektion zuständig, nicht der Informationsdienst.', 'Schluss bleibt gleich.']);
  const x = R.runRules(a, settings).findings.filter(f => f.crit === 'L05'), y = R.runRules(b, settings).findings.filter(f => f.crit === 'L05');
  const r = RC.classify({ findings: x.map(f => RC.slim(f, 'open', '')), paraMap: RC.mapParas(a.paras, b.paras), checked: new Set(['L05']), pairs: new Set(), aiPairs: new Set(), paras: a.paras },
    { findings: y, checked: new Set(['L05']), pairs: new Set(), aiPairs: new Set(), paras: b.paras, refText: () => '' });
  eq([x.length, y.length, r.resolved.length, r.fresh.size, r.stay.size], [1, 1, 1, 1, 0], 'andere Textstelle: im Zweifel erledigt und neu');
  // Dieselbe Textstelle in einen anderen Absatz verschoben: geblieben
  const c = doc(['Einleitung bleibt gleich.', 'Schluss bleibt gleich.', 'Neu am Ende: Die Mitarbeiter*innen prüfen.']);
  const z = R.runRules(c, settings).findings.filter(f => f.crit === 'L05');
  const r2 = RC.classify({ findings: x.map(f => RC.slim(f, 'open', '')), paraMap: RC.mapParas(a.paras, c.paras), checked: new Set(['L05']), pairs: new Set(), aiPairs: new Set(), paras: a.paras },
    { findings: z, checked: new Set(['L05']), pairs: new Set(), aiPairs: new Set(), paras: c.paras, refText: () => '' });
  eq([r2.stay.size, r2.resolved.length], [1, 0], 'gleiche Textstelle in neuem Absatz: geblieben');
}
ok(['L06:sollte', 'L06:grundsätzlich', 'T01:gemäß', 'T06:nt 96%', 'R02:http://www.example.com/kontakt'].every(x => stayL.includes(x)), 'geblieben: verschobener Absatz (R02), geänderter Absatz (L06 grundsätzlich), unveränderte');
ok(!stayL.some(x => x.startsWith('S02')) && !freshL.some(x => x.startsWith('S02')), 'Umnummerieren erzeugt keinen Befund');
// Gleiche Textstelle zweimal im selben Absatz: Zuordnung der Reihe nach, nicht über Kreuz
{
  const a = doc(['TODO eins. Text dazwischen. TODO zwei.']), b = doc(['Neu am Anfang. TODO eins. Text dazwischen. TODO zwei.']);
  const x = R.runRules(a, settings).findings.filter(f => f.crit === 'L03'), y = R.runRules(b, settings).findings.filter(f => f.crit === 'L03');
  const r = RC.classify({ findings: x.map(f => RC.slim(f, 'open', '')), paraMap: RC.mapParas(a.paras, b.paras), checked: new Set(['L03']), pairs: new Set(), aiPairs: new Set(), paras: a.paras },
    { findings: y, checked: new Set(['L03']), pairs: new Set(), aiPairs: new Set(), paras: b.paras, refText: () => '' });
  eq([r.stay.size, r.stay.get(y[0].id).start, r.stay.get(y[1].id).start], [2, x[0].start, x[1].start], 'gleiche Textstelle zweimal: der Reihe nach');
}
// Befund zum ganzen Dokument (fehlender Abschnitt) bleibt über den Gegenstand; nicht geprüfte Kriterien zählen weder erledigt noch neu
{
  const a = doc(['Ein Text ohne Abschnitte.']), b = doc(['Ein anderer Text ohne Abschnitte.']);
  const x = R.runRules(a, settings), y = R.runRules(b, { off: new Set(['F05']), params: {} });
  const r = RC.classify({ findings: x.findings.map(f => RC.slim(f, 'ignored', '')), paraMap: RC.mapParas(a.paras, b.paras), checked: new Set(x.checked), pairs: new Set(), aiPairs: new Set(), paras: a.paras },
    { findings: y.findings, checked: new Set(y.checked), pairs: new Set(), aiPairs: new Set(), paras: b.paras, refText: () => '' });
  const secs = y.findings.filter(f => f.crit === 'F04');
  ok(secs.length >= 3 && secs.every(f => r.stay.has(f.id)), 'ganzes Dokument: fehlende Abschnitte geblieben');
  ok(r.skipped.some(o => o.crit === 'F05') && !r.resolved.some(o => o.crit === 'F05'), 'ausgeschaltetes Kriterium: nicht erneut geprüft statt erledigt');
}
// KI-Befunde der alten Fassung: ohne KI-Lauf der neuen Fassung «nicht erneut geprüft»
{
  const o = { id: 'o1', crit: 'Q04', key: undefined, source: 'ai', para: 1, start: 0, end: 4, quote: 'Sie sollte' };
  const r = RC.classify({ findings: [RC.slim(o, 'open', '')], paraMap: prev.paraMap, checked: new Set(['Q04']), pairs: new Set(), aiPairs: new Set(), paras: A.paras }, cur);
  eq([r.skipped.length, r.resolved.length], [1, 0], 'KI-Befund ohne neuen KI-Lauf: nicht erneut geprüft');
}
// Vergleichsbefunde: Ort über den Text der Referenzabsätze, nur wenn derselbe Vergleich besteht
{
  const o = { id: 'c1', crit: 'X02', key: 'f.X02', source: 'compare', cmp: 'r>t', refDoc: 'r', para: 3, start: 10, end: 12, quote: '20' };
  const n1 = Object.assign({}, o, { id: 'c2', para: 5 }), n2 = Object.assign({}, o, { id: 'c3', para: 5, quote: '25' });
  const P = { findings: [RC.slim(o, 'ignored', 'Die Frist beträgt 30 Tage.')], paraMap: prev.paraMap, checked: new Set(['X02']), pairs: new Set(['r']), aiPairs: new Set(), paras: A.paras };
  const C = (fs, pairs) => ({ findings: fs, checked: new Set(['X02']), pairs: new Set(pairs), aiPairs: new Set(), paras: B.paras, refText: () => 'Die Frist beträgt 30 Tage.' });
  eq(RC.classify(P, C([n1], ['r'])).stay.size, 1, 'Vergleich: gleiche Referenzstelle, gleiche Zahl: geblieben');
  const r2 = RC.classify(P, C([n2], ['r'])); eq([r2.stay.size, r2.resolved.length, r2.fresh.size], [0, 1, 1], 'Vergleich: andere Zahl: erledigt und neu');
  const r3 = RC.classify(P, C([], [])); eq([r3.skipped.length, r3.resolved.length], [1, 0], 'Vergleich fehlt: nicht erneut geprüft');
}
// Ähnlichkeit ganzer Dokumente
ok(RC.similarity(A, B) > 0.7 && RC.similarity(A, doc(['Völlig anderer Inhalt über Ferienplanung und Kantine.', 'Weitere Angaben zur Kantine folgen später.'])) < 0.2, 'Ähnlichkeit: Fassungen hoch, fremdes Dokument tief');

/* ---------- 4. Regeländerungen aus dem Referenzkorpus ---------- */
// X07: Abschnitt in der Sprache der Referenz mit fast denselben Wörtern (ältere Referenz kopiert) gilt als unübersetzt
{
  const de = 'Die Auskunft ist grundsätzlich kostenlos. Massgebend ist die Gebührenverordnung. Verursacht ein Gesuch einen Aufwand von mehr als 8 Stunden, kann das Amt eine Gebühr erheben.';
  const copy = 'Die Auskunft ist kostenlos. Verursacht ein Gesuch einen Aufwand von mehr als 8 Stunden, kann das Amt eine Gebühr erheben.';
  const fr = 'Les renseignements sont gratuits. Si une demande occasionne un travail de plus de 8 heures, l’office peut percevoir un émolument.';
  const x07 = (a, b) => DP.align.compare(doc([a], { lang: 'de' }), doc([b], { lang: 'fr' }), { off: new Set(), params: {} }).findings.filter(f => f.crit === 'X07').length;
  eq([x07(de, copy), x07(de, fr), x07(de, 'Die Gebühr beträgt höchstens 300 Franken und richtet sich nach dem Aufwand der Sektion.')], [1, 0, 0], 'X07: kopierte ältere Referenz gemeldet, Übersetzung und anderer deutscher Text nicht');
}
// T03: Leerzeichen vor dem Komma bei angeklebtem Folgewort wird hinter das Komma gesetzt
{
  const f = R.runRules(doc(['Zuständig ist die Sektion ,die das Gesuch erhalten hat. Es gilt die Frist , wie besprochen.']), { off: new Set(), params: {} }).findings.filter(x => x.key === 'f.T03.before');
  const t = 'Zuständig ist die Sektion ,die das Gesuch erhalten hat. Es gilt die Frist , wie besprochen.';
  const apply = (x) => t.slice(0, x.fix.start) + x.fix.repl + t.slice(x.fix.end);
  eq(f.map(apply), ['Zuständig ist die Sektion, die das Gesuch erhalten hat. Es gilt die Frist , wie besprochen.', 'Zuständig ist die Sektion ,die das Gesuch erhalten hat. Es gilt die Frist, wie besprochen.'], 'T03: Vorschlag ergibt «Sektion, die» bzw. «Frist, wie»');
}

console.log(n, 'Fälle;', bad, 'Fehler');
process.exit(bad ? 1 : 0);
