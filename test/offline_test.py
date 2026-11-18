"""Offline-Ausgabe (dist-offline/Lectora-<Version>.html): öffnen über file://, Netzwerk nur für die Versionsabfrage (im Test
abgefangen), keine Konsolenfehler und keine Verstösse gegen die Sicherheitsrichtlinie (CSP), Hauptabläufe mit Downloads des
Browsers (Office-Prüfung), kein KI-Zugang, axe auf den Zuständen der Offline-Ausgabe, Bildschirmfotos.
Versionsabfrage: neuere, gleiche und ältere Version, fehlerhafte, feindliche, langsame und scheiternde Antworten, genau eine Anfrage
ohne Abfrageteil, Cookies und Referrer, CSP sperrt jede andere Adresse; Altershinweis; Ausgabe ohne Versionsabfrage (keine Anfrage);
GitHub Pages (Auslieferung über einen lokalen Webserver): «Seite neu laden», «Als Datei speichern», Downloads, PDF-Worker.
Standardprofile im Profilband. Umgekehrt für die Artefakt-Ausgabe: kein erreichbarer Download-Link, keine Offline-Kennzeichnung, nur cdnjs.
Vorher: node build.mjs --offline && node build.mjs --offline --no-update-check && node build.mjs --local && node build.mjs.
Schluss: «FEHLER: keine»."""
import sys, os, re, json, glob, time, base64, subprocess, zipfile, tempfile
sys.path.insert(0, os.path.dirname(__file__))
from engine_test import *
from ooxml_check import check as ooxml_check
OUT = os.path.join(ROOT, 'test', 'out', 'offline'); os.makedirs(OUT, exist_ok=True)
SHOTS = os.path.join(ROOT, 'test', 'shots'); os.makedirs(SHOTS, exist_ok=True)
AXE = open(os.path.join(ROOT, 'node_modules/axe-core/axe.min.js'), encoding='utf-8').read()
AXE_RUN = 'axe.run(document, {runOnly: {type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"]}}).then(r => r.violations.map(v => v.id + " " + v.nodes.length + " " + v.nodes[0].html.slice(0, 120)))'
errors = []
def check(ok, msg):
    print(('  ok   ' if ok else '  FEHLER ') + msg)
    if not ok: errors.append(msg)
if not os.path.exists(OFFLINE_FILE): sys.exit('Offline-Ausgabe fehlt: node build.mjs --offline')
OFF = OFFLINE_FILE
size = os.path.getsize(OFF)
print('Offline-Ausgabe:', os.path.relpath(OFF, ROOT), f'{size / 1024 / 1024:.2f} MiB ({size} Byte)')

# ---------- Statisch: eine Datei, keine externe Quelle, CSP ----------
html = open(OFF, encoding='utf-8').read()
check(os.path.basename(OFF) == f'Lectora-{VERSION}.html', 'Dateiname mit Version')
markup = re.sub(r'<script\b[^>]*>[\s\S]*?</script>', '<script></script>', html)
check(not re.search(r'\s(?:src|href)="(?!data:|#)', markup) and not re.search(r'url\((?!data:)', markup), 'Markup und Stile: keine Quelle ausser data:')
check(not re.search(r'<script[^>]+\bsrc=', html), 'kein Skript mit src')
check(not re.search(r'cdnjs\.cloudflare|googleapis|unpkg\.com|jsdelivr', html), 'keine Adresse von cdnjs oder einem anderen CDN')
csp = re.search(r'<meta http-equiv="Content-Security-Policy" content="([^"]+)">', html)
check(bool(csp) and html.index(csp.group(0)) < html.index('<script'), 'CSP-Meta vor dem ersten Skript')
dirs = dict((d.split()[0], d.split()[1:]) for d in csp.group(1).split('; '))
print('   CSP:', re.sub(r"'sha256-[^']+'", "'sha256-…'", csp.group(1)))
check(dirs.get('default-src') == ["'none'"] and dirs.get('connect-src') == [VERSION_URL] and dirs.get('worker-src') == ['blob:'] and dirs.get('img-src') == ['data:'] and dirs.get('font-src') == ['data:']
      and all(x.startswith("'sha256-") for x in dirs.get('script-src', [])) and all(x.startswith("'sha256-") for x in dirs.get('style-src', [])) and dirs.get('base-uri') == ["'none'"] and dirs.get('form-action') == ["'none'"],
      'CSP: default-src none, connect-src genau die Versionsdatei, Skripte und Stile nur über Hash, worker-src blob:, Bilder und Schriften data:')
check(len(dirs['script-src']) == len(re.findall(r'<script>', html)), f'je eingebettetes Skript ein Hash ({len(dirs["script-src"])})')
check('DP.offline=true;' in html, 'DP.offline=true in der Offline-Ausgabe')
# Lizenzhinweise am Anfang der Datei (Kommentar): enthalten Adressen aus den Lizenztexten, werden nie geladen
lic = re.match(r'<!DOCTYPE html>\n<!--([\s\S]*?)-->', html)
check(bool(lic) and 'JSZip' in lic.group(1) and 'Apache License' in lic.group(1) and 'SIL OPEN FONT LICENSE' in lic.group(1).upper() and 'ISC License' in lic.group(1) and 'pdf-lib' in lic.group(1), 'Lizenzhinweise der eingebetteten Komponenten am Anfang der Datei')
code = html[lic.end():] if lic else html
hosts = sorted(set(h for h in re.findall(r'https?://([a-z0-9.-]+)', code) if h))
raw = re.findall(r'https://sem-sgg\.github\.io[^\s"\'`;)]*', code)
check(raw and all(u == VERSION_URL for u in raw), f'sem-sgg.github.io nur als Adresse der Versionsdatei ({len(raw)}×: CSP und src/update.js)')
check('raw.githubusercontent.com' not in code, 'keine Adresse auf raw.githubusercontent.com (frühere Versionsabfrage)')
# Erlaubt sind nur Kennungen, die nie geladen werden: XML-Namensräume (OOXML, SVG, XMP, XFA) und Quellenhinweise in den Lizenzköpfen
NS_HOSTS = {'sem-sgg.github.io', 'schemas.openxmlformats.org', 'purl.oclc.org', 'purl.org', 'www.w3.org', 'ns.adobe.com', 'www.xfa.org', 'www.apache.org', 'github.com', 'raw.github.com', 'stuk.github.io', 'stuartk.com'}
check(set(hosts) <= NS_HOSTS, 'Hostnamen nur als Namensraum oder Quellenhinweis (nie geladen): ' + ', '.join(hosts))

INIT = r'''
window.__csp = []; window.__claudeTouched = 0;
document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI));
Object.defineProperty(window, 'claude', { configurable: true, get() { window.__claudeTouched++; return undefined; } });
'''
def waitf(pg, expr, timeout=30000):
    t0 = time.time()
    while time.time() - t0 < timeout / 1000:
        if pg.evaluate(expr): return True
        time.sleep(0.1)
    raise AssertionError('Zeitüberschreitung: ' + expr)
