"""Workflows und Veröffentlichung, ohne Netz: Aktionen per Commit festgelegt, Rechte je Auftrag, Release nur von main, Versionsdatei erst
mit GitHub Pages, kein Token im Arbeitsverzeichnis des Fedlex-Abgleichs, checks nicht doppelt bei Tags; Regeln für den Hinweistext in
version.json (dieselben wie in src/update.js). Start von Hand (workflow_dispatch): Eingabe nur über env und streng geprüft, nur von
main, Tag und Release dürfen noch nicht bestehen, beide Wege veröffentlichen dieselbe geprüfte Datei. Führt die Shell-Schritte
«Auslöser und Version» und «Seite zusammenstellen» aus, tools/release_stand.py gegen ein nachgebildetes gh und tools/release_check.py
auf Kopien mit vergessenen Dateien. Aufruf: python3 test/release_test.py. Schluss: «FEHLER: keine»."""
import os, re, sys, subprocess, json, shutil, tempfile, textwrap
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import release_check
errors = []
def ok(c, msg):
    print(('  ok   ' if c else '  FEHLER ') + msg)
    if not c: errors.append(msg)

def run_blocks(text):
    """Inhalt aller run:-Schritte (Block mit | und einzeilig), ohne YAML-Bibliothek."""
    out, lines = [], text.split('\n')
    for i, l in enumerate(lines):
        m = re.match(r'^(\s*)(?:- )?run: ?(.*)$', l)
        if not m: continue
        if m.group(2).strip() in ('|', '|-', '>', '>-'):
            ind, body = len(m.group(1)), []
            for k in lines[i + 1:]:
                if k.strip() and len(k) - len(k.lstrip()) <= ind: break
                body.append(k)
            out.append(textwrap.dedent('\n'.join(body)).strip('\n') + '\n')
        else: out.append(m.group(2) + '\n')
    return out

def jobs(text):
    """Aufträge eines Workflows: Name → Text des Auftrags (zwei Leerzeichen eingerückt unter jobs:)."""
    body = text[text.index('\njobs:\n') + 7:]
    parts = re.split(r'^  ([\w-]+):\s*$', body, flags=re.M)
    return {parts[i]: parts[i + 1] for i in range(1, len(parts), 2)}

def step(text, name):
    """Text eines Schritts mit diesem Namen (bis zum nächsten Schritt)."""
    m = re.search(r'^(\s*)- name: ' + re.escape(name) + r'.*?(?=^\1- |\Z)', text, re.M | re.S)
    return m.group(0) if m else ''

def timeout(job):
    m = re.search(r'timeout-minutes: (\d+)', job)
    return int(m.group(1)) if m else 0

WF = os.path.join(ROOT, '.github', 'workflows')
wf = {f: open(os.path.join(WF, f), encoding='utf-8').read() for f in sorted(os.listdir(WF)) if f.endswith('.yml')}
for f, s in wf.items():
    uses = re.findall(r'uses:\s*(\S+)(.*)', s)
    bad = [u for u, c in uses if not re.fullmatch(r'[\w.-]+/[\w.-]+@[0-9a-f]{40}', u) or not re.search(r'#\s*v\d', c)]
    ok(uses and not bad, f'{f}: {len(uses)} Aktionen per Commit festgelegt, Version im Kommentar {bad[:2]}')
    ok(re.search(r'^permissions:\s*(\{\}|\n\s+contents: read)', s, re.M) is not None, f'{f}: Rechte oben minimal')
    ok('pull_request_target' not in s, f'{f}: kein pull_request_target')
    # Keine Ereignisdaten direkt in Shell-Befehlen (Titel, Zweig, Eingaben nur über env); Blöcke und einzeilige run:
    runs = '\n'.join(run_blocks(s))
    ok(runs.strip() and not re.search(r'\$\{\{\s*(?:github\.event|inputs|github\.head_ref)', runs), f'{f}: keine Ereignisdaten in run-Blöcken')
