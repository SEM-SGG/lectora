"""Kontrastprüfung über die gerenderten Ansichten (berechnete Stile): Text unter 4.5:1 (grosser Text 3:1), Bedienrahmen und
Fokusrahmen unter 3:1. Deaktivierte Bedienelemente sind ausgenommen (WCAG 1.4.3). Gibt jede Unterschreitung aus und endet mit der Summe."""
import sys, os, json
sys.path.insert(0, os.path.dirname(__file__))
from engine_test import *
from ui_test import MOCK

JS = r'''() => {
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const over = (top, bot) => ({ r: top.r * top.a + bot.r * (1 - top.a), g: top.g * top.a + bot.g * (1 - top.a), b: top.b * top.a + bot.b * (1 - top.a), a: 1 });
  // Hintergrund: Ebenen von innen nach aussen zusammensetzen
  const bgOf = (el) => { const layers = []; for (let n = el; n && n.nodeType === 1; n = n.parentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c && c.a > 0) { layers.push(c); if (c.a >= 1) break; } } let out = { r: 255, g: 255, b: 255, a: 1 }; for (let i = layers.length - 1; i >= 0; i--) out = over(layers[i], out); return out; };
  const vis = (el) => { const r = el.getBoundingClientRect(); if (!r.width || !r.height) return false; const s = getComputedStyle(el); return s.visibility !== 'hidden' && s.opacity !== '0' && !el.closest('[hidden], .sr, [aria-hidden="true"] svg'); };
  const label = (el) => (el.getAttribute('data-fid') || el.id || el.className || el.tagName).toString().slice(0, 40) + ' «' + (el.textContent || el.value || '').trim().slice(0, 30) + '»';
  const bad = [];
  // Text
  const seen = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    if (!t.textContent.trim()) continue; const el = t.parentElement; if (!el || seen.has(el)) continue; seen.add(el);
    if (!vis(el) || el.closest('.sr, script, style, [disabled], option')) continue;
    const s = getComputedStyle(el); const fg = parse(s.color); if (!fg) continue;
    const bg = bgOf(el), col = over(fg, bg), r = ratio(col, bg);
    const size = parseFloat(s.fontSize), large = size >= 24 || (size >= 18.66 && +s.fontWeight >= 600);
    if (r < (large ? 3 : 4.5) - 0.005) bad.push('Text ' + r.toFixed(2) + ':1 ' + label(el));
  }
  // Bedienrahmen: Felder (Unterkante), Kontrollkästchen, gerahmte Schaltflächen, Segmente
  for (const el of document.querySelectorAll('input, select, textarea, .btn, .chip, .seg button, .icon-btn')) {
    if (!vis(el) || el.disabled) continue;
    const s = getComputedStyle(el), own = parse(s.backgroundColor), outer = bgOf(el.parentElement);
    const fill = own && own.a > 0 ? over(own, outer) : outer;
    const fillR = ratio(fill, outer);
    const sides = ['Bottom', 'Top', 'Left', 'Right'].map(k => ({ w: parseFloat(s['border' + k + 'Width']), c: parse(s['border' + k + 'Color']) })).filter(x => x.w > 0 && x.c && x.c.a > 0);
    const borderR = sides.length ? Math.max(...sides.map(x => ratio(over(x.c, outer), outer))) : 0;
    // Ohne eigene Fläche und durch ihren Text bestimmt (wie Ghost-Schaltflächen): Tabs (Carbon: Unterlinie hairline) und die Sprachsegmente der Utility-Leiste
    const ghost = el.matches('.btn.text, .icon-btn:not(.tonal), .linkish, .chips.tabs .chip, .utility .seg button');
    if (!ghost && Math.max(fillR, borderR) < 3 - 0.005) bad.push('Rahmen ' + Math.max(fillR, borderR).toFixed(2) + ':1 ' + label(el));
  }
  // Grafik: Farbfelder der Akzente gegen ihren Grund (mindestens 3:1)
  for (const el of document.querySelectorAll('.swatch')) {
    if (!vis(el)) continue; const c = parse(getComputedStyle(el).backgroundColor); if (!c) continue;
    const g = bgOf(el.parentElement), r = ratio(c, g); window.__sw = (window.__sw || 0) + 1;
    if (r < 3 - 0.005) bad.push('Farbfeld ' + r.toFixed(2) + ':1 ' + label(el.parentElement));
  }
  return bad;
}'''
FOCUS = r'''() => {
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const bgOf = (el) => { for (let n = el; n && n.nodeType === 1; n = n.parentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c && c.a >= 1) return c; } return { r: 255, g: 255, b: 255, a: 1 }; };
  const el = document.activeElement; if (!el || el === document.body) return null;
  const s = getComputedStyle(el); const w = parseFloat(s.outlineWidth), oc = parse(s.outlineColor);
  if (!w || s.outlineStyle === 'none' || !oc) return 'kein Fokusrahmen ' + (el.getAttribute('data-fid') || el.id || el.tagName);
  // Nachbarfarben: innen der canvas-Ring (bei box-shadow) bzw. die eigene Fläche, aussen der Grund
  const inner = s.boxShadow && s.boxShadow !== 'none' ? parse(s.boxShadow) : bgOf(el), outer = bgOf(el.parentElement);
  const r = Math.max(ratio(oc, inner), ratio(oc, outer));
  return r < 3 ? 'Fokus ' + r.toFixed(2) + ':1 ' + (el.getAttribute('data-fid') || el.id || el.tagName) : '';
}'''

