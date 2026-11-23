"""Prüft, ob die festen Kennzahlen der Produktdokumentation (docs/lectora-dokumentation.html) zum Stand des Repositorys passen.

  python3 tools/doku_check.py                 prüfen (braucht die gebauten Ausgaben: npm run build)
  python3 tools/doku_check.py --datei PFAD    eine andere Datei prüfen (Tests)

Geprüft wird in allen drei Sprachen:
  - Zahl der lokalen Regeln, der KI-Kriterien und aller Kriterien (aus DP.rules.CATALOG in src/rules.js)
  - Zahl der Kriterien je Kategorie im Kriterienkatalog der Dokumentation (CAT_DATA)
  - Zahl der Bundeserlasse (aus der Erlasstabelle in src/erlasse.js)
  - Dateigrössen in MB (1 MB = 1 000 000 Byte) oder in Byte: Offline-Ausgabe (dist-offline/Lectora-<Version>.html) und Artefakt-Ausgabe
    (dist/index.html); erlaubt sind höchstens 5 Prozent Abweichung
Die Versionsnummer der Dokumentation prüft tools/release_check.py (ohne Build, auch im Workflow release).
Exit-Code 0 = alles stimmt, 1 = Abweichung (mit Datei, Fundstelle und Behebung).
"""
import html as htmlmod, json, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOC = 'docs/lectora-dokumentation.html'
TOLERANZ = 0.05
BEHEBUNG = ('Behebung: Ziehe die Produktdokumentation nach (alle drei Sprachen, siehe AGENTS.md, Abschnitt «Produktdokumentation»). '
            'Ohne Agenten: Gib einem Agenten den Auftrag «Ziehe docs/lectora-dokumentation.html auf den Stand des Repositorys nach: '
            'Kennzahlen, Texte und Bilder in Deutsch, Französisch und Italienisch, nach AGENTS.md».')


def stand():
    """Kennzahlen aus dem Quellcode (über Node, wie die Logiktests)."""
    js = ("globalThis.DP={};const fs=require('fs');for(const f of ['lang','erlasse','modal','rules'])(0,eval)(fs.readFileSync('src/'+f+'.js','utf8'));"
          "const C=DP.rules.CATALOG,cats={};for(const c of C){const k=cats[c.cat]||(cats[c.cat]={lok:0,ki:0});c.ai?k.ki++:k.lok++;}"
          "console.log(JSON.stringify({lok:C.filter(c=>!c.ai).length,ki:C.filter(c=>c.ai).length,alle:C.length,cats,erlasse:DP.erlasse.TABLE.length}))")
    r = subprocess.run([os.environ.get('NODE', 'node'), '-e', js], cwd=ROOT, capture_output=True, text=True)
    if r.returncode: sys.exit('Kennzahlen aus src/ nicht lesbar: ' + r.stderr.strip()[:300])
    return json.loads(r.stdout)


def zeile(text, pos):
    return text.count('\n', 0, pos) + 1