c = wf['checks.yml']
ok(re.search(r'push:\n\s+branches:', c) is not None, 'checks: nur Zweige (ein Tag startet release, nicht checks)')
ok('hygiene.py --commits' in c and 'fetch-depth: 0' in c, 'checks: Hygiene der Commits mit ganzer Geschichte')
ok(timeout(jobs(c)['logik-und-export']) >= 60, 'checks: Zeitlimit des ersten Auftrags lässt Raum für langsame Systempakete (mindestens 60 Minuten)')
ok(c.index('release_check.py --aktuell') < c.index('- name: Systempakete') and c.index('release_check.py --aktuell') < c.index('setup-node'), 'checks: Versionsnummern zuerst geprüft, vor den Installationen (rasche, verständliche Meldung)')
r = wf['release.yml']
J = jobs(r)
P, R, G = J.get('pruefen', ''), J.get('release', ''), J.get('pages', '')
ok('merge-base --is-ancestor "$GITHUB_SHA" origin/main' in r and 'fetch-depth: 0' in r, 'release: nur von einem Commit auf main')
ok('cp veroeffentlichung/version.json site/version.json' in G and re.search(r'needs: \[?[^\n]*\brelease\b', G) is not None, 'release: version.json erst im Auftrag pages, nach dem Release')
ok('sha256sum -c SHA256SUMS.txt' in R, 'release: Prüfsummen vor dem Hochladen geprüft')
# Zwei Wege: Tag-Push bleibt, Start von Hand mit genau einer Eingabe
ok(re.search(r"push:\n\s+tags:\n\s+- 'v\[0-9\]\+", r) is not None, 'release: Tag-Push vX.Y.Z startet weiterhin')
disp = r[r.index('workflow_dispatch:'):r.index('\npermissions:')]
ok(re.findall(r'^      (\w+):$', disp, re.M) == ['version'] and 'required: true' in disp and 'type: string' in disp and 'ohne «v»' in disp, 'release: Start von Hand mit genau einer Eingabe «version» (Beschreibung deutsch, ohne «v»)')
# Eingabe nie in die Shell: in keinem run-Block irgendein Ausdruck, inputs.version nur als env-Wert
for f in ('release.yml', 'pages.yml'):
    ok(not any('${{' in b for b in run_blocks(wf[f])), f'{f}: kein ${{{{ … }}}} in run-Blöcken (Werte nur über env)')
uses_in = [l.strip() for l in r.split('\n') if 'inputs.' in l and not l.strip().startswith('#')]
ok(uses_in == ['EINGABE: ${{ inputs.version }}'], f'release: inputs.version nur in env (EINGABE) {uses_in}')
first = step(P, 'Auslöser und Version')
ok(first and P.index('- name: Auslöser und Version') < P.index('actions/checkout'), 'release: Eingabe und Auslöser geprüft, bevor etwas ausgecheckt wird')
ok('[ "$GITHUB_REF" != refs/heads/main ]' in first and 'exit 1' in first and 'im Menü «Branch» den Zweig main' in first, 'release: von Hand nur von main, sonst Abbruch mit Anleitung')
ok(r'[[ "$V" =~ ^(0|[1-9][0-9]{0,3})\.(0|[1-9][0-9]{0,3})\.(0|[1-9][0-9]{0,3})$ ]]' in first and 'grep' not in first, 'release: Version mit strengem Muster (bash [[ =~ ]], ganze Eingabe), gleich wie tools/release_check.py')
ok('release_check.py --version "$V"' in P and 'release_stand.py vorab' in P and P.index('release_stand.py vorab') < P.index('setup-node') and P.index('release_check.py') < P.index('setup-node'), 'release: Versionen, Tag und Release geprüft, bevor gebaut und getestet wird')
ok(all(step(P, n) and '\n        if:' not in step(P, n) for n in ('Auslöser und Version', 'Der Commit liegt auf main', 'Versionen stimmen überein', 'Tag und Release dieser Version')), 'release: Prüfschritte laufen immer (kein if:)')
ok('--ereignis "$GITHUB_EVENT_NAME"' in P and '--versuch "$GITHUB_RUN_ATTEMPT"' in P, 'release: Prüfung kennt Weg (von Hand / Tag) und Versuch (Wiederholung)')
tagstep = step(R, 'Tag auf den geprüften Commit')
ok("if: github.event_name == 'workflow_dispatch'" in tagstep and 'release_stand.py tag' in tagstep and '--commit "$GITHUB_SHA"' in tagstep, 'release: Tag nur beim Start von Hand, auf den geprüften Commit')
ok(R.index('release_stand.py tag') < R.index('release_stand.py release'), 'release: erst der Tag, dann das Release')
rs = open(os.path.join(ROOT, 'tools', 'release_stand.py'), encoding='utf-8').read()
ok("'--verify-tag'" in rs and "'-X', 'POST', f'repos/{repo()}/git/refs'" in rs and '--target' not in rs, 'release_stand: Tag in einem Schritt angelegt (scheitert, wenn er besteht), Release nur zu einem bestehenden Tag (--verify-tag)')
ok(re.search(r'permissions:\n\s+contents: read\n', P) and re.search(r'permissions:\n\s+contents: write\n\s+env:', R) and re.search(r'permissions:\n\s+pages: write\n\s+id-token: write\n\s+environment:', G), 'release: Rechte je Auftrag minimal (lesen / Release schreiben / Pages)')
for f in ('release.yml', 'pages.yml'):
    ok(re.search(r'^concurrency:\n  group: release\n  cancel-in-progress: false', wf[f], re.M) is not None, f'{f}: gemeinsame Warteschlange «release», nie zwei Veröffentlichungen gleichzeitig')
