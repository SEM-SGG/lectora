"""Gemeinsame Hilfen der Python-Tests: Pfade relativ zum Repository, lokaler Webserver auf einem freien Port, Browser aus
Playwright (oder LECTORA_CHROME), dazu ein Lauf der Regeln über Testdokumente (python3 test/engine_test.py [Datei …])."""
import base64, json, os, sys, subprocess, time, threading, http.server, socketserver, functools
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FX = os.path.join(ROOT, 'test', 'fixtures')
OUT_ROOT = os.path.join(ROOT, 'test', 'out')
SHOTS_DIR = os.path.join(ROOT, 'test', 'shots')
VERSION = json.load(open(os.path.join(ROOT, 'package.json'), encoding='utf-8'))['version']
OFFLINE_FILE = os.path.join(ROOT, 'dist-offline', f'Lectora-{VERSION}.html')
OFFLINE_NOCHECK_FILE = os.path.join(ROOT, 'dist-offline', f'Lectora-{VERSION}-ohne-Versionsabfrage.html')
VERSION_URL = 'https://sem-sgg.github.io/lectora/version.json'
RELEASE_URL = 'https://github.com/SEM-SGG/lectora/releases/latest'
_SERVERS = {}

def _handler(directory):
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **k): super().__init__(*a, directory=directory, **k)
        def log_message(self, *a): pass
        def end_headers(self):
            self.send_header('Cache-Control', 'no-store'); super().end_headers()
    return Quiet

def serve(key=None, directory=None):
    """Startet einen Webserver auf 127.0.0.1 und einem freien Port (vom Betriebssystem gewählt) für das Repository
    (oder directory). Gibt die Basisadresse zurück; url(key) liefert sie später wieder."""
    s = socketserver.ThreadingTCPServer(('127.0.0.1', 0), _handler(directory or ROOT)); s.daemon_threads = True
    threading.Thread(target=s.serve_forever, daemon=True).start()
    base = f'http://127.0.0.1:{s.server_address[1]}'
    _SERVERS[key] = base
    return base

def url(key=None):
    return _SERVERS[key]

def launch(pw, **kw):
    """Chromium aus Playwright (python -m playwright install chromium); LECTORA_CHROME=/pfad/zum/browser wählt einen anderen.
    Als root (Container) ohne Sandbox."""
    args = list(kw.pop('args', []) or [])
    if (hasattr(os, 'geteuid') and os.geteuid() == 0) or os.environ.get('LECTORA_NO_SANDBOX'): args.append('--no-sandbox')
    exe = os.environ.get('LECTORA_CHROME') or None
    return pw.chromium.launch(executable_path=exe, args=args, **kw)

def proxy_settings():
    """Proxy für Tests, die echte Adressen laden (cdnjs): aus HTTPS_PROXY, lokale Adressen direkt."""
    px = os.environ.get('HTTPS_PROXY') or os.environ.get('https_proxy')
    return {'server': px, 'bypass': '127.0.0.1,localhost'} if px else None

def mock_version(ctx, version=None, body=None, status=200):
    """Beantwortet die Versionsabfrage der Offline-Ausgabe im Test (keine echte Anfrage an GitHub). Standard: dieselbe Version
    (kein Hinweis). Gibt die Liste der abgefangenen Anfragen zurück."""
    seen = []
    def handle(route):
        seen.append(route.request)
        b = body if body is not None else json.dumps({'version': version or VERSION, 'date': '2026-11-18', 'note': {'de': 'Test', 'fr': 'Test', 'it': 'Test'}})
        route.fulfill(status=status, body=b, headers={'Access-Control-Allow-Origin': '*', 'Content-Type': 'text/plain; charset=utf-8'})
    ctx.route(VERSION_URL, handle)
    return seen

def b64(name): return base64.b64encode(open(os.path.join(FX, name), 'rb').read()).decode()
if __name__ == '__main__':
    serve('engine')
    with sync_playwright() as pw:
        br = launch(pw)
        pg = br.new_page(); pg.on('console', lambda m: print('[console]', m.text)); pg.on('pageerror', lambda e: print('[pageerror]', e))
        pg.goto(url('engine') + '/test/harness.html')
        names = sys.argv[1:] or sorted(f for f in os.listdir(FX) if f.endswith(('.docx', '.pdf', '.pptx')))
        for n in names:
            pg.evaluate('([n,b]) => loadDoc(n,b)', [n, b64(n)])
            info = pg.evaluate('''(n) => { const d = docs[n]; const r = DP.rules.runRules(d, {}); 
              return {fmt:d.format, lang:d.lang, type:d.type, words:d.meta.words, paras:d.paras.length, meta: Object.assign({}, d.meta, {headerFooter: undefined}),
                heads: d.paras.filter(p=>p.kind==='h'||p.kind==='title').map(p=>p.kind+p.level+' '+p.text.slice(0,50)),
                checked: r.checked.length,
                f: r.findings.map(f => f.crit+' ['+f.sev+'] '+f.key+' '+JSON.stringify(f.params)+(f.quote?' «'+f.quote.slice(0,70)+'»':'')+(f.fix?' → «'+f.fix.repl+'»':''))}; }''', n)
            print('\n=====', n, info['fmt'], info['lang'], info['type'], 'words', info['words'], 'paras', info['paras'], 'checked', info['checked'])
            print('meta', json.dumps(info['meta'], ensure_ascii=False))
            if '-v' in os.environ.get('V', ''): print('heads', info['heads'])
            for f in info['f']: print('  ', f)
        br.close()
