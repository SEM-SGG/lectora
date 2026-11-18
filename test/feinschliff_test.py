"""Feinschliff der Prüfansicht: Tastenkürzel (mit Übersicht und Schalter), Übersicht der Befunde am Rand, Übergänge bei Entscheiden,
Hochzählen des Ergebnisses, Verbindungslinie zwischen Randkarte und Textstelle, Ablage über dem ganzen Fenster.
Die meisten Prüfungen laufen mit prefers-reduced-motion (keine Zeitabhängigkeit); eigene Prüfungen mit Bewegung warten auf den Endzustand.
Schreibt Screenshots f1440_* und f375_* nach test/shots. Letzte Zeile: «FEHLER: keine»."""
import sys, os, re
sys.path.insert(0, os.path.dirname(__file__))
from engine_test import *
SHOTS = os.path.join(ROOT, 'test', 'shots'); os.makedirs(SHOTS, exist_ok=True)
errors = []
def check(cond, msg):
    print(('ok    ' if cond else 'FEHLER ') + msg)
    if not cond: errors.append(msg)

def page(br, w=1440, h=900, motion=False, locale='de-CH'):
    ctx = br.new_context(viewport={'width': w, 'height': h}, locale=locale, device_scale_factor=1, reduced_motion='no-preference' if motion else 'reduce')
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
    pg.on('console', lambda m: errors.append('console: ' + m.text) if m.type == 'error' and 'favicon' not in m.text and '404' not in m.text else None)
    pg.goto(url(8776) + '/dist-local/index.html'); pg.wait_for_timeout(400)
    return pg
def load(pg, names):
    pg.set_input_files('#file', [os.path.join(FX, n) for n in names]); pg.wait_for_function(f'DP.state.docs.length === {len(names)} && !DP.state.busy', timeout=60000); pg.wait_for_timeout(200)
FOCUS = 'document.activeElement === document.body ? "BODY" : (document.activeElement.getAttribute("data-fid") || "#" + document.activeElement.id)'
ST = '(id) => DP.ui.stOf(DP.ui.findings().find(f => f.id === id))'
OPEN = '() => DP.ui.findings().filter(f => DP.ui.stOf(f) === "open").length'
# Animationen dieses Pakets (Übergänge, Kartenwechsel, Hochzählen, Einblenden der Seite); vorhandene wie die der Meldungen zählen nicht
OUR = '() => document.getAnimations().filter(a => { const n = a.animationName || "", el = a.effect && a.effect.target; return /^(a-|card-st|cnt)/.test(n) || (n === "fade" && el && el.closest && !!el.closest(".st-anim, .fade-in")); }).map(a => a.animationName)'