# Beide Wege veröffentlichen dieselbe geprüfte Datei: ein Artefakt aus pruefen, in release und pages geprüft
ok('name: veroeffentlichung' in P and R.count('name: veroeffentlichung') == 1 and G.count('name: veroeffentlichung') == 1, 'release: Release und Pages nehmen das Artefakt aus dem geprüften Lauf')
ok('if:' not in G.split('steps:')[0] and 'event_name' not in G, 'release: Auftrag pages gleich für beide Wege')
seite = step(G, 'Seite zusammenstellen')
ok('sha256sum -c SHA256SUMS.txt' in seite and 'cmp veroeffentlichung/Lectora.html' in seite and 'cp veroeffentlichung/Lectora.html site/index.html' in seite, 'release: Pages prüft Prüfsummen und nimmt genau die geprüfte Datei')
ok('cp docs/lectora-dokumentation.html veroeffentlichung/dokumentation.html' in P and 'cp veroeffentlichung/dokumentation.html site/dokumentation.html' in seite,
   'release: Produktdokumentation des geprüften Stands auf GitHub Pages als dokumentation.html')
ok('site/dokumentation.html' in wf['pages.yml'] and 'origin/main:docs/lectora-dokumentation.html' in wf['pages.yml'], 'pages: Produktdokumentation vom Tag, sonst von main')
ok(timeout(P) >= 120 and timeout(R) >= 10 and timeout(G) >= 15 and timeout(jobs(p := wf['pages.yml'])['pages']) >= 15, 'release: Zeitlimits mit Reserve (alle Tests mit Systempaketen; deploy-pages wartet bis 10 Minuten)')
e = wf['erlasse.yml']
ok('persist-credentials: false' in e and 'x-access-token:${GH_TOKEN}' in e, 'erlasse: kein Token im Arbeitsverzeichnis; geschoben nur im letzten Schritt')
ok('"$code" = 4' in e, 'erlasse: unplausible Antwort bricht ab')
p = wf['pages.yml']
ok('[[ "$TAG" =~ ^v[0-9]+' in p, 'pages: Tag mit bash [[ =~ ]] geprüft (grep liesse Zeilenumbrüche durch)')
ok('workflow_dispatch' in p and 'gh release download' in p and 'sha256sum -c' in p and 'merge-base --is-ancestor HEAD origin/main' in p, 'pages: Zurückrollen aus einem bestehenden Release, mit Prüfsumme, nur von main')
ok(os.path.exists(os.path.join(ROOT, '.github', 'dependabot.yml')) and all(x in open(os.path.join(ROOT, '.github', 'dependabot.yml')).read() for x in ('github-actions', 'npm', 'pip')), 'dependabot: Aktionen, npm, pip')

# ---- Shell-Schritt «Auslöser und Version» ausführen (wie GitHub: bash -e -o pipefail), mit guten und schlechten Eingaben
def bash_step(body, env):
    tmp = tempfile.mkdtemp(prefix='rel-')
    out = os.path.join(tmp, 'output')
    open(out, 'w').close()
    e = {'PATH': os.environ.get('PATH', ''), 'GITHUB_OUTPUT': out, **env}
    pr = subprocess.run(['bash', '--noprofile', '--norc', '-e', '-o', 'pipefail', '-c', body], cwd=tmp, env=e, capture_output=True, text=True)
    res = pr.returncode, open(out).read(), pr.stdout + pr.stderr, tmp
    return res
body = [b for b in run_blocks(first)][0]
D = {'GITHUB_EVENT_NAME': 'workflow_dispatch', 'GITHUB_REF': 'refs/heads/main', 'GITHUB_REF_NAME': 'main'}
for eingabe, want in (('2.1.0', 'version=2.1.0\n'), ('10.0.12', 'version=10.0.12\n'), ('v2.1.0', None), ('2.1', None), ('2.1.0 ', None), (' 2.1.0', None),
                      ('02.1.0', None), ('2.1.0.1', None), ('2.1.0\n::warning::x', None), ('2.1.0;touch boese', None), ('$(touch boese)', None),
                      ('`touch boese`', None), ('', None), ('2.1.0\n', None)):
    rc, out, log, tmp = bash_step(body, {**D, 'EINGABE': eingabe})
    sauber = not os.path.exists(os.path.join(tmp, 'boese')) and '::warning::' not in log
    ok((rc == 0 and out == want) if want else (rc == 1 and out == '' and '::error::' in log and sauber), f'Schritt «Auslöser und Version», Eingabe {eingabe!r}: ' + ('angenommen' if want else 'abgelehnt, nichts ausgeführt'))
