// Standardprofile der Sektion (profile/*.json): Jede Datei ist ein gültiges Lectora-Profil und passt zum aktuellen Kriterienkatalog.
// Ein umbenanntes oder gestrichenes Kriterium, ein umbenannter Parameter oder ein Wert ausserhalb der Grenzen lässt diesen Test
// scheitern, statt das Profil beim Laden still zu verändern. Dazu: Namen in drei Sprachen, eindeutige Namen, README mit jeder Abweichung.
// Schluss: «0 Fehler».
import fs from 'node:fs';
globalThis.window = globalThis;
for (const f of ['lang', 'erlasse', 'modal', 'i18n', 'rules', 'profile']) (0, eval)(fs.readFileSync(new URL('../src/' + f + '.js', import.meta.url), 'utf8'));
const R = DP.rules, PF = DP.profile;
const dir = new URL('../profile/', import.meta.url);
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort();
const readme = fs.readFileSync(new URL('README.md', dir), 'utf8');
let errs = 0, n = 0;
const ok = (c, msg) => { n++; if (!c) { errs++; console.log('  FEHLER ' + msg); } else console.log('  ok   ' + msg); };

ok(files.length === 3, `drei Standardprofile (${files.join(', ')})`);
const names = { de: new Set(), fr: new Set(), it: new Set() };
for (const f of files) {
  const text = fs.readFileSync(new URL(f, dir), 'utf8'), raw = JSON.parse(text);
  const r = PF.parse(text);
  ok(r.ok, `${f}: als Profil lesbar`);
  if (!r.ok) continue;
  const rep = r.report;
  ok(!rep.unknownCrit.length && !rep.unknownParam.length, `${f}: nur bekannte Kriterien und Parameter (${rep.unknownCrit.concat(rep.unknownParam).join(', ') || 'alle bekannt'})`);
  ok(!rep.clamped.length && !rep.cut.length && !rep.badField.length && !rep.newer, `${f}: Werte innerhalb der Grenzen, keine gekürzten oder unbrauchbaren Felder`);
  // Was die Datei verlangt, kommt unverändert an (nichts still verworfen; keine Parameter mit Standardwert)
  const s = raw.settings;
  ok(JSON.stringify([...s.off].sort()) === JSON.stringify(r.profile.settings.off), `${f}: ausgeschaltete Kriterien unverändert (${s.off.join(', ') || 'keine'})`);
  ok(JSON.stringify(Object.fromEntries(Object.entries(s.params).sort())) === JSON.stringify(r.profile.settings.params), `${f}: Parameter unverändert (${Object.entries(s.params).map(([k, v]) => k + '=' + v).join(', ') || 'keine'})`);
  ok(Object.keys(s.params).every(k => R.PARAM_BY_ID[k].def !== s.params[k]), `${f}: nur Parameter, die vom Standard abweichen`);
  ok(!s.off.some(id => R.BY_ID[id].ai), `${f}: schaltet keine KI-Kriterien aus (gilt in beiden Ausgaben gleich)`);
  // Namen in drei Sprachen, eindeutig
  for (const l of ['de', 'fr', 'it']) { ok(typeof raw.names?.[l] === 'string' && raw.names[l].trim().length > 0 && raw.names[l].length <= PF.LIMITS.name, `${f}: Name ${l} «${raw.names?.[l]}»`); names[l].add(raw.names?.[l]); }
  ok(raw.name === raw.names.de, `${f}: name = names.de`);
  // README dokumentiert jede Abweichung vom Standard
  for (const id of s.off) ok(readme.includes(id), `${f}: README nennt ausgeschaltetes Kriterium ${id}`);
  for (const k of Object.keys(s.params)) ok(readme.includes(k), `${f}: README nennt Parameter ${k}`);
  ok(readme.includes(raw.names.de), `${f}: README nennt das Profil «${raw.names.de}»`);
}
for (const l of ['de', 'fr', 'it']) ok(names[l].size === files.length, `Namen ${l} eindeutig`);
// Gegenprobe: ein umbenanntes Kriterium bzw. ein umbenannter Parameter fällt auf
const probe = JSON.parse(fs.readFileSync(new URL(files[0], dir), 'utf8'));
probe.settings.off = ['S99']; probe.settings.params = { 'L01.notiz': 20 };
const pr = PF.parse(JSON.stringify(probe));
ok(pr.ok && pr.report.unknownCrit.includes('S99') && pr.report.unknownParam.includes('L01.notiz'), 'Gegenprobe: unbekanntes Kriterium und unbekannter Parameter werden gemeldet');
console.log(`${n} Prüfungen; ${errs} Fehler`);
process.exit(errs ? 1 : 0);
