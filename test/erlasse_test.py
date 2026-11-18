"""Abgleich der Erlasstabelle mit Fedlex (tools/erlasse_abgleich.py) ohne Netz: aufgezeichnete Antworten des SPARQL-Endpunkts
(test/fixtures/fedlex/, abgerufen am 2026-11-18) und ein Abbild der Tabelle von diesem Tag. Geprüft werden der Vergleich (keine
Unterschiede im Ausgangszustand; geänderte Abkürzung, geänderter Kurztitel, nicht mehr in Kraft, Nachfolger, SR-Nummer), das
Übernehmen mit --write (Tabelle und Quellen) und das Lesen und Schreiben von src/erlasse.js ohne weitere Änderungen.
Schluss: «FEHLER: keine» (Exit-Code 0)."""
import contextlib, copy, io, json, os, re, shutil, sys, tempfile
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import erlasse_abgleich as E
orig = E.fetch  # echter Ablauf; die Tests ersetzen nur die Quelle (Fake statt Endpunkt)

FX = os.path.join(ROOT, 'test', 'fixtures', 'fedlex')
WORKS = json.load(open(os.path.join(FX, 'werke.json'), encoding='utf-8'))['bindings']
BYSR = json.load(open(os.path.join(FX, 'sr.json'), encoding='utf-8'))['bindings']
ROWS = json.load(open(os.path.join(FX, 'tabelle.json'), encoding='utf-8'))['rows']
errors = []
def ok(c, msg):
    print(('  ok   ' if c else '  FEHLER ') + msg)
    if not c: errors.append(msg)


class Fake:
    """Beantwortet die Abfragen aus den Aufzeichnungen: filtert nach den VALUES der Abfrage (ELI bzw. SR-Nummer)."""
    def __init__(self, works, bysr): self.works, self.bysr, self.n = works, bysr, 0
    def query(self, q):
        self.n += 1
        if 'VALUES ?work' in q:
            want = set(re.findall(r'<(https://fedlex\.data\.admin\.ch/eli/[^>]+)>', q.split('VALUES ?work', 1)[1].split('}', 1)[0]))
            return {'results': {'bindings': [b for b in self.works if b['work']['value'] in want]}}
        want = set(json.loads('[' + ','.join(re.findall(r'"[^"]+"', q.split('VALUES ?sr', 1)[1].split('}', 1)[0])) + ']'))
        return {'results': {'bindings': [b for b in self.bysr if b['sr']['value'] in want]}}


def run(works=WORKS, bysr=BYSR, rows=ROWS):
    w, s = E.fetch(rows, Fake(works, bysr))
    return E.compare(rows, w, s)


def binding(eli, lang=None, **kv):
    for b in WORKS:
        if b['work']['value'] == E.ELI + eli and (lang is None or b.get('lang', {}).get('value') == lang): return b
    raise KeyError(eli)


print('== Normalisierung')
ok(E.norm('mise en \x9cuvre') == E.norm('mise en œuvre') == E.norm('mise en uvre'), 'fehlendes oder verstümmeltes «œ» aus Fedlex gilt nicht als Unterschied')

print('== Ausgangszustand')
d = run()
ok(d == [], f'{len(ROWS)} Erlasse, keine Unterschiede ({len(d)})')
ok(len({r[7] for r in ROWS}) == len(ROWS) and all(r[7].startswith('cc/') for r in ROWS), 'jede ELI eindeutig und konsolidiert (cc/)')

print('== Abgeleiteter Kurztitel')
ok(E.derived_title('Bundesgesetz vom 25. September 2020 über den Datenschutz (Datenschutzgesetz, DSG)', 'DSG', None) == 'Datenschutzgesetz', 'Klammer «Name, Abkürzung» → Name')
ok(E.derived_title("Loi fédérale du 16 décembre 2005 sur les étrangers et l'intégration (LEI)", 'LEI', None) == "Loi fédérale sur les étrangers et l'intégration", 'Datum und Abkürzung entfernt (fr)')
ok(E.derived_title('Convenzione del 4 novembre 1950 per la salvaguardia dei diritti (CEDU)', 'CEDU', None) == 'Convenzione per la salvaguardia dei diritti', 'Datum und Abkürzung entfernt (it)')
ok(E.derived_title('Verordnung vom 1. Juli 2020 über X (Klammer ohne Abkürzung)', 'XV', None) == 'Verordnung über X (Klammer ohne Abkürzung)', 'fremde Klammer bleibt stehen')
ok(E.norm('Loi sur la sécurité de l’information') == E.norm("Loi sur la sécurité de l'information"), 'typografischer und gerader Apostroph gelten als gleich')

print('== Geänderte Daten bei Fedlex')
W = copy.deepcopy(WORKS); S = copy.deepcopy(BYSR)
def find(eli, lang=None):
    return [b for b in W if b['work']['value'] == E.ELI + eli and (lang is None or b.get('lang', {}).get('value') == lang)]