rc, out, log, _ = bash_step(body, {**D, 'EINGABE': 'v2.1.0'})
ok('ohne «v»' in log, 'Eingabe mit «v»: Meldung sagt «ohne «v»»')
rc, out, log, _ = bash_step(body, {**D, 'GITHUB_REF': 'refs/heads/release/2.1.0', 'GITHUB_REF_NAME': 'release/2.1.0', 'EINGABE': '2.1.0'})
ok(rc == 1 and out == '' and 'nur von main' in log and 'im Menü «Branch» den Zweig main' in log, 'Start von Hand von einem anderen Zweig: Abbruch mit Anleitung')
rc, out, log, _ = bash_step(body, {**D, 'GITHUB_REF': 'refs/tags/v2.1.0', 'GITHUB_REF_NAME': 'v2.1.0', 'EINGABE': '2.1.0'})
ok(rc == 1 and out == '', 'Start von Hand von einem Tag aus: Abbruch (nur main)')
for ref, want in (('v2.1.0', 'version=2.1.0\n'), ('v2.1', None), ('v02.1.0', None)):
    rc, out, log, _ = bash_step(body, {'GITHUB_EVENT_NAME': 'push', 'GITHUB_REF': 'refs/tags/' + ref, 'GITHUB_REF_NAME': ref, 'EINGABE': ''})
    ok((rc == 0 and out == want) if want else rc == 1, f'Tag-Push {ref}: ' + ('Version aus dem Tag' if want else 'abgelehnt'))

# ---- Shell-Schritt «Seite zusammenstellen»: nimmt genau die geprüfte Datei und die version.json dieser Version
seite_body = run_blocks(seite)[0]
def seite_mit(v_json, manip=None, v='2.1.0'):
    tmp = tempfile.mkdtemp(prefix='rel-')
    d = os.path.join(tmp, 'veroeffentlichung'); os.makedirs(d)
    open(os.path.join(d, f'Lectora-{v}.html'), 'w').write('<!DOCTYPE html>geprüft')
    shutil.copy(os.path.join(d, f'Lectora-{v}.html'), os.path.join(d, 'Lectora.html'))
    open(os.path.join(d, 'dokumentation.html'), 'w').write('<!DOCTYPE html>Dokumentation')
    json.dump({'version': v_json}, open(os.path.join(d, 'version.json'), 'w'))
    subprocess.run(f'sha256sum "Lectora-{v}.html" Lectora.html > SHA256SUMS.txt', shell=True, cwd=d, check=True)
    if manip: manip(d)
    pr = subprocess.run(['bash', '--noprofile', '--norc', '-e', '-o', 'pipefail', '-c', seite_body], cwd=tmp, env={'PATH': os.environ['PATH'], 'V': v}, capture_output=True, text=True)
    site = os.path.join(tmp, 'site')
    return pr.returncode, (open(os.path.join(site, 'index.html')).read() if os.path.exists(os.path.join(site, 'index.html')) else None), \
        (open(os.path.join(site, 'dokumentation.html')).read() if os.path.exists(os.path.join(site, 'dokumentation.html')) else None)
rc, idx, dok = seite_mit('2.1.0')
ok(rc == 0 and idx == '<!DOCTYPE html>geprüft', 'Seite: geprüfte Datei als index.html')
ok(dok == '<!DOCTYPE html>Dokumentation', 'Seite: Produktdokumentation als dokumentation.html')
ok(seite_mit('2.0.0')[0] != 0, 'Seite: version.json einer anderen Version → Abbruch')
ok(seite_mit('2.1.0', lambda d: open(os.path.join(d, 'Lectora.html'), 'a').write('x'))[0] != 0, 'Seite: veränderte Datei (Prüfsumme) → Abbruch')
ok(seite_mit('2.1.0', v='')[0] != 0, 'Seite: ohne Version vom Auftrag pruefen → Abbruch')

