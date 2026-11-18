"""Prüft vor einer Veröffentlichung, ob Tag, package.json, version.json und der oberste Eintrag in CHANGELOG.md übereinstimmen,
und schreibt den Eintrag als Text für die Release-Notizen.

  python3 tools/release_check.py v2.1.0                     prüfen
  python3 tools/release_check.py v2.1.0 --notes notizen.md  prüfen und den Eintrag aus CHANGELOG.md schreiben
  python3 tools/release_check.py --aktuell                  prüfen ohne Tag (package.json als Massstab), z. B. vor dem Taggen

version.json muss dieselben Regeln erfüllen wie die Versionsabfrage in src/update.js (sonst zeigt Lectora keinen Hinweis):
Version X.Y.Z, Datum JJJJ-MM-TT, Hinweis in de, fr, it mit höchstens 200 Zeichen, ohne spitze Klammern, Steuerzeichen und Adressen.
Der Workflow release legt diese Datei nach bestandenen Tests auf GitHub Pages ab (https://sem-sgg.github.io/lectora/version.json).
Exit-Code 0 = alles stimmt, 1 = Abweichung (mit Meldung).
"""
import datetime, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VER = re.compile(r'^(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,3})$')
# Wie URLISH in src/update.js: keine Adressen im Hinweis
URLISH = re.compile(r'://|\bwww\.|(?:^|[^\w])[\w-]+(?:\.[\w-]+)*\.[a-z]{2,24}(?![\w])|@', re.I)
HEAD = re.compile(r'^## \[?(\d+\.\d+\.\d+)\]? [–-] (\d{4}-\d{2}-\d{2})\s*$', re.M)


def changelog_top():
    text = open(os.path.join(ROOT, 'CHANGELOG.md'), encoding='utf-8').read()
    m = HEAD.search(text)
    if not m: return None, None, ''
    nxt = HEAD.search(text, m.end())
    body = text[m.end():nxt.start() if nxt else len(text)].strip()
    return m.group(1), m.group(2), body


def main(argv):
    errs = []
    pkg = json.load(open(os.path.join(ROOT, 'package.json'), encoding='utf-8'))['version']
    tag = next((a for a in argv if a.startswith('v')), None)
    if tag is None and '--aktuell' not in argv: print(__doc__); return 2
    want = tag[1:] if tag else pkg
    if tag and not VER.match(want): errs.append(f'Tag {tag}: erwartet vX.Y.Z')
    if pkg != want: errs.append(f'package.json: {pkg}, Tag verlangt {want}')
    vj = json.load(open(os.path.join(ROOT, 'version.json'), encoding='utf-8'))
    if vj.get('version') != want: errs.append(f'version.json: {vj.get("version")}, erwartet {want}')
    try: datetime.date.fromisoformat(vj.get('date', ''))
    except ValueError: errs.append(f'version.json: Datum {vj.get("date")!r} ungültig')
    note = vj.get('note') if isinstance(vj.get('note'), dict) else {}
    for l in ('de', 'fr', 'it'):
        s = note.get(l)
        if not isinstance(s, str) or not s.strip() or len(s) > 200 or re.search(r'[\x00-\x1f\x7f-\x9f\u2028\u2029<>]', s): errs.append(f'version.json: note.{l} fehlt, ist länger als 200 Zeichen oder enthält < > bzw. Steuerzeichen')
        elif URLISH.search(s): errs.append(f'version.json: note.{l} enthält etwas, das wie eine Adresse aussieht (://, www., Hostname, @); die Versionsabfrage verwirft dann die ganze Datei')
    if len(vj) > 8: errs.append('version.json: mehr als 8 Felder (die Versionsabfrage verwirft die Datei)')
    if len(json.dumps(vj, ensure_ascii=False).encode('utf-8')) > 4096: errs.append('version.json: grösser als 4 KiB (die Versionsabfrage verwirft die Datei)')
    cv, cd, body = changelog_top()
    if cv != want: errs.append(f'CHANGELOG.md: oberster Eintrag {cv}, erwartet {want} (Überschrift «## {want} – JJJJ-MM-TT»)')
    if cd and vj.get('date') != cd: errs.append(f'CHANGELOG.md ({cd}) und version.json ({vj.get("date")}): verschiedene Daten')
    if not body: errs.append('CHANGELOG.md: oberster Eintrag ohne Text')
    if '--notes' in argv:
        out = argv[argv.index('--notes') + 1]
        with open(out, 'w', encoding='utf-8') as f: f.write(body + '\n')
    for e in errs: print('  ' + e)
    print(f'Version {want}: ' + ('Tag, package.json, version.json und CHANGELOG.md stimmen überein' if not errs else f'{len(errs)} Abweichung(en)'))
    return 1 if errs else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