# 1. Abkürzung des AIG (de) geändert
for b in find('cc/2007/758', 'de'): b['short']['value'] = 'AuIG'
# 2. Amtlicher Kurztitel des BGÖ (de) geändert
for b in find('cc/2006/355', 'de'): b['alt'] = {'type': 'literal', 'value': 'Transparenzgesetz'}
# 3. ZEMIS-Verordnung nicht mehr in Kraft, ohne Nachfolger
for b in find('cc/2006/303'): b['status']['value'] = 'https://fedlex.data.admin.ch/vocabulary/enforcement-status/3'
S = [b for b in S if b['sr']['value'] != '142.513']
# 4. VISV nicht mehr in Kraft, Nachfolger mit derselben SR-Nummer und neuer ELI
for b in find('cc/2014/2'): b['status']['value'] = 'https://fedlex.data.admin.ch/vocabulary/enforcement-status/3'
S = [b for b in S if b['sr']['value'] != '142.512'] + [{'work': {'type': 'uri', 'value': E.ELI + 'cc/2027/99'}, 'sr': {'type': 'literal', 'value': '142.512'}}]
# 5. SR-Nummer des Sprachengesetzes geändert
for b in find('cc/2009/821'): b['sr']['value'] = '441.10'
d = run(W, S)
kinds = sorted((x['sr'], x['kind'], x.get('lang') or '') for x in d)
want = sorted([('142.20', 'abbr', 'de'), ('152.3', 'title', 'de'), ('142.513', 'status', ''), ('142.512', 'status', ''), ('142.512', 'successor', ''), ('441.1', 'sr', '')])
ok(kinds == want, f'genau die fünf Änderungen erkannt: {kinds}')
ab = [x for x in d if x['kind'] == 'abbr'][0]; ok(ab['old'] == 'AIG' and ab['new'] == 'AuIG', 'Abkürzung: bisher AIG, neu AuIG')
su = [x for x in d if x['kind'] == 'successor'][0]; ok(su['new'] == 'cc/2027/99', 'Nachfolger: neue ELI cc/2027/99')
rep = E.report(ROWS, d, '2026-12-01')
ok('| 142.20 | Abkürzung geändert | de | AIG | AuIG |' in rep and 'nicht mehr in Kraft' in rep and 'Nachfolger (neue ELI)' in rep, 'Bericht als Markdown-Tabelle')

print('== Übernehmen (--write) auf Kopien von src/erlasse.js und design/erlasse-quellen.csv')
tmp = tempfile.mkdtemp(); TABLE0, SOURCES0 = E.TABLE, E.SOURCES
try:
    tab, src = os.path.join(tmp, 'erlasse.js'), os.path.join(tmp, 'quellen.csv')
    text = open(E.TABLE, encoding='utf-8').read()
    # Aufzeichnung und Tabelle gehören zusammen: in der Kopie steht die Tabelle vom Tag der Aufzeichnung
    a = text.index('const RAW = ['); b = text.index('\n  ];', a)
    base = text[:a] + 'const RAW = [\n' + ',\n'.join('    ' + json.dumps(r, ensure_ascii=False).replace('","', '", "') for r in ROWS) + text[b:]
    open(tab, 'w', encoding='utf-8').write(base); shutil.copy(E.SOURCES, src)
    E.TABLE, E.SOURCES = tab, src
    ok(E.read_table() == ROWS, 'Tabelle gelesen wie aufgezeichnet')
    same = E.write_table(ROWS, '2026-11-18')
    ok(same == base, 'Schreiben ohne Änderung ergibt dieselbe Datei (Byte für Byte)')
    E.fetch = lambda rows, src_: orig(rows, Fake(W, S))
    out = io.StringIO()
    with contextlib.redirect_stdout(out): code = E.main(['--write', '--today', '2026-12-01'])
    new = E.read_table(); by = {r[7]: r for r in new}
    ok(code == 3, f'Exit-Code 3 bei Änderungen ({code})')
    ok(by['cc/2007/758'][1] == 'AuIG' and by['cc/2006/355'][4] == 'Transparenzgesetz', 'Abkürzung und amtlicher Kurztitel übernommen')
    ok('cc/2027/99' in by and 'cc/2014/2' not in by and by['cc/2027/99'][0] == '142.512', 'Nachfolger: ELI ersetzt, SR-Nummer bleibt')
    ok('cc/2006/303' in by, 'nicht mehr in Kraft ohne Nachfolger: Eintrag bleibt (von Hand prüfen)')
    ok(by['cc/2009/821'][0] == '441.10', 'SR-Nummer übernommen')
    t2 = open(tab, encoding='utf-8').read()
    ok('Stand 1.12.2026' in t2 and len(new) == len(ROWS), 'Stand im Kopf aktualisiert, Zahl der Einträge unverändert')
    csvt = open(src, encoding='utf-8').read()
    ok('142.20,AuIG,LEI,LStrI,https://www.fedlex.admin.ch/eli/cc/2007/758/de' in csvt and 'https://www.fedlex.admin.ch/eli/cc/2027/99/de' in csvt and '2026-12-01' in csvt, 'Quellen (CSV): Abkürzung, neue ELI und Abfragedatum')
    # Danach liefert derselbe Abgleich nur noch, was von Hand zu prüfen bleibt
    W2 = copy.deepcopy(W)
    for b in W2:
        if b['work']['value'] == E.ELI + 'cc/2014/2': b['work']['value'] = E.ELI + 'cc/2027/99'; b['status']['value'] = E.IN_FORCE
    E.fetch = lambda rows, src_: orig(rows, Fake(W2, S))
    with contextlib.redirect_stdout(io.StringIO()): code2 = E.main(['--today', '2026-12-01'])
    left = E.compare(E.read_table(), *orig(E.read_table(), Fake(W2, S)))
    ok(sorted((x['sr'], x['kind']) for x in left) == [('142.513', 'status')], f'zweiter Lauf: nur noch der Fall ohne Nachfolger ({[(x["sr"], x["kind"]) for x in left]})')
    # Ohne Änderung: Exit-Code 0, nichts geschrieben
    open(tab, 'w', encoding='utf-8').write(base); shutil.copy(os.path.join(ROOT, 'design', 'erlasse-quellen.csv'), src)
    E.fetch = lambda rows, src_: orig(rows, Fake(WORKS, BYSR))
    with contextlib.redirect_stdout(io.StringIO()): code3 = E.main(['--write', '--today', '2026-12-01'])
    ok(code3 == 0 and open(tab, encoding='utf-8').read() == base, 'keine Änderung: Exit-Code 0, Datei unverändert')
