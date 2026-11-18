"""Prüft vor einer Veröffentlichung, ob Tag, package.json, version.json und der oberste Eintrag in CHANGELOG.md übereinstimmen,
und schreibt den Eintrag als Text für die Release-Notizen.

  python3 tools/release_check.py v2.1.0                     prüfen (Version aus dem Tag)
  python3 tools/release_check.py --version 2.1.0            prüfen (Version ausdrücklich, ohne «v»; Start von Hand im Workflow)
  python3 tools/release_check.py v2.1.0 --notes notizen.md  prüfen und den Eintrag aus CHANGELOG.md schreiben
  python3 tools/release_check.py --aktuell                  prüfen ohne Tag (package.json als Massstab), z. B. vor dem Release

version.json muss dieselben Regeln erfüllen wie die Versionsabfrage in src/update.js (sonst zeigt Lectora keinen Hinweis):
Version X.Y.Z, Datum JJJJ-MM-TT, Hinweis in de, fr, it mit höchstens 200 Zeichen, ohne spitze Klammern, Steuerzeichen und Adressen.
Der Workflow release legt diese Datei nach bestandenen Tests auf GitHub Pages ab (https://sem-sgg.github.io/lectora/version.json).
Exit-Code 0 = alles stimmt, 1 = Abweichung (mit Meldung).
"""
import datetime, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# \Z statt $: $ liesse einen Zeilenumbruch am Ende durch (Eingaben aus dem Workflow)
VER = re.compile(r'^(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,3})\Z')
# Wie URLISH in src/update.js: keine Adressen im Hinweis
URLISH = re.compile(r'://|\bwww\.|(?:^|[^\w])[\w-]+(?:\.[\w-]+)*\.[a-z]{2,24}(?![\w])|@', re.I)
HEAD = re.compile(r'^## \[?(\d+\.\d+\.\d+)\]? [–-] (\d{4}-\d{2}-\d{2})\s*$', re.M)


def changelog_top():
    text = open(os.path.join(ROOT, 'CHANGELOG.md'), encoding='utf-8').read()
    m = HEAD.search(text)
    first = next((l.strip() for l in text.splitlines() if l.startswith('## ')), None)
    if not m: return None, None, '', first
    nxt = HEAD.search(text, m.end())
    body = text[m.end():nxt.start() if nxt else len(text)].strip()
    return m.group(1), m.group(2), body, first


def load_json(name, errs):
    """JSON-Datei lesen; bei einem Fehler eine verständliche Meldung statt eines Programmabbruchs."""
    try: return json.load(open(os.path.join(ROOT, name), encoding='utf-8'))
    except json.JSONDecodeError as e:
        errs.append(f'{name} ist nach der Änderung kein gültiges JSON mehr (Zeile {e.lineno}, Spalte {e.colno}). Häufige Ursachen: ein fehlendes '
                    f'Komma am Zeilenende, ein Anführungszeichen zu viel oder zu wenig, gerade Anführungszeichen "…" im Hinweistext '
                    f'(verwende «…»). Vergleiche die Datei mit dem Beispiel in docs/release.md.')
        return None


SPRACHE = {'de': 'Deutsch', 'fr': 'Französisch', 'it': 'Italienisch'}