def shortcuts(br):
    print('== Tastenkürzel (Dokumentansicht, Liste)')
    pg = page(br); load(pg, ['weisung_de_demo.docx']); pg.evaluate('DP.ui.go("check")'); pg.wait_for_timeout(300)
    # J: erster offener Befund in Dokumentreihenfolge, Fokus auf der Stelle im Text, Werkzeugleiste zu
    pg.keyboard.press('j'); pg.wait_for_timeout(200)
    first = pg.evaluate('DP.state.sel'); f1 = pg.evaluate(FOCUS)
    check(first and f1 in ('chg-' + first, 'sel-' + first) and not pg.query_selector('#dvTb'), f'J wählt den ersten offenen Befund ({first}, Fokus {f1}), Leiste geschlossen')
    pg.keyboard.press('j'); pg.wait_for_timeout(200); second = pg.evaluate('DP.state.sel')
    pg.keyboard.press('k'); pg.wait_for_timeout(200)
    check(second != first and pg.evaluate('DP.state.sel') == first, 'J geht weiter, K zurück')
    # Gewählte Karte ist im Bild
    vis = pg.evaluate('''(id) => { const r = document.querySelector('.mc[data-id="' + id + '"]').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }''', first)
    check(vis, 'gewählte Randkarte im Bild')
    # A auf einem Befund ohne Vorschlag: Hinweis, kein Entscheid
    nofix = pg.evaluate('DP.ui.findings().find(f => !f.fix && f.para != null && DP.ui.stOf(f) === "open").id')
    fix = pg.evaluate('DP.ui.findings().filter(f => f.fix && f.para != null && DP.ui.stOf(f) === "open").map(f => f.id)')
    pg.evaluate('(id) => { DP.state.sel = id; DP.ui.render(); }', nofix); pg.wait_for_timeout(100)
    n0 = pg.evaluate(OPEN); pg.keyboard.press('a'); pg.wait_for_timeout(200)
    check(pg.evaluate(OPEN) == n0 and 'keinen Vorschlag' in pg.inner_text('#snacks'), 'A ohne Vorschlag: Hinweis statt Entscheid')
    # I ignoriert ihn; danach ist der nächste offene Befund gewählt und fokussiert
    pg.keyboard.press('i'); pg.wait_for_timeout(250)
    nxt = pg.evaluate('DP.state.sel')
    check(pg.evaluate(ST, nofix) == 'ignored' and nxt != nofix and pg.evaluate(ST, nxt) == 'open' and pg.evaluate(FOCUS) in ('chg-' + nxt, 'sel-' + nxt), f'I ignoriert, nächster offener Befund gewählt ({nxt}, Fokus {pg.evaluate(FOCUS)})')
    # U nimmt den Entscheid zurück und wählt den Befund wieder
    pg.keyboard.press('u'); pg.wait_for_timeout(250)
    check(pg.evaluate(ST, nofix) == 'open' and pg.evaluate('DP.state.sel') == nofix, 'U macht «Ignorieren» rückgängig')
    # A und R auf Vorschlägen
    pg.evaluate('(id) => { DP.state.sel = id; DP.ui.render(); }', fix[0]); pg.keyboard.press('a'); pg.wait_for_timeout(250)
    after_a = pg.evaluate('DP.state.sel'); fa = pg.evaluate(FOCUS)
    check(pg.evaluate(ST, fix[0]) == 'accepted' and after_a != fix[0] and pg.evaluate(ST, after_a) == 'open' and fa in ('chg-' + after_a, 'sel-' + after_a), f'A nimmt an; nächster offener Befund gewählt ({after_a}, Fokus {fa})')
    vis = pg.evaluate('''(id) => { const el = document.querySelector('.chg[data-id="' + id + '"]') || document.querySelector('.mc[data-id="' + id + '"]'); const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }''', after_a)
    check(vis, 'nach A ist der nächste Befund im Bild')
    pg.evaluate('(id) => { DP.state.sel = id; DP.ui.render(); }', fix[1]); pg.keyboard.press('r'); pg.wait_for_timeout(250)
    check(pg.evaluate(ST, fix[1]) == 'rejected', 'R lehnt ab')
    pg.keyboard.press('u'); pg.wait_for_timeout(200); pg.keyboard.press('u'); pg.wait_for_timeout(200)
    check(pg.evaluate(ST, fix[1]) == 'open' and pg.evaluate(ST, fix[0]) == 'open', 'U zweimal: beide Entscheide zurückgenommen (Stapel)')
    pg.keyboard.press('u'); pg.wait_for_timeout(200)
    check('rückgängig' in pg.inner_text('#snacks').lower(), 'U ohne weiteren Entscheid: Hinweis')
    # Rückgängig über die Meldung zählt mit: U überspringt den schon zurückgenommenen Entscheid
    pg.evaluate('(id) => { DP.state.sel = id; DP.ui.render(); }', nofix); pg.keyboard.press('i'); pg.wait_for_timeout(250); pg.click('[data-fid="snack-undo"]'); pg.wait_for_timeout(200)
    pg.keyboard.press('u'); pg.wait_for_timeout(200)
    check(pg.evaluate(ST, nofix) == 'open' and 'Es gibt keinen Entscheid' in pg.inner_text('#snacks'), 'U nach «Rückgängig» der Meldung tut nichts doppelt')
    # E öffnet die Bearbeitung; Tasten im Feld lösen nichts aus
    pg.evaluate('(id) => { DP.state.sel = id; DP.ui.render(); }', fix[0]); pg.keyboard.press('e'); pg.wait_for_timeout(200)
    check(pg.evaluate('document.activeElement.id') == 'm-fix-' + fix[0], 'E öffnet das Bearbeitungsfeld mit Fokus')
    n0 = pg.evaluate(OPEN); sel0 = pg.evaluate('DP.state.sel')
    pg.keyboard.press('End'); pg.keyboard.type('jkariue?'); pg.wait_for_timeout(200)
    check(pg.evaluate(OPEN) == n0 and pg.evaluate('DP.state.sel') == sel0 and pg.input_value(f'#m-fix-{fix[0]}').endswith('jkariue?') and not pg.evaluate('document.getElementById("dlg").open'), 'Tippen im Bearbeitungsfeld löst kein Kürzel aus')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    # Mit gedrückter Steuer-, Alt- oder Meta-Taste nichts
    for mod in ('Control', 'Alt', 'Meta'):
        pg.evaluate('(id) => { DP.state.sel = id; DP.ui.render(); document.querySelector("[data-fid=chg-" + id + "]").focus(); }', fix[0])
        pg.keyboard.press(f'{mod}+a'); pg.wait_for_timeout(100)
        check(pg.evaluate(ST, fix[0]) == 'open', f'{mod}+A löst nichts aus')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(100)
    # Enter auf der gewählten Stelle öffnet die Leiste (vorhandenes Verhalten)
    pg.evaluate('(id) => document.querySelector("[data-fid=chg-" + id + "]").focus()', fix[0]); pg.keyboard.press('Enter'); pg.wait_for_timeout(200)
    check(pg.query_selector('#dvTb') is not None, 'Enter auf der Stelle öffnet die Leiste'); pg.keyboard.press('Escape'); pg.wait_for_timeout(100)
    # ? öffnet die Übersicht; im Dialog wirken die Tasten nicht
    pg.keyboard.press('?'); pg.wait_for_selector('#dlg[open] [data-fid="kb-tab"]')
    rows = pg.evaluate('document.querySelectorAll("#dlg [data-fid=kb-tab] tbody tr").length')
    check(rows == 8 and pg.evaluate(FOCUS) == 'kb-close', f'? öffnet die Übersicht ({rows} Zeilen), Fokus auf «Schliessen»')
    sel0 = pg.evaluate('DP.state.sel'); pg.keyboard.press('j'); pg.keyboard.press('a'); pg.wait_for_timeout(150)
    check(pg.evaluate('DP.state.sel') == sel0 and pg.evaluate(ST, fix[0]) == 'open', 'im Dialog lösen J und A nichts aus')
    # Schalter aus: keine Kürzel mehr, auch nicht «?»; die Schaltfläche in der Leiste öffnet die Übersicht weiterhin
    pg.click('#kbOn'); pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    check(pg.evaluate('DP.state.keys') is False, 'Schalter schaltet die Kürzel aus')
    pg.evaluate('(id) => document.querySelector("[data-fid=chg-" + id + "]").focus()', fix[0]); pg.keyboard.press('a'); pg.keyboard.press('j'); pg.keyboard.press('?'); pg.wait_for_timeout(200)
    check(pg.evaluate(ST, fix[0]) == 'open' and pg.evaluate('DP.state.sel') == fix[0] and not pg.evaluate('document.getElementById("dlg").open'), 'ausgeschaltet: A, J und ? ohne Wirkung')
    pg.click('[data-fid="kb-help"]'); pg.wait_for_selector('#dlg[open] #kbOn')
    check(not pg.is_checked('#kbOn'), 'Schaltfläche in der Leiste öffnet die Übersicht, Schalter zeigt «aus»')
    pg.click('#kbOn'); pg.click('[data-fid="kb-close"]'); pg.wait_for_timeout(200)
    check(pg.evaluate(FOCUS) == 'kb-help', 'nach dem Schliessen Fokus zurück auf der Schaltfläche')
    # Liste: J und A wirken ebenso, Fokus auf den Schaltflächen der Karte
    pg.click('[data-fid="view-list"]'); pg.wait_for_timeout(200); pg.evaluate('DP.state.sel = null')
    pg.keyboard.press('j'); pg.wait_for_timeout(200); ls = pg.evaluate('DP.state.sel'); lf = pg.evaluate(FOCUS)
    first_card = pg.evaluate('(() => { const all = [...document.querySelectorAll(".find")]; const o = all.find(c => c.classList.contains("st-open")); return o && o.dataset.id; })()')
    check(ls == first_card and lf in ('acc-' + ls, 'dis-' + ls), f'Liste: J wählt die erste offene Karte der Liste ({ls}, Fokus {lf})')
    pg.keyboard.press('i' if not pg.evaluate('(id) => !!DP.ui.findings().find(f => f.id === id).fix', ls) else 'a'); pg.wait_for_timeout(250)
    check(pg.evaluate(ST, ls) != 'open' and pg.evaluate('DP.state.sel') != ls and pg.evaluate(FOCUS).endswith(pg.evaluate('DP.state.sel')), 'Liste: Entscheid, danach nächste Karte gewählt und fokussiert')
    pg.keyboard.press('u'); pg.wait_for_timeout(200); check(pg.evaluate(ST, ls) == 'open', 'Liste: U nimmt zurück')
    # Pflichtenmatrix: keine Kürzel
    pg.click('[data-fid="view-duty"]'); pg.wait_for_timeout(200); n0 = pg.evaluate(OPEN); pg.keyboard.press('j'); pg.keyboard.press('a'); pg.wait_for_timeout(150)
    check(pg.evaluate(OPEN) == n0, 'Pflichtenmatrix: keine Kürzel')
    pg.click('[data-fid="view-doc"]'); pg.wait_for_timeout(200)
    # Profilname (Kriterien): Tippen ändert nichts an den Befunden
    pg.evaluate('DP.ui.go("criteria")'); pg.wait_for_timeout(200); n0 = pg.evaluate(OPEN)
    pg.click('#profName'); pg.keyboard.press('End'); pg.keyboard.type('jaria'); pg.wait_for_timeout(100)
    check(pg.evaluate(OPEN) == n0 and pg.input_value('#profName').endswith('jaria'), 'Tippen im Profilnamen löst nichts aus')
    pg.evaluate('DP.ui.go("check")'); pg.wait_for_timeout(200)
    # Französisch: Übersicht in der Sprache der Oberfläche
    pg.evaluate('DP.ui.setLang("fr")'); pg.keyboard.press('?'); pg.wait_for_selector('#dlg[open]')
    check('Raccourcis clavier' in pg.inner_text('#dlg') and 'Accepte la proposition' in pg.inner_text('#dlg'), 'Übersicht auf Französisch')
    pg.keyboard.press('Escape'); pg.evaluate('DP.ui.setLang("de")')
    pg.context.close()

