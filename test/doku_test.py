"""Test der Routineprüfung der Produktdokumentation: tools/doku_check.py (Kennzahlen nach dem Build) und die Versionsprüfung in
tools/release_check.py. Jede veraltete Angabe muss mit Datei, Fundstelle und Behebung gemeldet werden; der aktuelle Stand besteht.
Aufruf: python3 test/doku_test.py (nach dem Build). Schluss: «FEHLER: keine»."""
import json, os, re, shutil, subprocess, sys, tempfile
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOC = os.path.join(ROOT, 'docs', 'lectora-dokumentation.html')
errors = []
def ok(cond, msg):
    print(('  ok   ' if cond else '  FEHLER ') + msg)
    if not cond: errors.append(msg)
env = {**os.environ, 'GITHUB_ACTIONS': ''}

# ---- tools/doku_check.py
def doku(change=None):
    tmp = tempfile.mkdtemp(prefix='doku-'); p = os.path.join(tmp, 'doku.html')
    text = open(DOC, encoding='utf-8').read()
    open(p, 'w', encoding='utf-8').write(change(text) if change else text)
    r = subprocess.run([sys.executable, os.path.join(ROOT, 'tools', 'doku_check.py'), '--datei', p], cwd=ROOT, capture_output=True, text=True, env=env)
    shutil.rmtree(tmp, ignore_errors=True)
    return r.returncode, r.stdout + r.stderr
rc, log = doku()
ok(rc == 0 and 'Kennzahlen stimmen' in log, f'aktueller Stand besteht ({log.strip().splitlines()[-1] if log.strip() else ""})')
st = json.loads(subprocess.run(['node', '-e', "globalThis.DP={};const fs=require('fs');for(const f of ['lang','erlasse','modal','rules'])(0,eval)(fs.readFileSync('src/'+f+'.js','utf8'));"
                                "console.log(JSON.stringify({lok:DP.rules.CATALOG.filter(c=>!c.ai).length,ki:DP.rules.CATALOG.filter(c=>c.ai).length,erl:DP.erlasse.TABLE.length}))"],
                               cwd=ROOT, capture_output=True, text=True).stdout)
falsch = lambda n: str(n + 1)
for was, fn in (
        ('lokale Regeln (Deutsch)', lambda t: t.replace(f'{st["lok"]} lokale Regeln', f'{falsch(st["lok"])} lokale Regeln', 1)),
        ('lokale Regeln (Französisch)', lambda t: t.replace(f'{st["lok"]} règles locales', f'{falsch(st["lok"])} règles locales', 1)),
        ('KI-Kriterien (Italienisch)', lambda t: t.replace(f'Funzioni IA ({st["ki"]} criteri', f'Funzioni IA ({falsch(st["ki"])} criteri', 1)),
        ('Erlasse', lambda t: t.replace(f'{st["erl"]} Fedlex-Erlasse', f'{falsch(st["erl"])} Fedlex-Erlasse', 1)),
        ('Kategorie im Kriterienkatalog', lambda t: re.sub(r'(Formale Vollständigkeit \()(\d+)', lambda m: m.group(1) + falsch(int(m.group(2))), t, count=1)),
        ('Grösse der Offline-Ausgabe', lambda t: re.sub(r'Lectora\.html \((\d+[.,]\d+) MB\)', 'Lectora.html (9.99 MB)', t, count=1)),
        ('Grösse der Artefakt-Ausgabe (Französisch, Mo)', lambda t: re.sub(r'(Artefact \()\d+,\d+( Mo\))', r'\g<1>7,77\2', t, count=1))):
    rc, log = doku(fn)
    first = next((l for l in log.splitlines() if 'Zeile' in l or 'Keine' in l), '')
    ok(rc == 1 and 'docs/lectora-dokumentation.html' in log and 'Ändere' in log and 'Behebung' in log and ('Zeile' in first),
       f'veraltet: {was} → Meldung mit Fundstelle und Behebung «{first.strip()[:110]}»')

