"""Abgleich der eingebauten Erlasstabelle (src/erlasse.js, Quellen in design/erlasse-quellen.csv) mit Fedlex.

Quelle: SPARQL-Endpunkt der Bundeskanzlei (https://fedlex.data.admin.ch/sparqlendpoint), dieselbe Methode wie beim Aufbau der Tabelle:
  - Erlass über seine ELI (https://fedlex.data.admin.ch/eli/cc/…), Status über jolux:inForceStatus (enforcement-status/0 = in Kraft),
    SR-Nummer über jolux:historicalLegalId
  - je Sprachfassung (de, fr, it): Abkürzung = jolux:titleShort, Kurztitel = jolux:titleAlternative; ohne amtlichen Kurztitel der Titel
    (jolux:title) ohne Datum und ohne die Abkürzung in Klammern
  - Nachfolger: ein anderer geltender Erlass mit derselben SR-Nummer

Gemeldet werden: Abkürzung geändert, Kurztitel geändert, SR-Nummer geändert, Erlass nicht mehr in Kraft, Nachfolger mit neuer ELI.
Typografische und gerade Apostrophe gelten als gleich.

Verwendung:
  python3 tools/erlasse_abgleich.py                 Bericht (Markdown) auf die Standardausgabe; Exit-Code 0 = keine Änderung, 3 = Änderungen
  python3 tools/erlasse_abgleich.py --write         Änderungen in src/erlasse.js und design/erlasse-quellen.csv übernehmen
  python3 tools/erlasse_abgleich.py --report DATEI  Bericht zusätzlich in DATEI schreiben (für den Pull Request)
  python3 tools/erlasse_abgleich.py --record ORDNER Antworten des Endpunkts als JSON ablegen (für Tests)
  python3 tools/erlasse_abgleich.py --replay ORDNER aufgezeichnete Antworten statt des Endpunkts verwenden
Nicht in Kraft ohne Nachfolger: Der Eintrag bleibt stehen und ist im Bericht als «von Hand prüfen» markiert (nichts wird gelöscht).
Fehler beim Abruf: Exit-Code 2, nichts wird geschrieben.
Unplausible Antwort (Grenzen unten: Form der Werte, Anzahl der Änderungen): Exit-Code 4, nichts wird geschrieben.
"""
import argparse, csv, datetime, hashlib, io, json, os, re, sys, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TABLE = os.path.join(ROOT, 'src', 'erlasse.js')
SOURCES = os.path.join(ROOT, 'design', 'erlasse-quellen.csv')
ENDPOINT = 'https://fedlex.data.admin.ch/sparqlendpoint'
ELI = 'https://fedlex.data.admin.ch/eli/'
IN_FORCE = 'https://fedlex.data.admin.ch/vocabulary/enforcement-status/0'
LANGS = ('de', 'fr', 'it')
LANG_URI = {'de': 'http://publications.europa.eu/resource/authority/language/DEU', 'fr': 'http://publications.europa.eu/resource/authority/language/FRA', 'it': 'http://publications.europa.eu/resource/authority/language/ITA'}
PREFIX = 'PREFIX jolux: <http://data.legilux.public.lu/resource/ontology/jolux#>\n'
ROW = re.compile(r'^(\s*)(\[\s*"[^"]+",.*\]),?\s*$')


# ---------- Tabelle lesen und schreiben ----------
def read_table(text=None):
    """Einträge [SR, Abk. de, fr, it, Kurztitel de, fr, it, ELI] in der Reihenfolge der Datei."""
    text = text if text is not None else open(TABLE, encoding='utf-8').read()
    a = text.index('const RAW = ['); b = text.index('\n  ];', a)
    rows = []
    for line in text[a:b].split('\n')[1:]:
        m = ROW.match(line)
        if m: rows.append(json.loads(m.group(2)))
    if not rows: raise ValueError('src/erlasse.js: keine Einträge in RAW gefunden')
    return rows