# ---- tools/release_stand.py gegen ein nachgebildetes gh (Zustand in einer JSON-Datei)
STUB = r"""#!/usr/bin/env python3
import json, os, sys
st_path = os.environ['GH_STUB']; st = json.load(open(st_path)); a = sys.argv[1:]
st.setdefault('calls', []).append(a)
def save(): json.dump(st, open(st_path, 'w'))
def fail(msg): save(); sys.stderr.write(msg + '\n'); sys.exit(1)
if st.get('kaputt'): fail('HTTP 502: Bad Gateway')
R = 'repos/' + os.environ['GH_REPO'] + '/'
if a[0] == 'api' and a[1] == '-X':
    ref = a[a.index('-f') + 1].split('=', 1)[1]; sha = a[-1].split('=', 1)[1]
    if st.get('ruleset'): fail('Repository rule violations found (HTTP 422)')
    if st.get('race'): st['refs'][ref] = {'type': 'commit', 'sha': st['race']}; fail('Reference already exists (HTTP 422)')
    if ref in st['refs']: fail('Reference already exists (HTTP 422)')
    st['refs'][ref] = {'type': 'commit', 'sha': sha}; save(); print('{}'); sys.exit(0)
if a[0] == 'api' and a[1].startswith(R + 'git/matching-refs/'):
    pre = 'refs/' + a[1][len(R + 'git/matching-refs/'):]
    save(); print(json.dumps([{'ref': k, 'object': v} for k, v in st['refs'].items() if k.startswith(pre)])); sys.exit(0)
if a[0] == 'api' and a[1].startswith(R + 'git/tags/'):
    save(); print(json.dumps({'object': st['annotated'][a[1].rsplit('/', 1)[1]]})); sys.exit(0)
if a[0] == 'api' and a[1].startswith(R + 'releases?'):
    rels = list(st['releases'].values()); save()
    print(json.dumps(rels[:1])); print(json.dumps(rels[1:])); sys.exit(0)  # zwei Seiten wie --paginate
if a[:2] == ['release', 'create']:
    tag = a[2]
    if 'refs/tags/' + tag not in st['refs']: fail('tag ' + tag + ' doesn\'t exist in the repo, aborting due to --verify-tag')
    if tag in st['releases']: fail('a release with the same tag name already exists: ' + tag)
    files = [x for x in a[a.index('notizen.md') + 1:]]
    st['releases'][tag] = {'tag_name': tag, 'draft': False, 'assets': [{'id': i, 'name': f, 'size': os.path.getsize(f), 'state': 'uploaded'} for i, f in enumerate(files)]}
    st['sums'][tag] = open('SHA256SUMS.txt').read(); save(); print('https://github.com/x/y/releases/tag/' + tag); sys.exit(0)
if a[:2] == ['release', 'download']:
    tag = a[2]
    if tag not in st['sums']: fail('release not found')
    save(); sys.stdout.write(st['sums'][tag]); sys.exit(0)
fail('Stub: unbekannter Aufruf ' + ' '.join(a))
"""
SB = tempfile.mkdtemp(prefix='rel-gh-')
open(os.path.join(SB, 'gh'), 'w').write(STUB); os.chmod(os.path.join(SB, 'gh'), 0o755)
C1, C2 = 'a' * 40, 'b' * 40
FILES = os.path.join(SB, 'veroeffentlichung'); os.makedirs(FILES)
for n, t in (('Lectora.html', 'L'), ('Lectora-2.1.0.html', 'L'), ('notizen.md', 'n')): open(os.path.join(FILES, n), 'w').write(t)
SUMS = 'x  Lectora-2.1.0.html\nx  Lectora.html\n'
open(os.path.join(FILES, 'SHA256SUMS.txt'), 'w').write(SUMS)
def stand(state, *args, env=None):
    sp = os.path.join(SB, 'state.json')
    json.dump({'refs': {}, 'annotated': {}, 'releases': {}, 'sums': {}, **state}, open(sp, 'w'))
    e = {'PATH': SB + os.pathsep + os.environ['PATH'], 'GH_STUB': sp, 'GH_REPO': 'SEM-SGG/lectora', 'GH_TOKEN': 'x', **(env or {})}
    pr = subprocess.run([sys.executable, os.path.join(ROOT, 'tools', 'release_stand.py'), *args], env=e, capture_output=True, text=True)
    return pr.returncode, pr.stdout + pr.stderr, json.load(open(sp))
T = 'refs/tags/v2.1.0'
def vorab(state, ereignis='workflow_dispatch', versuch='1', commit=C1, env=None):
    return stand(state, 'vorab', '--version', '2.1.0', '--commit', commit, '--ereignis', ereignis, '--versuch', versuch, env=env)