def main():
    serve(8772)
    total = []
    with sync_playwright() as pw:
        br = launch(pw)
        for w, h in ((1440, 900), (1056, 900), (840, 900), (375, 812)):
            # Kontraste der ruhenden Darstellung: ohne Bewegung (beim Hochzählen ist der Endwert im DOM für einen Moment unsichtbar)
            pg = br.new_page(viewport={'width': w, 'height': h}, locale='de-CH', reduced_motion='reduce'); pg.add_init_script(MOCK)
            pg.goto(url(8772) + '/dist-local/index.html'); pg.wait_for_timeout(500)
            def check(name):
                res = pg.evaluate(JS); total.extend(f'{w} {name}: {x}' for x in res)
                if res: print(f'{w}px {name}: {len(res)} Unterschreitungen', res[:6])
            check('start')
            pg.set_input_files('#file', [os.path.join(FX, n) for n in ('weisung_de_demo.docx', 'weisung_fr_errors.docx', 'weisung_de_flawed.pdf', 'praesentation_de.pptx', 'weisung_it_clean.docx')])
            pg.wait_for_function('DP.state.docs.length === 5 && !DP.state.busy', timeout=30000); pg.wait_for_timeout(5000)
            # KI-Befunde erzeugen (Mock), damit KI-Tags und KI-Karte im Ergebnis vorkommen
            pg.evaluate('DP.ui.go("check")'); pg.wait_for_timeout(400); pg.evaluate('document.querySelector("[data-fid=aiDoc-go]").click()'); pg.wait_for_timeout(300)
            pg.click('#dlg .btn:not(.text)'); pg.wait_for_function('DP.state.res[DP.state.cur].aiState === "done"', timeout=10000); pg.wait_for_timeout(5000)
            # KI-Funktionen (Mock): Pflichtenmatrizen DE/FR/IT mit Abgleich, Formulierungsvorschläge (mit Warnung, verworfen), Rückübersetzung
            ids = pg.evaluate('DP.state.docs.map(d => d.id)')
            pg.evaluate(f'DP.state.ref = "{ids[0]}"; DP.state.tgt = "{ids[1]}"; DP.state.tgt2 = "{ids[4]}"; DP.state.cur = "{ids[0]}"; DP.state.view = "duty"; DP.ui.go("check")'); pg.wait_for_timeout(300)
            pg.click('[data-fid="aiDuty-all"]'); pg.wait_for_selector('#dlg[open]'); pg.click('[data-fid="aiask-ok"]')
            pg.wait_for_function(f'{json.dumps([ids[0], ids[1], ids[4]])}.every(id => DP.state.duty[id] && DP.state.duty[id].state === "done")', timeout=20000)
            pg.evaluate('DP.state.view = "list"; DP.ui.render()'); pg.wait_for_timeout(300)
            rw = pg.evaluate('(() => { const F = DP.ui.findings(); return [F.find(f => f.crit === "L06" && f.quote === "sollte").id, F.find(f => f.crit === "L05").id, F.find(f => f.crit === "L06" && f.quote !== "sollte").id]; })()')
            for fid, mode in zip(rw, (None, 'name', 'html')):
                pg.evaluate(f'window.__mock.reword = {json.dumps(mode)}'); pg.click(f'[data-fid="rw-{fid}"]')
                if pg.query_selector('#dlg[open]'): pg.click('[data-fid="aiask-ok"]')
                pg.wait_for_function(f'(() => {{ const f = DP.ui.findings().find(f => f.id === "{fid}"); return f.fixAi || f.rwErr; }})()', timeout=5000)
            pg.evaluate(f'window.__mock.reword = null; DP.state.ref = "{ids[0]}"; DP.state.tgt = "{ids[1]}"; DP.state.view = "doc"; DP.ui.go("compare")'); pg.wait_for_timeout(400)
            pg.click('[data-fid="aiBt-go"]'); pg.wait_for_selector('#dlg[open]'); pg.click('[data-fid="aiask-ok"]'); pg.wait_for_function('DP.state.bt && DP.state.bt.state === "done"', timeout=10000)
            for l in ('de', 'fr', 'it'):
                pg.evaluate(f'DP.ui.setLang("{l}")'); pg.wait_for_timeout(150)
                pg.evaluate(f'DP.state.cur = "{ids[0]}"; DP.state.view = "duty"; DP.state.dutyGaps = false; DP.ui.go("check")'); pg.wait_for_timeout(400)
                # Nach der neuen Fassung (erste Sprache) ist die Matrix der alten verworfen: Hinweis prüfen, dann neu erstellen
                if not pg.evaluate(f'!!(DP.state.duty["{ids[0]}"] && DP.state.duty["{ids[0]}"].state === "done")'):
                    check(l + ' KI Matrix verworfen'); pg.click('[data-fid="aiDuty-go"]'); pg.wait_for_selector('#dlg[open]'); pg.click('[data-fid="aiask-ok"]'); pg.wait_for_function(f'DP.state.duty["{ids[0]}"].state === "done"', timeout=10000); pg.wait_for_timeout(200)
                check(l + ' KI Pflichtenmatrix')
                pg.evaluate('DP.state.dutyGaps = true; DP.state.dutySynAll = true; DP.ui.render()'); pg.wait_for_timeout(200); check(l + ' KI Matrix Lücken, Synopse')
                pg.evaluate('DP.state.dutyGaps = false; DP.state.dutySynAll = false; DP.state.view = "list"; DP.ui.render()'); pg.wait_for_timeout(300); check(l + ' KI Liste mit Vorschlägen')
                pg.click('[data-fid^="rw-"]'); pg.wait_for_selector('#dlg[open]'); pg.wait_for_timeout(200); check(l + ' KI Zustimmung Formulierung'); pg.keyboard.press('Escape'); pg.wait_for_timeout(150)
                pg.evaluate('DP.state.view = "doc"; DP.ui.render()'); pg.wait_for_timeout(300)
                pg.click('.mc:has(.tag.ai) .mc-title' if pg.query_selector('.mc:has(.tag.ai) .mc-title') else '.mc .mc-title'); pg.wait_for_timeout(200); check(l + ' KI Randkarte')
                pg.evaluate(f'DP.state.ref = "{ids[0]}"; DP.state.tgt = "{ids[1]}"; DP.state.cmpMode = "pair"; DP.state.cmpOnly = false; DP.state.btNote = {{id: "{ids[0]}>{ids[1]}", row: 6, text: ""}}; DP.ui.go("compare")'); pg.wait_for_timeout(500); check(l + ' KI Rückübersetzung')
                pg.evaluate('DP.state.btNote = null; DP.state.cmpOnly = true')
                pg.click('[data-fid="aiBt-go"]'); pg.wait_for_selector('#dlg[open]'); pg.wait_for_timeout(200); check(l + ' KI Zustimmung Rückübersetzung'); pg.keyboard.press('Escape'); pg.wait_for_timeout(150)
                pg.evaluate('DP.ui.go("docs")'); pg.wait_for_timeout(300); check(l + ' docs')
                pg.evaluate('DP.state.cur = DP.state.docs[0].id; DP.ui.go("check")'); pg.wait_for_timeout(500); check(l + ' check doc')
                pg.click('.chg.c-open > :is(del, ins)'); pg.wait_for_selector('#dvTb'); pg.wait_for_timeout(200); check(l + ' check toolbar+card')
                pg.keyboard.press('Escape'); pg.click('[data-fid="f-hidden"]'); pg.wait_for_timeout(200); check(l + ' check hidden'); pg.click('[data-fid="f-hidden"]'); pg.wait_for_timeout(200)
                # Überarbeiten: gewählter Befund mit Verbindungslinie und Übersicht am Rand, Übersicht der Tastenkürzel
                pg.evaluate('(() => { const f = DP.ui.findings().find(x => x.fix && x.para != null && !x.dismissed); DP.state.sel = f.id; DP.ui.render(); document.querySelector(".chg.sel").scrollIntoView({block: "center"}); })()'); pg.wait_for_timeout(300); check(l + ' check selected+connector+rail')
                # Unter 672 px gibt es die Schaltfläche nicht; die Übersicht öffnet dann die Taste ? (Tastatur am Tablet)
                if pg.is_visible('[data-fid="kb-help"]'): pg.click('[data-fid="kb-help"]')
                else: pg.evaluate('document.getElementById("view").focus()'); pg.keyboard.press('?')
                pg.wait_for_selector('#dlg[open] #kbOn'); pg.wait_for_timeout(300); check(l + ' check kb dialog'); pg.keyboard.press('Escape'); pg.wait_for_timeout(150)
                pg.click('[data-fid="view-list"]'); pg.wait_for_timeout(400); check(l + ' check list')
                pg.click('[data-fid="view-doc"]'); pg.wait_for_timeout(200)
                pg.evaluate('DP.state.ref = DP.state.docs[0].id; DP.state.tgt = DP.state.docs[1].id; DP.ui.go("compare")'); pg.wait_for_timeout(500); check(l + ' compare')
                pg.evaluate('DP.state.tgt2 = DP.state.docs[4].id; DP.state.cmpMode = "tri"; DP.state.cmpOnly = false; DP.ui.go("compare")'); pg.wait_for_timeout(600); check(l + ' compare tri')
                pg.evaluate('DP.state.cmpMode = "pair"; DP.state.cmpOnly = true')
                pg.evaluate('DP.state.critOpen = new Set(["custom"]); DP.state.settings.actsText = "999.1; ABC; DEF; GHI\\nx"; DP.ui.go("criteria")'); pg.wait_for_timeout(300); check(l + ' criteria acts'); pg.evaluate('DP.state.settings.actsText = ""')
                pg.evaluate('DP.state.cur = DP.state.docs[0].id; DP.ui.go("export")'); pg.wait_for_timeout(400); check(l + ' export word')
                pg.evaluate('DP.state.cur = DP.state.docs[2].id; DP.ui.go("export")'); pg.wait_for_timeout(400); check(l + ' export pdf')
                pg.evaluate('DP.state.cur = DP.state.docs[3].id; DP.ui.go("export")'); pg.wait_for_timeout(400); check(l + ' export pptx')
                pg.evaluate('DP.state.docs[2].annErr = "encrypted"; DP.state.cur = DP.state.docs[2].id; DP.ui.go("export")'); pg.wait_for_timeout(400); check(l + ' export pdf encrypted'); pg.evaluate('DP.state.docs[2].annErr = null')
                pg.evaluate('DP.state.critOpen = new Set(["formal","struct","lang","typo","refs","tech","quality","trans","custom"]); DP.state.settings.params = {"L01.note": 20}; DP.ui.go("criteria")'); pg.wait_for_timeout(500); check(l + ' criteria open+param')
                pg.evaluate('DP.state.settings.params = {}; DP.ui.go("help")'); pg.wait_for_timeout(500); check(l + ' help')
                # Arbeitswerkzeug: Profilband, Nachprüfung, Fehlalarm, Rückmeldung (Zustände einmal je Sprache aufgebaut)
                pg.evaluate('DP.state.profile = {name: "Team", sig: "x", how: "loaded"}; DP.ui.go("criteria")'); pg.wait_for_timeout(300); check(l + ' criteria profile')
                pg.evaluate('DP.state.profile = null')
                if not pg.evaluate('Object.keys(DP.state.versions).length'):
                    pg.evaluate('DP.ui.go("docs")'); pg.wait_for_timeout(200)
                    pg.set_input_files('#file', [os.path.join(FX, 'weisung_de_demo_v2.docx')]); pg.wait_for_selector('#dlg[open] [data-fid="ver-version"]'); pg.wait_for_timeout(200); check(l + ' version dialog')
                    pg.click('[data-fid="ver-version"]'); pg.wait_for_function('!DP.state.busy && Object.keys(DP.state.versions).length === 1')
                pg.evaluate('DP.state.cur = DP.state.docs[0].id; DP.state.filter.hidden = true; DP.ui.go("check")'); pg.wait_for_timeout(500)
                if not pg.evaluate('DP.ui.findings().some(f => f.fa)'): pg.evaluate('(() => { const f = DP.ui.findings().find(f => !f.fix && !f.dismissed); f.fa = true; f.dismissed = true; DP.ui.render(); })()'); pg.wait_for_timeout(200)
                check(l + ' check recheck+fa'); pg.click('[data-fid="view-list"]'); pg.wait_for_timeout(400); check(l + ' check list fa note'); pg.click('[data-fid="view-doc"]'); pg.wait_for_timeout(200)
                pg.evaluate('DP.state.filter.hidden = false; DP.ui.go("export")'); pg.wait_for_timeout(400); check(l + ' export feedback')
                pg.evaluate('DP.ui.go("check")'); pg.wait_for_timeout(400); pg.evaluate('document.querySelector("[data-fid=aiDoc-go]").click()'); pg.wait_for_timeout(400); check(l + ' dialog'); pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
                if w < 1056: pg.click('#menuBtn'); pg.wait_for_timeout(300); check(l + ' menu'); pg.keyboard.press('Escape')
            print(f'{w}px: Ansichten in DE/FR/IT geprüft, Farbfelder gemessen:', pg.evaluate('window.__sw || 0'))
            pg.evaluate('DP.ui.setLang("de")')
            if w in (1056, 840): pg.close(); continue
            # Fokusrahmen: mit Tab durch jede Ansicht
            for route in ('docs', 'check', 'compare', 'export', 'criteria', 'help'):
                pg.evaluate(f'DP.ui.go("{route}")'); pg.wait_for_timeout(400); pg.evaluate('document.body.focus()')
                fb = []
                for _ in range(70):
                    pg.keyboard.press('Tab'); r = pg.evaluate(FOCUS)
                    if r: fb.append(r)
                pg.keyboard.press('Escape')
                fb = sorted(set(fb)); total.extend(f'{w} focus {route}: {x}' for x in fb)
                print(f'{w}px Fokus {route}: {len(fb)} Unterschreitungen', fb[:6] if fb else '')
            pg.close()
        # Offline-Ausgabe (file://): Kennzeichnung, Erklärungen statt KI, Anleitung, Sitzungsdialog, Signaturdialog
        import glob as _g, time as _t
        off = [OFFLINE_FILE] if os.path.exists(OFFLINE_FILE) else []
        if not off: total.append('Offline-Ausgabe fehlt (node build.mjs --offline)')
        for w, h in ((1440, 900), (375, 812)) if off else ():
            pg = br.new_page(viewport={'width': w, 'height': h}, locale='de-CH', reduced_motion='reduce'); mock_version(pg); pg.goto('file://' + off[-1]); pg.wait_for_timeout(500)
            def check(name):
                res = pg.evaluate(JS); total.extend(f'{w} offline {name}: {x}' for x in res)
                if res: print(f'{w}px offline {name}: {len(res)} Unterschreitungen', res[:6])
            pg.set_input_files('#file', [os.path.join(FX, n) for n in ('weisung_de_signiert.pdf', 'weisung_de_demo.docx', 'weisung_fr_errors.docx', 'weisung_it_clean.docx')])
            for _ in range(200):
                if pg.query_selector('#dlg[open] [data-fid="ver-separate"]'): pg.click('[data-fid="ver-separate"]')
                if pg.evaluate('DP.state.docs.length === 4 && !DP.state.busy'): break
                _t.sleep(0.1)
            for l in ('de', 'fr', 'it'):
                pg.evaluate(f'DP.ui.setLang("{l}")'); pg.wait_for_timeout(150)
                pg.evaluate('DP.ui.go("docs")'); pg.wait_for_timeout(300); check(l + ' docs')
                pg.evaluate('DP.state.cur = DP.state.docs[1].id; DP.ui.go("check")'); pg.wait_for_timeout(500); check(l + ' check')
                pg.evaluate('DP.state.ref = DP.state.docs[1].id; DP.state.tgt = DP.state.docs[2].id; DP.state.tgt2 = DP.state.docs[3].id; DP.state.cmpMode = "pair"; DP.ui.go("compare")'); pg.wait_for_timeout(500); check(l + ' compare')
                pg.evaluate('DP.state.cmpMode = "tri"; DP.ui.go("compare")'); pg.wait_for_timeout(500); check(l + ' compare tri'); pg.evaluate('DP.state.cmpMode = "pair"')
                pg.evaluate('DP.ui.go("criteria")'); pg.wait_for_timeout(300); check(l + ' criteria')
                pg.evaluate('DP.ui.go("help")'); pg.wait_for_timeout(400); check(l + ' help')
                pg.click('#sessionChip'); pg.wait_for_selector('#dlg[open]'); pg.wait_for_timeout(400); check(l + ' session dialog'); pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
                pg.evaluate('DP.state.cur = DP.state.docs[0].id; DP.ui.go("export")'); pg.wait_for_timeout(300); pg.click('[data-fid="dl-annot"]'); pg.wait_for_selector('#dlg[open] [data-fid="sig-go"]', timeout=30000); pg.wait_for_timeout(400)
                check(l + ' signed dialog'); pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
            print(f'{w}px Offline-Ausgabe: Ansichten in DE/FR/IT geprüft')
            pg.close()
            # Hinweis auf eine neue Version (Datei und GitHub Pages), Altershinweis; Fokus auf den Bedienelementen des Hinweises
            pages = serve('pages', directory=os.path.dirname(OFFLINE_FILE))
            for lang in ('de', 'fr'):
                for where in ('file', 'pages'):
                    pg = br.new_page(viewport={'width': w, 'height': h}, locale=lang + '-CH', reduced_motion='reduce'); mock_version(pg, '9.9.9')
                    pg.goto('file://' + OFFLINE_FILE if where == 'file' else pages + '/' + os.path.basename(OFFLINE_FILE)); pg.wait_for_selector('#updBand:not([hidden])', timeout=10000)
                    check(f'{lang} {where} Versionshinweis')
                    for fid in ('upd-dl' if where == 'file' else 'upd-reload', 'upd-close'):
                        pg.focus(f'[data-fid="{fid}"]'); pg.keyboard.press('Shift+Tab'); pg.keyboard.press('Tab'); pg.wait_for_timeout(150)
                        r = pg.evaluate(FOCUS)
                        if r: total.append(f'{w} offline {lang} {where} Fokus {fid}: {r}')
                    pg.evaluate('DP.ui.go("criteria")'); pg.wait_for_timeout(300); check(f'{lang} {where} Kriterien mit Standardprofil')
                    pg.close()
            # GitHub Pages: Rückmeldesymbol der Kopfzeile, Hinweis zu klassifizierten Dokumenten, Sperrdialog (VERTRAULICH, INTERN), Links der Anleitung (Dokumentation, Fehler melden, Mail);
            # Fokusrahmen auf jedem Bedienelement (mit der Tastatur erreicht, damit :focus-visible gilt)
            def kfocus(lang, fid):
                sel = f'[data-fid="{fid}"]'
                for keys in (('Shift+Tab', 'Tab'), ('Tab', 'Shift+Tab')):
                    pg.focus(sel)
                    for k in keys: pg.keyboard.press(k)
                    pg.wait_for_timeout(150)
                    if pg.evaluate('(s) => document.activeElement === document.querySelector(s)', sel): break
                else:
                    total.append(f'{w} pages {lang} Fokus {fid}: mit der Tastatur nicht erreichbar'); return
                r = pg.evaluate(FOCUS)
                if r: total.append(f'{w} pages {lang} Fokus {fid}: {r}')
            idle = '!document.getElementById("dlg").open && !DP.state.busy'
            for lang in ('de', 'fr', 'it'):
                pg = br.new_page(viewport={'width': w, 'height': h}, locale=lang + '-CH', reduced_motion='reduce'); mock_version(pg)
                pg.goto(pages + '/' + os.path.basename(OFFLINE_FILE)); pg.wait_for_selector('[data-fid="web-classif-note"]', timeout=10000); pg.wait_for_timeout(300)
                check(f'{lang} pages Hinweis Vermerke'); kfocus(lang, 'web-note-dl'); kfocus(lang, 'web-note-doc'); kfocus(lang, 'feedback')
                pg.set_input_files('#file', [os.path.join(FX, 'klassif_vertraulich_fuss.docx')]); pg.wait_for_selector('#dlg[open] [data-fid="web-classif-blocked"]', timeout=30000); pg.wait_for_timeout(300)
                check(f'{lang} pages Sperrdialog')
                for fid in ('webblock-dl', 'webblock-close'): kfocus(lang, fid)
                pg.keyboard.press('Escape'); pg.wait_for_function(idle); pg.wait_for_timeout(200)
                pg.set_input_files('#file', [os.path.join(FX, 'klassif_intern_kopf.docx')]); pg.wait_for_selector('#dlg[open] [data-fid="web-classif-blocked"]', timeout=30000); pg.wait_for_timeout(300)
                check(f'{lang} pages Sperrdialog INTERN')
                pg.click('[data-fid="webblock-close"]'); pg.wait_for_function(idle)
                if pg.evaluate('DP.state.docs.length'): total.append(f'{w} pages {lang}: Dokument mit Vermerk trotz Sperre geladen')
                pg.evaluate('DP.ui.go("help")'); pg.wait_for_timeout(300)
                for fid in ('g-doc', 'g-issue', 'g-mail'): kfocus(lang, fid)
                pg.close()
            pg = br.new_page(viewport={'width': w, 'height': h}, locale='de-CH', reduced_motion='reduce'); pg.route(VERSION_URL, lambda r: r.abort())
            pg.add_init_script('Date.now = ((n) => () => n() + 200 * 86400000)(Date.now)')
            pg.goto('file://' + OFFLINE_FILE); pg.wait_for_selector('#updBand:not([hidden])', timeout=15000); check('Altershinweis')
            print(f'{w}px Offline-Ausgabe: Versionshinweis, GitHub Pages (mit Hinweis, Sperrdialog und Rückfrage zu Vermerken) und Altershinweis geprüft')
            pg.close()
        br.close()
    print('Kontrast: gesamt', len(total), 'Unterschreitungen')
    return 1 if total else 0

if __name__ == '__main__': sys.exit(main())
