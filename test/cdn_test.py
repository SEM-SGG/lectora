"""Artefakt-Ausgabe (dist/index.html): lädt JSZip, pdf.js, dessen Worker und pdf-lib von cdnjs, jede Datei mit Integritätsprüfung, und sonst
nichts. Braucht Internet (cdnjs); hinter einem Proxy über HTTPS_PROXY. Schluss: «FEHLER: keine» (Exit-Code 0)."""
import sys, os, re
sys.path.insert(0, os.path.dirname(__file__))
from engine_test import *
serve(8772)
errors = []
def ok(cond, msg):
    print(('  ok   ' if cond else '  FEHLER ') + msg)
    if not cond: errors.append(msg)
with sync_playwright() as pw:
    px = os.environ.get('HTTPS_PROXY') or os.environ.get('https_proxy')
    br = launch(pw, proxy=proxy_settings())
    ctx = br.new_context(ignore_https_errors=True); pg = ctx.new_page()
    msgs = []; pg.on('console', lambda m: msgs.append(m.type + ': ' + m.text)); pg.on('pageerror', lambda e: msgs.append('pageerror: ' + str(e)))
    reqs = []; pg.on('request', lambda r: reqs.append(r.url.split('?')[0]))
    pg.goto(url(8772) + '/dist/index.html'); pg.wait_for_timeout(2500)
    print('JSZip geladen:', pg.evaluate('typeof JSZip'), '| Integrität gesetzt:', pg.evaluate('document.querySelector("script[integrity]").integrity.slice(0, 20)'))
    pg.click('[data-fid="demo"]'); pg.wait_for_function('DP.state.docs.length === 3 && !DP.state.busy', timeout=20000)
    print('Beispieldokumente:', pg.evaluate('DP.state.docs.map(d => [d.name, d.lang, DP.state.res[d.id].rule.length])'))
    pg.set_input_files('#file', [os.path.join(FX, 'konzept_real_fr.pdf')]); pg.wait_for_function('DP.state.docs.length === 4 && !DP.state.busy', timeout=30000)
    print('PDF über CDN:', pg.evaluate('[typeof pdfjsLib, DP.state.docs[3].format, DP.state.docs[3].paras.length, DP.state.docs[3].lang]'))
    # Export mit Kommentaren: lädt pdf-lib erst jetzt, mit Integritätsprüfung (Datei mit Befunden; Rückfrage zur Fassung: eigenes Dokument)
    pg.set_input_files('#file', [os.path.join(FX, 'weisung_de_flawed.pdf')]); pg.wait_for_selector('[data-fid="ver-separate"]', timeout=30000); pg.click('[data-fid="ver-separate"]')
    pg.wait_for_function('DP.state.docs.length === 5 && !DP.state.busy', timeout=30000)
    pg.evaluate('DP.state.cur = DP.state.docs[4].id; DP.ui.go("export")'); pg.wait_for_timeout(300)
    pg.click('[data-fid="dl-annot"]'); pg.wait_for_function('typeof PDFLib === "object"', timeout=30000); pg.wait_for_timeout(1500)
    print('pdf-lib über CDN:', pg.evaluate('[typeof PDFLib, (document.querySelector("script[src*=pdf-lib]") || {}).integrity || "", DP.state.docs[4].annErr || "ohne Fehler", document.getElementById("snacks").innerText]'))
    ext = sorted(set(u for u in reqs if '127.0.0.1' not in u and not u.startswith('blob:') and not u.startswith('data:')))
    print('Fremdanfragen:', ext)
    want = sorted('https://cdnjs.cloudflare.com/ajax/libs/' + f for f in ['jszip/3.10.2/jszip.min.js', 'pdf.js/3.11.174/pdf.min.js', 'pdf.js/3.11.174/pdf.worker.min.js', 'pdf-lib/1.17.1/pdf-lib.min.js'])
    print('Genau die cdnjs-Dateien:', 'ja' if ext == want else 'NEIN ' + repr(set(ext) ^ set(want)))
    ok(ext == want, 'genau die vier Dateien von cdnjs, keine andere Anfrage')
    ok(pg.evaluate('typeof JSZip') == 'function' and pg.evaluate('typeof pdfjsLib') == 'object' and pg.evaluate('typeof PDFLib') == 'object', 'JSZip, pdf.js und pdf-lib geladen')
    ok(pg.evaluate('DP.state.docs[3].paras.length') > 10, 'PDF über pdf.js von cdnjs gelesen')
    ok(all(pg.evaluate(f'(document.querySelector("script[src*=\'{f}\']") || {{}}).integrity || ""').startswith('sha512-') for f in ('jszip.min.js', 'pdf.min.js', 'pdf.worker.min.js', 'pdf-lib.min.js')), 'alle vier Dateien von cdnjs als Skript mit Integritätsprüfung (auch der Worker)')
    ok(pg.evaluate('document.querySelector("script[integrity]").integrity.startsWith("sha512-")') and pg.evaluate('(document.querySelector("script[src*=pdf-lib]") || {}).integrity || ""').startswith('sha512-'), 'Integritätsprüfung (SRI) für JSZip und pdf-lib gesetzt')
    # Die veröffentlichte Fassung hat keinen erreichbaren Download-Link und keine Kennzeichnung der Offline-Ausgabe
    html = open(os.path.join(ROOT, 'dist', 'index.html'), encoding='utf-8').read()
    print('Artefakt: DP.offline=false:', 'DP.offline=false;' in html, '| <a download> im Markup:', bool(__import__('re').search(r'<a\b[^>]*\bdownload\b', html)), '| Offline-Kennzeichnung sichtbar:', pg.evaluate('!document.getElementById("offMark").hidden'), '| Download-Links im DOM:', pg.evaluate('document.querySelectorAll("a[download]").length'))
    cons = [m for m in msgs if 'favicon' not in m and '404' not in m]
    print('Konsole:', cons[:6])
    ok(not [m for m in cons if m.startswith(('error', 'pageerror'))], 'Konsole ohne Fehler')
    ok('DP.offline=false;' in html and not re.search(r'<a\b[^>]*\bdownload\b', html) and 'raw.githubusercontent' not in html, 'Artefakt: DP.offline=false, kein <a download>, keine Versionsabfrage')
    br.close()
print('FEHLER:', 'keine' if not errors else '\n  ' + '\n  '.join(errors))
sys.exit(1 if errors else 0)
