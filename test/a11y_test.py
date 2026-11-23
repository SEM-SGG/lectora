"""Barrierefreiheit (axe-core, WCAG 2.1 A/AA und Best Practice) in allen Ansichten und Zuständen der Testausgabe, der KI-Funktionen
(simuliert), der Offline-Ausgabe (mit Hinweis auf eine neue Version) und auf GitHub Pages (Hinweis, Sperrdialog und Rückfrage zu
Dokumenten mit Klassifizierungsvermerk); zum Schluss die Leistung bei einem grossen
Dokument (ein Entscheid < 300 ms im Median). Jede Zeile «… Verstösse: …» muss leer sein; Exit-Code 1 sonst."""
import sys, os, json, time, builtins
sys.path.insert(0, os.path.dirname(__file__))
from engine_test import *
AXE = open(os.path.join(ROOT, 'node_modules/axe-core/axe.min.js'), encoding='utf-8').read()
serve(8771)
# Jede Ausgabe «… Verstösse: <Liste oder Zahl>» wird mitgezählt: eine nicht leere Liste oder eine Zahl > 0 ist ein Fehler
VIOL = []
def print(*a, **k):
    for i, x in enumerate(a[:-1]):
        if isinstance(x, str) and x.rstrip().endswith('Verstösse:'):
            v = a[i + 1]
            if (isinstance(v, list) and v) or (isinstance(v, int) and v > 0): VIOL.append(x.strip() + ' ' + repr(v)[:200])
    builtins.print(*a, **k)