def main(argv):
    errs = []
    werte = {argv[i + 1] for i, a in enumerate(argv[:-1]) if a in ('--notes', '--version')}
    tag = next((a for a in argv if a.startswith('v') and a not in werte), None)
    given = argv[argv.index('--version') + 1] if '--version' in argv[:-1] else None
    if [tag, given, '--aktuell' in argv or None].count(None) != 2: print(__doc__); return 2
    pj = load_json('package.json', errs)
    pkg = pj.get('version') if isinstance(pj, dict) else None
    want, quelle = (tag[1:], 'Tag') if tag else (given, 'Eingabe') if given is not None else (pkg or '', 'package.json')
    if not VER.match(want):
        # Falsche Form: kein Vergleich mit den Dateien, nur diese Meldung
        if tag: msg = f'Der Tag {tag[:40]!r} hat nicht die Form vX.Y.Z (zum Beispiel v2.1.0).'
        elif given is not None:
            msg = (f'Die eingegebene Version {want[:40]!r} hat nicht die Form X.Y.Z. Gib drei Zahlen mit Punkten ein, ohne «v» und ohne '
                   f'Leerzeichen, zum Beispiel 2.1.0.')
        else: msg = errs[0] if errs else f'package.json: Die Version {want[:40]!r} hat nicht die Form X.Y.Z (zum Beispiel 2.1.0).'
        fehler([msg]); print('Version nicht geprüft.'); return 1
    if pj is not None and pkg != want: errs.append(f'package.json nennt die Version {pkg}, erwartet ist {want}. Ändere in package.json die Zeile '
                                f'"version": "{pkg}" in "version": "{want}".')
    vj = load_json('version.json', errs)
    cv, cd, body, first = changelog_top()
    if isinstance(vj, dict):
        if vj.get('version') != want: errs.append(f'version.json nennt die Version {vj.get("version")}, erwartet ist {want}. Ändere dort die Zeile '
                                                  f'"version": "{vj.get("version")}" in "version": "{want}".')
        try: datetime.date.fromisoformat(vj.get('date', ''))
        except (TypeError, ValueError): errs.append(f'version.json: Das Datum {vj.get("date")!r} ist ungültig. Schreibe es in der Form JJJJ-MM-TT, '
                                                    f'zum Beispiel 2026-12-01.')
        note = vj.get('note') if isinstance(vj.get('note'), dict) else {}
        for l in ('de', 'fr', 'it'):
            s = note.get(l)
            if not isinstance(s, str) or not s.strip():
                errs.append(f'version.json: Der Hinweis auf {SPRACHE[l]} («note», «{l}») fehlt oder ist leer. Schreibe einen kurzen Satz.')
            elif len(s) > 200:
                errs.append(f'version.json: Der Hinweis auf {SPRACHE[l]} hat {len(s)} Zeichen, erlaubt sind 200. Kürze ihn.')
            elif re.search(r'[\x00-\x1f\x7f-\x9f\u2028\u2029<>]', s):
                errs.append(f'version.json: Der Hinweis auf {SPRACHE[l]} enthält < oder > oder einen Zeilenumbruch. Entferne sie.')
            elif URLISH.search(s):
                errs.append(f'version.json: Der Hinweis auf {SPRACHE[l]} enthält etwas, das wie eine Adresse aussieht (://, www., ein Name mit Punkt '
                            f'wie beispiel.ch, oder @). Entferne es: Sonst zeigen die Offline-Ausgaben gar keinen Hinweis.')
        if len(vj) > 8: errs.append('version.json hat mehr als 8 Felder. Lass nur «version», «date» und «note» stehen (sonst verwirft die Versionsabfrage die Datei).')
        if len(json.dumps(vj, ensure_ascii=False).encode('utf-8')) > 4096: errs.append('version.json ist grösser als 4 KiB. Kürze die Hinweise.')
        if cd and vj.get('date') != cd: errs.append(f'CHANGELOG.md nennt das Datum {cd}, version.json das Datum {vj.get("date")}. Trage in beiden dasselbe Datum ein.')
    if cv != want:
        if first and not HEAD.match(first):
            errs.append(f'CHANGELOG.md: Die oberste Überschrift «{first[:60]}» hat nicht die Form «## {want} – JJJJ-MM-TT». Korrigiere sie, '
                        f'zum Beispiel «## {want} – 2026-12-01».')
        else:
            errs.append(f'CHANGELOG.md: Der oberste Eintrag nennt die Version {cv}, erwartet ist {want}. Schreibe zuoberst, unter dem Einleitungssatz, '
                        f'einen neuen Eintrag mit der Überschrift «## {want} – JJJJ-MM-TT».')
    elif not body: errs.append(f'CHANGELOG.md: Unter der Überschrift «## {want} …» fehlt der Text. Beschreibe, was neu ist.')
    if '--notes' in argv:
        out = argv[argv.index('--notes') + 1]
        with open(out, 'w', encoding='utf-8') as f: f.write(body + '\n')
    # Nennen alle Dateien dieselbe andere Version, ist vermutlich die Eingabe vertippt
    if quelle != 'package.json' and errs and pkg and pkg != want and isinstance(vj, dict) and vj.get('version') == pkg and cv == pkg:
        if quelle == 'Eingabe':
            errs = [f'Du hast {want} eingegeben, aber package.json, version.json und CHANGELOG.md nennen alle {pkg}. Hast du dich vertippt? '
                    f'Dann starte den Workflow neu mit {pkg}. Willst du wirklich {want} veröffentlichen, ändere zuerst die drei Dateien in einem Pull Request.']
        else:
            errs = [f'Der Tag v{want} passt nicht: package.json, version.json und CHANGELOG.md nennen alle {pkg}. Veröffentlicht wird nichts. '
                    f'Ändere zuerst die drei Dateien in einem Pull Request.']
    # Ohne Vorgabe (Workflow checks): Nennen version.json und CHANGELOG.md dieselbe neue Version, ist package.json vergessen
    if quelle == 'package.json' and pkg and isinstance(vj, dict) and vj.get('version') == cv and cv and cv != pkg and VER.match(cv):
        errs = [f'package.json nennt noch die Version {pkg}, version.json und CHANGELOG.md schon {cv}. Hast du package.json vergessen? '
                f'Ändere dort die Zeile "version": "{pkg}" in "version": "{cv}".'] + [e for e in errs if not e.startswith(('version.json nennt', 'CHANGELOG.md: Der oberste'))]
    fehler(errs)
    if errs: print(f'Version {want}: {len(errs)} Abweichung(en). Korrigiere die genannten Dateien (docs/release.md, Schritt 1).')
    else: print(f'Version {want}: ' + ('' if quelle == 'package.json' else quelle + ', ') + 'package.json, version.json und CHANGELOG.md stimmen überein.')
    return 1 if errs else 0


def fehler(errs):
    # In GitHub Actions als Anmerkung (::error::): erscheint oben auf der Seite des Laufs, ohne das Protokoll zu öffnen
    pre = '::error::' if os.environ.get('GITHUB_ACTIONS') == 'true' else '  '
    for e in errs: print(pre + e)


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
