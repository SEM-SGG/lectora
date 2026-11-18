"""Stand einer Version bei GitHub vor und während der Veröffentlichung (Workflow release). Fragt über `gh` nach Tag und Release.

  python3 tools/release_stand.py vorab   --version X.Y.Z --commit SHA --ereignis workflow_dispatch|push --versuch N
      vor dem Bauen: Ist die Version noch frei (Start von Hand) bzw. zeigt der Tag auf den Stand (Tag-Push)?
  python3 tools/release_stand.py tag     --version X.Y.Z --commit SHA --versuch N
      nur beim Start von Hand, nach den Tests: legt den Tag vX.Y.Z auf den geprüften Commit an (in einem Schritt; besteht er
      schon, scheitert das Anlegen, statt einen fremden Tag zu übernehmen)
  python3 tools/release_stand.py release --version X.Y.Z --dateien VERZEICHNIS
      legt das Release zum bestehenden Tag an (--verify-tag). Besteht es schon mit denselben Dateien (Wiederholung eines Laufs),
      geht es weiter, damit GitHub Pages folgen kann; mit anderen Dateien oder als Entwurf: Abbruch mit Anleitung

Wiederholung: Ein Lauf, den du mit «Re-run» neu startest, hat GITHUB_RUN_ATTEMPT > 1. Nur dann dürfen Tag oder Release schon
bestehen, und nur auf dem geprüften Commit bzw. mit denselben Dateien.
Umgebung: GH_TOKEN, GH_REPO (wie für gh). Exit-Code 0 = weiter, 1 = Abbruch (Meldung als ::error::), 2 = Aufruf falsch.
"""
import json, os, re, subprocess, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from release_check import VER  # noqa: E402

SHA = re.compile(r'^[0-9a-f]{40}$')
ERHOEHEN = ('Erhöhe die Version in einem Pull Request (package.json, version.json, CHANGELOG.md), führe ihn zusammen und starte '
            'danach neu. Eine Versionsnummer wird nie zweimal vergeben.')


class Abbruch(Exception):
    pass


def gh(*args, cwd=None):
    r = subprocess.run(['gh', *args], cwd=cwd, capture_output=True, text=True)
    return r.returncode, r.stdout, r.stderr.strip()


def gh_json(*args):
    code, out, err = gh(*args)
    if code: raise Abbruch(f'Die Anfrage an GitHub ist gescheitert ({err[:200]}). Warte einige Minuten und wähle '
                           f'dann beim Lauf «Re-run jobs» → «Re-run failed jobs».')
    # --paginate gibt je Seite ein JSON-Feld aus, hintereinander
    dec, pos, teile = json.JSONDecoder(), 0, []
    out = out.strip()
    while pos < len(out):
        obj, pos = dec.raw_decode(out, pos)
        teile.append(obj)
        while pos < len(out) and out[pos].isspace(): pos += 1
    if len(teile) == 1: return teile[0]
    return [x for t in teile for x in t]


def repo():
    r = os.environ.get('GH_REPO', '')
    if not re.fullmatch(r'[\w.-]+/[\w.-]+', r): raise Abbruch('GH_REPO fehlt oder hat nicht die Form Organisation/Repository')
    return r


def tag_commit(v):
    """Commit, auf den der Tag vX.Y.Z zeigt (auch bei einem annotierten Tag), oder None, wenn es ihn nicht gibt."""
    name = f'refs/tags/v{v}'
    refs = gh_json('api', f'repos/{repo()}/git/matching-refs/tags/v{v}')
    hit = [r for r in refs if r.get('ref') == name]
    if not hit: return None
    obj = hit[0].get('object') or {}
    for _ in range(5):
        if obj.get('type') == 'commit': return obj.get('sha')
        if obj.get('type') != 'tag': break
        obj = (gh_json('api', f'repos/{repo()}/git/tags/{obj.get("sha")}') or {}).get('object') or {}
    raise Abbruch(f'Der Tag v{v} zeigt auf keinen Commit. Diese Version ist nicht verwendbar. {ERHOEHEN}')


def release_info(v):
    """Release mit dem Tag vX.Y.Z (auch ein Entwurf, soweit der Token ihn sieht) oder None."""
    rels = gh_json('api', f'repos/{repo()}/releases?per_page=100', '--paginate')
    hit = [r for r in rels if r.get('tag_name') == f'v{v}']
    return hit[0] if hit else None


def vorab(v, commit, ereignis, versuch):
    tag, rel = tag_commit(v), release_info(v)
    if ereignis == 'workflow_dispatch':
        if tag and tag != commit:
            raise Abbruch(f'Der Tag v{v} besteht schon und zeigt auf den Commit {tag[:12]}, nicht auf den Stand von main '
                          f'({commit[:12]}). {ERHOEHEN}')
        if (tag or rel) and versuch == 1:
            was = 'ein Release' if rel else 'der Tag'
            raise Abbruch(f'Für die Version {v} besteht schon {was} v{v}. {ERHOEHEN}')
        if tag or rel:
            print(f'Wiederholung (Versuch {versuch}): Tag oder Release v{v} aus einem früheren Versuch, auf demselben Commit.')
        else:
            print(f'Version {v} ist frei: kein Tag v{v}, kein Release v{v}.')
    elif ereignis == 'push':
        if tag != commit:
            raise Abbruch(f'Der Tag v{v} zeigt nicht (mehr) auf den Commit dieses Laufs ({commit[:12]}). Wurde er verschoben oder gelöscht?')
        if rel and versuch == 1:
            raise Abbruch(f'Das Release v{v} besteht schon. {ERHOEHEN}')
        print(f'Tag v{v} zeigt auf {commit[:12]}' + ('; Release besteht aus einem früheren Versuch.' if rel else '; noch kein Release.'))
    else:
        raise Abbruch(f'Unbekanntes Ereignis {ereignis[:40]!r}')