REL = {'v2.1.0': {'tag_name': 'v2.1.0', 'draft': False, 'assets': []}}
OLD = {'v2.0.0': {'tag_name': 'v2.0.0', 'draft': False, 'assets': []}}
rc, log, _ = vorab({'releases': dict(OLD), 'refs': {'refs/tags/v2.0.0': {'type': 'commit', 'sha': C2}, 'refs/tags/v2.1.0-test': {'type': 'commit', 'sha': C2}}})
ok(rc == 0 and 'ist frei' in log, 'release_stand vorab, von Hand: Version frei (anderer Tag mit gleichem Anfang zählt nicht) → weiter')
rc, log, _ = vorab({'refs': {T: {'type': 'commit', 'sha': C2}}})
ok(rc == 1 and 'zeigt auf den Commit bbbbbbbbbbbb' in log and 'Erhöhe die Version' in log, 'vorab, von Hand: Tag auf anderem Commit → Abbruch «Erhöhe die Version …»')
rc, log, _ = vorab({'refs': {T: {'type': 'commit', 'sha': C2}}}, versuch='2')
ok(rc == 1, 'vorab, von Hand, Wiederholung: Tag auf anderem Commit → trotzdem Abbruch')
rc, log, _ = vorab({'refs': {T: {'type': 'commit', 'sha': C1}}})
ok(rc == 1 and 'besteht schon der Tag v2.1.0' in log, 'vorab, von Hand: Tag besteht schon (gleicher Commit, erster Versuch) → Abbruch')
rc, log, _ = vorab({'releases': dict(REL)})
ok(rc == 1 and 'besteht schon ein Release v2.1.0' in log, 'vorab, von Hand: Release besteht schon → Abbruch')
rc, log, _ = vorab({'refs': {T: {'type': 'tag', 'sha': 'c' * 40}}, 'annotated': {'c' * 40: {'type': 'commit', 'sha': C2}}})
ok(rc == 1 and 'bbbbbbbbbbbb' in log, 'vorab: annotierter Tag wird bis zum Commit aufgelöst (anderer Commit → Abbruch)')
rc, log, _ = vorab({'refs': {T: {'type': 'commit', 'sha': C1}}, 'releases': dict(REL)}, versuch='2')
ok(rc == 0 and 'Wiederholung' in log, 'vorab, von Hand, Wiederholung: Tag und Release aus früherem Versuch, gleicher Commit → weiter')
rc, log, _ = vorab({'kaputt': True})
ok(rc == 1 and 'Anfrage an GitHub ist gescheitert' in log, 'vorab: GitHub nicht erreichbar → Abbruch, nicht «frei»')
rc, log, _ = vorab({'refs': {T: {'type': 'commit', 'sha': C1}}}, ereignis='push')
ok(rc == 0 and 'noch kein Release' in log, 'vorab, Tag-Push: Tag auf dem Commit des Laufs, kein Release → weiter')
rc, log, _ = vorab({'refs': {T: {'type': 'commit', 'sha': C2}}}, ereignis='push')
ok(rc == 1, 'vorab, Tag-Push: Tag inzwischen verschoben → Abbruch')
rc, log, _ = vorab({'refs': {T: {'type': 'commit', 'sha': C1}}, 'releases': dict(REL)}, ereignis='push')
ok(rc == 1 and 'Release v2.1.0 besteht schon' in log, 'vorab, Tag-Push: Release besteht schon (erster Versuch) → Abbruch vor den Tests')
rc, log, _ = vorab({'refs': {T: {'type': 'commit', 'sha': C1}}, 'releases': dict(REL)}, ereignis='push', versuch='3')
ok(rc == 0, 'vorab, Tag-Push, Wiederholung: Release aus früherem Versuch → weiter')
for bad in (('--version', '2.1'), ('--version', 'v2.1.0'), ('--commit', 'main'), ('--versuch', '0')):
    args = {'--version': '2.1.0', '--commit': C1, '--ereignis': 'workflow_dispatch', '--versuch': '1'}; args[bad[0]] = bad[1]
    rc, log, _ = stand({}, 'vorab', *[x for kv in args.items() for x in kv])
    ok(rc == 2, f'release_stand: ungültiger Wert {bad} → Aufruf abgelehnt')

def tag(state, versuch='1', env=None):
    return stand(state, 'tag', '--version', '2.1.0', '--commit', C1, '--versuch', versuch, env=env)