finally:
    E.TABLE, E.SOURCES = TABLE0, SOURCES0
    shutil.rmtree(tmp, ignore_errors=True)

print('== Fehler beim Abruf')
class Broken:
    def query(self, q): raise OSError('Netz nicht erreichbar')
E.fetch = lambda rows, src_: orig(rows, Broken())
err = io.StringIO()
with contextlib.redirect_stderr(err), contextlib.redirect_stdout(io.StringIO()): code4 = E.main([])
ok(code4 == 2 and 'fehlgeschlagen' in err.getvalue(), 'Abruf scheitert: Exit-Code 2, Meldung, nichts geschrieben')

print('== Unplausible Antworten (Fedlex ist eine fremde Quelle)')
E.fetch = orig
rows3 = copy.deepcopy(ROWS)
def mod_works(fn):
    w = copy.deepcopy(WORKS)
    for b in w: fn(b)
    return w
# Abkürzungen fehlen in einer Sprache überall (Teilausfall) → keine Übernahme, Exit-Code 4
w_noshort = mod_works(lambda b: b.pop('short', None) if b.get('lang', {}).get('value') == 'fr' else None)
d = run(w_noshort)
why = E.implausible(ROWS, d)
ok(any('fehlt bei Fedlex' in x for x in why) and any('automatische Änderungen' in x for x in why), f'Abkürzungen fehlen: unplausibel ({len(why)} Gründe)')
# Ein einzelner Wert mit Markup oder Adresse
w_bad = copy.deepcopy(WORKS)
for b in w_bad:
    if b['work']['value'].endswith('/cc/2007/758') and b.get('lang', {}).get('value') == 'de' and 'short' in b: b['short']['value'] = '<b>AIG</b>'
why = E.implausible(ROWS, run(w_bad))
ok(any('Abkürzung (de) unplausibel' in x for x in why), 'Abkürzung mit Markup: unplausibel')
w_url = copy.deepcopy(WORKS)
for b in w_url:
    if b['work']['value'].endswith('/cc/2007/758') and b.get('lang', {}).get('value') == 'de' and 'alt' in b: b['alt']['value'] = 'Siehe https://beispiel.ch'
why = E.implausible(ROWS, run(w_url))
ok(any('Kurztitel (de) unplausibel' in x for x in why), 'Kurztitel mit Adresse: unplausibel')
ok(E.implausible(ROWS, run()) == [], 'Ausgangszustand: plausibel')
err = io.StringIO()
E.fetch = lambda rows, src_: orig(rows, Fake(w_noshort, BYSR))
with contextlib.redirect_stderr(err), contextlib.redirect_stdout(io.StringIO()): code5 = E.main(['--write'])
ok(code5 == 4 and 'unplausibel' in err.getvalue(), 'main: Exit-Code 4, nichts geschrieben')
E.fetch = orig
ok(E.md('a|b @team [x](http://y) `c` *d*') == 'a\\|b @\u200bteam \\[x\\](http://y) \\`c\\` \\*d\\*', 'Bericht: Markdown maskiert, keine Erwähnung')

print('FEHLER:', 'keine' if not errors else '\n  ' + '\n  '.join(errors))
sys.exit(1 if errors else 0)