def tag(v, commit, versuch):
    t = tag_commit(v)
    if t is None:
        code, _, err = gh('api', '-X', 'POST', f'repos/{repo()}/git/refs', '-f', f'ref=refs/tags/v{v}', '-f', f'sha={commit}')
        if code == 0:
            print(f'Tag v{v} auf {commit[:12]} angelegt.')
            return
        # Gescheitert: Ist der Tag inzwischen entstanden (gleichzeitig angelegt), gelten die Regeln unten; sonst Abbruch
        t = tag_commit(v)
        if t is None:
            raise Abbruch(f'Der Tag v{v} liess sich nicht anlegen: {err[:300]}. Verhindert ein Ruleset für Tags v* das Anlegen, '
                          f'braucht der Workflow eine Ausnahme (docs/repo-einstellungen.md, «Ruleset für Tags»). Danach: «Re-run failed jobs».')
    if t != commit:
        raise Abbruch(f'Der Tag v{v} besteht schon und zeigt auf den Commit {t[:12]}, nicht auf den geprüften Stand ({commit[:12]}). {ERHOEHEN}')
    if versuch == 1:
        raise Abbruch(f'Der Tag v{v} ist während dieses Laufs entstanden (zum Beispiel mit git push). Dieser Lauf veröffentlicht nicht; '
                      f'das tut der Lauf, den der Tag gestartet hat.')
    print(f'Tag v{v} besteht aus einem früheren Versuch und zeigt auf den geprüften Stand {commit[:12]}.')


def release(v, verz):
    dateien = ['Lectora.html', f'Lectora-{v}.html', 'SHA256SUMS.txt']
    for d in dateien + ['notizen.md']:
        if not os.path.isfile(os.path.join(verz, d)): raise Abbruch(f'{d} fehlt in {verz}')
    rel = release_info(v)
    if rel is None:
        code, out, err = gh('release', 'create', f'v{v}', '--verify-tag', '--title', f'Lectora {v}', '--notes-file', 'notizen.md', *dateien, cwd=verz)
        if code == 0:
            print(out.strip() or f'Release v{v} angelegt.')
            return
        rel = release_info(v)
        if rel is None: raise Abbruch(f'Das Release v{v} liess sich nicht anlegen: {err[:300]}')
    gleich = not rel.get('draft')
    assets = {a.get('name'): a for a in rel.get('assets') or []}
    for d in dateien:
        a = assets.get(d)
        if not a or a.get('state', 'uploaded') != 'uploaded' or a.get('size') != os.path.getsize(os.path.join(verz, d)): gleich = False
    if gleich:
        code, out, _ = gh('release', 'download', f'v{v}', '--pattern', 'SHA256SUMS.txt', '--output', '-')
        gleich = code == 0 and out == open(os.path.join(verz, 'SHA256SUMS.txt'), encoding='utf-8').read()
    if not gleich:
        raise Abbruch(f'Das Release v{v} besteht schon, aber als Entwurf oder mit anderen bzw. unvollständigen Dateien. Öffne Releases → v{v}. '
                      f'Ist es ein unvollständiger Rest dieses Laufs: Lösche das Release (den Tag nicht) und wähle beim Lauf «Re-run failed jobs». '
                      f'Sonst: {ERHOEHEN}')
    print(f'Das Release v{v} besteht schon mit denselben Dateien (Wiederholung). Weiter mit GitHub Pages.')


def arg(argv, name, muster=None):
    if name not in argv or argv.index(name) + 1 >= len(argv): raise ValueError(f'{name} fehlt')
    w = argv[argv.index(name) + 1]
    if muster and not muster.match(w): raise ValueError(f'{name}: ungültiger Wert')
    return w


def main(argv):
    if not argv or argv[0] not in ('vorab', 'tag', 'release'): print(__doc__); return 2
    try:
        v = arg(argv, '--version')
        if not VER.match(v): raise ValueError('--version: erwartet X.Y.Z (ohne «v»)')
        if argv[0] == 'release':
            release(v, arg(argv, '--dateien'))
        else:
            commit = arg(argv, '--commit', SHA)
            versuch = int(arg(argv, '--versuch', re.compile(r'^[1-9]\d{0,3}$')))
            if argv[0] == 'vorab': vorab(v, commit, arg(argv, '--ereignis'), versuch)
            else: tag(v, commit, versuch)
    except ValueError as e:
        print(f'::error::{e}'); return 2
    except Abbruch as e:
        print(f'::error::{e}'); return 1
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