rc, log, st = tag({})
ok(rc == 0 and st['refs'].get(T) == {'type': 'commit', 'sha': C1}, 'release_stand tag: Tag fehlt → auf den geprüften Commit angelegt')
rc, log, st = tag({'ruleset': True})
ok(rc == 1 and 'Ruleset' in log and 'Re-run failed jobs' in log, 'tag: Ruleset verhindert das Anlegen → Abbruch mit Hinweis auf die Ausnahme')
rc, log, st = tag({'race': C2})
ok(rc == 1 and 'bbbbbbbbbbbb' in log and st['refs'][T]['sha'] == C2, 'tag: gleichzeitig auf anderem Commit entstanden → Abbruch, fremder Tag bleibt unberührt')
rc, log, st = tag({'race': C1})
ok(rc == 1 and 'während dieses Laufs entstanden' in log, 'tag: gleichzeitig per git push entstanden (erster Versuch) → Abbruch; der Lauf des Tags veröffentlicht')
rc, log, st = tag({'refs': {T: {'type': 'commit', 'sha': C1}}})
ok(rc == 1 and 'während dieses Laufs entstanden' in log, 'tag: besteht beim ersten Versuch schon → Abbruch')
rc, log, st = tag({'refs': {T: {'type': 'commit', 'sha': C1}}}, versuch='2')
ok(rc == 0 and not any(c[:2] == ['api', '-X'] for c in st['calls']), 'tag, Wiederholung: Tag aus früherem Versuch auf dem geprüften Commit → weiter, nichts angelegt')
rc, log, st = tag({'refs': {T: {'type': 'commit', 'sha': C2}}}, versuch='2')
ok(rc == 1, 'tag, Wiederholung: Tag auf anderem Commit → Abbruch')

def release(state):
    return stand(state, 'release', '--version', '2.1.0', '--dateien', FILES)
TAGGED = {'refs': {T: {'type': 'commit', 'sha': C1}}}
rc, log, st = release(TAGGED)
created = [c for c in st['calls'] if c[:2] == ['release', 'create']]
ok(rc == 0 and len(created) == 1 and '--verify-tag' in created[0] and created[0][-3:] == ['Lectora.html', 'Lectora-2.1.0.html', 'SHA256SUMS.txt'], 'release_stand release: Release zum bestehenden Tag (--verify-tag) mit den drei Dateien')
again = {k: st[k] for k in ('refs', 'releases', 'sums')}
rc, log, st = release(again)
ok(rc == 0 and not any(c[:2] == ['release', 'create'] for c in st['calls']) and 'Weiter mit GitHub Pages' in log, 'release: Release besteht schon mit denselben Dateien (Wiederholung) → weiter zu Pages, nicht «already exists»')
rc, log, st = release({**again, 'sums': {'v2.1.0': 'y  Lectora.html\n'}})
ok(rc == 1 and 'Lösche das Release (den Tag nicht)' in log, 'release: Release mit anderen Dateien → Abbruch mit Anleitung')
rc, log, st = release({**again, 'releases': {'v2.1.0': {**again['releases']['v2.1.0'], 'draft': True}}})
ok(rc == 1, 'release: Release als Entwurf (unvollständiger Rest) → Abbruch mit Anleitung')
rc, log, st = release({**again, 'releases': {'v2.1.0': {**again['releases']['v2.1.0'], 'assets': again['releases']['v2.1.0']['assets'][:2]}}})
ok(rc == 1, 'release: Release ohne alle drei Dateien → Abbruch')
rc, log, st = release({})
ok(rc == 1 and 'liess sich nicht anlegen' in log, 'release: ohne Tag → Abbruch (--verify-tag)')

# ---- tools/release_check.py auf Kopien: Jede vergessene oder falsch geänderte Datei wird mit Namen und Abhilfe genannt
def check_copy(change, *args):
    tmp = tempfile.mkdtemp(prefix='rel-chk-')
    os.makedirs(os.path.join(tmp, 'tools'))
    shutil.copy(os.path.join(ROOT, 'tools', 'release_check.py'), os.path.join(tmp, 'tools'))
    for f in ('package.json', 'version.json', 'CHANGELOG.md'): shutil.copy(os.path.join(ROOT, f), tmp)
    for f, fn in change.items():
        fp = os.path.join(tmp, f); neu = fn(open(fp, encoding='utf-8').read())
        open(fp, 'w', encoding='utf-8').write(neu)
    pr = subprocess.run([sys.executable, os.path.join(tmp, 'tools', 'release_check.py'), *args], capture_output=True, text=True, env={**os.environ, 'GITHUB_ACTIONS': ''})
    return pr.returncode, pr.stdout + pr.stderr