with sync_playwright() as pw:
    br = launch(pw)
    for theme in ('light',):
        pg = br.new_page(viewport={'width': 1280, 'height': 900}, locale='fr-CH'); pg.on('pageerror', lambda e: print('[pageerror]', e))
        pg.goto(url(8771) + '/dist-local/index.html'); pg.wait_for_timeout(500)
        print(theme, 'Startsprache aus Browser:', pg.evaluate('DP.state.lang'), pg.evaluate('document.documentElement.lang'))
        pg.set_input_files('#file', [os.path.join(FX, n) for n in ('weisung_de_demo.docx', 'weisung_fr_errors.docx', 'weisung_de_flawed.pdf', 'praesentation_de.pptx', 'weisung_it_clean.docx')])
        pg.wait_for_function('DP.state.docs.length === 5 && !DP.state.busy', timeout=30000)
        pg.evaluate(AXE)
        for route in ('docs', 'check', 'compare', 'export', 'criteria', 'help'):
            pg.evaluate(f'DP.ui.go("{route}")'); pg.wait_for_timeout(1200)
            res = pg.evaluate('axe.run(document, {runOnly: {type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"]}}).then(r => r.violations.map(v => ({id: v.id, impact: v.impact, n: v.nodes.length, ex: v.nodes.slice(0, 2).map(n => n.html.slice(0, 140) + " :: " + (n.any[0] ? n.any[0].message : (n.all[0] ? n.all[0].message : "")).slice(0, 160))})))')
            print(' ', route, 'Verstösse:', len(res))
            for v in res: print('    ', v['id'], v['impact'], v['n'], v['ex'])
        # Prüfansicht in weiteren Zuständen: Werkzeugleiste offen, Entscheide gefällt, PDF mit Kopierknöpfen, Liste
        AXE_RUN = 'axe.run(document, {runOnly: {type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"]}}).then(r => r.violations.map(v => v.id + " " + v.nodes.length + " " + v.nodes[0].html.slice(0, 120)))'
        pg.evaluate('DP.ui.go("check")'); pg.wait_for_timeout(800)
        pg.click('.chg.c-open > :is(del, ins)'); pg.wait_for_selector('#dvTb'); pg.wait_for_timeout(300)
        print('  check+toolbar Verstösse:', pg.evaluate(AXE_RUN))
        pg.click('[data-fid="tb-acc"]'); pg.click('[data-fid="f-hidden"]'); pg.wait_for_timeout(300)
        pg.click('.chg.c-open > :is(del, ins)'); pg.click('[data-fid="tb-rej"]'); pg.wait_for_timeout(300)
        print('  check+entschieden Verstösse:', pg.evaluate(AXE_RUN))
        pg.click('.mc:not(.sel) .mc-title'); pg.wait_for_timeout(300)
        print('  check+Randkarte aufgeklappt Verstösse:', pg.evaluate(AXE_RUN))
        pg.click('[data-fid="f-info"]'); pg.wait_for_timeout(300); print('  check+Filter Verstösse:', pg.evaluate(AXE_RUN)); pg.click('[data-fid="f-info"]'); pg.wait_for_timeout(300)
        # Überarbeiten: Tastenkürzel (J, Übersicht offen), Übersicht am Rand mit Fokus, Verbindungslinie
        pg.evaluate('DP.state.sel = null; DP.state.tb = null; DP.ui.render(); document.getElementById("view").focus()'); pg.keyboard.press('j'); pg.wait_for_timeout(300)
        print('  check+Kürzel J, Linie Verstösse:', pg.evaluate(AXE_RUN), '| Linie sichtbar:', pg.is_visible('#dvLink'))
        pg.focus('#dvRail'); pg.keyboard.press('ArrowDown'); pg.wait_for_timeout(300)
        print('  check+Übersicht am Rand Verstösse:', pg.evaluate(AXE_RUN), '| exponiert:', [l for l in pg.locator('#dvRail').aria_snapshot().splitlines() if l.strip().startswith('- ')])
        pg.keyboard.press('?'); pg.wait_for_selector('#dlg[open] #kbOn'); pg.wait_for_timeout(300)
        print('  check+Tastenkürzel-Dialog Verstösse:', pg.evaluate(AXE_RUN)); pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
        pg.evaluate('DP.state.cur = DP.state.docs.find(d => d.format === "pdf").id; DP.ui.go("check")'); pg.wait_for_timeout(600); pg.click('[data-fid="bulk-all"]'); pg.wait_for_timeout(400)
        print('  check PDF Verstösse:', pg.evaluate(AXE_RUN))
        pg.evaluate('DP.ui.go("export")'); pg.wait_for_timeout(800); print('  export PDF Verstösse:', pg.evaluate(AXE_RUN))
        # Export mit Kommentaren: PowerPoint, Meldung bei verschlüsselter PDF-Datei, Dialog bei signierter PDF-Datei
        pg.evaluate('DP.state.cur = DP.state.docs.find(d => d.format === "pptx").id; DP.ui.go("export")'); pg.wait_for_timeout(600); print('  export PowerPoint Verstösse:', pg.evaluate(AXE_RUN))
        pg.evaluate('(() => { const d = DP.state.docs.find(d => d.format === "pdf"); d.annErr = "encrypted"; DP.state.cur = d.id; DP.ui.go("export"); })()'); pg.wait_for_timeout(600); print('  export PDF verschlüsselt Verstösse:', pg.evaluate(AXE_RUN))
        pg.evaluate('DP.state.docs.find(d => d.format === "pdf").annErr = null')
        pg.set_input_files('#file', [os.path.join(FX, 'weisung_de_signiert.pdf')]); pg.wait_for_timeout(1500)
        if pg.query_selector('#dlg[open] [data-fid="ver-separate"]'): pg.click('[data-fid="ver-separate"]')
        pg.wait_for_function('DP.state.docs.length === 6 && !DP.state.busy', timeout=30000)
        pg.evaluate('DP.state.cur = DP.state.docs[5].id; DP.ui.go("export")'); pg.wait_for_timeout(400); pg.click('[data-fid="dl-annot"]'); pg.wait_for_selector('#dlg[open] [data-fid="sig-go"]', timeout=30000); pg.wait_for_timeout(400)
        print('  Dialog signierte PDF-Datei Verstösse:', pg.evaluate(AXE_RUN)); pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
        pg.evaluate('DP.state.docs.splice(5, 1); DP.state.cur = DP.state.docs[0].id; DP.ui.render()')
        pg.evaluate('DP.ui.go("check")'); pg.wait_for_timeout(500); pg.click('[data-fid="view-list"]'); pg.wait_for_timeout(800)
        print('  check Liste Verstösse:', pg.evaluate(AXE_RUN))
        pg.evaluate('DP.state.sel = null; document.getElementById("view").focus()'); pg.keyboard.press('j'); pg.wait_for_timeout(300); print('  check Liste+Kürzel J Verstösse:', pg.evaluate(AXE_RUN))
        # Kriterienkatalog aufgeklappt mit geändertem Parameter; Prüfansicht mit Hinweis; Kurzinfo sichtbar
        pg.evaluate('DP.ui.go("criteria")'); pg.wait_for_timeout(500); pg.click('[data-fid="crit-open-all"]'); pg.wait_for_timeout(300)
        pg.fill('#par-L01-note', '20'); pg.press('#par-L01-note', 'Enter'); pg.wait_for_timeout(400)
        print('  criteria aufgeklappt+Parameter Verstösse:', pg.evaluate(AXE_RUN))
        pg.focus('#par-L01-note'); pg.keyboard.press('Tab'); pg.wait_for_timeout(200)
        print('  criteria+Kurzinfo sichtbar:', pg.is_visible('#tip'), 'Verstösse:', pg.evaluate(AXE_RUN))
        pg.evaluate('DP.ui.go("check")'); pg.wait_for_timeout(600); print('  check+Parameterhinweis Verstösse:', pg.evaluate(AXE_RUN))
        # Vergleich «Alle drei» (DE, FR, IT) mit allen Zeilen, eigene Erlasse mit ungültiger Zeile
        TRI = 'DP.state.ref = DP.state.docs[0].id; DP.state.tgt = DP.state.docs[1].id; DP.state.tgt2 = DP.state.docs[4].id; DP.state.cmpMode = "tri"; DP.state.cmpOnly = false; DP.ui.go("compare")'
        pg.evaluate(TRI); pg.wait_for_timeout(800); print('  compare tri 1280 Verstösse:', pg.evaluate(AXE_RUN))
        pg.evaluate('DP.state.critOpen = new Set(["custom"]); DP.state.settings.actsText = "999.1; ABC; DEF; GHI\\nx"; DP.ui.go("criteria")'); pg.wait_for_timeout(500); print('  criteria eigene Erlasse Verstösse:', pg.evaluate(AXE_RUN))
        pg.evaluate('DP.state.settings.actsText = ""')
        pg.set_viewport_size({'width': 400, 'height': 800}); pg.evaluate(TRI); pg.wait_for_timeout(800); print('  compare tri 400px Verstösse:', pg.evaluate(AXE_RUN))
        pg.evaluate('DP.state.cmpMode = "pair"; DP.state.cmpOnly = true')
        pg.set_viewport_size({'width': 400, 'height': 800}); pg.evaluate('DP.ui.go("help")'); pg.wait_for_timeout(800); print('  help 400px Verstösse:', pg.evaluate(AXE_RUN))
        pg.evaluate('DP.ui.go("criteria")'); pg.wait_for_timeout(800); print('  criteria 400px Verstösse:', pg.evaluate(AXE_RUN))
        pg.evaluate('DP.state.cur = DP.state.docs[0].id; DP.ui.go("check")'); pg.wait_for_timeout(800); print('  check 400px Verstösse:', pg.evaluate(AXE_RUN))
        # Arbeitswerkzeug: Profilband, Profildialog, Kopierdialog (ohne Downloads), Rückfrage neue Fassung, Nachprüfung, Fehlalarm, Rückmeldung
        import json as _j
        os.makedirs(os.path.join(ROOT, 'test', 'out'), exist_ok=True); pf = os.path.join(ROOT, 'test', 'out', 'a11y_profil.json')
        open(pf, 'w', encoding='utf-8').write(_j.dumps({'format': 'lectora-profil', 'schema': 1, 'name': 'Team', 'settings': {'off': ['L06', 'Z99'], 'params': {'L01.note': 500}}}))
        for vw in (1280, 400):
            pg.set_viewport_size({'width': vw, 'height': 900 if vw > 1000 else 800})
            pg.evaluate('DP.ui.go("criteria")'); pg.wait_for_timeout(400); print(f'  criteria Profilband {vw}px Verstösse:', pg.evaluate(AXE_RUN))
            pg.set_input_files('#profFile', [pf]); pg.wait_for_selector('#dlg[open] [data-fid="prof-apply"]'); pg.wait_for_timeout(300); print(f'  Profildialog {vw}px Verstösse:', pg.evaluate(AXE_RUN)); pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
            pg.click('[data-fid="prof-save"]'); pg.wait_for_selector('#dlg[open] #copyText'); pg.wait_for_timeout(300); print(f'  Kopierdialog {vw}px Verstösse:', pg.evaluate(AXE_RUN)); pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
        pg.set_viewport_size({'width': 1280, 'height': 900})
        pg.evaluate('DP.ui.go("docs")'); pg.wait_for_timeout(300)
        pg.set_input_files('#file', [os.path.join(FX, 'weisung_de_demo_v2.docx')]); pg.wait_for_selector('#dlg[open] [data-fid="ver-version"]'); pg.wait_for_timeout(300)
        print('  Rückfrage neue Fassung Verstösse:', pg.evaluate(AXE_RUN)); pg.click('[data-fid="ver-version"]'); pg.wait_for_function('!DP.state.busy && Object.keys(DP.state.versions).length === 1'); pg.wait_for_timeout(300)
        print('  docs mit Fassung Verstösse:', pg.evaluate(AXE_RUN))
        pg.evaluate('DP.ui.go("check")'); pg.wait_for_timeout(600); print('  check Nachprüfung Verstösse:', pg.evaluate(AXE_RUN))
        pg.click('[data-fid="f-rc-new"]'); pg.wait_for_timeout(300); pg.click('[data-fid="view-list"]'); pg.wait_for_timeout(400); print('  check Nachprüfung Filter neu, Liste Verstösse:', pg.evaluate(AXE_RUN))
        pg.click('[data-fid="f-all"]'); pg.wait_for_timeout(300)
        fa = pg.evaluate('document.querySelector("[data-fid^=\'fa-\']").dataset.fid'); pg.click(f'[data-fid="{fa}"]'); pg.wait_for_timeout(300)
        if not pg.evaluate('DP.state.filter.hidden'): pg.click('[data-fid="f-hidden"]'); pg.wait_for_timeout(300)
        print('  check Fehlalarm mit Notiz Verstösse:', pg.evaluate(AXE_RUN))
        pg.click('[data-fid="view-doc"]'); pg.wait_for_timeout(400); pg.click(f'#mct-{fa[3:]}'); pg.wait_for_timeout(300); print('  check Randkarte Fehlalarm aufgeklappt Verstösse:', pg.evaluate(AXE_RUN))
        pg.evaluate('DP.ui.go("export")'); pg.wait_for_timeout(500); print('  export Rückmeldung Verstösse:', pg.evaluate(AXE_RUN))
        pg.evaluate('DP.state.critOpen = new Set(["lang", "typo"]); DP.ui.go("criteria")'); pg.wait_for_timeout(400); print('  criteria Fehlalarmzähler Verstösse:', pg.evaluate(AXE_RUN))
        pg.close()
    # KI-Funktionen (simuliertes window.claude): Zustimmungen, Pflichtenmatrix mit Lücken und Abgleich, Formulierungsvorschlag
    # (mit Warnung, verworfen, in Arbeit), Rückübersetzung mit Hinweisen und offenem Notizfeld; 1280 und 400 px
    from ui_test import MOCK
    for vw, vh in ((1280, 900), (400, 800)):
        pg = br.new_page(viewport={'width': vw, 'height': vh}, locale='de-CH'); pg.add_init_script(MOCK); pg.on('pageerror', lambda e: print('[pageerror]', e))
        pg.goto(url(8771) + '/dist-local/index.html'); pg.wait_for_timeout(500); pg.evaluate(AXE)
        pg.set_input_files('#file', [os.path.join(FX, n) for n in ('weisung_de_demo.docx', 'weisung_fr_errors.docx', 'weisung_it_clean.docx')]); pg.wait_for_function('DP.state.docs.length === 3 && !DP.state.busy', timeout=30000); pg.wait_for_timeout(300)
        pg.evaluate('DP.state.cur = "d1"; DP.state.view = "duty"; DP.ui.go("check")'); pg.wait_for_timeout(400)
        print(f'  KI Pflichten leer {vw}px Verstösse:', pg.evaluate(AXE_RUN))
        pg.click('[data-fid="aiDuty-all"]'); pg.wait_for_selector('#dlg[open]'); pg.wait_for_timeout(300); print(f'  KI Zustimmung Matrix (alle) {vw}px Verstösse:', pg.evaluate(AXE_RUN)); pg.click('[data-fid="aiask-ok"]')
        pg.wait_for_function('["d1","d2","d3"].every(id => DP.state.duty[id] && DP.state.duty[id].state === "done")', timeout=20000); pg.wait_for_timeout(300)
        print(f'  KI Pflichtenmatrix und Abgleich {vw}px Verstösse:', pg.evaluate(AXE_RUN))
        pg.click('[data-fid="duty-f-gaps"]'); pg.click('[data-fid="duty-sort-due"]'); pg.click('[data-fid="duty-syn-all"]'); pg.wait_for_timeout(300); print(f'  KI Matrix Lücken, sortiert, Synopse vollständig {vw}px Verstösse:', pg.evaluate(AXE_RUN))
        pg.click('[data-fid="duty-f-all"]'); pg.wait_for_timeout(200); pg.click('[data-fid="dj-1"]'); pg.wait_for_timeout(400); print(f'  KI Sprung zur Stelle {vw}px Verstösse:', pg.evaluate(AXE_RUN))
        pg.evaluate('window.__mock.duty = "rate"'); pg.evaluate('DP.state.view = "duty"; DP.ui.render()'); pg.click('[data-fid="aiDuty-go"]'); pg.wait_for_selector('#dlg[open]'); pg.click('[data-fid="aiask-ok"]'); pg.wait_for_function('DP.state.duty.d1.state !== "running"'); pg.wait_for_timeout(200)
        print(f'  KI Matrix Fehler und Pause {vw}px Verstösse:', pg.evaluate(AXE_RUN)); pg.evaluate('DP.state.aiPause = 0; window.__mock.duty = null')
        pg.evaluate('DP.state.view = "list"; DP.ui.render()'); pg.wait_for_timeout(300)
        L06 = pg.evaluate('DP.ui.findings().find(f => f.crit === "L06" && f.quote === "sollte").id'); L05 = pg.evaluate('DP.ui.findings().find(f => f.crit === "L05").id')
        pg.click(f'[data-fid="rw-{L06}"]'); pg.wait_for_selector('#dlg[open]'); pg.wait_for_timeout(300); print(f'  KI Zustimmung Formulierung {vw}px Verstösse:', pg.evaluate(AXE_RUN))
        pg.check('#aiRemember'); pg.click('[data-fid="aiask-ok"]'); pg.wait_for_function(f'DP.ui.findings().find(f => f.id === "{L06}").fixAi'); pg.wait_for_timeout(200)
        pg.evaluate('window.__mock.reword = "name"'); pg.click(f'[data-fid="rw-{L05}"]'); pg.wait_for_function(f'DP.ui.findings().find(f => f.id === "{L05}").fixAi'); pg.wait_for_timeout(200)
        L062 = pg.evaluate('DP.ui.findings().find(f => f.crit === "L06" && f.quote !== "sollte").id')
        pg.evaluate('window.__mock.reword = "drop-number"'); pg.evaluate('window.__mock.reword = "html"'); pg.click(f'[data-fid="rw-{L062}"]'); pg.wait_for_function(f'DP.ui.findings().find(f => f.id === "{L062}").rwErr'); pg.wait_for_timeout(200)
        print(f'  KI Liste: Vorschlag, Warnung, verworfen {vw}px Verstösse:', pg.evaluate(AXE_RUN))
        pg.evaluate('window.__mock.reword = null; window.__mock.delay = 3000'); pg.click(f'[data-fid="rw-{L062}"]'); pg.wait_for_timeout(300); print(f'  KI Liste: Anfrage läuft {vw}px Verstösse:', pg.evaluate(AXE_RUN))
        pg.click(f'[data-fid="rwx-{L062}"]'); pg.wait_for_timeout(300); pg.evaluate('window.__mock.delay = 150')
        pg.evaluate('DP.state.view = "doc"; DP.ui.render()'); pg.wait_for_timeout(300); pg.click(f'#mct-{L05}'); pg.wait_for_timeout(300); print(f'  KI Randkarte mit KI-Vorschlag {vw}px Verstösse:', pg.evaluate(AXE_RUN))
        pg.evaluate('DP.state.ref = "d1"; DP.state.tgt = "d2"; DP.ui.go("compare")'); pg.wait_for_timeout(500)
        pg.click('[data-fid="aiBt-go"]'); pg.wait_for_selector('#dlg[open]'); pg.wait_for_timeout(300); print(f'  KI Zustimmung Rückübersetzung {vw}px Verstösse:', pg.evaluate(AXE_RUN)); pg.click('[data-fid="aiask-ok"]')
        pg.wait_for_function('DP.state.bt && DP.state.bt.state === "done"', timeout=10000); pg.wait_for_timeout(300)
        print(f'  KI Rückübersetzung {vw}px Verstösse:', pg.evaluate(AXE_RUN))
        pg.click('[data-fid="bt-sort"]'); pg.wait_for_timeout(200); pg.click('[data-fid="btk-6"]'); pg.wait_for_timeout(200); print(f'  KI Rückübersetzung sortiert, Notizfeld {vw}px Verstösse:', pg.evaluate(AXE_RUN))
        pg.keyboard.type('Verneinung fehlt'); pg.keyboard.press('Enter'); pg.wait_for_timeout(300); print(f'  KI festgehaltener Befund {vw}px Verstösse:', pg.evaluate(AXE_RUN))
        pg.close()
    # Offline-Ausgabe (file://): Kennzeichnung, Erklärungen statt KI, Anleitung, Sitzungsdialog
    import glob as _g
    off = [OFFLINE_FILE] if os.path.exists(OFFLINE_FILE) else []
    if off:
        for vw, vh in ((1280, 900), (400, 800)):
            pg = br.new_page(viewport={'width': vw, 'height': vh}, locale='de-CH'); mock_version(pg); pg.goto('file://' + off[-1]); pg.wait_for_timeout(500); pg.evaluate(AXE)
            print(f'  offline start {vw}px Verstösse:', pg.evaluate(AXE_RUN))
            pg.set_input_files('#file', [os.path.join(FX, n) for n in ('weisung_de_demo.docx', 'weisung_fr_errors.docx', 'weisung_it_clean.docx')])
            for _ in range(100):
                if pg.evaluate('DP.state.docs.length === 3 && !DP.state.busy'): break
                time.sleep(0.1)
            for route in ('check', 'compare', 'criteria', 'help'):
                pg.evaluate(f'DP.state.ref = DP.state.docs[0].id; DP.state.tgt = DP.state.docs[1].id; DP.ui.go("{route}")'); pg.wait_for_timeout(700)
                print(f'  offline {route} {vw}px Verstösse:', pg.evaluate(AXE_RUN))
            pg.evaluate('DP.state.tgt2 = DP.state.docs[2].id; DP.state.cmpMode = "tri"; DP.ui.go("compare")'); pg.wait_for_timeout(700); print(f'  offline compare tri {vw}px Verstösse:', pg.evaluate(AXE_RUN))
            pg.click('#sessionChip'); pg.wait_for_selector('#dlg[open]'); pg.wait_for_timeout(500); print(f'  offline Sitzungsdialog {vw}px Verstösse:', pg.evaluate(AXE_RUN))
            pg.close()
        # Hinweis auf eine neue Version (file://: herunterladen; GitHub Pages: neu laden), Altershinweis, Standardprofil; 1440 und 375 px, DE und FR
        pages = serve('pages', directory=os.path.dirname(OFFLINE_FILE))
        for vw, vh in ((1440, 900), (375, 812)):
            for lang in ('de', 'fr'):
                for where in ('file', 'pages'):
                    pg = br.new_page(viewport={'width': vw, 'height': vh}, locale=lang + '-CH'); mock_version(pg, '9.9.9')
                    pg.goto('file://' + OFFLINE_FILE if where == 'file' else pages + '/' + os.path.basename(OFFLINE_FILE)); pg.wait_for_selector('#updBand:not([hidden])', timeout=10000); pg.evaluate(AXE)
                    print(f'  offline Versionshinweis {where} {lang} {vw}px Verstösse:', pg.evaluate(AXE_RUN))
                    if where == 'pages':
                        # Dokumente mit Klassifizierungsvermerk (Startseite mit Hinweis oben geprüft): Sperrdialog bei VERTRAULICH und bei INTERN
                        idle = '!document.getElementById("dlg").open && !DP.state.busy'
                        pg.set_input_files('#file', [os.path.join(FX, 'klassif_vertraulich_fuss.docx')]); pg.wait_for_selector('#dlg[open] [data-fid="web-classif-blocked"]', timeout=30000); pg.wait_for_timeout(300)
                        print(f'  Pages Sperrdialog VERTRAULICH {lang} {vw}px Verstösse:', pg.evaluate(AXE_RUN)); pg.keyboard.press('Escape'); pg.wait_for_function(idle); pg.wait_for_timeout(300)
                        pg.set_input_files('#file', [os.path.join(FX, 'klassif_intern_kopf.docx')]); pg.wait_for_selector('#dlg[open] [data-fid="web-classif-blocked"]', timeout=30000); pg.wait_for_timeout(300)
                        print(f'  Pages Sperrdialog INTERN {lang} {vw}px Verstösse:', pg.evaluate(AXE_RUN))
                        pg.click('[data-fid="webblock-close"]'); pg.wait_for_function(idle); pg.wait_for_timeout(300)
                        if pg.evaluate('DP.state.docs.length'): VIOL.append(f'Pages {lang} {vw}px: Dokument mit Vermerk trotz Sperre geladen')
                    pg.evaluate('DP.ui.go("criteria")'); pg.wait_for_timeout(500); print(f'  offline Kriterien mit Standardprofil {where} {lang} {vw}px Verstösse:', pg.evaluate(AXE_RUN))
                    pg.close()
            pg = br.new_page(viewport={'width': vw, 'height': vh}, locale='de-CH'); pg.route(VERSION_URL, lambda r: r.abort())
            pg.add_init_script('Date.now = ((n) => () => n() + 200 * 86400000)(Date.now)')
            pg.goto('file://' + OFFLINE_FILE); pg.wait_for_selector('#updBand:not([hidden])', timeout=15000); pg.evaluate(AXE)
            print(f'  offline Altershinweis {vw}px Verstösse:', pg.evaluate(AXE_RUN)); pg.close()
    else: VIOL.append('Offline-Ausgabe fehlt (node build.mjs --offline)'); print('  Offline-Ausgabe fehlt (node build.mjs --offline)')
    # Grosses Dokument: Zeit bis Anzeige
    pg = br.new_page(viewport={'width': 1280, 'height': 900}); pg.goto(url(8771) + '/dist-local/index.html'); pg.wait_for_timeout(400)
    t0 = time.time(); pg.set_input_files('#file', [os.path.join(FX, 'gross_de.docx')]); pg.wait_for_function('DP.state.docs.length === 1 && !DP.state.busy', timeout=60000); t1 = time.time()
    pg.evaluate('DP.ui.go("check")'); pg.wait_for_timeout(300); t2 = pg.evaluate('(() => { const t = performance.now(); DP.ui.render(); return performance.now() - t; })()')
    # Ein Entscheid, während alle Absätze gezeigt sind (Sprung zum letzten Vorschlag): nur die betroffene Zeile wird neu aufgebaut
    pg.click('[data-fid="rv-prev"]'); pg.wait_for_selector('#dvTb'); pg.wait_for_timeout(1200)
    rows = pg.evaluate('document.querySelectorAll(".dv-row").length'); ms = []
    for k in range(5):
        ms.append(pg.evaluate('''() => new Promise(r => { const b = document.querySelector('[data-fid="tb-acc"]'); const t = performance.now(); b.click(); requestAnimationFrame(() => setTimeout(() => r(performance.now() - t), 0)); })'''))
        pg.wait_for_timeout(200); pg.click('[data-fid="rv-prev"]'); pg.wait_for_selector('#dvTb'); pg.wait_for_timeout(500)
    ms = sorted(round(x) for x in ms); assert ms[2] < 300, ms
    print('Grossdokument: laden+prüfen', round(t1 - t0, 2), 's; Befunde', pg.evaluate('DP.state.res[DP.state.cur].rule.length'), '; Render', round(t2), 'ms; DOM-Knoten', pg.evaluate('document.querySelectorAll("*").length'), '; Entscheid bei', rows, 'gezeigten Absätzen (bis zum nächsten Bild, Median von 5)', ms[2], 'ms', ms)
    br.close()
print('Verstösse gesamt:', len(VIOL))
for v in VIOL: builtins.print('  ', v)
sys.exit(1 if VIOL else 0)