focus = lambda pg: pg.evaluate('document.activeElement === document.body ? "BODY" : (document.activeElement.getAttribute("data-fid") || "#" + document.activeElement.id)')

# ===== Versionsabfrage, Altershinweis, Ausgabe ohne Abfrage, GitHub Pages, Standardprofile =====
NEWER = {'version': '9.1.0', 'date': '2027-03-01', 'note': {'de': 'Neue Regeln für Fristen.', 'fr': 'Nouvelles règles pour les délais.', 'it': 'Nuove regole per i termini.'}}
def vbody(**over):
    o = json.loads(json.dumps(NEWER)); o.update(over); return json.dumps(o)
def update_tests(pw):
    print('\n== Versionsabfrage')
    br = launch(pw)
    def start(body=None, status=200, handler=None, w=1440, h=900, locale='de-CH', target=None, init=None, cookies=False):
        ctx = br.new_context(viewport={'width': w, 'height': h}, locale=locale, accept_downloads=True, device_scale_factor=1)
        if cookies: ctx.add_cookies([{'name': 'gh', 'value': 'geheim', 'domain': 'raw.githubusercontent.com', 'path': '/', 'secure': True}, {'name': 'gh2', 'value': 'geheim', 'domain': '.githubusercontent.com', 'path': '/', 'secure': True}])
        seen, ev = [], {'err': [], 'cons': [], 'reqs': []}
        if handler: ctx.route(VERSION_URL, lambda r: (seen.append(r.request), handler(r)))
        else: seen = mock_version(ctx, body=body, status=status)
        pg = ctx.new_page(); pg.add_init_script(INIT)
        if init: pg.add_init_script(init)
        pg.on('pageerror', lambda e: ev['err'].append(str(e)))
        pg.on('console', lambda m: ev['cons'].append(m.type + ': ' + m.text) if m.type in ('error', 'warning') else None)
        pg.on('request', lambda r: ev['reqs'].append(r))
        pg.goto(target or 'file://' + OFF); return ctx, pg, seen, ev
    band = lambda pg: pg.evaluate('(() => { const b = document.getElementById("updBand"); return b.hidden ? null : b.innerText; })()')
    def usable(pg):
        pg.click('[data-fid="nav-criteria"]'); pg.wait_for_timeout(200); a = pg.evaluate('DP.state.route') == 'criteria'
        pg.click('[data-fid="nav-docs"]'); pg.wait_for_timeout(200); return a and pg.evaluate('DP.state.route') == 'docs' and pg.is_enabled('[data-fid="demo"]')

    # Neuere Version: Hinweis in DE, FR, IT mit dem festen Link
    for lang, word, note, btn in (('de', 'Neue Version 9.1.0 verfügbar.', NEWER['note']['de'], 'Neue Version herunterladen'), ('fr', 'Nouvelle version 9.1.0 disponible.', NEWER['note']['fr'], 'Télécharger la nouvelle version'), ('it', 'Nuova versione 9.1.0 disponibile.', NEWER['note']['it'], 'Scarica la nuova versione')):
        ctx, pg, seen, ev = start(vbody(), locale=lang + '-CH', cookies=True)
        pg.wait_for_selector('#updBand:not([hidden])', timeout=10000); t = band(pg)
        a = pg.evaluate('(() => { const a = document.querySelector("[data-fid=upd-dl]"); return a && [a.getAttribute("href"), a.target, a.rel, a.innerText.trim()]; })()')
        # Datum in der Schreibweise der Oberfläche, nicht als JJJJ-MM-TT
        day = {'de': '1. März 2027', 'fr': '1er mars 2027', 'it': '1° marzo 2027'}[lang]
        check(word in t and note in t and day in t and '2027-03-01' not in t and a == [RELEASE_URL, '_blank', 'noopener noreferrer', btn], f'{lang}: neuere Version → Hinweis «{t.splitlines()[0][:90]}», Link auf {a and a[0]}')
        if lang == 'de':
            r = seen[0]; hd = r.all_headers()
            check(len(seen) == 1 and r.url == VERSION_URL and '?' not in r.url and r.method == 'GET', f'genau eine Anfrage, GET, genau die Adresse ohne Abfrageteil ({len(seen)}× {r.url})')
            check('cookie' not in hd and 'referer' not in hd and 'authorization' not in hd and not [k for k in hd if k.startswith('x-')], 'ohne Cookies (obwohl gesetzt), ohne Referrer, ohne eigene Kopfzeilen: ' + ', '.join(sorted(hd)))
            check(hd.get('origin') == 'null', f'Herkunft der Datei: Origin «{hd.get("origin")}» (file:// → null; die Antwort von GitHub erlaubt jede Herkunft)')
            check(pg.evaluate('getComputedStyle(document.getElementById("updBand")).display') != 'none' and pg.evaluate('document.getElementById("updBand").getAttribute("role")') == 'status', 'Hinweis als Statusmeldung (role=status)')
            pg.screenshot(path=os.path.join(SHOTS, '70_update_de_1440.png'))
            # Ausblenden: für die Sitzung, Fokus auf den Inhalt; ein Sprachwechsel bringt den Hinweis nicht zurück
            pg.click('[data-fid="upd-close"]'); pg.wait_for_timeout(200)
            check(band(pg) is None and focus(pg) == '#view', f'ausgeblendet, Fokus auf dem Inhalt ({focus(pg)})')
            pg.click('[data-fid="lang-fr"]'); pg.wait_for_timeout(200); check(band(pg) is None, 'bleibt nach Sprachwechsel ausgeblendet')
            check(usable(pg) and not ev['err'], 'Seite bedienbar, keine Fehler')
        if lang == 'fr': pg.screenshot(path=os.path.join(SHOTS, '70_update_fr_1440.png'))
        ctx.close()
    for w, h, lang in ((375, 812, 'de'), (375, 812, 'fr')):
        ctx, pg, seen, ev = start(vbody(), w=w, h=h, locale=lang + '-CH'); pg.wait_for_selector('#updBand:not([hidden])', timeout=10000)
        ov = pg.evaluate('(() => { const b = document.getElementById("updBand"); return [b.scrollWidth <= b.clientWidth + 1, document.documentElement.scrollWidth <= innerWidth + 1, [...b.querySelectorAll("a,button")].every(e => e.getBoundingClientRect().height >= 40)]; })()')
        check(ov == [True, True, True], f'{w}px {lang}: Hinweis ohne Überlauf, Bedienelemente mindestens 40 px hoch {ov}')
        pg.screenshot(path=os.path.join(SHOTS, f'70_update_{lang}_{w}.png')); ctx.close()

    # Gleiche oder ältere Version: nichts
    for v in (VERSION, '1.9.9', '0.0.1'):
        ctx, pg, seen, ev = start(vbody(version=v)); pg.wait_for_timeout(1500)
        check(band(pg) is None and len(seen) == 1 and not ev['err'], f'Version {v} → kein Hinweis')
        ctx.close()

    # Fehlerhafte, feindliche, langsame und scheiternde Antworten: kein Hinweis, kein Fehler, Seite bedienbar
    big = json.dumps(dict(NEWER, pad='x' * 5000))
    hostile = [
        ('kein JSON', 'das ist kein JSON', 200), ('HTML-Seite', '<!DOCTYPE html><html><body><h1>Neue Version</h1></body></html>', 200),
        ('JSON-Liste', '[1, 2, 3]', 200), ('zu gross (> 4 KiB)', big, 200), ('Version als Zahl', vbody(version=9.1), 200),
        ('Version mit Zusatz', vbody(version='9.1.0-beta'), 200), ('Version mit führender Null', vbody(version='09.1.0'), 200),
        ('Version mit Markup', vbody(version='<b>9</b>.1.0'), 200), ('Datum ungültig', vbody(date='2027-02-30'), 200),
        ('Hinweis mit HTML', vbody(note={'de': '<img src=x onerror=alert(1)>', 'fr': 'x', 'it': 'x'}), 200),
        ('Hinweis zu lang', vbody(note={'de': 'x' * 300, 'fr': 'x', 'it': 'x'}), 200),
        ('Hinweis mit Adresse', vbody(note={'de': 'Bitte die neue Version von https://beispiel.ch laden.', 'fr': 'x', 'it': 'x'}), 200),
        ('Hinweis mit Hostname', vbody(note={'de': 'Neue Version auf lectora-update.ch.', 'fr': 'x', 'it': 'x'}), 200),
        ('Hinweis mit www.', vbody(note={'de': 'x', 'fr': 'Voir www.lectora.ch', 'it': 'x'}), 200), ('Hinweis fehlt (it)', vbody(note={'de': 'a', 'fr': 'b'}), 200),
        ('Hinweis als Liste', vbody(note=['a', 'b', 'c']), 200), ('Hinweis mit Steuerzeichen', vbody(note={'de': 'a\u0007b', 'fr': 'b', 'it': 'c'}), 200),
        ('zu viele Felder', json.dumps(dict(NEWER, **{f'k{i}': i for i in range(9)})), 200),
        ('Status 404', vbody(), 404), ('Status 500', vbody(), 500)]
    for name, body, st in hostile:
        ctx, pg, seen, ev = start(body, status=st); pg.wait_for_timeout(1200)
        check(band(pg) is None and not ev['err'] and pg.evaluate('typeof window.__xss') == 'undefined' and len(seen) == 1, f'{name} → kein Hinweis, kein Fehler')
        ctx.close()
    for name, handler in (('Netzwerkfehler', lambda r: r.abort('failed')), ('keine Verbindung (Adresse unbekannt)', lambda r: r.abort('namenotresolved')),
                          ('Weiterleitung auf andere Adresse', lambda r: r.fulfill(status=302, headers={'Location': 'https://example.com/version.json', 'Access-Control-Allow-Origin': '*'}))):
        ctx, pg, seen, ev = start(handler=handler); pg.wait_for_timeout(1500)
        check(band(pg) is None and not ev['err'] and usable(pg), f'{name} → kein Hinweis, kein Fehler, Seite bedienbar')
        ctx.close()
    # Langsam: die Antwort kommt nie; nach 8 Sekunden gibt die Seite auf, ohne Meldung; bedienbar ist sie die ganze Zeit
    ctx, pg, seen, ev = start(handler=lambda r: None); pg.wait_for_timeout(700)
    check(usable(pg), 'langsame Antwort: Seite sofort bedienbar (die Abfrage blockiert nichts)')
    pg.wait_for_timeout(8500); check(band(pg) is None and not ev['err'] and len(seen) == 1, 'langsame Antwort: nach Ablauf der Wartezeit kein Hinweis, kein Fehler, keine zweite Anfrage')
    ctx.unroute_all(behavior='ignoreErrors'); ctx.close()

    # CSP: jede andere Adresse gesperrt (auch eine andere Datei im selben Repository); der Test beantwortete sie sonst
    ctx, pg, seen, ev = start(vbody(version=VERSION))
    for u in ('https://sem-sgg.github.io/lectora/index.html', 'https://sem-sgg.github.io/other/version.json', 'https://example.com/', 'https://api.github.com/repos/SEM-SGG/lectora/releases/latest'):
        ctx.route(u, lambda r: r.fulfill(status=200, body='{}', headers={'Access-Control-Allow-Origin': '*'}))
    pg.wait_for_timeout(800)
    res = pg.evaluate('''async (urls) => { const out = []; for (const u of urls) { try { await fetch(u); out.push('erlaubt'); } catch (e) { out.push('gesperrt'); } } return out; }''',
                      ['https://sem-sgg.github.io/lectora/index.html', 'https://sem-sgg.github.io/other/version.json', 'https://example.com/', 'https://api.github.com/repos/SEM-SGG/lectora/releases/latest'])
    viol = pg.evaluate('window.__csp')
    check(res == ['gesperrt'] * 4 and len([v for v in viol if v.startswith('connect-src')]) == 4, f'CSP sperrt andere Datei im Repository, anderes Repository, anderen Host, GitHub-API ({res}; {len(viol)} Verstösse gemeldet)')
    ws = pg.evaluate('(() => { try { new WebSocket("wss://example.com/"); return "erlaubt"; } catch (e) { return "gesperrt"; } })()'); pg.wait_for_timeout(200)
    check(any(v.startswith('connect-src') and 'wss' in v for v in pg.evaluate('window.__csp')) or ws == 'gesperrt', 'CSP sperrt WebSocket')
    ctx.close()

    # Altershinweis: Abfrage scheitert und die Ausgabe ist älter als 90 Tage
    shift = 'Date.now = ((n) => () => n() + %d * 86400000)(Date.now)'
    ctx, pg, seen, ev = start(handler=lambda r: r.abort('failed'), init=shift % 120); pg.wait_for_selector('#updBand:not([hidden])', timeout=10000)
    a = pg.evaluate('(() => { const a = document.querySelector("[data-fid=upd-repo]"); return a && a.getAttribute("href"); })()')
    check('Diese Ausgabe ist vom' in band(pg) and a == RELEASE_URL, f'ohne Antwort und älter als 90 Tage → Altershinweis mit Link auf die Ausgaben ({a})')
    pg.screenshot(path=os.path.join(SHOTS, '71_altershinweis_de_1440.png')); ctx.close()
    ctx, pg, seen, ev = start(handler=lambda r: r.abort('failed'), init=shift % 30); pg.wait_for_timeout(1500)
    check(band(pg) is None, 'ohne Antwort, jünger als 90 Tage → kein Hinweis'); ctx.close()
    ctx, pg, seen, ev = start(vbody(version=VERSION), init=shift % 400); pg.wait_for_timeout(1500)
    check(band(pg) is None, 'Antwort «aktuell», auch wenn die Ausgabe alt ist → kein Hinweis'); ctx.close()

    # Ausgabe ohne Versionsabfrage: connect-src 'none', kein Code, keine Anfrage
    nc = open(OFFLINE_NOCHECK_FILE, encoding='utf-8').read() if os.path.exists(OFFLINE_NOCHECK_FILE) else ''
    check(bool(nc) and "connect-src 'none'" in nc and 'raw.githubusercontent.com' not in nc and 'DP.updateCheck=false;' in nc and '=== update.js ===' not in nc, 'Ausgabe ohne Versionsabfrage: connect-src none, weder Adresse noch Modul im Code')
    if nc:
        ctx, pg, seen, ev = start(vbody(), target='file://' + OFFLINE_NOCHECK_FILE); pg.wait_for_timeout(2000)
        net = [r.url for r in ev['reqs'] if not r.url.startswith(('file:', 'blob:', 'data:'))]
        check(not seen and not net and band(pg) is None and pg.evaluate('typeof DP.update') == 'undefined', f'Ausgabe ohne Versionsabfrage: null Anfragen ({len(seen)} an die Versionsdatei, {len(net)} andere), kein Hinweis')
        pg.evaluate('DP.ui.go("help", "ai")'); pg.wait_for_timeout(400)
        check('fragt keine Versionsnummer ab' in pg.inner_text('#g-ai') and 'Die Seite lädt nichts nach und sendet nichts' in pg.inner_text('#g-data'), 'Ausgabe ohne Versionsabfrage: Anleitung sagt «keine Verbindung»')
        pg.click('[data-fid="off-mark"]') if pg.is_visible('[data-fid="off-mark"]') else None
        ctx.close()
        ctx, pg, seen, ev = start(target='file://' + OFFLINE_NOCHECK_FILE, init=shift % 120); pg.wait_for_selector('#updBand:not([hidden])', timeout=10000)
        check('Diese Ausgabe ist vom' in band(pg) and not seen, 'Ausgabe ohne Versionsabfrage: Altershinweis nach 90 Tagen, ohne Anfrage'); ctx.close()

    # Kennzeichnung der Offline-Ausgabe: Kurzinfo nennt die Abfrage, Klick führt zur Erklärung
    ctx, pg, seen, ev = start(vbody(version=VERSION)); pg.wait_for_timeout(500)
    tip = pg.evaluate('document.getElementById("offMark").dataset.tip')
    pg.click('#offMark'); pg.wait_for_timeout(800)
    check('GitHub' in tip and 'Versionsnummer' in tip and pg.evaluate('DP.state.route') == 'help', f'Kennzeichnung: Kurzinfo «{tip[:70]}…», Klick öffnet die Anleitung')
    ctx.close()

    # Standardprofile im Profilband (DE und FR): Auswahl, Rückfrage wie bei einer Datei, übernommen
    for lang, name, btn_t, ok_t in (('de', 'SGG Weisung', 'Standardprofil laden', 'Aktives Profil'), ('fr', 'SGG Directive', 'Charger le profil standard', None)):
        ctx, pg, seen, ev = start(vbody(version=VERSION), locale=lang + '-CH'); pg.wait_for_timeout(300)
        pg.evaluate('DP.ui.go("criteria")'); pg.wait_for_timeout(400)
        opts = pg.evaluate('[...document.querySelectorAll("#profStd option")].map(o => o.textContent)')
        check(len(opts) == 3 and name in opts and pg.inner_text('[data-fid="prof-std"]').strip() == btn_t, f'{lang}: Standardprofile {opts}, Schaltfläche «{pg.inner_text("[data-fid=prof-std]").strip()}»')
        pg.select_option('#profStd', 'sgg-weisung'); pg.screenshot(path=os.path.join(SHOTS, f'72_standardprofil_{lang}_1440.png'))
        pg.click('[data-fid="prof-std"]'); pg.wait_for_selector('#dlg[open] [data-fid="prof-apply"]')
        pg.wait_for_timeout(500); dt = pg.inner_text('#dlg'); pg.screenshot(path=os.path.join(SHOTS, f'72_standardprofil_dialog_{lang}_1440.png'))
        pg.evaluate(AXE); ax = pg.evaluate(AXE_RUN)
        check(name in dt and not ax, f'{lang}: Rückfrage nennt «{name}», axe ohne Verstoss {ax}')
        pg.click('[data-fid="prof-apply"]'); pg.wait_for_timeout(400)
        st = pg.evaluate('[DP.state.settings.params["L01.note"], DP.state.settings.params["L01.warn"], DP.state.settings.params["S06.maxWords"], DP.state.profile && DP.state.profile.name]')
        check(st == [25, 35, 120, name] and focus(pg) == 'prof-std', f'{lang}: übernommen {st}, Fokus auf der Schaltfläche ({focus(pg)})')
        if lang == 'de':
            pg.select_option('#profStd', 'sgg-aktennotiz'); pg.click('[data-fid="prof-std"]'); pg.wait_for_selector('#dlg[open] [data-fid="prof-cancel"]'); pg.click('[data-fid="prof-cancel"]'); pg.wait_for_timeout(200)
            check(pg.evaluate('DP.state.profile.name') == 'SGG Weisung' and focus(pg) == 'prof-std', 'Abbrechen ändert nichts, Fokus zurück')
        ctx.close()
    for w, lang in ((375, 'de'), (375, 'fr')):
        ctx, pg, seen, ev = start(vbody(version=VERSION), w=w, h=812, locale=lang + '-CH'); pg.wait_for_timeout(300)
        pg.evaluate('DP.ui.go("criteria")'); pg.wait_for_timeout(400); pg.evaluate('document.getElementById("profBand").scrollIntoView({block: "start"})'); pg.wait_for_timeout(200)
        ov = pg.evaluate('(() => { const b = document.getElementById("profBand"); return [b.scrollWidth <= b.clientWidth + 1, document.querySelector("[data-fid=prof-std]").getBoundingClientRect().height >= 40]; })()')
        check(ov == [True, True], f'{w}px {lang}: Profilband mit Standardprofil ohne Überlauf, Schaltfläche ≥ 40 px')
        pg.screenshot(path=os.path.join(SHOTS, f'72_standardprofil_{lang}_{w}.png')); ctx.close()

    # GitHub Pages: dieselbe Datei über einen Webserver (hier lokal, http); neuere Version → «Seite neu laden»
    print('\n== GitHub Pages (Auslieferung über einen Webserver)')
    site = tempfile.mkdtemp(); import shutil; shutil.copy(OFF, os.path.join(site, 'index.html'))
    base = serve('pages', directory=site)
    for w, h, lang in ((1440, 900, 'de'), (1440, 900, 'fr'), (375, 812, 'de'), (375, 812, 'fr')):
        ctx, pg, seen, ev = start(vbody(), w=w, h=h, locale=lang + '-CH', target=base + '/'); pg.wait_for_selector('#updBand:not([hidden])', timeout=10000)
        rl = pg.evaluate('(() => { const b = document.querySelector("[data-fid=upd-reload]"); return b && [b.tagName, b.innerText.trim()]; })()')
        wsv = pg.evaluate('(() => { const a = document.getElementById("webSave"); return [a.hidden, a.getAttribute("href"), a.target, a.getAttribute("aria-label")]; })()')
        check(rl and rl[0] == 'BUTTON' and rl[1] == {'de': 'Seite neu laden', 'fr': 'Recharger la page'}[lang] and pg.query_selector('[data-fid="upd-dl"]') is None, f'Pages {lang} {w}px: neuere Version → «{rl and rl[1]}» statt Download')
        ov = pg.evaluate('(() => { const u = document.querySelector(".utility"), b = document.getElementById("updBand"); return [u.scrollWidth <= u.clientWidth + 1, b.scrollWidth <= b.clientWidth + 1, document.documentElement.scrollWidth <= innerWidth + 1]; })()')
        check(ov == [True, True, True], f'Pages {lang} {w}px: Utility-Leiste und Hinweis ohne Überlauf {ov}')
        check(wsv == [False, RELEASE_URL, '_blank', {'de': 'Als Datei speichern', 'fr': 'Enregistrer comme fichier'}[lang]], f'Pages {lang} {w}px: «Als Datei speichern» verweist auf die neuste Ausgabe {wsv}')
        if w == 1440 and lang == 'de':
            check(seen[0].all_headers().get('origin') == base, f'Pages: Versionsabfrage mit Origin der Seite ({seen[0].all_headers().get("origin")})')
            pg.screenshot(path=os.path.join(SHOTS, '73_pages_de_1440.png'))
            pg.evaluate('window.__marke = 1'); pg.click('[data-fid="upd-reload"]'); pg.wait_for_load_state('load'); pg.wait_for_timeout(800)
            check(pg.evaluate('typeof window.__marke') == 'undefined' and len(seen) == 2, f'Pages: «Seite neu laden» lädt neu ({len(seen)} Abfragen: je Start eine)')
            # Über https bzw. http: PDF (Worker aus blob:), Downloads, keine CSP-Verstösse
            pg.set_input_files('#file', [os.path.join(FX, 'weisung_de_flawed.pdf'), os.path.join(FX, 'weisung_de_demo.docx')]); waitf(pg, 'DP.state.docs.length === 2 && !DP.state.busy')
            check(pg.evaluate('DP.state.docs[0].paras.length') > 20, 'Pages: PDF gelesen (Worker aus blob: unter der CSP)')
            pg.evaluate('DP.state.cur = DP.state.docs[1].id; DP.ui.go("export")'); pg.wait_for_timeout(400)
            with pg.expect_download(timeout=30000) as d: pg.click('[data-fid="dl-word"]')
            p_w = os.path.join(OUT, 'pages_' + d.value.suggested_filename); d.value.save_as(p_w)
            ev2 = ooxml_check(p_w, os.path.join(FX, 'weisung_de_demo.docx'), 'Lectora')
            check(d.value.suggested_filename.endswith('_Korrektur.docx') and not ev2, f'Pages: Download über den Browser ({d.value.suggested_filename}), Office-Prüfung {"bestanden" if not ev2 else ev2[:2]}')
            check(not pg.evaluate('window.__csp') and not ev['err'], 'Pages: keine CSP-Verstösse, keine Fehler ' + repr(pg.evaluate('window.__csp')[:3]))
            pg.evaluate('DP.ui.go("help", "ai")'); pg.wait_for_timeout(500)
            check('GitHub Pages' in pg.inner_text('#g-ai') and 'Als Datei speichern' in pg.inner_text('#g-ai') and 'GitHub Pages' in pg.inner_text('#g-data'), 'Pages: Anleitung beschreibt die Webseite und «Als Datei speichern»')
            pg.screenshot(path=os.path.join(SHOTS, '73_pages_guide_de_1440.png'))
        else:
            pg.screenshot(path=os.path.join(SHOTS, f'73_pages_{lang}_{w}.png'))
        ctx.close()
    ctx, pg, seen, ev = start(vbody(version=VERSION), target=base + '/'); pg.wait_for_timeout(1500)
    check(band(pg) is None and pg.is_visible('#webSave'), 'Pages: aktuelle Version → kein Hinweis, «Als Datei speichern» sichtbar'); ctx.close()
    shutil.rmtree(site, ignore_errors=True)
    br.close()