def write_table(rows, today, text=None):
    text = text if text is not None else open(TABLE, encoding='utf-8').read()
    a = text.index('const RAW = ['); b = text.index('\n  ];', a)
    out, i = [], 0
    lines = text[a:b].split('\n')
    keep = [l for l in lines[1:] if ROW.match(l)]
    if len(keep) != len(rows): raise ValueError('Anzahl der Einträge hat sich verändert')
    for line in lines:
        m = ROW.match(line)
        if m:
            comma = ',' if line.rstrip().endswith(',') else ''
            out.append(m.group(1) + json.dumps(rows[i], ensure_ascii=False) + comma); i += 1
        else: out.append(line)
    new = text[:a] + '\n'.join(out) + text[b:]
    d = datetime.date.fromisoformat(today)
    new = re.sub(r'Stand \d{1,2}\.\d{1,2}\.\d{4}', f'Stand {d.day}.{d.month}.{d.year}', new, count=1)
    return new


def read_sources():
    with open(SOURCES, encoding='utf-8', newline='') as f: return list(csv.DictReader(f))


def write_sources(rows, recs, today):
    """CSV: Abkürzungen und Quellen je Eintrag aus der Tabelle; Abfragedatum für geprüfte Einträge."""
    by_sr = {r['SR']: r for r in recs}
    fields = ['SR', 'Abk_DE', 'Abk_FR', 'Abk_IT', 'Quelle_DE', 'Quelle_FR', 'Quelle_IT', 'Art', 'Abfrage']
    buf = io.StringIO(); w = csv.DictWriter(buf, fieldnames=fields, lineterminator='\n'); w.writeheader()
    for r in rows:
        old = by_sr.get(r[0], {})
        q = old.get('Abfrage') or ''
        q = re.sub(r'\d{4}-\d{2}-\d{2}', today, q, count=1) if q else f'fedlex.data.admin.ch SPARQL, {today}: jolux:titleShort je Sprachfassung, SR-Nummer über jolux:historicalLegalId, nur in Kraft (enforcement-status/0)'
        w.writerow({'SR': r[0], 'Abk_DE': r[1] or '(keine)', 'Abk_FR': r[2] or '(keine)', 'Abk_IT': r[3] or '(keine)',
                    'Quelle_DE': f'https://www.fedlex.admin.ch/eli/{r[7]}/de', 'Quelle_FR': f'https://www.fedlex.admin.ch/eli/{r[7]}/fr', 'Quelle_IT': f'https://www.fedlex.admin.ch/eli/{r[7]}/it',
                    'Art': old.get('Art') or 'amtlich (Fedlex, Bundeskanzlei)', 'Abfrage': q})
    return buf.getvalue()


# ---------- Fedlex ----------
class Source:
    """Abruf beim Endpunkt; mit record/replay für Tests (Dateiname = Hash der Abfrage)."""
    def __init__(self, record=None, replay=None, timeout=90):
        self.record, self.replay, self.timeout = record, replay, timeout
    def query(self, q):
        key = hashlib.sha256(q.encode('utf-8')).hexdigest()[:16]
        if self.replay:
            with open(os.path.join(self.replay, key + '.json'), encoding='utf-8') as f: return json.load(f)
        data = urllib.parse.urlencode({'query': q}).encode('ascii')
        req = urllib.request.Request(ENDPOINT, data=data, headers={'Accept': 'application/sparql-results+json', 'User-Agent': 'lectora-erlasse-abgleich'})
        with urllib.request.urlopen(req, timeout=self.timeout) as r: res = json.load(r)
        if self.record:
            os.makedirs(self.record, exist_ok=True)
            with open(os.path.join(self.record, key + '.json'), 'w', encoding='utf-8') as f: json.dump(res, f, ensure_ascii=False, indent=1)
        return res


def q_works(elis):
    vals = ' '.join(f'<{ELI}{e}>' for e in elis)
    langs = ' '.join(f'(<{LANG_URI[l]}> "{l}")' for l in LANGS)
    return PREFIX + f'''SELECT ?work ?status ?sr ?lang ?short ?alt ?title WHERE {{
  VALUES ?work {{ {vals} }}
  OPTIONAL {{ ?work jolux:inForceStatus ?status }}
  OPTIONAL {{ ?work jolux:historicalLegalId ?sr }}
  OPTIONAL {{
    ?work jolux:isRealizedBy ?expr . ?expr jolux:language ?l .
    VALUES (?l ?lang) {{ {langs} }}
    OPTIONAL {{ ?expr jolux:titleShort ?short }} OPTIONAL {{ ?expr jolux:titleAlternative ?alt }} OPTIONAL {{ ?expr jolux:title ?title }}
  }}
}}'''


