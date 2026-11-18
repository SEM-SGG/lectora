"""Workflows und Veröffentlichung, ohne Netz: Aktionen per Commit festgelegt, Rechte je Auftrag, Release nur von main, Versionsdatei erst
mit GitHub Pages, kein Token im Arbeitsverzeichnis des Fedlex-Abgleichs, checks nicht doppelt bei Tags; Regeln für den Hinweistext in
version.json (dieselben wie in src/update.js). Aufruf: python3 test/release_test.py. Schluss: «FEHLER: keine»."""
import os, re, sys, subprocess, json
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import release_check
errors = []
def ok(c, msg):
    print(('  ok   ' if c else '  FEHLER ') + msg)
    if not c: errors.append(msg)

WF = os.path.join(ROOT, '.github', 'workflows')
wf = {f: open(os.path.join(WF, f), encoding='utf-8').read() for f in sorted(os.listdir(WF)) if f.endswith('.yml')}
for f, s in wf.items():
    uses = re.findall(r'uses:\s*(\S+)(.*)', s)
    bad = [u for u, c in uses if not re.fullmatch(r'[\w.-]+/[\w.-]+@[0-9a-f]{40}', u) or not re.search(r'#\s*v\d', c)]
    ok(uses and not bad, f'{f}: {len(uses)} Aktionen per Commit festgelegt, Version im Kommentar {bad[:2]}')
    ok(re.search(r'^permissions:\s*(\{\}|\n\s+contents: read)', s, re.M) is not None, f'{f}: Rechte oben minimal')
    ok('pull_request_target' not in s, f'{f}: kein pull_request_target')
    # Keine Ereignisdaten direkt in Shell-Befehlen (Titel, Zweig, Eingaben nur über env)
    runs = '\n'.join(re.findall(r'run: \|\n((?:\s{10,}.*\n)+)', s))
    ok(runs.strip() and not re.search(r'\$\{\{\s*(?:github\.event|inputs|github\.head_ref)', runs), f'{f}: keine Ereignisdaten in run-Blöcken')
c = wf['checks.yml']
ok(re.search(r'push:\n\s+branches:', c) is not None, 'checks: nur Zweige (ein Tag startet release, nicht checks)')
ok('hygiene.py --commits' in c and 'fetch-depth: 0' in c, 'checks: Hygiene der Commits mit ganzer Geschichte')
r = wf['release.yml']
ok('merge-base --is-ancestor "$GITHUB_SHA" origin/main' in r and 'fetch-depth: 0' in r, 'release: nur von einem Commit auf main')
ok(r.index('cp veroeffentlichung/version.json site/version.json') > r.index('needs: release'), 'release: version.json erst im Auftrag pages, nach dem Release')
ok('sha256sum -c SHA256SUMS.txt' in r, 'release: Prüfsummen vor dem Hochladen geprüft')
e = wf['erlasse.yml']
ok('persist-credentials: false' in e and 'x-access-token:${GH_TOKEN}' in e, 'erlasse: kein Token im Arbeitsverzeichnis; geschoben nur im letzten Schritt')
ok('"$code" = 4' in e, 'erlasse: unplausible Antwort bricht ab')
p = wf['pages.yml']
ok('workflow_dispatch' in p and 'gh release download' in p and 'sha256sum -c' in p and 'merge-base --is-ancestor HEAD origin/main' in p, 'pages: Zurückrollen aus einem bestehenden Release, mit Prüfsumme, nur von main')
ok(os.path.exists(os.path.join(ROOT, '.github', 'dependabot.yml')) and all(x in open(os.path.join(ROOT, '.github', 'dependabot.yml')).read() for x in ('github-actions', 'npm', 'pip')), 'dependabot: Aktionen, npm, pip')

# Hinweistext: dieselben Regeln wie src/update.js (Adressen verboten)
U = release_check.URLISH
for t, bad in (('Neue Regeln für Fristen.', False), ('Version 2.1.0 mit 5 neuen Kriterien.', False), ('z. B. Art. 5 Abs. 2.', False), ('Neue Regeln, u.a. für Fristen.', False),
               ('Laden Sie die Version von https://x.ch herunter.', True), ('Siehe www.lectora-update.ch.', True), ('Neu: lectora-update.ch', True), ('Schreiben Sie an info' + '@x.ch', True)):
    ok(bool(U.search(t)) == bad, f'Hinweis «{t}»: {"verworfen" if bad else "zulässig"}')
node = subprocess.run(['node', '-e', '''globalThis.DP = {version: "2.0.0"}; (0, eval)(require("fs").readFileSync("src/update.js", "utf8"));
  const v = (n) => !!DP.update.validate({version: "2.1.0", date: "2026-12-01", note: {de: n, fr: "a", it: "b"}});
  console.log(JSON.stringify(["Neue Regeln.", "Siehe https://x.ch", "Siehe www.x.ch", "Neu: x-update.ch", "a" + "@b.ch", "Art. 5 Abs. 2."].map(v)));'''], cwd=ROOT, capture_output=True, text=True)
ok(node.stdout.strip() == '[true,false,false,false,false,true]', f'src/update.js verwirft dieselben Hinweise ({node.stdout.strip() or node.stderr[:200]})')
ok("'https://sem-sgg.github.io/lectora/version.json'" in open(os.path.join(ROOT, 'src', 'update.js')).read() and 'https://sem-sgg.github.io/lectora/version.json' in open(os.path.join(ROOT, 'build.mjs')).read(), 'Versionsabfrage: GitHub Pages, gleiche Adresse in update.js und build.mjs (CSP)')

print('FEHLER:', 'keine' if not errors else '\n  ' + '\n  '.join(errors))
sys.exit(1 if errors else 0)
