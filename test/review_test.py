"""Regressionstests zu den Befunden der Sicherheits- und Datenschutzprüfung (Paket «Review B»):
  1. Unlesbare Dateien: Teil mit DTD oder Lesefehler, ohne Text, entpackt zu gross → Fehlermeldung, nie ein leeres «bestandenes» Dokument
  2. Klassifizierungsvermerke je Stufe und Ort: im Artefakt nicht geladen (alle Wege); die Sperre der KI-Funktionen als zweite Sicherung
  3. Keine Anfrage an Claude vor der Zustimmung, für jede KI-Funktion; Zustimmung nennt, was gesendet wird (auch eigene Kriterien)
  4. KI-Prüfung: Obergrenze ehrlich genannt (Zustimmung und Ergebnis)
  5. KI-Vorschläge: geprüft, von Sammelentscheiden ausgenommen, in Word, PDF, PowerPoint und Bericht gekennzeichnet
  6. Kein Browser-Speicher, kein Verlauf; Zurück-Cache bringt keine Dokumente zurück (über http, wie GitHub Pages)
  7. PDF/A: Die Kopie mit Kommentaren trägt keine PDF/A-Kennung mehr, XMP-Datum wie im Info-Verzeichnis
Schluss: «FEHLER: keine»."""
import sys, os, re, io, json, time, base64, zipfile, tempfile, shutil, subprocess
sys.path.insert(0, os.path.dirname(__file__))
from engine_test import *
from ooxml_check import check as ooxml_check
OUT = os.path.join(OUT_ROOT, 'review'); os.makedirs(OUT, exist_ok=True)
AXE = open(os.path.join(ROOT, 'node_modules/axe-core/axe.min.js'), encoding='utf-8').read()
AXE_RUN = 'axe.run(document, {runOnly: {type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"]}}).then(r => r.violations.map(v => v.id + " " + v.nodes.length + " " + v.nodes[0].html.slice(0, 120)))'
errors = []
def check(ok, msg):
    print(('  ok   ' if ok else '  FEHLER ') + msg)
    if not ok: errors.append(msg)

MOCK = r'''
window.__prompts = []; window.__saved = [];
const block = (input, name) => { const a = input.indexOf('<<<' + name + '\n'); if (a < 0) return []; const from = a + name.length + 4, end = input.indexOf('\n' + name + '>>>', from); return JSON.parse(input.slice(from, end)); };
const sample = async () => ({ text: 'x' });
sample.json = async (input) => {
  window.__prompts.push(input);
  if (/^You are a meticulous reviewer/.test(input)) {
    const m = block(input, 'DOCUMENT').find(o => /innert 2 Arbeitstagen/.test(o.text)); if (!m) return [];
    return [{ p: m.p, crit: 'Q04', sev: 'warn', quote: 'an die zuständige Sektion weiter', fix: 'an die dafür zuständige Sektion weiter', msg: { de: 'Zuständigkeit unklar.', fr: 'Compétence peu claire.', it: 'Competenza poco chiara.' } },
            { p: m.p, crit: 'Q02', sev: 'error', quote: 'innert 2 Arbeitstagen', fix: 'innert 5 Arbeitstagen', msg: { de: 'Frist widerspricht Ziffer 5.', fr: 'Délai contradictoire.', it: 'Termine contraddittorio.' } }];
  }
  if (/^You compare two language versions/.test(input)) return [];
  if (/^You improve the wording/.test(input)) { const p = JSON.parse(/^PASSAGE \(JSON string\): (.*)$/m.exec(input)[1]); return { text: p.replace('sollte', 'muss') }; }
  if (/^You translate segments/.test(input)) return block(input, 'SEGMENTS').map(o => ({ id: o.id, text: o.text }));
  if (/^You extract the obligations/.test(input)) return [];
  return [];
};
const downloads = { save: async ({ filename, data }) => { const buf = new Uint8Array(await new Response(data).arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 8192) s += String.fromCharCode.apply(null, buf.subarray(i, i + 8192)); window.__saved.push({ filename, b64: btoa(s) }); return { status: 'saved' }; } };
window.claude = { use: async (n) => n === 'sample' ? sample : n === 'downloads' ? downloads : null };
'''

def waitf(pg, expr, timeout=30):
    t0 = time.time()
    while time.time() - t0 < timeout:
        if pg.evaluate(expr): return True
        time.sleep(0.15)
    raise AssertionError('Zeitüberschreitung: ' + expr)