def q_by_sr(srs):
    vals = ' '.join(json.dumps(s) for s in srs)
    return PREFIX + f'''SELECT ?work ?sr WHERE {{
  VALUES ?sr {{ {vals} }}
  ?work jolux:historicalLegalId ?sr ; jolux:inForceStatus <{IN_FORCE}> .
  FILTER(STRSTARTS(STR(?work), "{ELI}cc/"))
}}'''


def chunks(xs, n=40):
    for i in range(0, len(xs), n): yield xs[i:i + n]


def fetch(rows, src):
    """Daten je ELI: {eli: {status, sr, lang: {short, alt, title}}} und geltende Erlasse je SR-Nummer: {sr: [eli, …]}."""
    works = {}
    for part in chunks([r[7] for r in rows]):
        for b in src.query(q_works(part))['results']['bindings']:
            eli = b['work']['value'][len(ELI):]
            w = works.setdefault(eli, {'status': None, 'sr': None, 'lang': {}})
            if 'status' in b: w['status'] = b['status']['value']
            if 'sr' in b: w['sr'] = b['sr']['value']
            if 'lang' in b:
                L = w['lang'].setdefault(b['lang']['value'], {})
                for k in ('short', 'alt', 'title'):
                    if k in b: L[k] = b[k]['value']
    by_sr = {}
    for part in chunks(sorted({r[0] for r in rows})):
        for b in src.query(q_by_sr(part))['results']['bindings']:
            by_sr.setdefault(b['sr']['value'], set()).add(b['work']['value'][len(ELI):])
    return works, {k: sorted(v) for k, v in by_sr.items()}


# ---------- Vergleich ----------
APOS = str.maketrans({'’': "'", '‘': "'", ' ': ' ', ' ': ' '})
# Fedlex liefert die Ligatur «œ» in einigen Titeln als Steuerzeichen oder gar nicht («mise en uvre» statt «mise en œuvre», SR 0.362.31, Stand 18.11.2026):
# Für den Vergleich gilt ein fehlendes «œ» nicht als Unterschied; die Tabelle behält die richtige Schreibweise.
C1 = {c: None for c in range(0x80, 0xa0)}  # Steuerzeichen C1 (dort, wo Fedlex «œ» verliert)
def norm(s): return None if s is None else re.sub(r'\s+', ' ', s.translate(APOS)).replace('œ', '').replace('Œ', '').translate(C1).strip()

MONTHS = r'(?:Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember|janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre|gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)'
DATE = re.compile(r'\s+(?:vom|du|del|dell[\'’]|dei)\s*\d{1,2}(?:er|\.|°)?\s+' + MONTHS + r'\s+\d{4}', re.I)

def derived_title(title, short, alt):
    """Kurztitel ohne amtlichen Kurztitel: Titel ohne Datum und ohne Klammer mit Abkürzung oder Kurztitel am Schluss."""
    if not title: return None
    t = DATE.sub('', title, count=1)
    m = re.search(r'\s*\(([^()]*)\)\s*$', t)
    if m:
        parts = [x.strip() for x in m.group(1).split(',')]
        # «(Datenschutzgesetz, DSG)»: der Name vor der Abkürzung ist der Kurztitel
        if short and len(parts) > 1 and parts[-1] == short: return ', '.join(parts[:-1])
        if (short and m.group(1).strip() == short) or (alt and alt in m.group(1)): t = t[:m.start()]
    return t.strip()


def official(w, lang):
    L = w['lang'].get(lang, {})
    short = L.get('short')
    title = L.get('alt') or derived_title(L.get('title'), short, None)
    return short, title, bool(L.get('alt'))