cur = json.load(open(os.path.join(ROOT, 'package.json')))['version']
vj0 = json.load(open(os.path.join(ROOT, 'version.json')))
NEU = '9.8.7'
bump_pkg = lambda t: t.replace(f'"version": "{cur}"', f'"version": "{NEU}"', 1)
bump_vj = lambda t: t.replace(f'"version": "{cur}"', f'"version": "{NEU}"', 1)
bump_cl = lambda t: t.replace(f'\n## {cur} – {vj0["date"]}', f'\n## {NEU} – {vj0["date"]}\n\n- Korrektur.\n\n## {cur} – {vj0["date"]}', 1)
ALL = {'package.json': bump_pkg, 'version.json': bump_vj, 'CHANGELOG.md': bump_cl}
rc, log = check_copy(ALL, '--version', NEU)
ok(rc == 0 and 'stimmen überein' in log, 'release_check: alle drei Dateien auf der neuen Version → stimmt')
rc, log = check_copy(ALL, '--aktuell')
ok(rc == 0, 'release_check --aktuell (Workflow checks): alle drei Dateien gleich → stimmt')
for vergessen in ALL:
    for args in (('--aktuell',), ('--version', NEU)):
        rc, log = check_copy({k: v for k, v in ALL.items() if k != vergessen}, *args)
        erste = log.strip().split('\n')[0]
        ok(rc == 1 and erste.lstrip().startswith(vergessen) and log.count('Ändere') + log.count('Schreibe') == 1, f'release_check {args[0]}: {vergessen} vergessen → genau eine Meldung, sie nennt {vergessen} und die Abhilfe')
rc, log = check_copy({}, '--version', NEU)
ok(rc == 1 and 'Hast du dich vertippt?' in log, 'release_check: Eingabe passt zu keiner Datei, die Dateien sind sich einig → «Hast du dich vertippt?»')
rc, log = check_copy({**ALL, 'version.json': lambda t: bump_vj(t).replace('",\n  "note"', '"\n  "note"', 1)}, '--aktuell')
ok(rc == 1 and 'kein gültiges JSON' in log and 'Komma' in log and 'Traceback' not in log, 'release_check: version.json kaputt (Komma fehlt) → verständliche Meldung, kein Programmabbruch')
rc, log = check_copy({**ALL, 'version.json': lambda t: bump_vj(t).replace(vj0['note']['fr'], 'Voir www.exemple.ch', 1)}, '--aktuell')
ok(rc == 1 and 'Französisch' in log and 'Adresse' in log, 'release_check: Adresse im Hinweis → Meldung nennt Sprache und Grund')
rc, log = check_copy({**ALL, 'CHANGELOG.md': lambda t: bump_cl(t).replace(f'## {NEU} – ', f'## {NEU} vom ', 1)}, '--aktuell')
ok(rc == 1 and 'hat nicht die Form' in log, 'release_check: Überschrift im Changelog in falscher Form → Meldung zeigt die Überschrift')
rc, log = check_copy({**ALL, 'CHANGELOG.md': lambda t: bump_cl(t).replace(f'## {NEU} – {vj0["date"]}', f'## {NEU} - 2099-01-01', 1)}, '--aktuell')
ok(rc == 1 and 'dasselbe Datum' in log, 'release_check: Datum im Changelog anders als in version.json → Meldung')
rc, log = check_copy(ALL, '--version', NEU + '\n')
ok(rc == 1 and 'nicht die Form' in log, 'release_check: Version mit Zeilenumbruch am Ende → abgelehnt')

# ---- Das Beispiel in docs/release.md (Schritt 1) besteht die Prüfung: package.json, version.json und Abschnitt im Changelog
doc = open(os.path.join(ROOT, 'docs', 'release.md'), encoding='utf-8').read()
bsp_json = re.search(r'```json\n(.*?)```', doc, re.S)
bsp_cl = re.search(r'```\n(\s*## (\d+\.\d+\.\d+) – .*?)```', doc, re.S)
if bsp_json and bsp_cl:
    vj_bsp = textwrap.dedent(bsp_json.group(1)); V_BSP = (re.search(r'"version": "([^"]+)"', vj_bsp) or re.search('(x)', 'x')).group(1)
    cl_bsp = textwrap.dedent(bsp_cl.group(1)).strip().split('\n')
    cl_neu = '\n'.join(cl_bsp[:-1]).rstrip() + '\n\n'
    rc, log = check_copy({'package.json': lambda t: t.replace(f'"version": "{cur}"', f'"version": "{V_BSP}"', 1), 'version.json': lambda t: vj_bsp,
                          'CHANGELOG.md': lambda t: t.replace('\n## ', '\n' + cl_neu + '## ', 1)}, '--version', V_BSP)
    ok(rc == 0, f'docs/release.md: Beispiel für {V_BSP} (version.json, Changelog) besteht tools/release_check.py {log.strip().splitlines()[0] if rc else ""}')
else:
    ok(False, 'docs/release.md: Beispiel für version.json und Changelog gefunden')
ok('"version": "2.0.0",' in doc and '| `package.json` |' in doc and '`package-lock.json`' in doc, 'docs/release.md: nennt die drei Dateien mit der Version und package-lock.json')

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