def main(argv):
    path = argv[argv.index('--datei') + 1] if '--datei' in argv[:-1] else os.path.join(ROOT, DOC)
    raw = open(path, encoding='utf-8').read()
    # Eingebettete Bilder und Schriften (Base64) weglassen; Zeilennummern bleiben, weil sie keine Zeilenumbrüche enthalten
    src = re.sub(r'[A-Za-z0-9+/=]{300,}', '…', raw)
    st, errs = stand(), []

    def soll(rx, want, was):
        """Jede Fundstelle von rx (Gruppe 1: Zahl) muss want nennen; mindestens eine Fundstelle muss es geben."""
        hits = list(re.finditer(rx, src))
        if not hits: errs.append(f'{DOC}: Keine Angabe «{was}» gefunden (Muster {rx}). Steht die Angabe nicht mehr in der Dokumentation, passe tools/doku_check.py an.')
        for m in hits:
            got = int(m.group(1))
            if got != want:
                errs.append(f'{DOC}, Zeile {zeile(src, m.start())}: «{htmlmod.unescape(m.group(0)).strip()[:80]}» nennt {got} {was}, im Repository sind es {want}. '
                            f'Ändere die Zahl auf {want}.')

    lok, ki, alle, erl = st['lok'], st['ki'], st['alle'], st['erlasse']
    soll(r'(\d+) (?:lokalen? Regeln|règles locales|regole locali|Regeln \+|règles \+|regole \+)', lok, 'lokale Regeln')
    soll(r'(\d+) (?:lokal|locaux|locali) · ', lok, 'lokale Regeln')
    soll(r'(?:Lokal im Browser|En local dans le navigateur|In locale nel browser) \((\d+)', lok, 'lokale Regeln')
    soll(r'(\d+) (?:optional mit KI|avec IA|con IA)\b', ki, 'KI-Kriterien')
    soll(r'(?:KI-Funktionen|Fonctions d’IA|Funzioni IA) \((\d+)', ki, 'KI-Kriterien')
    soll(r'(?:Optional mit Claude|Facultatif avec Claude|Facoltativo con Claude) \((\d+)', ki, 'KI-Kriterien')
    soll(r'(?:und|et|e) (\d+) (?:optionale KI-Kriterien|critères d’IA facultatifs|criteri IA facoltativi)', ki, 'KI-Kriterien')
    soll(r'(?:Dateiformate und|formats et|formati e|>\s*) ?(\d+) (?:Kriterien|critères|criteri)\s*<', alle, 'Kriterien insgesamt')
    soll(r'(\d+) (?:Bundeserlassen?|Fedlex-Erlasse|Erlasse|actes fédéraux|actes Fedlex|actes|atti federali|atti Fedlex|atti)\b', erl, 'Bundeserlasse')

    # Kriterien je Kategorie: CAT_DATA im Skript der Dokumentation, je Sprache die Beschreibung jeder Kategorie
    m = re.search(r'const CAT_DATA = (\{.*?\});\n', src, re.S)
    if not m: errs.append(f'{DOC}: CAT_DATA (Kriterienkatalog der Dokumentation) nicht gefunden. Steht der Katalog anders in der Datei, passe tools/doku_check.py an.')
    else:
        data, z = json.loads(m.group(1)), zeile(src, m.start())
        for lang, cats in data.items():
            for cat, info in cats.items():
                want = st['cats'].get(cat)
                if not want: errs.append(f'{DOC}, Zeile {z} (CAT_DATA, {lang}): Kategorie «{cat}» gibt es in src/rules.js nicht. Entferne sie oder benenne sie wie in DP.rules.CATS.'); continue
                d = info.get('desc', '')
                n_lok = re.search(r'\((\d+) (?:lokale|critères locaux|criteri locali)', d)
                n_ki = re.search(r'(\d+) (?:optionale KI-Kriterien|critères IA facultatifs|criteri IA facoltativi)', d)
                if want['lok'] and (not n_lok or int(n_lok.group(1)) != want['lok']):
                    errs.append(f'{DOC}, Zeile {z} (CAT_DATA, {lang}, {cat}): Die Beschreibung nennt {n_lok.group(1) if n_lok else "keine"} lokale Kriterien, '
                                f'in src/rules.js sind es {want["lok"]}. Ändere «{d[:60]}…».')
                if want['ki'] and (not n_ki or int(n_ki.group(1)) != want['ki']):
                    errs.append(f'{DOC}, Zeile {z} (CAT_DATA, {lang}, {cat}): Die Beschreibung nennt {n_ki.group(1) if n_ki else "keine"} KI-Kriterien, '
                                f'in src/rules.js sind es {want["ki"]}. Ändere «{d[:60]}…».')

    # Dateigrössen: «Lectora.html (3.45 MB)», «Artefakt (1.42 MB)», französisch «Mo»
    version = json.load(open(os.path.join(ROOT, 'package.json'), encoding='utf-8'))['version']
    dateien = {'off': f'dist-offline/Lectora-{version}.html', 'art': 'dist/index.html'}
    groesse = {}
    for k, f in dateien.items():
        p = os.path.join(ROOT, f)
        if not os.path.exists(p): errs.append(f'{f} fehlt: Die Dateigrösse lässt sich nicht prüfen. Baue zuerst alle Ausgaben (npm run build).')
        else: groesse[k] = os.path.getsize(p) / 1e6
    # Auch Angaben in Byte («3 451 602 Byte»): dieselbe Prüfung, damit keine genaue Zahl veraltet
    hits = list(re.finditer(r'(\d+[.,]\d+)\s*(?:MB|Mo)\b|(?<![\d.,])(\d{1,3}(?:[ \u00a0\u202f\u2009’\']\d{3}){1,3})\s*Bytes?\b', src))
    if not hits: errs.append(f'{DOC}: Keine Dateigrösse in MB gefunden. Steht sie nicht mehr in der Dokumentation, passe tools/doku_check.py an.')
    for m in hits:
        vor = htmlmod.unescape(re.sub(r'<[^>]+>', ' ', src[max(0, m.start() - 80):m.start()]))
        # Massgebend ist der Text seit der letzten schliessenden Klammer: «Lectora.html (…) · Artefakt (1.42 MB)»
        k = 'art' if 'Artefa' in vor.rsplit(')', 1)[-1] else 'off'
        if k not in groesse: continue
        got = float(m.group(1).replace(',', '.')) if m.group(1) else int(re.sub(r'\D', '', m.group(2))) / 1e6
        want = groesse[k]
        if abs(got - want) > TOLERANZ * want:
            name = 'Artefakt-Ausgabe (dist/index.html)' if k == 'art' else f'Offline-Ausgabe ({dateien["off"]})'
            errs.append(f'{DOC}, Zeile {zeile(src, m.start())}: «{m.group(0)}» weicht mehr als {int(TOLERANZ * 100)} Prozent von der {name} ab, '
                        f'die {want:.2f} MB gross ist. Ändere die Angabe auf {want:.2f} MB (Französisch {want:.2f} Mo, Italienisch {want:.2f} MB, '
                        f'dort mit Komma statt Punkt).')

    pre = '::error::' if os.environ.get('GITHUB_ACTIONS') == 'true' else '  '
    for e in errs: print(pre + e)
    if errs:
        print(f'Produktdokumentation: {len(errs)} Abweichung(en). {BEHEBUNG}')
        return 1
    print(f'Produktdokumentation: Kennzahlen stimmen ({lok} lokale Regeln, {ki} KI-Kriterien, {alle} Kriterien, {erl} Erlasse, '
          + ', '.join(f'{v:.2f} MB' for v in groesse.values()) + ').')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