def compare(rows, works, by_sr):
    """Liste der Unterschiede: {sr, eli, kind, lang, old, new, note}. kind: abbr, title, sr, status, successor, missing."""
    diffs = []
    for r in rows:
        sr, eli = r[0], r[7]
        w = works.get(eli)
        if not w or (w['status'] is None and not w['lang']):
            diffs.append({'sr': sr, 'eli': eli, 'kind': 'missing', 'note': 'ELI bei Fedlex nicht gefunden'}); continue
        if w['status'] != IN_FORCE:
            succ = [e for e in by_sr.get(sr, []) if e != eli]
            diffs.append({'sr': sr, 'eli': eli, 'kind': 'status', 'old': 'in Kraft', 'new': (w['status'] or 'ohne Status').rsplit('/', 1)[-1], 'note': 'nicht mehr in Kraft'})
            if succ: diffs.append({'sr': sr, 'eli': eli, 'kind': 'successor', 'old': eli, 'new': succ[0], 'note': 'geltender Erlass mit derselben SR-Nummer' + (f' (weitere: {", ".join(succ[1:])})' if len(succ) > 1 else '')})
            continue
        if w['sr'] and norm(w['sr']) != sr:
            diffs.append({'sr': sr, 'eli': eli, 'kind': 'sr', 'old': sr, 'new': w['sr']})
        for i, lang in enumerate(LANGS):
            short, title, has_alt = official(w, lang)
            if lang not in w['lang']: diffs.append({'sr': sr, 'eli': eli, 'kind': 'missing', 'lang': lang, 'note': 'Sprachfassung fehlt bei Fedlex'}); continue
            if norm(short) != norm(r[1 + i]):
                diffs.append({'sr': sr, 'eli': eli, 'kind': 'abbr', 'lang': lang, 'old': r[1 + i], 'new': short})
            if title and norm(title) != norm(r[4 + i]):
                diffs.append({'sr': sr, 'eli': eli, 'kind': 'title', 'lang': lang, 'old': r[4 + i], 'new': title, 'note': None if has_alt else 'abgeleitet aus dem Titel (ohne amtlichen Kurztitel)'})
    return diffs


# ---------- Plausibilität: Fedlex ist eine fremde Quelle ----------
MAX_CHANGES_ABS, MAX_CHANGES_REL = 6, 0.10
RE_ABBR = re.compile(r"^[^\W_][\w .()/'’&-]{0,23}$")
RE_SR = re.compile(r'^\d+(?:\.\d+)*$')
RE_ELI = re.compile(r'^cc/[\w./-]{1,60}$')
RE_BAD = re.compile(r'[\x00-\x1f\x7f<>`|\\]|https?:|www\.|@')


def implausible(rows, diffs):
    """Gründe, weshalb die Antwort nicht übernommen werden darf (leere Liste: plausibel)."""
    why = []
    auto = [d for d in diffs if d['kind'] in ('abbr', 'sr', 'successor') or (d['kind'] == 'title' and d.get('note') is None)]
    limit = max(MAX_CHANGES_ABS, int(len(rows) * MAX_CHANGES_REL))
    if len(auto) > limit: why.append(f'{len(auto)} automatische Änderungen (höchstens {limit})')
    for d in auto:
        v = d.get('new')
        if d['kind'] == 'abbr':
            if v is None and d.get('old'): why.append(f"SR {d['sr']}: Abkürzung ({d['lang']}) fehlt bei Fedlex, bisher «{d['old']}»")
            elif v is not None and (not RE_ABBR.match(v) or RE_BAD.search(v)): why.append(f"SR {d['sr']}: Abkürzung ({d['lang']}) unplausibel: {v[:40]!r}")
        elif d['kind'] == 'title' and (not isinstance(v, str) or not 3 <= len(v) <= 300 or RE_BAD.search(v)): why.append(f"SR {d['sr']}: Kurztitel ({d['lang']}) unplausibel: {str(v)[:40]!r}")
        elif d['kind'] == 'sr' and (not isinstance(v, str) or not RE_SR.match(v)): why.append(f"SR {d['sr']}: SR-Nummer unplausibel: {str(v)[:40]!r}")
        elif d['kind'] == 'successor' and (not isinstance(v, str) or not RE_ELI.match(v)): why.append(f"SR {d['sr']}: ELI des Nachfolgers unplausibel: {str(v)[:60]!r}")
    return why


def md(s):
    """Wert für eine Markdown-Tabelle: Sonderzeichen maskiert, keine Erwähnungen (@), keine Zeilenumbrüche."""
    if s is None: return '–'
    s = re.sub(r'\s+', ' ', str(s))[:300]
    s = re.sub(r'([\\`*_\[\]<>|#!~])', r'\\\1', s)
    return s.replace('@', '@\u200b')