with sync_playwright() as pw:
    br = launch(pw)
    reqs, msgs, vreqs = [], [], []
    def page(w=1440, h=900, locale='de-CH'):
        ctx = br.new_context(viewport={'width': w, 'height': h}, locale=locale, accept_downloads=True, device_scale_factor=1)
        ctx.grant_permissions(['clipboard-read', 'clipboard-write'])
        vreqs.append(mock_version(ctx))
        pg = ctx.new_page(); pg.add_init_script(INIT)
        pg.on('request', lambda r: reqs.append(r.url))
        pg.on('console', lambda m: msgs.append(m.type + ': ' + m.text) if m.type in ('error', 'warning') else None)
        pg.on('pageerror', lambda e: msgs.append('pageerror: ' + str(e)))
        pg.goto('file://' + OFF); pg.wait_for_timeout(600)
        return pg
    def download(pg, fid, name):
        with pg.expect_download(timeout=30000) as d: pg.click(f'[data-fid="{fid}"]')
        dl = d.value; path = os.path.join(OUT, dl.suggested_filename); dl.save_as(path)
        return dl.suggested_filename, path

    # ===== Start, Kennzeichnung, kein KI-Zugang =====
    pg = page()
    mark = pg.inner_text('#offMark')
    check(re.fullmatch(rf'Offline-Ausgabe {re.escape(VERSION)} · \d{{1,2}}\. \w+ \d{{4}}', mark.split('\n')[0].strip()) is not None and pg.is_visible('#offMark'), f'Kennzeichnung in der Werkzeugleiste: «{mark.splitlines()[0]}»')
    check(pg.evaluate('[DP.offline, DP.state.aiAvail, DP.state.dlAvail, typeof pdfjsLib, typeof PDFLib, typeof JSZip]') == [True, False, True, 'object', 'object', 'function'], 'DP.offline, keine KI, Downloads über den Browser, Bibliotheken eingebettet')
    check('Offline' in pg.title(), f'Titel nennt die Offline-Ausgabe ({pg.title()})')
    fact = pg.inner_text('.grid3'); check('Ohne Konto und ohne KI' in fact and 'Versionsnummer' in fact and 'Claude' not in fact, 'Startseite: Karte «Ohne Konto und ohne KI» (mit Versionsabfrage) statt KI')
    pg.screenshot(path=os.path.join(SHOTS, '60_offline_start_de_1440.png'))
    pg.evaluate(AXE); print('   axe Startseite:', pg.evaluate(AXE_RUN)); check(pg.evaluate(AXE_RUN) == [], 'axe Startseite (Offline) ohne Verstoss')
    pg.click('#sessionChip'); pg.wait_for_selector('#dlg[open]'); pg.wait_for_timeout(500)
    check('keine KI-Funktionen' in pg.inner_text('#dlg') and 'Versionsnummer' in pg.inner_text('#dlg') and 'Claude' not in pg.inner_text('#dlg'), 'Sitzungsdialog: offline, ohne KI, nennt die Versionsabfrage')
    ax = pg.evaluate(AXE_RUN); check(ax == [], 'axe Sitzungsdialog (Offline) ohne Verstoss ' + repr(ax))
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)

    # ===== Dokumente: PDF und PowerPoint, dann die Beispiele =====
    pg.set_input_files('#file', [os.path.join(FX, 'weisung_de_flawed.pdf'), os.path.join(FX, 'praesentation_de.pptx')]); waitf(pg, 'DP.state.docs.length === 2 && !DP.state.busy')
    pg.click('[data-fid="demo"]'); waitf(pg, 'DP.state.docs.length === 5 && !DP.state.busy')
    check(pg.evaluate('DP.state.docs.map(d => d.format + ":" + d.paras.length).join(" ")').count(':') == 5 and pg.evaluate('DP.state.docs[0].paras.length') > 20, 'PDF (Worker aus blob:), PowerPoint und drei Beispieldokumente gelesen: ' + pg.evaluate('DP.state.docs.map(d => d.format + ":" + d.paras.length).join(" ")'))
    pg.screenshot(path=os.path.join(SHOTS, '60_offline_docs_de_1440.png'))
    # Prüfung: Erklärung statt KI-Karte, einen Vorschlag annehmen
    pg.evaluate('DP.state.cur = DP.state.docs[2].id; DP.ui.go("check")'); pg.wait_for_timeout(600)
    check(pg.query_selector('.ai-card') is None and pg.query_selector('[data-fid="aiDoc-go"]') is None and pg.is_visible('[data-fid="ai-off"]'), 'Prüfung: keine KI-Karte, ruhige Erklärung')
    check('gehören nicht zur Offline-Ausgabe' in pg.inner_text('[data-fid="ai-off"]') and not re.search(r'nicht zur Verfügung|Konto|account', pg.inner_text('[data-fid="ai-off"]')), 'Erklärung ohne «nicht verfügbar» oder Kontohinweis')
    # Neue KI-Funktionen: weder Ansicht «Pflichten» noch «Vorschlag von Claude anfordern»; die Erklärung nennt sie
    check(pg.query_selector('[data-fid="view-duty"]') is None and pg.query_selector('[data-fid^="rw-"]') is None and pg.query_selector('[data-fid="aiDuty-go"]') is None, 'Prüfung: keine Pflichtenmatrix, kein Formulierungsvorschlag (Dokumentansicht)')
    pg.click('[data-fid="view-list"]'); pg.wait_for_timeout(300)
    check(pg.query_selector('[data-fid^="rw-"]') is None and pg.query_selector('[data-fid^="m-rw-"]') is None, 'Prüfung: kein Formulierungsvorschlag (Liste)')
    pg.evaluate('DP.state.view = "duty"; DP.ui.render()'); pg.wait_for_timeout(300)
    check(pg.query_selector('[data-fid="aiDuty-go"]') is None and pg.query_selector('.duty') is None, 'auch mit Ansichtszustand «duty»: keine Pflichtenmatrix (Liste statt Matrix)')
    pg.evaluate('DP.state.view = "doc"; DP.ui.render()'); pg.wait_for_timeout(300)
    off_t = pg.inner_text('[data-fid="ai-off"]'); check('Rückübersetzung' in off_t and 'Pflichtenmatrix' in off_t and 'Formulierungsvorschläge' in off_t, 'Erklärung nennt Rückübersetzung, Pflichtenmatrix und Formulierungsvorschläge')
    check(pg.evaluate('typeof DP.ai.runReword === "function" && typeof DP.duties.run === "function"') and pg.evaluate('DP.ai.getSample().then(s => s === null)'), 'Schnittstelle liefert offline nichts (getSample → null)')
    pg.screenshot(path=os.path.join(SHOTS, '61_offline_check_de_1440.png'))
    check(pg.evaluate(AXE_RUN) == [], 'axe Prüfung (Offline) ohne Verstoss')
    n0 = pg.evaluate('DP.ui.findings().filter(f => f.accepted).length')
    pg.click('.chg.c-open > :is(del, ins)'); pg.wait_for_selector('#dvTb'); pg.click('[data-fid="tb-acc"]'); pg.wait_for_timeout(300)
    check(pg.evaluate('DP.ui.findings().filter(f => f.accepted).length') == n0 + 1, 'Vorschlag angenommen')
    # Vergleich paarweise und dreifach
    pg.evaluate('DP.state.ref = DP.state.docs[2].id; DP.state.tgt = DP.state.docs[3].id; DP.ui.go("compare")'); pg.wait_for_timeout(600)
    nrows = pg.evaluate('document.querySelectorAll(".seg-row").length')
    check(nrows > 0 and pg.query_selector('[data-fid="aiCmp-go"]') is None and pg.is_visible('[data-fid="ai-off"]'), f'Vergleich: {nrows} Zeilen, Erklärung statt Bedeutungsvergleich')
    check(pg.evaluate(AXE_RUN) == [], 'axe Vergleich (Offline) ohne Verstoss')
    pg.click('[data-fid="cmp-mode-tri"]'); pg.wait_for_timeout(500)
    check(pg.query_selector('[data-fid="cmp-tri-ai"]') is None and pg.is_visible('[data-fid="ai-off"]'), 'Synopse: Erklärung statt Hinweis auf den Bedeutungsvergleich')
    pg.click('[data-fid="cmp-mode-pair"]'); pg.wait_for_timeout(300)
    check(pg.query_selector('[data-fid="aiBt-go"]') is None and pg.query_selector('#aiBt') is None and pg.query_selector('[data-fid^="rw-"]') is None and len(pg.query_selector_all('[data-fid="ai-off"]')) == 1, 'Vergleich: keine Rückübersetzung, kein Formulierungsvorschlag, eine einzige Erklärung')
    pg.click('[data-fid="cmp-mode-tri"]'); pg.wait_for_timeout(300)
    pg.click('[data-fid="cmp-mode-pair"]'); pg.wait_for_timeout(300)

    # ===== Exporte als Downloads des Browsers =====
    pg.evaluate('DP.state.cur = DP.state.docs[2].id; DP.ui.go("export")'); pg.wait_for_timeout(400)
    pg.screenshot(path=os.path.join(SHOTS, '62_offline_export_word_de_1440.png'))
    fn, p_word = download(pg, 'dl-word', 'word')
    ev = ooxml_check(p_word, os.path.join(FX, 'weisung_de_demo.docx'), 'Lectora')
    check(fn.endswith('_Korrektur.docx') and not ev, f'Word mit Korrekturmodus: {fn}, Office-Prüfung {"bestanden" if not ev else ev[:3]}')
    fn, p_rep = download(pg, 'dl-rep', 'rep')
    ev = ooxml_check(p_rep)
    check(fn.endswith('_Pruefbericht.docx') and not ev, f'Prüfbericht: {fn}, Office-Prüfung {"bestanden" if not ev else ev[:3]}')
    pg.evaluate('DP.state.cur = DP.state.docs[0].id; DP.ui.go("export")'); pg.wait_for_timeout(400)
    pg.screenshot(path=os.path.join(SHOTS, '62_offline_export_pdf_de_1440.png'))
    check(pg.evaluate(AXE_RUN) == [], 'axe Export PDF (Offline) ohne Verstoss')
    fn, p_pdf = download(pg, 'dl-annot', 'pdf')
    from pypdf import PdfReader
    n_an = sum(len(p.get('/Annots') or []) for p in PdfReader(p_pdf).pages); q = subprocess.run(['qpdf', '--check', p_pdf], capture_output=True)
    check(fn == 'weisung_de_flawed_Kommentare.pdf' and n_an == pg.evaluate('DP.ui.annotItems(DP.state.docs[0]).length') and q.returncode == 0, f'PDF mit Kommentaren: {fn}, {n_an} Anmerkungen, qpdf ohne Fehler')
    pg.evaluate('DP.state.cur = DP.state.docs[1].id; DP.ui.go("export")'); pg.wait_for_timeout(400)
    fn, p_ppt = download(pg, 'dl-annot', 'pptx')
    ev = ooxml_check(p_ppt, os.path.join(FX, 'praesentation_de.pptx'))
    n_cm = sum(len(re.findall(r'<p:cm ', zipfile.ZipFile(p_ppt).read(n).decode())) for n in zipfile.ZipFile(p_ppt).namelist() if n.startswith('ppt/comments/'))
    check(fn == 'praesentation_de_Kommentare.pptx' and n_cm > 0 and not ev, f'PowerPoint mit Kommentaren: {fn}, {n_cm} Kommentare, Office-Prüfung {"bestanden" if not ev else ev[:3]}')
    # Prüfprofil speichern und wieder laden
    pg.evaluate('DP.state.critOpen = new Set(["typo"]); DP.ui.go("criteria")'); pg.wait_for_timeout(400)
    check(pg.is_visible('[data-fid="crit-ai-off"]'), 'Kriterien: Hinweis zu den KI-Kriterien der Offline-Ausgabe')
    check(pg.evaluate(AXE_RUN) == [], 'axe Kriterien (Offline) ohne Verstoss')
    pg.click('#sw-crit-T07'); pg.wait_for_timeout(200)
    fn, p_prof = download(pg, 'prof-save', 'prof')
    prof = json.load(open(p_prof, encoding='utf-8'))
    check(prof.get('format') == 'lectora-profil' and 'T07' in prof['settings']['off'] and pg.query_selector('#dlg[open]') is None, f'Prüfprofil gespeichert: {fn} (kein Kopierdialog)')
    pg.click('#sw-crit-T07'); pg.wait_for_timeout(200); check(not pg.evaluate('DP.state.settings.off.has("T07")'), 'T07 wieder eingeschaltet')
    pg.set_input_files('#profFile', [p_prof]); pg.wait_for_selector('#dlg[open] [data-fid="prof-apply"]'); pg.click('[data-fid="prof-apply"]'); pg.wait_for_timeout(500)
    check(pg.evaluate('DP.state.settings.off.has("T07")'), 'Prüfprofil geladen: T07 wieder ausgeschaltet')
    # Rückmeldung (Fehlalarm)
    pg.evaluate('DP.state.cur = DP.state.docs[2].id; DP.ui.go("check")'); pg.wait_for_timeout(400); pg.click('[data-fid="view-list"]'); pg.wait_for_timeout(400)
    fa = pg.evaluate('(() => { const b = document.querySelector("[data-fid^=\'fa-\']"); return b && b.dataset.fid; })()'); pg.click(f'[data-fid="{fa}"]'); pg.wait_for_timeout(300)
    pg.evaluate('DP.ui.go("export")'); pg.wait_for_timeout(400)
    fn, p_fb = download(pg, 'fb-save', 'fb')
    fb = json.load(open(p_fb, encoding='utf-8'))
    check(fn.startswith('Lectora-Rueckmeldung_') and fb.get('format') and len(fb.get('entries', fb.get('falseAlarms', []))) >= 1, f'Rückmeldung gespeichert: {fn}')
    # Anleitung: Abschnitte der Offline-Ausgabe
    pg.evaluate('DP.ui.go("help", "ai")'); pg.wait_for_timeout(600)
    g = pg.inner_text('#g-ai'); gd = pg.inner_text('#g-data')
    check(g.startswith('Offline-Ausgabe') and 'einzige Verbindung' in g and 'IP-Adresse' in g and 'Neue Version herunterladen' in g and 'Content Security Policy' in g and 'Claude' not in g, 'Anleitung KI-Abschnitt: Offline-Ausgabe mit Versionsabfrage, IP-Adresse, CSP')
    check('stecken in dieser Datei' in gd and 'einzige Verbindung' in gd and 'IP-Adresse' in gd and 'Dokumentinhalte gehen nie mit' in gd and 'ohne diese Abfrage' in gd and 'cdnjs' not in gd and 'Download-Ordner' in gd, 'Anleitung Datenhaltung: eine Anfrage an GitHub, IP-Adresse, keine Dokumentdaten, Ausgabe ohne Abfrage')
    check('KI-Prüfung gehört nicht zur Offline-Ausgabe' in pg.inner_text('#g-steps'), 'Anleitung Schritt 4 ohne KI')
    pg.evaluate('document.getElementById("g-data").scrollIntoView({block: "start"})'); pg.wait_for_timeout(200)
    pg.screenshot(path=os.path.join(SHOTS, '63_offline_guide_ai_de_1440.png'))
    check(pg.evaluate(AXE_RUN) == [], 'axe Anleitung (Offline) ohne Verstoss')
    pg.evaluate('DP.ui.setLang("fr")'); pg.wait_for_timeout(300); pg.evaluate('document.getElementById("g-data").scrollIntoView({block: "start"})'); pg.wait_for_timeout(200)
    check(pg.inner_text('#g-ai').startswith('Édition hors ligne') and pg.inner_text('#offMark').startswith('Édition hors ligne'), 'FR: Anleitung und Kennzeichnung «Édition hors ligne»')
    pg.screenshot(path=os.path.join(SHOTS, '63_offline_guide_ai_fr_1440.png'))
    pg.evaluate('DP.ui.setLang("it")'); pg.wait_for_timeout(300)
    check(pg.inner_text('#g-ai').startswith('Edizione offline') and pg.inner_text('#offMark').startswith('Edizione offline'), 'IT: Anleitung und Kennzeichnung «Edizione offline»')
    pg.evaluate('DP.ui.setLang("de")'); pg.wait_for_timeout(200)
    # Kein Zugriff auf die Schnittstelle von Claude, keine Anfrage, keine Meldung
    check(pg.evaluate('window.__claudeTouched') == 0, 'window.claude nie abgefragt')
    csp_v = pg.evaluate('window.__csp')
    pg.context.close()

    # ===== Schmal und französisch =====
    for w, h, lang in ((375, 812, 'de'), (375, 812, 'fr'), (1440, 900, 'fr')):
        pg = page(w, h, lang + '-CH')
        pg.set_input_files('#file', [os.path.join(FX, 'weisung_de_flawed.pdf')]); waitf(pg, 'DP.state.docs.length === 1 && !DP.state.busy')
        ov = pg.evaluate('(() => { const m = document.getElementById("offMark"), u = document.querySelector(".utility"); return [m.getBoundingClientRect().right <= document.getElementById("langSeg").getBoundingClientRect().left + 0.5, u.scrollWidth <= u.clientWidth + 1]; })()')
        check(ov == [True, True] and pg.is_visible('#offMark'), f'{w}px {lang}: Kennzeichnung passt in die Werkzeugleiste ({pg.inner_text("#offMark").splitlines()[0]})')
        pg.screenshot(path=os.path.join(SHOTS, f'60_offline_start_{lang}_{w}.png'))
        pg.evaluate('DP.ui.go("check")'); pg.wait_for_timeout(500); pg.screenshot(path=os.path.join(SHOTS, f'61_offline_check_{lang}_{w}.png'))
        pg.evaluate(AXE); check(pg.evaluate(AXE_RUN) == [], f'axe Prüfung {w}px {lang} ohne Verstoss')
        pg.evaluate('DP.ui.go("export")'); pg.wait_for_timeout(500); pg.screenshot(path=os.path.join(SHOTS, f'62_offline_export_pdf_{lang}_{w}.png'))
        pg.evaluate('DP.ui.go("help", "ai")'); pg.wait_for_timeout(500); pg.screenshot(path=os.path.join(SHOTS, f'63_offline_guide_ai_{lang}_{w}.png'))
        csp_v += pg.evaluate('window.__csp')
        pg.context.close()

    other = sorted(set(u for u in reqs if not (u.startswith('file://') and u.split('#')[0].split('?')[0] == 'file://' + OFF) and not u.startswith(('blob:', 'data:')) and u != VERSION_URL))
    check(not other, 'Netzwerk: keine Anfrage ausser der Datei selbst, blob:, data: und der Versionsdatei ' + (repr(other[:5]) if other else f'({len(reqs)} Anfragen)'))
    check(all(len(v) == 1 for v in vreqs) and len(vreqs) == 4, f'je Start genau eine Versionsabfrage ({[len(v) for v in vreqs]})')
    check(not csp_v, 'keine CSP-Verstösse ' + (repr(csp_v[:5]) if csp_v else ''))
    check(not msgs, 'Konsole ohne Fehler und Warnungen ' + (repr(msgs[:5]) if msgs else ''))
    br.close()

    update_tests(pw)

    # ===== Umgekehrt: veröffentlichte Fassung =====
    print('\n== Veröffentlichte Fassung (dist/index.html) und Testfassung (dist-local)')
    art = open(os.path.join(ROOT, 'dist', 'index.html'), encoding='utf-8').read()
    check('DP.offline=false;' in art and 'Content-Security-Policy' not in art, 'Artefakt: DP.offline=false, keine Offline-CSP')
    check(not re.search(r'<a\b[^>]*\bdownload\b', art), 'Artefakt: kein <a download> im Markup')
    # Der einzige Code, der einen Link mit download-Attribut baut, steht im Zweig «if (DP.offline)» von saveFile
    sites = [m.start() for m in re.finditer(r'\.download\s*=|download:\s', art)]
    branch = re.search(r'async function saveFile\(blob, filename\) \{\s*if \(DP\.offline\) \{(.*?)\n    \}', art, re.S)
    inside = branch and all(branch.start(1) <= s <= branch.end(1) for s in sites)
    check(len(sites) == 1 and bool(inside), f'Artefakt: {len(sites)} Stelle mit download-Attribut, nur im Zweig der Offline-Ausgabe')
    serve(8783)
    br = launch(pw)
    ctx = br.new_context(accept_downloads=True); ctx.grant_permissions(['clipboard-read', 'clipboard-write']); pg = ctx.new_page()
    pg.add_init_script('''window.__anchors = 0; const oc = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { if (this.hasAttribute('download')) window.__anchors++; return oc.call(this); };
      new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1 && (n.matches('a[download]') || n.querySelector('a[download]'))) window.__anchors++; }).observe(document, {childList: true, subtree: true});''')
    dls = []; pg.on('download', lambda d: dls.append(d.suggested_filename))
    pg.goto(url(8783) + '/dist-local/index.html'); pg.wait_for_timeout(500)
    pg.set_input_files('#file', [os.path.join(FX, 'weisung_de_flawed.pdf'), os.path.join(FX, 'weisung_de_demo.docx')]); pg.wait_for_function('DP.state.docs.length === 2 && !DP.state.busy', timeout=30000)
    check(pg.evaluate('document.getElementById("offMark").hidden') and pg.query_selector('[data-fid="ai-off"]') is None, 'Testfassung: keine Offline-Kennzeichnung, keine Offline-Erklärung')
    pg.evaluate('DP.state.cur = DP.state.docs[1].id; DP.ui.go("export")'); pg.wait_for_timeout(300); pg.click('[data-fid="dl-word"]'); pg.wait_for_timeout(800)
    na = pg.inner_text('#snacks')
    pg.evaluate('DP.ui.go("export")'); pg.wait_for_timeout(200)
    pg.evaluate('DP.state.cur = DP.state.docs[0].id; DP.state.dlAvail = null; DP.ui.go("export")'); pg.wait_for_timeout(300); pg.click('[data-fid="dl-annot"]'); pg.wait_for_timeout(2500)
    pg.evaluate('DP.ui.go("criteria")'); pg.wait_for_timeout(300); pg.click('[data-fid="prof-save"]'); pg.wait_for_selector('#dlg[open] #copyText')
    check(pg.evaluate('window.__anchors') == 0 and not dls and 'nicht zur Verfügung' in na, f'Ohne Claude (Artefakt-Code): kein Download-Link, kein Download, Hinweis «{na.strip()[:60]}…» bzw. Kopierdialog')
    br.close()
    # Netzwerk der veröffentlichten Fassung: nur cdnjs (ausführlich in cdn_test.py)
    px = os.environ.get('HTTPS_PROXY') or os.environ.get('https_proxy')
    br = launch(pw, proxy=proxy_settings())
    ctx = br.new_context(ignore_https_errors=True); pg = ctx.new_page(); r2 = []; pg.on('request', lambda r: r2.append(r.url))
    pg.goto(url(8783) + '/dist/index.html'); pg.wait_for_timeout(2500)
    pg.set_input_files('#file', [os.path.join(FX, 'weisung_de_flawed.pdf')]); pg.wait_for_function('DP.state.docs.length === 1 && !DP.state.busy', timeout=60000)
    ext = sorted(set(u for u in r2 if '127.0.0.1' not in u and not u.startswith(('blob:', 'data:'))))
    check(ext and all(u.startswith('https://cdnjs.cloudflare.com/ajax/libs/') for u in ext), f'Artefakt: Anfragen nur an cdnjs ({len(ext)} Dateien)')
    check(pg.evaluate('document.getElementById("offMark").hidden'), 'Artefakt: keine Offline-Kennzeichnung')
    br.close()

print(f'\nGrösse der Offline-Ausgabe: {size / 1024 / 1024:.2f} MiB')
print('FEHLER:', 'keine' if not errors else '\n  ' + '\n  '.join(errors))
sys.exit(1 if errors else 0)