def variant(src, dst, change=None, extra=None):
    zin = zipfile.ZipFile(src); zout = zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED)
    for n in zin.namelist():
        d = zin.read(n)
        if change and n in change: d = change[n](d)
        zout.writestr(n, d)
    for n, d in (extra or {}).items(): zout.writestr(n, d)
    zout.close()

TMP = tempfile.mkdtemp(prefix='lectora-review-')
def tmpf(name): return os.path.join(TMP, name)

base = serve('review')
with sync_playwright() as pw:
    br = launch(pw)
    def page(w=1440, h=900):
        ctx = br.new_context(viewport={'width': w, 'height': h}, locale='de-CH', device_scale_factor=1, accept_downloads=True)
        ctx.grant_permissions(['clipboard-read', 'clipboard-write'])
        pg = ctx.new_page(); pg.add_init_script(MOCK)
        pg.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
        pg.goto(base + '/dist-local/index.html'); pg.wait_for_timeout(700)
        return pg
    def load(pg, paths, n=None):
        before = pg.evaluate('DP.state.docs.length')
        pg.set_input_files('#file', paths); pg.wait_for_timeout(300)
        waitf(pg, '!DP.state.busy')
        for _ in range(20):
            if pg.query_selector('[data-fid="ver-separate"]'): pg.click('[data-fid="ver-separate"]'); pg.wait_for_timeout(300); waitf(pg, '!DP.state.busy')
            else: break
        return pg.evaluate('DP.state.docs.length') - before
    snack = lambda pg: pg.inner_text('#snacks')
    nprompts = lambda pg: pg.evaluate('window.__prompts.length')

    # ===== 1. Unlesbare Dateien =====
    print('== 1. Unlesbare Dateien')
    src = os.path.join(FX, 'weisung_de_flawed.docx')
    variant(src, tmpf('dtd.docx'), {'word/document.xml': lambda d: d.replace(b'?>', b'?><!DOCTYPE w:document [<!ENTITY a "x">]>', 1)})
    variant(src, tmpf('kaputt.docx'), {'word/document.xml': lambda d: d.replace(b'</w:body>', b'<w:p></w:body>', 1)})
    variant(src, tmpf('kaputt_stil.docx'), {'word/styles.xml': lambda d: d[:len(d) // 2]})
    variant(src, tmpf('leer.docx'), {'word/document.xml': lambda d: re.sub(rb'<w:body>.*</w:body>', b'<w:body><w:p/></w:body>', d, flags=re.S)})
    # Teil, der entpackt 70 MB gross wäre (gut komprimierbar), in einem Teil, den Lectora liest
    big = b'<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:r><w:t>' + b'A' * (70 * 1024 * 1024) + b'</w:t></w:r></w:p></w:hdr>'
    variant(src, tmpf('bombe.docx'), None, {'word/header7.xml': big})
    pg = page()
    for name, want in (('dtd.docx', 'beschädigt oder enthält nicht zulässige Angaben'), ('kaputt.docx', 'beschädigt oder enthält nicht zulässige Angaben'),
                       ('kaputt_stil.docx', 'beschädigt oder enthält nicht zulässige Angaben'), ('leer.docx', 'keinen Text gefunden'), ('bombe.docx', 'entpackt grösser als 64 MB')):
        added = load(pg, [tmpf(name)]); sn = snack(pg)
        check(added == 0 and want in sn, f'{name}: nicht geladen, Meldung «{sn[:90]}»')
    check(pg.evaluate('DP.state.docs.length') == 0, 'kein leeres Dokument in der Liste')
    pg.context.close()

    # ===== 2. Klassifizierungsvermerke =====
    # Artefakt-Ausgabe (hier die Testausgabe dist-local, DP.offline ist false): Dokumente mit Vermerk INTERN, VERTRAULICH oder GEHEIM
    # lädt und prüft Lectora nicht (Sperrdialog wie auf der Webseite), über Dateiauswahl, Ablegen, mehrere Dateien und «Neue Fassung laden».
    # Die Sperre der KI-Funktionen bleibt zweite Sicherung; der Test gibt dafür geladenen Dokumenten den Vermerk nachträglich.
    print('\n== 2. Klassifizierungsvermerke')
    pg = page()
    want = {'klassif_intern_kopf.docx': 'INTERN', 'klassif_vertraulich_fuss.docx': 'VERTRAULICH', 'klassif_vertraulich_fuss.pdf': 'VERTRAULICH',
            'klassif_secret_kopf_fr.docx': 'SECRET', 'klassif_confidenziale_folie.pptx': 'CONFIDENZIALE'}
    ndocs = lambda: pg.evaluate('DP.state.docs.length')
    def blocked():
        pg.wait_for_selector('#dlg[open] [data-fid="web-classif-blocked"]', timeout=30000); pg.wait_for_timeout(200)
        a = pg.evaluate('(() => { const a = document.querySelector("[data-fid=webblock-dl]"); return a && [a.getAttribute("href"), a.target]; })()')
        return pg.inner_text('#dlg'), a
    def close_block():
        pg.click('[data-fid="webblock-close"]'); waitf(pg, '!DP.state.busy && !document.getElementById("dlg").open'); pg.wait_for_timeout(200)
    for f, label in want.items():
        pg.set_input_files('#file', [os.path.join(FX, f)]); t, a = blocked()
        check(f'«{label}»' in t and f'«{f}»' in t and 'Dokument wird hier nicht geprüft' in t and 'in Claude nicht' in t and 'Lectora.html' in t and a == [DOWNLOAD_URL, '_blank']
              and pg.query_selector('#dlg input[type="checkbox"]') is None and ndocs() == 0, f'Artefakt: {f} ({label}) → nicht geladen, Sperrdialog mit Link auf Lectora.html, ohne Weg, trotzdem zu prüfen')
        if f.endswith('.pdf'):
            pg.evaluate(AXE); ax = pg.evaluate(AXE_RUN); check(ax == [], f'axe: Sperrdialog im Artefakt ohne Verstoss {ax}')
            check(pg.evaluate('document.activeElement.dataset.fid') == 'webblock-close', 'Sperrdialog: Fokus auf «Schliessen»')
            pg.screenshot(path=os.path.join(SHOTS_DIR, 'r00_artefakt_gesperrt_de_1440.png'))
        close_block()
    check(ndocs() == 0 and pg.evaluate('Object.keys(DP.state.res).length') == 0 and pg.evaluate('document.activeElement.dataset.fid') == 'pick', 'Artefakt: nichts geladen, nichts geprüft, Fokus auf «Dateien auswählen»')
    # Mehrere Dateien (etwa für den Sprachvergleich): nur die Fassungen ohne Vermerk werden geladen
    pg.set_input_files('#file', [os.path.join(FX, n) for n in ('klassif_keine.docx', 'klassif_secret_kopf_fr.docx', 'weisung_fr_errors.docx')])
    blocked(); close_block(); waitf(pg, '!DP.state.busy && DP.state.docs.length === 2')
    for _ in range(5):
        if pg.query_selector('[data-fid="ver-separate"]'): pg.click('[data-fid="ver-separate"]'); pg.wait_for_timeout(300)
    names = pg.evaluate('DP.state.docs.map(d => d.name)')
    check(sorted(names) == ['klassif_keine.docx', 'weisung_fr_errors.docx'] and pg.evaluate('DP.state.docs.every(d => !d.meta.classification)'),
          f'Artefakt: drei Dateien, eine mit SECRET → geladen nur {names}; der Sprachvergleich sieht nur Dokumente ohne Vermerk')
    # Ablegen auf der Ablagefläche
    pg.evaluate('DP.ui.go("docs")'); pg.wait_for_timeout(300)
    raw = base64.b64encode(open(os.path.join(FX, 'klassif_intern_kopf.docx'), 'rb').read()).decode()
    pg.evaluate('''([b64, name]) => { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      const dt = new DataTransfer(); dt.items.add(new File([u], name, {type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"}));
      document.getElementById("drop").dispatchEvent(new DragEvent("drop", {bubbles: true, cancelable: true, dataTransfer: dt})); }''', [raw, 'klassif_intern_kopf.docx'])
    t, _ = blocked(); close_block()
    check('«INTERN»' in t and ndocs() == 2, 'Artefakt: abgelegte Datei mit INTERN → Sperrdialog, nicht geladen')
    # «Neue Fassung laden»: eine Fassung mit Vermerk ersetzt das geladene Dokument nicht
    did = pg.evaluate('DP.state.docs.find(d => d.name === "klassif_keine.docx").id')
    with pg.expect_file_chooser() as fc: pg.click(f'[data-fid="ver-{did}"]')
    fc.value.set_files(os.path.join(FX, 'klassif_vertraulich_fuss.docx')); t, _ = blocked(); close_block()
    check('«VERTRAULICH»' in t and pg.evaluate(f'DP.state.docs.some(d => d.id === "{did}" && d.name === "klassif_keine.docx") && Object.keys(DP.state.versions).length === 0'),
          'Artefakt: neue Fassung mit VERTRAULICH → Sperrdialog, die geladene Fassung bleibt')
    pg.context.close()

    # Zweite Sicherung: KI-Funktionen sperren ein geladenes Dokument, das (wie eine später geladene Fassung) einen Vermerk trägt
    pg = page()
    load(pg, [os.path.join(FX, f) for f in ('weisung_de_flawed.docx', 'weisung_fr_errors.docx', 'klassif_keine.docx')])
    idx = {d: i for i, d in enumerate(pg.evaluate('DP.state.docs.map(d => d.name)'))}
    def mark(name, level, label):
        pg.evaluate(f'DP.state.docs[{idx[name]}].meta.classification = ' + ('null' if level is None else f'{{level: {level}, label: "{label}"}}'))
    def open_ai(doc_name, fid='aiDoc-go', view='doc'):
        pg.evaluate(f'DP.state.cur = DP.state.docs[{idx[doc_name]}].id; DP.state.view = "{view}"; DP.ui.go("check")'); pg.wait_for_timeout(400)
        pg.click(f'[data-fid="{fid}"]'); pg.wait_for_selector('#dlg[open]'); pg.wait_for_timeout(150)
    for level, label in ((1, 'INTERN'), (2, 'VERTRAULICH'), (3, 'GEHEIM')):
        mark('weisung_de_flawed.docx', level, label)
        for fid, view in (('aiDoc-go', 'doc'), ('aiDuty-go', 'duty')):
            open_ai('weisung_de_flawed.docx', fid, view); t = pg.inner_text('#dlg')
            check(pg.query_selector('[data-fid="ai-blocked"]') is not None and pg.query_selector('[data-fid="aiask-ok"]') is None and pg.query_selector('#dlg input[type="checkbox"]') is None
                  and f'«{label}»' in t and 'sendet Lectora nie an Claude' in t and 'Datenregel' in t and 'nach Muster' in t, f'{label} ({fid}): KI gesperrt, ohne Weg zum Senden')
            if level == 2 and fid == 'aiDoc-go':
                pg.wait_for_timeout(300); pg.evaluate(AXE); ax = pg.evaluate(AXE_RUN); check(ax == [], f'axe: Dialog «Nicht an Claude senden» ohne Verstoss {ax}')
                check(pg.evaluate('document.activeElement.dataset.fid') == 'aiblock-close', 'Fokus auf «Schliessen»')
                pg.screenshot(path=os.path.join(SHOTS_DIR, 'r01_ki_gesperrt_de_1440.png'))
            pg.click('[data-fid="aiblock-close"]'); pg.wait_for_timeout(150)
    # Formulierungsvorschlag (Liste) und Bedeutungsvergleich: gesperrt, wenn eine beteiligte Fassung einen Vermerk trägt
    mark('weisung_de_flawed.docx', 1, 'INTERN')
    pg.evaluate(f'DP.state.cur = DP.state.docs[{idx["weisung_de_flawed.docx"]}].id; DP.state.view = "list"; DP.ui.go("check")'); pg.wait_for_timeout(400)
    rw = pg.evaluate('(() => { const b = document.querySelector("[data-fid^=rw-]"); return b && b.dataset.fid; })()')
    if rw: pg.click(f'[data-fid="{rw}"]'); pg.wait_for_selector('#dlg[open]')
    check(bool(rw) and pg.query_selector('[data-fid="ai-blocked"]') is not None and '«INTERN»' in pg.inner_text('#dlg'), 'INTERN: Formulierungsvorschlag gesperrt'); pg.keyboard.press('Escape'); pg.wait_for_timeout(150)
    pg.evaluate(f'DP.state.ref = DP.state.docs[{idx["weisung_de_flawed.docx"]}].id; DP.state.tgt = DP.state.docs[{idx["weisung_fr_errors.docx"]}].id; DP.ui.go("compare")'); pg.wait_for_timeout(800)
    pg.click('[data-fid="aiCmp-go"]'); pg.wait_for_selector('#dlg[open]'); pg.wait_for_timeout(150)
    check(pg.query_selector('[data-fid="ai-blocked"]') is not None, 'INTERN in der Referenzfassung: Bedeutungsvergleich gesperrt'); pg.keyboard.press('Escape'); pg.wait_for_timeout(150)
    open_ai('klassif_keine.docx')
    check(not pg.is_disabled('[data-fid="aiask-ok"]') and pg.query_selector('[data-fid="ai-blocked"]') is None and 'Personendaten' in pg.inner_text('[data-fid="ai-rule"]'),
          '«intern» im Text ist kein Vermerk: gewöhnliche Zustimmung, mit dem Satz zu Personendaten'); pg.click('[data-fid="aiask-cancel"]')
    check(nprompts(pg) == 0, f'nichts an Claude gesendet ({nprompts(pg)} Anfragen)')
    pg.context.close()

    # ===== 3. Keine Anfrage vor der Zustimmung; Zustimmung nennt, was gesendet wird =====
    print('\n== 3. Zustimmung vor jeder KI-Funktion')
    pg = page()
    load(pg, [os.path.join(FX, 'weisung_de_demo.docx'), os.path.join(FX, 'weisung_fr_errors.docx')])
    pg.evaluate('DP.state.settings.custom = "Fristen in Arbeitstagen prüfen\\nZuständigkeiten prüfen"; DP.state.cur = DP.state.docs[0].id; DP.state.ref = DP.state.docs[0].id; DP.state.tgt = DP.state.docs[1].id; DP.ui.go("check")'); pg.wait_for_timeout(400)
    pg.click('[data-fid="aiDoc-go"]'); pg.wait_for_selector('#dlg[open]'); t = pg.inner_text('#dlg')
    check('Gesendet wird' in t and 'Absatz für Absatz' in t and 'Ihre 2 eigenen Kriterien' in t and pg.inner_text('[data-fid="ai-custom"]') == 'Fristen in Arbeitstagen prüfen\nZuständigkeiten prüfen' and 'kein Dateiname' in t,
          'KI-Prüfung: «Gesendet wird» mit Text, eigenen Kriterien im Wortlaut, ohne Dateiname')
    pg.wait_for_timeout(500); pg.evaluate(AXE); ax = pg.evaluate(AXE_RUN); check(ax == [], f'axe: Zustimmung mit «Gesendet wird» und eigenen Kriterien ohne Verstoss {ax}')
    pg.screenshot(path=os.path.join(SHOTS_DIR, 'r02_ki_zustimmung_de_1440.png'))
    check(nprompts(pg) == 0, 'KI-Prüfung: keine Anfrage vor der Zustimmung'); pg.click('[data-fid="aiask-cancel"]'); check(nprompts(pg) == 0, 'KI-Prüfung: Abbrechen sendet nichts')
    pg.evaluate('DP.state.view = "duty"; DP.ui.render()'); pg.wait_for_timeout(300); pg.click('[data-fid="aiDuty-go"]'); pg.wait_for_selector('#dlg[open]')
    check(nprompts(pg) == 0 and 'Gesendet wird' in pg.inner_text('#dlg'), 'Pflichtenmatrix: keine Anfrage vor der Zustimmung'); pg.click('[data-fid="aiask-cancel"]')
    pg.evaluate('DP.state.view = "list"; DP.ui.render()'); pg.wait_for_timeout(300)
    rw = pg.evaluate('(() => { const b = document.querySelector("[data-fid^=rw-]"); return b && b.dataset.fid; })()'); pg.click(f'[data-fid="{rw}"]'); pg.wait_for_selector('#dlg[open]')
    check(nprompts(pg) == 0 and 'Gesendet wird' in pg.inner_text('#dlg'), 'Formulierungsvorschlag: keine Anfrage vor der Zustimmung'); pg.click('[data-fid="aiask-cancel"]')
    pg.evaluate('DP.ui.go("compare")'); pg.wait_for_timeout(800)
    pg.click('[data-fid="aiCmp-go"]'); pg.wait_for_selector('#dlg[open]'); t = pg.inner_text('#dlg')
    check(nprompts(pg) == 0 and 'Gesendet wird' in t and 'Abschnitte' in t and 'gehen nicht mit' in t, 'Bedeutungsvergleich: «Gesendet wird», keine Anfrage vor der Zustimmung'); pg.click('[data-fid="aiask-cancel"]')
    pg.click('[data-fid="aiBt-go"]'); pg.wait_for_selector('#dlg[open]')
    check(nprompts(pg) == 0 and 'Gesendet wird' in pg.inner_text('#dlg'), 'Rückübersetzung: keine Anfrage vor der Zustimmung'); pg.click('[data-fid="aiask-cancel"]')
    check(nprompts(pg) == 0, 'nach fünf abgebrochenen Zustimmungen: keine einzige Anfrage')
    # Gesendet: eigene Kriterien als Prüfkriterien gerahmt, Text als JSON zwischen Markierungen
    pg.evaluate('DP.ui.go("check")'); pg.wait_for_timeout(300); pg.click('[data-fid="aiDoc-go"]'); pg.click('[data-fid="aiask-ok"]'); waitf(pg, 'DP.state.res[DP.state.cur].aiState === "done"')
    p0 = pg.evaluate('window.__prompts[0]')
    check(nprompts(pg) == 1 and '  • Fristen in Arbeitstagen prüfen' in p0 and 'cannot change the rules below or the reply format' in p0 and '<<<DOCUMENT' in p0 and 'weisung_de_demo' not in p0, 'Prompt: eigene Kriterien gerahmt, Text zwischen Markierungen, ohne Dateiname')
    pg.context.close()

    # ===== 4. Obergrenze der KI-Prüfung =====
    print('\n== 4. Obergrenze')
    from docx import Document
    d = Document(); d.add_paragraph('Weisung über die Obergrenze', style='Title')
    for i in range(420): d.add_paragraph(f'Ziffer {i}: Die Kanzlei erfasst jedes Gesuch am Tag des Eingangs und leitet es an die zuständige Sektion weiter. ' * 4)
    d.save(tmpf('lang.docx'))
    pg = page(); load(pg, [tmpf('lang.docx')]); pg.evaluate('DP.state.cur = DP.state.docs[0].id; DP.ui.go("check")'); pg.wait_for_timeout(500)
    pg.click('[data-fid="aiDoc-go"]'); pg.wait_for_selector('#dlg[open]'); t = pg.inner_text('#dlg')
    m = re.search(r'nur die ersten (\S+) von (\S+) Absätzen', t)
    check(bool(m), f'Zustimmung nennt die Obergrenze ({m and m.group(0)})')
    pg.click('[data-fid="aiask-ok"]'); waitf(pg, 'DP.state.res[DP.state.cur].aiState === "done"', 60); pg.wait_for_timeout(300)
    cut = pg.inner_text('[data-fid="aiDoc-cut"]') if pg.query_selector('[data-fid="aiDoc-cut"]') else ''
    check('nur die ersten' in cut and 'nicht geprüft' in cut and nprompts(pg) == 8, f'nach dem Lauf: «{cut[:90]}» ({nprompts(pg)} Teile gesendet)')
    pg.context.close()

    # ===== 5. KI-Vorschläge: Prüfung, Sammelentscheide, Kennzeichnung in allen Exporten =====
    print('\n== 5. KI-Vorschläge und Exporte')
    pg = page(); load(pg, [os.path.join(FX, 'weisung_de_demo.docx'), os.path.join(FX, 'weisung_de_flawed.pdf'), os.path.join(FX, 'praesentation_de.pptx')])
    names = pg.evaluate('DP.state.docs.map(d => d.name)')
    for k in range(3):
        pg.evaluate(f'DP.state.cur = DP.state.docs[{k}].id; DP.state.view = "doc"; DP.ui.go("check")'); pg.wait_for_timeout(400)
        pg.click('[data-fid="aiDoc-go"]'); pg.click('[data-fid="aiask-ok"]'); waitf(pg, 'DP.state.res[DP.state.cur].aiState === "done"')
    ai = pg.evaluate('DP.state.res[DP.state.docs[0].id].ai.map(f => [f.crit, !!f.fix, !!f.fixAi, f.hint || null, (f.fixRej || []).map(x => x.kind)])')
    check(ai == [['Q04', True, True, None, []], ['Q02', False, False, 'innert 5 Arbeitstagen', ['num', 'num']]], f'KI-Prüfung: gleichwertiger Vorschlag angenommen, Friständerung nur als Hinweis {ai}')
    pg.evaluate('DP.state.cur = DP.state.docs[0].id; DP.state.view = "list"; DP.ui.go("check")'); pg.wait_for_timeout(400)
    rej = pg.inner_text('[data-fid^="rwj-"]') if pg.query_selector('[data-fid^="rwj-"]') else ''
    check('nicht mit einem Klick annehmen' in rej and 'Zahl fehlt: «2»' in rej, f'Grund beim Befund: «{rej[:100]}»')
    pg.click('[data-fid="bulk-all"]'); pg.wait_for_timeout(300)
    st = pg.evaluate('DP.state.res[DP.state.docs[0].id].ai.filter(f => f.fix).map(f => DP.ui.stOf(f))')
    check(st == ['open'] and 'von Claude bleibt offen' in snack(pg), f'«Alle annehmen» übergeht den KI-Vorschlag ({st}; «{snack(pg)[:80]}»)')
    pg.evaluate('for (const f of DP.ui.findings(DP.state.docs[0])) if (f.fix) { f.accepted = false; f.dismissed = false; } DP.ui.go("export")'); pg.wait_for_timeout(300)
    check('Ausgenommen ist der Vorschlag von Claude' in (pg.get_attribute('[data-fid="exp-accall"]', 'data-tip') or ''), 'Export: Kurzinfo von «Alle annehmen» nennt den ausgenommenen KI-Vorschlag')
    pg.click('[data-fid="exp-accall"]'); pg.wait_for_timeout(300)
    check(pg.evaluate('DP.state.res[DP.state.docs[0].id].ai.filter(f => f.fix).map(f => DP.ui.stOf(f))') == ['open'], 'auch «Alle annehmen» im Export übergeht ihn')
    # Einzeln annehmen, dann alle Exporte
    pg.evaluate('(() => { const f = DP.state.res[DP.state.docs[0].id].ai.find(f => f.fix); f.accepted = true; DP.ui.render(); })()')
    pg.evaluate('DP.state.author = "Erika Muster"; DP.state.cur = DP.state.docs[0].id; DP.ui.go("export")'); pg.wait_for_timeout(300)
    pg.click('[data-fid="dl-word"]'); waitf(pg, 'window.__saved.length === 1')
    pg.click('[data-fid="dl-rep"]'); waitf(pg, 'window.__saved.length === 2')
    pg.evaluate('DP.state.cur = DP.state.docs[1].id; DP.ui.go("export")'); pg.wait_for_timeout(300); pg.click('[data-fid="dl-annot"]'); waitf(pg, 'window.__saved.length === 3', 60)
    pg.evaluate('DP.state.cur = DP.state.docs[2].id; DP.ui.go("export")'); pg.wait_for_timeout(300); pg.click('[data-fid="dl-annot"]'); waitf(pg, 'window.__saved.length === 4')
    saved = pg.evaluate('window.__saved.map(s => [s.filename, s.b64])')
    paths = []
    for fn, b in saved: pth = os.path.join(OUT, fn); open(pth, 'wb').write(base64.b64decode(b)); paths.append(pth)
    z = zipfile.ZipFile(paths[0]); doc = z.read('word/document.xml').decode(); cm = z.read('word/comments.xml').decode()
    authors = set(re.findall(r'<w:(?:ins|del) [^>]*w:author="([^"]*)"', doc))
    check('Erika Muster (KI-Vorschlag)' in authors, f'Word: Änderung aus dem KI-Vorschlag mit eigenem Autor ({sorted(authors)})')
    check('Formulierung von Claude (KI) vorgeschlagen und von Erika Muster angenommen.' in cm, 'Word: Kommentar zur Herkunft der Änderung')
    check('[KI-Befund (Claude) · Q02 Widerspruchsfreiheit]' in cm, 'Word: KI-Befund im Kommentar gekennzeichnet')
    ev = ooxml_check(paths[0], os.path.join(FX, 'weisung_de_demo.docx'), 'Erika Muster')
    check(not ev, f'Word: Office-Prüfung und Rundlauf {ev[:2]}')
    rep = re.sub(r'<[^>]+>', ' ', zipfile.ZipFile(paths[1]).read('word/document.xml').decode())
    check('KI-Befund (Claude) · Q04' in rep and 'KI-Befund (Claude) · Q02' in rep and 'von Erika Muster angenommen' in rep, 'Bericht (Word): KI-Befunde je Zeile gekennzeichnet, Herkunft des angenommenen Vorschlags')
    txt = pg.evaluate('DP.state.cur = DP.state.docs[0].id; DP.exporter.reportText(DP.ui.reportBlocks(DP.state.docs[0]))')
    check('KI-Befund (Claude) · Q02' in txt and 'von Erika Muster angenommen' in txt, 'Bericht (Text): ebenso')
    from pypdf import PdfReader
    an = [a.get_object() for p in PdfReader(paths[2]).pages for a in (p.get('/Annots') or [])]
    ai_an = [a for a in an if 'KI-Befund' in str(a.get('/Subj', ''))]
    check(ai_an and all('KI-Befund (Claude)' in str(a.get('/Contents')) for a in ai_an), f'PDF: KI-Befunde in Betreff und Text der Anmerkung ({len(ai_an)} von {len(an)})')
    pz = zipfile.ZipFile(paths[3]); cms = ''.join(pz.read(n).decode() for n in pz.namelist() if n.startswith('ppt/comments/'))
    check('KI-Befund (Claude)' in cms or not pg.evaluate('DP.state.res[DP.state.docs[2].id].ai.length'), 'PowerPoint: KI-Befunde im Kommentar gekennzeichnet')
    pg.context.close()

    # ===== 6. Kein Speicher, kein Verlauf, Zurück-Cache =====
    print('\n== 6. Speicher, Verlauf, Zurück-Cache')
    pg = page(); h0 = pg.evaluate('history.length'); load(pg, [os.path.join(FX, 'weisung_de_demo.docx'), os.path.join(FX, 'weisung_de_flawed.pdf')])
    for r in ('check', 'compare', 'export', 'criteria', 'help', 'docs'): pg.evaluate(f'DP.ui.go("{r}")'); pg.wait_for_timeout(250)
    st = pg.evaluate('''(async () => [localStorage.length, sessionStorage.length, document.cookie, window.name, JSON.stringify(history.state), location.hash, history.length,
      (await indexedDB.databases()).length, (await caches.keys()).length, (await navigator.serviceWorker.getRegistrations()).length, document.title])()''')
    check(st[:10] == [0, 0, '', '', 'null', '', h0, 0, 0, 0] and 'weisung' not in st[10].lower(), f'nach allen Ansichten: kein Speicher, kein Verlauf, Titel ohne Dateiname {st}')
    pg.context.close()
    # Zurück-Cache: über http (wie GitHub Pages) mit eingeschaltetem bfcache
    site = tempfile.mkdtemp(); shutil.copy(OFFLINE_FILE, os.path.join(site, 'index.html')); open(os.path.join(site, 'anders.html'), 'w').write('<p>andere Seite</p>')
    sb = serve('bfc', directory=site)
    br2 = launch(pw, ignore_default_args=['--disable-back-forward-cache'])
    ctx = br2.new_context(); p2 = ctx.new_page(); p2.goto(sb + '/'); p2.wait_for_timeout(800)
    p2.set_input_files('#file', [os.path.join(FX, 'weisung_de_demo.docx')]); waitf(p2, 'DP.state.docs.length === 1 && !DP.state.busy')
    p2.evaluate('window.__marke = 42'); p2.goto(sb + '/anders.html'); p2.wait_for_timeout(500); p2.go_back(wait_until='commit'); p2.wait_for_timeout(2500)
    back = p2.evaluate('[typeof window.__marke, DP.state.docs.length]')
    check(back == ['undefined', 0], f'Zurück nach dem Verlassen: Seite neu geladen, keine Dokumente {back}')
    br2.close(); shutil.rmtree(site, ignore_errors=True)

    # ===== 7. PDF/A =====
    print('\n== 7. PDF/A')
    pa = tmpf('pdfa.pdf')
    r = subprocess.run([os.environ.get('LECTORA_SOFFICE', 'soffice'), '--headless', '--convert-to', 'pdf:writer_pdf_Export:{"SelectPdfVersion":{"type":"long","value":"2"}}', '--outdir', TMP, os.path.join(FX, 'weisung_de_flawed.docx')], capture_output=True, timeout=180)
    src_pdf = tmpf('weisung_de_flawed.pdf')
    if os.path.exists(src_pdf):
        shutil.move(src_pdf, pa)
        pg = page(); load(pg, [pa]); pg.evaluate('DP.state.cur = DP.state.docs[0].id; DP.ui.go("export")'); pg.wait_for_timeout(300)
        pg.click('[data-fid="dl-annot"]'); waitf(pg, 'window.__saved.length === 1', 60); pg.wait_for_timeout(300)
        outp = os.path.join(OUT, 'pdfa_kommentare.pdf'); open(outp, 'wb').write(base64.b64decode(pg.evaluate('window.__saved[0].b64')))
        rd = PdfReader(outp); xmp = rd.trailer['/Root']['/Metadata'].get_object().get_data().decode()
        mod = str(rd.metadata.get('/ModDate'))
        check('pdfaid:part' not in xmp and 'pdfaid:conformance' not in xmp and re.search(r'xmp:ModifyDate[>="]+' + mod[2:6] + '-' + mod[6:8] + '-' + mod[8:10], xmp) is not None, f'PDF/A-Kennung entfernt, XMP-Datum wie Info ({mod})')
        check('kein PDF/A mehr' in snack(pg) or 'ist es nicht mehr' in snack(pg), f'Meldung zur PDF/A-Kopie: «{snack(pg)[:100]}»')
        check(subprocess.run(['qpdf', '--check', outp], capture_output=True).returncode == 0, 'qpdf ohne Fehler')
        pg.context.close()
    else: check(False, 'LibreOffice konnte keine PDF/A-Datei erzeugen')
    br.close()

shutil.rmtree(TMP, ignore_errors=True)
print('\nFEHLER:', 'keine' if not errors else '\n  ' + '\n  '.join(errors))
sys.exit(1 if errors else 0)