def apply(rows, diffs):
    """Übernimmt Abkürzungen, Kurztitel, SR-Nummern und Nachfolger. Gibt neue Zeilen und die Liste der von Hand zu prüfenden Fälle."""
    rows = [list(r) for r in rows]; manual = []
    idx = {r[7]: r for r in rows}
    succ = {d['eli']: d['new'] for d in diffs if d['kind'] == 'successor'}
    for d in diffs:
        r = idx.get(d['eli'])
        if r is None: continue
        if d['kind'] == 'abbr': r[1 + LANGS.index(d['lang'])] = d['new']
        elif d['kind'] == 'title' and d.get('note') is None: r[4 + LANGS.index(d['lang'])] = d['new']
        elif d['kind'] == 'title': manual.append(d)  # abgeleitete Titel nie automatisch übernehmen
        elif d['kind'] == 'sr': r[0] = d['new']
        elif d['kind'] == 'status' and d['eli'] not in succ: manual.append(d)
        elif d['kind'] == 'successor': r[7] = d['new']; manual.append(d)  # Abkürzung und Titel des Nachfolgers beim nächsten Lauf
        elif d['kind'] == 'missing': manual.append(d)
    rows.sort(key=lambda r: [int(x) if x.isdigit() else x for x in re.split(r'(\d+)', r[0])])
    return rows, manual


KIND = {'abbr': 'Abkürzung geändert', 'title': 'Kurztitel geändert', 'sr': 'SR-Nummer geändert', 'status': 'nicht mehr in Kraft',
        'successor': 'Nachfolger (neue ELI)', 'missing': 'bei Fedlex nicht gefunden'}

def report(rows, diffs, today):
    L = [f'## Abgleich der Erlasstabelle mit Fedlex ({today})', '',
         f'Geprüft: {len(rows)} Erlasse in `src/erlasse.js` gegen den SPARQL-Endpunkt der Bundeskanzlei ({ENDPOINT}).', '']
    if not diffs:
        L.append('Keine Unterschiede.'); return '\n'.join(L) + '\n'
    L += [f'{len(diffs)} Unterschied(e):', '', '| SR | Art | Sprache | bisher | Fedlex | Hinweis |', '| --- | --- | --- | --- | --- | --- |']
    esc = md
    for d in diffs:
        L.append(f"| {d['sr']} | {KIND[d['kind']]} | {d.get('lang') or '–'} | {esc(d.get('old'))} | {esc(d.get('new'))} | {esc(d.get('note'))} |")
    L += ['', 'Automatisch übernommen (mit `--write`): Abkürzungen, amtliche Kurztitel, SR-Nummern, Nachfolger (ELI).',
          'Von Hand prüfen: abgeleitete Kurztitel, Erlasse ohne Nachfolger, fehlende Einträge; Nachfolger: Abkürzung und Titel im nächsten Lauf.',
          'Danach: `node test/ausbau_test.mjs` und `python3 test/compare_test.py` (Regeln R04 und X12 nutzen die Tabelle).']
    return '\n'.join(L) + '\n'


def main(argv=None):
    ap = argparse.ArgumentParser(description='Abgleich der Erlasstabelle mit Fedlex')
    ap.add_argument('--write', action='store_true'); ap.add_argument('--report'); ap.add_argument('--record'); ap.add_argument('--replay')
    ap.add_argument('--today', default=datetime.date.today().isoformat())
    a = ap.parse_args(argv)
    rows = read_table()
    try:
        works, by_sr = fetch(rows, Source(record=a.record, replay=a.replay))
    except Exception as e:
        print(f'Abruf bei Fedlex fehlgeschlagen: {type(e).__name__}: {e}', file=sys.stderr); return 2
    diffs = compare(rows, works, by_sr)
    bad = implausible(rows, diffs)
    if bad:
        print('Antwort von Fedlex unplausibel, nichts übernommen:', file=sys.stderr)
        for b in bad[:20]: print('  ' + b, file=sys.stderr)
        return 4
    rep = report(rows, diffs, a.today)
    sys.stdout.write(rep)
    if a.report:
        with open(a.report, 'w', encoding='utf-8') as f: f.write(rep)
    if a.write and diffs:
        new_rows, manual = apply(rows, diffs)
        if new_rows != rows:
            table_text, sources_text = write_table(new_rows, a.today), write_sources(new_rows, read_sources(), a.today)
            with open(TABLE, 'w', encoding='utf-8') as f: f.write(table_text)
            with open(SOURCES, 'w', encoding='utf-8', newline='') as f: f.write(sources_text)
            print(f'geschrieben: src/erlasse.js, design/erlasse-quellen.csv ({len(manual)} Fall/Fälle von Hand prüfen)')
    return 3 if diffs else 0


if __name__ == '__main__':
    sys.exit(main())