def rail(br):
    print('== Übersicht am Rand')
    pg = page(br); load(pg, ['weisung_de_demo.docx']); pg.evaluate('DP.ui.go("check")'); pg.wait_for_timeout(300)
    marks = pg.evaluate('DP.ui.rail()'); shown = pg.evaluate('DP.ui.findings().filter(f => !f.dismissed).length')
    check(marks is not None and len(marks) == shown, f'eine Marke je gezeigtem Befund ({len(marks or [])}/{shown})')
    # Klick auf eine allein stehende Marke wählt genau diesen Befund
    lone = [m for m in marks if all(abs(m['y'] - o['y']) > 9 for o in marks if o is not m)]
    box = pg.query_selector('#dvRail').bounding_box()
    target = lone[len(lone) // 2]
    pg.mouse.click(box['x'] + 6, box['y'] + target['y']); pg.wait_for_timeout(300)
    check(pg.evaluate('DP.state.sel') == target['id'], f'Klick auf die Marke wählt {target["id"]} (gewählt {pg.evaluate("DP.state.sel")})')
    vis = pg.evaluate('''(id) => { const el = document.querySelector('.chg[data-id="' + id + '"]') || document.querySelector('.mc[data-id="' + id + '"]'); const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }''', target['id'])
    check(vis, 'die Stelle ist danach im Bild')
    # Barrierefreiheitsbaum: genau ein Element (Schieberegler mit Namen und Wert)
    snap = pg.locator('#dvRail').aria_snapshot()
    lines = [l for l in snap.splitlines() if l.strip().startswith('- ')]
    check(len(lines) == 1 and 'slider' in lines[0], f'ein Element im Barrierefreiheitsbaum: {lines}')
    vt = pg.get_attribute('#dvRail', 'aria-valuetext'); check(vt and re.match(r'\d+ von \d+: ', vt), f'Wert in Worten: {vt}')
    # Tastatur: Pfeil nach unten wählt den nächsten Befund, Fokus bleibt auf der Übersicht
    pg.focus('#dvRail'); s0 = pg.evaluate('DP.state.sel'); pg.keyboard.press('ArrowDown'); pg.wait_for_timeout(250)
    check(pg.evaluate('DP.state.sel') != s0 and pg.evaluate('document.activeElement.id') == 'dvRail', 'Pfeiltaste wählt den nächsten Befund, Fokus bleibt')
    pg.keyboard.press('Enter'); pg.wait_for_timeout(150); sel = pg.evaluate('DP.state.sel')
    check(pg.evaluate(FOCUS) in ('chg-' + sel, 'sel-' + sel), 'Enter springt zur Stelle')
    # Filter: nur Fehler
    pg.click('[data-fid="f-error"]'); pg.wait_for_timeout(200)
    n_err = pg.evaluate('DP.ui.findings().filter(f => !f.dismissed && f.sev === "error").length')
    check(len(pg.evaluate('DP.ui.rail()')) == n_err, f'Filter «Fehler»: {n_err} Marken')
    pg.click('[data-fid="f-all"]'); pg.wait_for_timeout(200)
    # Entscheid ohne Neuaufbau der Ansicht: Marke wird blass
    fx = pg.evaluate('DP.ui.findings().find(f => f.fix && f.para != null && DP.ui.stOf(f) === "open").id')
    pg.evaluate('document.querySelector(".dv-rows").dataset.keep = "1"')
    pg.evaluate('(id) => document.querySelector("[data-fid=chg-" + id + "]").click()', fx); pg.click('[data-fid="tb-acc"]'); pg.wait_for_timeout(200)
    m = [x for x in pg.evaluate('DP.ui.rail()') if x['id'] == fx]
    check(m and m[0]['done'] and pg.evaluate('document.querySelector(".dv-rows").dataset.keep') == '1', 'Entscheid: Marke erledigt, ohne Neuaufbau der Ansicht')
    # Unter 1056 px ausgeblendet (auch aus dem Barrierefreiheitsbaum)
    pg.set_viewport_size({'width': 1000, 'height': 800}); pg.wait_for_timeout(200)
    check(not pg.is_visible('#dvRail') and not pg.is_visible('#dvLink'), 'unter 1056 px: keine Übersicht, keine Linie')
    pg.context.close()
    # Grosses Dokument: Übersicht zeichnet 3600 Befunde, ohne Elementflut
    pg = page(br); load(pg, ['gross_de.docx']); pg.evaluate('DP.ui.go("check")'); pg.wait_for_timeout(300)
    t = pg.evaluate('(() => { const t = performance.now(); for (let k = 0; k < 5; k++) DP.ui.render(); return (performance.now() - t) / 5; })()')
    n = len(pg.evaluate('DP.ui.rail()')); kids = pg.evaluate('document.querySelectorAll("#dvRail *").length')
    check(n > 3000 and kids == 2, f'Grossdokument: {n} Marken auf einer Zeichenfläche ({kids} Elemente in der Übersicht), Render {round(t)} ms')
    pg.context.close()

def connector(br):
    print('== Verbindungslinie')
    pg = page(br); load(pg, ['weisung_de_demo.docx']); pg.evaluate('DP.ui.go("check")'); pg.wait_for_timeout(300)
    check(not pg.is_visible('#dvLink'), 'ohne Auswahl keine Linie')
    fx = pg.evaluate('DP.ui.findings().find(f => f.fix && f.para != null && DP.ui.stOf(f) === "open").id')
    pg.click(f'#mct-{fx}'); pg.wait_for_timeout(500)
    check(pg.is_visible('#dvLink'), 'gewählt, Karte und Stelle im Bild: Linie sichtbar')
    geo = pg.evaluate('''(id) => { const l = [...document.querySelectorAll('#dvLink > span')].map(s => s.getBoundingClientRect()); const c = document.querySelector('.chg[data-id="' + id + '"]').getClientRects()[0], k = document.querySelector('.mc[data-id="' + id + '"]').getBoundingClientRect();
      const p = document.querySelector('.chg[data-id="' + id + '"]').closest('.dv-p'), pr = p.getBoundingClientRect(), pad = parseFloat(getComputedStyle(p).paddingRight);
      return { y0: Math.abs(l[0].top - (c.top + c.height / 2)) <= 1, y1: Math.abs(l[2].top - (k.top + 16)) <= 1, end: Math.abs(l[2].right - k.left) <= 1, clear: l[0].left >= pr.right - pad, events: getComputedStyle(document.getElementById('dvLink')).pointerEvents }; }''', fx)
    check(geo['y0'] and geo['y1'] and geo['end'] and geo['clear'] and geo['events'] == 'none', f'Linie von der Textzeile zur Karte, ausserhalb des Textes, ohne Zeigerereignisse: {geo}')
    # Werkzeugleiste offen: kein Teil der Linie über der Leiste
    pg.evaluate('(id) => document.querySelector("[data-fid=chg-" + id + "]").click()', fx); pg.wait_for_selector('#dvTb'); pg.wait_for_timeout(200)
    over = pg.evaluate('''() => { const t = document.getElementById('dvTb').getBoundingClientRect(); return [...document.querySelectorAll('#dvLink > span')].some(s => { const r = s.getBoundingClientRect(); return r.right > t.left && r.left < t.right && r.bottom > t.top && r.top < t.bottom; }); }''')
    check(not over, 'Linie überdeckt die Werkzeugleiste nicht')
    pg.screenshot(path=os.path.join(SHOTS, 'f1440_connector_toolbar.png'))
    pg.keyboard.press('Escape')
    # Aus dem Bild gerollt: keine Linie; zurück: wieder da
    pg.evaluate('document.querySelector("main").scrollTop = 1e6'); pg.wait_for_timeout(200)
    check(not pg.is_visible('#dvLink'), 'Stelle ausserhalb des Bildes: keine Linie')
    pg.evaluate('(id) => document.querySelector(".chg[data-id=\\"" + id + "\\"]").scrollIntoView({block: "center"})', fx); pg.wait_for_timeout(200)
    check(pg.is_visible('#dvLink'), 'zurück im Bild: Linie wieder da')
    pg.click(f'#mct-{fx}'); pg.wait_for_timeout(200)
    check(not pg.is_visible('#dvLink'), 'Auswahl aufgehoben: keine Linie')
    pg.context.close()

def transitions(br):
    print('== Übergänge im Text')
    def run(motion):
        pg = page(br, motion=motion); load(pg, ['weisung_de_demo.docx']); pg.evaluate('DP.ui.go("check")'); pg.wait_for_timeout(900)
        fx = pg.evaluate('DP.ui.findings().filter(f => f.fix && f.para != null && DP.ui.stOf(f) === "open").map(f => f.id)')
        ign = pg.evaluate('DP.ui.findings().find(f => !f.fix && f.para != null && f.start != null && DP.ui.stOf(f) === "open").id')
        seen = []
        def act(id, fid):
            pg.evaluate('(id) => { const c = document.querySelector("[data-fid=chg-" + id + "]"); c.scrollIntoView({block: "center"}); c.click(); }', id); pg.wait_for_selector('#dvTb')
            pg.click(f'[data-fid="{fid}"]'); pg.wait_for_timeout(40)
            seen.append([pg.evaluate(OUR), pg.evaluate('document.querySelectorAll(".a-ghost, .a-run, .a-grow, .a-unset, .st-anim").length'), pg.evaluate('(id) => { const f = DP.ui.findings().find(x => x.id === id); return document.querySelector(".dv-row[data-row=\\"" + f.para + "\\"] > .dv-p").textContent; }', id)])
            if motion and fid == 'tb-acc' and id == fx[0]:
                pg.screenshot(path=os.path.join(SHOTS, 'f1440_trans_accept_1.png')); pg.wait_for_timeout(80); pg.screenshot(path=os.path.join(SHOTS, 'f1440_trans_accept_2.png'))
            pg.wait_for_timeout(500)
        # Abgelehnt und ignoriert verschwinden aus dem Text (Übergang auf dem Text selbst); mit «Ausgeblendete zeigen» bleiben sie stehen
        act(fx[0], 'tb-acc'); act(fx[1], 'tb-rej'); act(fx[0], 'tb-rst'); act(ign, 'tb-ign')
        pg.click('[data-fid="f-hidden"]'); pg.wait_for_timeout(200)
        act(fx[1], 'tb-rst'); act(fx[2], 'tb-rej'); act(fx[2], 'tb-rst'); act(ign, 'tb-ign')
        pg.wait_for_timeout(300)
        dom = pg.evaluate('[...document.querySelectorAll(".dv-row")].map(r => r.querySelector(".dv-p") ? r.querySelector(".dv-p").outerHTML : "").join("\\n") + [...document.querySelectorAll(".mc")].map(c => c.outerHTML.replace(/ style="[^"]*"/g, "")).join("\\n")')
        texts = pg.evaluate('[...document.querySelectorAll(".dv-p")].map(p => p.textContent).join("\\n")')
        # Sammelentscheid: nichts bewegt sich
        pg.click('[data-fid="bulk-all"]'); pg.wait_for_timeout(30); bulk = [pg.evaluate(OUR), pg.evaluate('document.querySelectorAll(".a-ghost, .a-run, .st-anim").length')]
        pg.context.close(); return dom, texts, seen, bulk
    d0, t0, s0, b0 = run(False); d1, t1, s1, b1 = run(True)
    check(all(not x[0] and not x[1] for x in s0), f'reduzierte Bewegung: keine Animation, keine Hilfselemente ({s0[0][:2]})')
    check(any(x[1] for x in s1) and any(x[0] for x in s1), f'mit Bewegung: Übergang läuft ({[x[0] for x in s1][:3]})')
    check(all(a[2] == b[2] for a, b in zip(s0, s1)), 'Text der Absätze schon während des Übergangs gleich wie ohne Bewegung')
    check(d0 == d1 and t0 == t1, 'Endzustand (Absätze und Randkarten) gleich wie ohne Bewegung')
    check(not b1[0] and not b1[1] and not b0[0], f'Sammelentscheid ohne Übergang ({b1})')

def countup(br):
    print('== Ergebnis: Hochzählen')
    pg = page(br, motion=True); load(pg, ['weisung_de_demo.docx', 'weisung_fr_errors.docx'])
    pg.evaluate('DP.state.cur = DP.state.docs[0].id; DP.ui.go("check")')
    now = pg.evaluate('[document.querySelector(".ring").getAttribute("aria-label"), document.querySelector(".ring .mid span").firstChild.textContent, [...document.querySelectorAll(".summary .stat b")].map(b => b.textContent), document.querySelectorAll(".summary .cnt").length]')
    pct = re.search(r'\d+', now[0]).group()
    check(now[1] == pct and now[3] >= 2, f'Endwert sofort im DOM ({now[1]} %, Kennzahlen {now[2]}), Hochzählen läuft ({now[3]} Zahlen)')
    pg.screenshot(path=os.path.join(SHOTS, 'f1440_countup_1.png'), clip={'x': 0, 'y': 80, 'width': 1440, 'height': 360})
    pg.wait_for_timeout(250); pg.screenshot(path=os.path.join(SHOTS, 'f1440_countup_2.png'), clip={'x': 0, 'y': 80, 'width': 1440, 'height': 360})
    pg.wait_for_timeout(700)
    end = pg.evaluate('[document.querySelectorAll(".cnt").length, document.querySelector(".ring .bar").getAttribute("stroke-dashoffset"), [...document.querySelectorAll(".summary .stat b")].map(b => b.outerHTML)]')
    check(end[0] == 0 and all('class' not in b and 'style' not in b for b in end[2]), 'nach dem Hochzählen: Zahlen ohne Hilfsklassen')
    off = round(2 * 3.141592653589793 * 54 * (1 - int(pct) / 100), 1)
    check(abs(float(end[1]) - off) < 0.2, f'Ring am Endwert ({end[1]} / {off})')
    # Nicht bei Dokumentwechsel, nicht nach Rückkehr, nicht nach einem Entscheid
    pg.click(f'[data-fid="tab-{pg.evaluate("DP.state.docs[1].id")}"]'); pg.wait_for_timeout(30)
    n_tab2 = pg.evaluate('document.querySelectorAll(".cnt").length'); pg.wait_for_timeout(800)
    pg.click(f'[data-fid="tab-{pg.evaluate("DP.state.docs[0].id")}"]'); pg.wait_for_timeout(30)
    check(pg.evaluate('document.querySelectorAll(".cnt").length') == 0, 'zurück zum ersten Dokument: kein erneutes Hochzählen')
    check(n_tab2 > 0, 'erstes Ergebnis des zweiten Dokuments zählt einmal hoch')
    pg.evaluate('DP.ui.go("export")'); pg.evaluate('DP.ui.go("check")'); pg.wait_for_timeout(30)
    check(pg.evaluate('document.querySelectorAll(".cnt").length') == 0, 'Seitenwechsel: kein erneutes Hochzählen')
    fx = pg.evaluate('DP.ui.findings().find(f => f.fix && f.para != null && DP.ui.stOf(f) === "open").id')
    pg.evaluate('(id) => document.querySelector("[data-fid=chg-" + id + "]").click()', fx); pg.click('[data-fid="tb-acc"]'); pg.wait_for_timeout(30)
    check(pg.evaluate('document.querySelectorAll(".cnt").length') == 0, 'Entscheid: Zahl springt direkt')
    # Neue Fassung: Hochzählen einmal
    pg.evaluate('DP.ui.go("docs")'); pg.set_input_files('#file', [os.path.join(FX, 'weisung_de_demo_v2.docx')]); pg.wait_for_selector('#dlg[open] [data-fid="ver-version"]'); pg.click('[data-fid="ver-version"]')
    pg.wait_for_function('!DP.state.busy && Object.keys(DP.state.versions).length === 1'); pg.evaluate('DP.ui.go("check")'); pg.wait_for_timeout(30)
    check(pg.evaluate('document.querySelectorAll(".summary .cnt").length') > 0, 'neue Fassung: Hochzählen einmal')
    pg.context.close()
    pg = page(br); load(pg, ['weisung_de_demo.docx']); pg.evaluate('DP.ui.go("check")'); pg.wait_for_timeout(30)
    check(pg.evaluate('document.querySelectorAll(".cnt, .ring.count").length') == 0, 'reduzierte Bewegung: kein Hochzählen')
    pg.context.close()

def drop_and_fade(br):
    print('== Ablage über dem Fenster, Seitenwechsel')
    pg = page(br, motion=True)
    pg.evaluate('''() => { const dt = new DataTransfer(); dt.items.add(new File(["x"], "a.docx")); window.__dt = dt; document.querySelector("main").dispatchEvent(new DragEvent("dragenter", {bubbles: true, dataTransfer: dt})); }''')
    check(pg.evaluate('document.getElementById("drop").classList.contains("over")'), 'Datei über dem Fenster: Ablagefläche hervorgehoben')
    pg.evaluate('window.dispatchEvent(new DragEvent("dragleave", {dataTransfer: window.__dt}))')
    check(not pg.evaluate('document.getElementById("drop").classList.contains("over")'), 'Fenster verlassen: Hervorhebung weg')
    pg.click('[data-fid="nav-help"]'); fade = pg.evaluate('document.querySelector(".page").classList.contains("fade-in")')
    check(fade and pg.evaluate('document.activeElement.id') == 'view', 'Seitenwechsel blendet ein, Fokus auf dem Inhaltsbereich')
    pg.context.close()

def shots(br):
    print('== Screenshots')
    for w, h in ((1440, 900), (375, 812)):
        for lang in ('de', 'fr'):
            pg = page(br, w, h); load(pg, ['weisung_de_demo.docx'])
            pg.evaluate(f'DP.ui.setLang("{lang}"); DP.ui.go("check")'); pg.wait_for_timeout(300)
            fx = pg.evaluate('DP.ui.findings().filter(f => f.fix && f.para != null).map(f => f.id)')[1]
            pg.click(f'#mct-{fx}'); pg.wait_for_timeout(300); pg.evaluate('(id) => document.querySelector(".chg[data-id=\\"" + id + "\\"]").scrollIntoView({block: "center"})', fx); pg.wait_for_timeout(300)
            pg.mouse.move(2, h - 2); pg.screenshot(path=os.path.join(SHOTS, f'f{w}_rail_connector_{lang}.png'))
            pg.evaluate('document.querySelector("main").scrollTop = 0'); pg.wait_for_timeout(200); pg.screenshot(path=os.path.join(SHOTS, f'f{w}_bar_{lang}.png'))
            if w < 672:
                check(not pg.is_visible('[data-fid="kb-help"]'), f'unter 672 px keine Schaltfläche für Tastenkürzel ({lang})')
                pg.evaluate('document.getElementById("view").focus()'); pg.keyboard.press('?')
            else: pg.click('[data-fid="kb-help"]')
            pg.wait_for_selector('#dlg[open]'); pg.wait_for_timeout(200); pg.screenshot(path=os.path.join(SHOTS, f'f{w}_kbdialog_{lang}.png'))
            ov = pg.evaluate('(() => { const d = document.getElementById("dlg"); return d.scrollWidth > d.clientWidth + 1; })()')
            check(not ov, f'Dialog ohne waagrechten Überlauf {w} {lang}')
            pg.keyboard.press('Escape')
            pg.evaluate('DP.ui.go("help")'); pg.wait_for_timeout(300); pg.evaluate('document.getElementById("gKbRv").scrollIntoView({block: "start"})'); pg.wait_for_timeout(200)
            pg.screenshot(path=os.path.join(SHOTS, f'f{w}_guide_keys_{lang}.png'))
            pg.context.close()

if __name__ == '__main__':
    serve(8776)
    with sync_playwright() as pw:
        br = launch(pw)
        for fn in (shortcuts, rail, connector, transitions, countup, drop_and_fade, shots):
            try: fn(br)
            except Exception as e:
                import traceback; traceback.print_exc(); errors.append(fn.__name__ + ': ' + str(e).splitlines()[0])
        br.close()
    print('FEHLER:', errors if errors else 'keine')
    sys.exit(1 if errors else 0)