# ---- tools/release_check.py: Version der Dokumentation (Kopie mit package.json, version.json, CHANGELOG.md und Dokumentation)
cur = json.load(open(os.path.join(ROOT, 'package.json'), encoding='utf-8'))['version']
vj = json.load(open(os.path.join(ROOT, 'version.json'), encoding='utf-8'))
X, Y, Z = map(int, cur.split('.'))
# Version, die die Dokumentation nennt: bei einer Korrekturversion darf sie kleiner sein als package.json (release_check.py)
sys.path.insert(0, os.path.join(ROOT, 'tools')); from release_check import DOKU_VER
dv = max(set(DOKU_VER.findall(open(DOC, encoding='utf-8').read())), key=lambda v: tuple(map(int, v.split('.'))))
def rel(pkg, doc_ver=None, doc_fn=None):
    tmp = tempfile.mkdtemp(prefix='rel-doku-'); os.makedirs(os.path.join(tmp, 'tools')); os.makedirs(os.path.join(tmp, 'docs'))
    shutil.copy(os.path.join(ROOT, 'tools', 'release_check.py'), os.path.join(tmp, 'tools'))
    pj = open(os.path.join(ROOT, 'package.json'), encoding='utf-8').read().replace(f'"version": "{cur}"', f'"version": "{pkg}"', 1)
    open(os.path.join(tmp, 'package.json'), 'w', encoding='utf-8').write(pj)
    open(os.path.join(tmp, 'version.json'), 'w', encoding='utf-8').write(json.dumps({**vj, 'version': pkg}, ensure_ascii=False, indent=2))
    cl = open(os.path.join(ROOT, 'CHANGELOG.md'), encoding='utf-8').read().replace('\n## ', f'\n## {pkg} – {vj["date"]}\n\n- Test.\n\n## ', 1)
    open(os.path.join(tmp, 'CHANGELOG.md'), 'w', encoding='utf-8').write(cl)
    text = open(DOC, encoding='utf-8').read()
    if doc_ver: text = text.replace(dv, doc_ver)
    if doc_fn: text = doc_fn(text)
    open(os.path.join(tmp, 'docs', 'lectora-dokumentation.html'), 'w', encoding='utf-8').write(text)
    r = subprocess.run([sys.executable, os.path.join(tmp, 'tools', 'release_check.py'), '--aktuell'], capture_output=True, text=True, env=env)
    shutil.rmtree(tmp, ignore_errors=True)
    return r.returncode, r.stdout + r.stderr
rc, log = rel(cur)
ok(rc == 0 and 'Produktdokumentation passt' in log, f'release_check: Version {cur} mit Dokumentation {dv} passt')
rc, log = rel(f'{X}.{Y}.{Z + 1}')
ok(rc == 0, f'release_check: Korrekturversion {X}.{Y}.{Z + 1} mit Dokumentation {dv} → stimmt (keine neue Dokumentation nötig)')
rc, log = rel(f'{X}.{Y + 1}.0')
ok(rc == 1 and 'lectora-dokumentation.html' in log and 'Nebenversion' in log and 'Agenten den Auftrag' in log, f'release_check: Nebenversion {X}.{Y + 1}.0 mit Dokumentation {dv} → Meldung mit Auftrag an einen Agenten')
rc, log = rel(f'{X + 1}.0.0')
ok(rc == 1 and 'Haupt- oder Nebenversion' in log, f'release_check: Hauptversion {X + 1}.0.0 mit Dokumentation {dv} → Meldung')
rc, log = rel(cur, doc_ver=f'{X}.{Y + 1}.0')
ok(rc == 1 and 'nicht neuer' in log, 'release_check: Dokumentation neuer als die Version → Meldung')
rc, log = rel(cur, doc_fn=lambda t: t.replace(f'(v{dv})', f'(v{X}.{Y}.{Z + 9})', 1))
ok(rc == 1 and 'verschiedene Versionen' in log, 'release_check: Dokumentation nennt zwei Versionen → Meldung')

print('FEHLER:', 'keine' if not errors else '\n  ' + '\n  '.join(errors))
sys.exit(1 if errors else 0)
