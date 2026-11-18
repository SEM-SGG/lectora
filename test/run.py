"""Alle Tests nacheinander, oder eine Gruppe, oder einzelne Dateien. Baut vorher alle Ausgaben.

  python3 test/run.py                 alle Gruppen nacheinander (wie in GitHub Actions)
  python3 test/run.py schnell         nur die Tests ohne Browser (wenige Sekunden)
  python3 test/run.py logik export    mehrere Gruppen
  python3 test/run.py ui_test.py      einzelne Testdatei(en)
  python3 test/run.py --ohne-build …  ohne vorherigen Build
  python3 test/run.py --liste         Gruppen und Dateien anzeigen

Die Browser-Tests laufen bewusst nacheinander: Einer misst Zeiten (a11y_test.py) und schlägt fehl, wenn andere Tests den Rechner
gleichzeitig auslasten. Jede Ausgabe steht vollständig in test/out/logs/<Test>.log. Exit-Code 1, wenn ein Test scheitert.
Die Gruppe «netz» braucht Internet (cdnjs); LECTORA_OHNE_NETZ=1 lässt sie aus.
"""
import os, subprocess, sys, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PY, NODE = sys.executable, os.environ.get('NODE', 'node')
GROUPS = {
    'schnell': [('i18n_test.mjs',), ('ausbau_test.mjs',), ('sprachkorpus_test.mjs',), ('werkzeug_test.mjs',), ('ki_test.mjs',), ('profile_test.mjs',), ('erlasse_test.py',), ('statik_test.mjs',), ('release_test.py',),
                ('hygiene', [PY, 'tools/hygiene.py']), ('hygiene-commits', [PY, 'tools/hygiene.py', '--commits']), ('hygiene_test.py',),
                ('notices', [NODE, 'tools/notices.mjs', '--check']),
                ('versionen', [PY, 'tools/release_check.py', '--aktuell'])],
    'logik': [('engine_test.py',), ('compare_test.py',), ('corpus_test.py',)],
    'export': [('export_test.py',), ('annot_test.py',)],
    'browser': [('ui_test.py',), ('feinschliff_test.py',), ('ki_ui_test.py',), ('review_test.py',), ('sprachfassungen_ui_test.py',), ('a11y_test.py',), ('contrast_test.py',)],
    'offline': [('offline_test.py',)],
    'netz': [('cdn_test.py',)],
}
ORDER = ['schnell', 'logik', 'export', 'browser', 'offline', 'netz']
BUILDS = [['--local'], [], ['--offline'], ['--offline', '--no-update-check']]


def command(entry):
    if len(entry) > 1: return entry[1]
    f = entry[0]
    return ([NODE] if f.endswith('.mjs') else [PY]) + [os.path.join('test', f)]


def main(argv):
    if '--liste' in argv:
        for g in ORDER: print(g + ':', ', '.join(e[0] for e in GROUPS[g]))
        return 0
    build = '--ohne-build' not in argv
    args = [a for a in argv if not a.startswith('--')]
    todo = []
    if not args: args = [g for g in ORDER if not (g == 'netz' and os.environ.get('LECTORA_OHNE_NETZ'))]
    for a in args:
        if a in GROUPS: todo += GROUPS[a]
        else:
            hit = [e for g in ORDER for e in GROUPS[g] if e[0] == a or e[0] == os.path.basename(a)]
            if not hit: print('Unbekannt:', a, '(python3 test/run.py --liste)'); return 2
            todo += hit
    logs = os.path.join(ROOT, 'test', 'out', 'logs'); os.makedirs(logs, exist_ok=True)
    env = dict(os.environ, PYTHONHASHSEED='0', PYTHONUNBUFFERED='1', PYTHONDONTWRITEBYTECODE='1')
    if build:
        for b in BUILDS:
            r = subprocess.run([NODE, 'build.mjs'] + b, cwd=ROOT, capture_output=True, text=True)
            print('build', ' '.join(b) or '(Artefakt)', '→', (r.stdout.strip() or r.stderr.strip()).splitlines()[-1] if (r.stdout or r.stderr) else '')
            if r.returncode: print(r.stderr); return 1
    results = []
    for e in todo:
        name = e[0]; t0 = time.time()
        print(f'\n===== {name}', flush=True)
        log = os.path.join(logs, name.replace('/', '_') + '.log')
        with open(log, 'w', encoding='utf-8') as lf:
            p = subprocess.Popen(command(e), cwd=ROOT, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding='utf-8', errors='replace')
            tail = []
            for line in p.stdout:
                lf.write(line); tail.append(line.rstrip('\n')); tail = tail[-12:]
            p.wait()
        dt = time.time() - t0
        print('\n'.join(tail))
        results.append((name, p.returncode, dt))
    print('\n===== Zusammenfassung')
    for name, rc, dt in results: print(f'{"ok    " if rc == 0 else "FEHLER"}  {name:<24} {dt:7.1f} s')
    bad = [n for n, rc, _ in results if rc != 0]
    print(f'{len(results) - len(bad)} von {len(results)} bestanden' + (f'; gescheitert: {", ".join(bad)}' if bad else '') + f'. Protokolle: test/out/logs/')
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
