"""Oberflächentests zu den Befunden der Prüfung der Sprachfassungen (Review): Sammelentscheid und Liste der Sprachfassungen (X12),
KI-Vorschläge nie im Sammelentscheid, Spaltennamen für Screenreader in Gegenüberstellung, Synopse und Rückübersetzung, Fokus nach
Entscheiden im Vergleich, nach dem Entfernen eines Dokuments und nach Escape im Profildialog, Übersicht am Rand mit Pos1/Ende,
Hinweis bei Dokumenten, die einander nicht entsprechen, Name des Standardprofils in der Sprache der Oberfläche, Tastenkürzel und
Filter auf schmalen Bildschirmen. Testdokumente entstehen zur Laufzeit (synthetische Sätze). Letzte Zeile: «FEHLER: keine»."""
import sys, os, re, tempfile, json
sys.path.insert(0, os.path.dirname(__file__))
from engine_test import *
from ui_test import MOCK
from docx import Document
SHOTS = os.path.join(ROOT, 'test', 'shots'); os.makedirs(SHOTS, exist_ok=True)
TMP = tempfile.mkdtemp(prefix='lectora-sf-')
errors = []
def check(cond, msg):
    print(('ok    ' if cond else 'FEHLER ') + msg)
    if not cond: errors.append(msg)

def mkdoc(name, paras):
    d = Document()
    for kind, t in paras:
        if kind == 'h': d.add_heading(t, level=1)
        else: d.add_paragraph(t)
    p = os.path.join(TMP, name); d.save(p); return p
ABK_DE = mkdoc('abk_de.docx', [('h', '1 Abkürzungen'), ('p', 'Das Ausländer- und Integrationsgesetz wird abgekürzt als AIG (deutsch), LEI (französisch) und LStrI (italienisch).'),
    ('h', '2 Geltung'), ('p', 'Gemäss Art. 30 AIG kann das Staatssekretariat Ausnahmen bewilligen, wenn wichtige Gründe vorliegen.')])
ABK_FR = mkdoc('abk_fr.docx', [('h', '1 Abréviations'), ('p', 'La loi fédérale sur les étrangers et l’intégration est abrégée AIG (allemand), LEI (français) et LStrI (italien).'),
    ('h', '2 Validité'), ('p', 'Selon l’art. 30 AIG, le secrétariat d’État peut accorder des dérogations lorsque des motifs importants le justifient.')])
FOREIGN_FR = mkdoc('fremd_fr.docx', [('h', 'Rapport annuel de la bibliothèque'), ('p', 'La bibliothèque a prêté de nombreux livres pendant l’année écoulée.'),
    ('h', 'Collections'), ('p', 'Les collections comprennent des romans, des essais et des revues spécialisées.'), ('h', 'Horaires'),
    ('p', 'La salle de lecture est ouverte du lundi au vendredi.'), ('h', 'Perspectives'), ('p', 'La bibliothèque prévoit de rénover la salle de lecture.')])

def page(br, w=1440, h=900, locale='de-CH'):
    ctx = br.new_context(viewport={'width': w, 'height': h}, locale=locale, device_scale_factor=1, reduced_motion='reduce')
    ctx.grant_permissions(['clipboard-read', 'clipboard-write'])
    pg = ctx.new_page(); pg.add_init_script(MOCK)
    pg.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
    pg.goto(url(8781) + '/dist-local/index.html'); pg.wait_for_timeout(400)
    return pg
def load(pg, paths, n=None):
    pg.set_input_files('#file', [p if os.path.isabs(p) else os.path.join(FX, p) for p in paths])
    pg.wait_for_function(f'DP.state.docs.length === {n or len(paths)} && !DP.state.busy', timeout=60000); pg.wait_for_timeout(300)
def demo(pg):
    pg.click('[data-fid="demo"]'); pg.wait_for_function('DP.state.docs.length === 3 && !DP.state.busy', timeout=60000); pg.wait_for_timeout(300)
FOCUS = 'document.activeElement === document.body ? "BODY" : (document.activeElement.getAttribute("data-fid") || "#" + document.activeElement.id)'

def x12_list(br):
    print('== X12: Aufzählung der Sprachfassungen, Sammelentscheid')
    pg = page(br); load(pg, [ABK_DE, ABK_FR])
    pg.evaluate('DP.ui.go("compare")'); pg.wait_for_timeout(300)
    pg.evaluate('DP.state.cur = DP.state.docs[1].id; DP.ui.go("check")'); pg.wait_for_timeout(300)
    x12 = pg.evaluate('DP.ui.findings().filter(f => f.crit === "X12" || f.crit === "R04").map(f => f.crit + ":" + f.quote)')
    check(x12 == ['R04:AIG'], f'nur das deutsche Kürzel im Fliesstext wird gemeldet, nicht die Aufzählung ({x12})')
    if pg.query_selector('[data-fid="bulk-all"]'): pg.click('[data-fid="bulk-all"]'); pg.wait_for_timeout(300)
    txt = pg.evaluate('DP.state.docs[1].paras.map((p, i) => DP.ui.fixedText(i)).join("\\n")')
    check('AIG (allemand), LEI (français) et LStrI (italien)' in txt and 'LEI (allemand)' not in txt, '«Alle annehmen» lässt die Aufzählung unverändert')
    check('l’art. 30 LEI' in txt, '«Alle annehmen» korrigiert das Kürzel im Fliesstext')
    pg.context.close()

def ai_bulk(br):
    print('== KI-Vorschläge nie im Sammelentscheid (Prüfung der Änderung des anderen Reviews)')
    pg = page(br); load(pg, ['weisung_de_demo.docx']); pg.evaluate('DP.ui.go("check")'); pg.click('[data-fid="view-list"]'); pg.wait_for_timeout(200)
    fid = pg.evaluate('DP.ui.findings().find(f => f.crit === "L06" && f.quote === "sollte").id')
    pg.click(f'[data-fid="rw-{fid}"]'); pg.wait_for_selector('#dlg[open]'); pg.click('#dlg .btn:not(.text)'); pg.wait_for_function(f'!!DP.ui.findings().find(f => f.id === "{fid}").fixAi', timeout=20000)
    pg.click('[data-fid="bulk-all"]'); pg.wait_for_timeout(300)
    st = pg.evaluate(f'DP.ui.stOf(DP.ui.findings().find(f => f.id === "{fid}"))')
    check(st == 'open', f'Vorschlag von Claude bleibt nach «Alle annehmen» offen ({st})')
    pg.context.close()

def columns(br):
    print('== Spaltennamen für Screenreader')
    for w in (1440, 375):
        pg = page(br, w, 900); demo(pg); pg.evaluate('DP.ui.go("compare")'); pg.wait_for_timeout(300)
        snap = pg.locator('.segs .seg-row').first.aria_snapshot()
        has = lambda s, x: re.search(re.escape(x) + r' ?:', s) is not None
        check(has(snap, 'Referenzfassung · Deutsch') and has(snap, 'Zu prüfende Fassung · Französisch'), f'{w} px paarweise: jede Zelle nennt ihre Spalte')
        pg.click('[data-fid="cmp-mode-tri"]'); pg.wait_for_timeout(300)
        snap = pg.locator('.segs.tri .seg-row').first.aria_snapshot()
        check(all(has(snap, x) for x in ('Referenzfassung · Deutsch', 'Zu prüfende Fassung 1 · Französisch', 'Zu prüfende Fassung 2 · Italienisch')), f'{w} px Synopse: drei Spaltennamen ({snap[:160]!r})')
        vis = pg.evaluate('getComputedStyle(document.querySelector(".segs.tri .cell .mob")).position')
        check((vis == 'absolute') == (w > 840), f'{w} px: Spaltenname {"nur für Screenreader" if w > 840 else "sichtbar"} ({vis})')
        pg.evaluate('DP.ui.setLang("it")'); pg.wait_for_timeout(200)
        snap = pg.locator('.segs.tri .seg-row').first.aria_snapshot()
        check(has(snap, 'Versione di riferimento · Tedesco'), f'{w} px Synopse auf Italienisch')
        head = pg.inner_text('.tri-stats .pair-h')
        check('rispetto alla versione in francese' in head, f'Überschrift des Paars grammatisch ({head})')
        pg.context.close()
    # Rückübersetzung: dritte Spalte
    pg = page(br); demo(pg); pg.evaluate('DP.ui.go("compare")'); pg.wait_for_timeout(300)
    pg.click('[data-fid="aiBt-go"]'); pg.wait_for_selector('#dlg[open]'); pg.click('#dlg .btn:not(.text)')
    pg.wait_for_function('DP.state.bt && DP.state.bt.state !== "running"', timeout=30000); pg.wait_for_timeout(300)
    snap = pg.locator('.segs.bt .seg-row').first.aria_snapshot()
    check(re.search(r'Rückübersetzung · Deutsch ?:', snap) is not None, f'Rückübersetzung: Spaltenname für Screenreader ({snap[:200]!r})')
    pg.context.close()

def focus(br):
    print('== Fokus nach Entscheiden im Vergleich, Entfernen, Escape')
    for mode in ('pair', 'tri'):
        pg = page(br); demo(pg); pg.evaluate('DP.ui.go("compare")'); pg.wait_for_timeout(300)
        if mode == 'tri': pg.click('[data-fid="cmp-mode-tri"]'); pg.wait_for_timeout(300)
        cards = pg.evaluate('Array.from(document.querySelectorAll(".segs .find[data-id]")).map(c => c.dataset.id)')
        f0 = cards[1]
        dis = pg.evaluate(f'(document.querySelector(".find[data-id=\\"{f0}\\"] [data-fid^=dis-]") || document.querySelector(".find[data-id=\\"{f0}\\"] [data-fid^=fa-]")).dataset.fid')
        pg.focus(f'[data-fid="{dis}"]'); pg.keyboard.press('Enter'); pg.wait_for_timeout(300)
        fo = pg.evaluate(FOCUS); nxt = pg.evaluate('document.activeElement.closest(".find") && document.activeElement.closest(".find").dataset.id')
        check(fo not in ('BODY', '#view') and nxt == cards[2], f'{mode}: nach «{dis.split("-")[0]}» Fokus auf der nächsten Karte ({fo}, {nxt})')
        fa = pg.evaluate(f'document.querySelector(".find[data-id=\\"{cards[2]}\\"] [data-fid^=fa-]").dataset.fid')
        pg.focus(f'[data-fid="{fa}"]'); pg.keyboard.press('Enter'); pg.wait_for_timeout(300)
        fo = pg.evaluate(FOCUS); check(fo not in ('BODY', '#view'), f'{mode}: nach «Fehlalarm melden» Fokus auf einer Karte ({fo})')
        pg.context.close()
    pg = page(br); demo(pg); pg.evaluate('DP.ui.go("docs")'); pg.wait_for_timeout(300)
    ids = pg.evaluate('DP.state.docs.map(d => d.id)')
    pg.click(f'[data-fid="rm-{ids[0]}"]'); pg.wait_for_timeout(300)
    if pg.query_selector('#dlg[open]'): pg.click('#dlg .btn.danger')
    pg.wait_for_timeout(300); fo = pg.evaluate(FOCUS)
    check(fo == f'rm-{ids[1]}', f'nach dem Entfernen Fokus auf dem nächsten Dokument ({fo})')
    for k in ids[1:]: pg.click(f'[data-fid="rm-{k}"]'); pg.wait_for_timeout(300)
    fo = pg.evaluate(FOCUS); check(fo in ('pick', 'demo'), f'letztes Dokument entfernt: Fokus auf «Dateien auswählen» ({fo})')
    # Profil aus Datei, Escape
    p = os.path.join(TMP, 'profil.json'); json.dump({'format': 'lectora-profil', 'schema': 1, 'name': 'T', 'settings': {'off': ['L06']}}, open(p, 'w'))
    pg.evaluate('DP.ui.go("criteria")'); pg.wait_for_timeout(300)
    pg.set_input_files('#profFile', p); pg.wait_for_selector('#dlg[open]'); pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    fo = pg.evaluate(FOCUS); check(fo == 'prof-load', f'Escape im Profildialog aus einer Datei: Fokus auf «Profil laden» ({fo})')
    pg.evaluate('DP.ui.go("docs")'); pg.wait_for_timeout(200); pg.set_input_files('#file', p); pg.wait_for_selector('#dlg[open]'); pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    fo = pg.evaluate(FOCUS); check(fo not in ('BODY',), f'Escape im Profildialog von der Ablage: Fokus nicht verloren ({fo})')
    pg.context.close()

def rail_keys(br):
    print('== Übersicht am Rand: Pos1 und Ende')
    pg = page(br); load(pg, ['weisung_de_demo.docx']); pg.evaluate('DP.ui.go("check")'); pg.wait_for_timeout(300)
    n = len(pg.evaluate('DP.ui.rail()'))
    pg.focus('#dvRail'); pg.keyboard.press('End'); pg.wait_for_timeout(200)
    vt = pg.get_attribute('#dvRail', 'aria-valuetext'); check(vt.startswith(f'{n} von {n}'), f'Ende ohne Auswahl: letzter Befund ({vt})')
    pg.keyboard.press('Home'); pg.wait_for_timeout(200)
    vt = pg.get_attribute('#dvRail', 'aria-valuetext'); check(vt.startswith(f'1 von {n}'), f'Pos1: erster Befund ({vt})')
    order = pg.evaluate('(() => { const all = Array.from(document.querySelectorAll("button, [tabindex=\\"0\\"]")); return [all.indexOf(document.getElementById("dvRail")), all.findIndex(e => e.classList.contains("mc-title"))]; })()')
    check(0 <= order[0] < order[1], f'Übersicht vor den Randkarten in der Tabulatorfolge ({order})')
    pg.context.close()

def mismatch(br):
    print('== Dokumente, die einander nicht entsprechen')
    pg = page(br); load(pg, ['weisung_de_demo.docx', FOREIGN_FR]); pg.evaluate('DP.ui.go("compare")'); pg.wait_for_timeout(300)
    tgt = pg.evaluate('DP.state.tgt')
    check(pg.is_visible(f'[data-fid="cmp-mismatch-{tgt}"]') and not pg.query_selector('.segs'), 'paarweise: Hinweis statt Gegenüberstellung')
    n = pg.evaluate(f'DP.ui.findings(DP.state.docs.find(d => d.id === "{tgt}")).filter(f => f.cmp).length')
    badge = pg.evaluate('(document.querySelector("[data-fid=nav-compare] .badge") || {}).textContent || ""')
    check(n == 0 and badge == '', f'Befunde des Vergleichs zählen nicht mit ({n}, Abzeichen «{badge}»)')
    pg.evaluate('DP.ui.setLang("fr")'); pg.wait_for_timeout(200); txt = pg.inner_text(f'[data-fid="cmp-mismatch-{tgt}"]')
    check('ne semble pas correspondre' in txt and 'Afficher quand même la comparaison' in txt, 'Hinweis auf Französisch')
    pg.evaluate('DP.ui.setLang("de")'); pg.wait_for_timeout(200)
    pg.click(f'[data-fid="cmp-force-{tgt}"]'); pg.wait_for_timeout(300)
    check(pg.query_selector('.segs') is not None and pg.evaluate(FOCUS) not in ('BODY',), 'trotzdem zeigen: Gegenüberstellung erscheint, Fokus bleibt')
    pg.context.close()
    pg = page(br); demo(pg); pg.evaluate('DP.ui.go("compare")'); pg.wait_for_timeout(300)
    check(not pg.query_selector('[data-fid^="cmp-mismatch-"]'), 'Beispieldokumente: kein Hinweis')
    pg.context.close()

def profile_and_narrow(br):
    print('== Standardprofil, schmale Bildschirme, Sitzung leeren')
    pg = page(br); pg.evaluate('DP.ui.go("criteria")'); pg.wait_for_timeout(300)
    pg.select_option('#profStd', index=1); pg.click('[data-fid="prof-std"]'); pg.wait_for_selector('#dlg[open]'); pg.click('[data-fid="prof-apply"]'); pg.wait_for_timeout(300)
    de = pg.inner_text('#profState'); pg.evaluate('DP.ui.setLang("fr")'); pg.wait_for_timeout(200); fr = pg.inner_text('#profState'); val = pg.input_value('#profName')
    check('SGG Konzept' in de and 'SGG Concept' in fr and val == 'SGG Concept', f'Name des Standardprofils folgt der Sprache ({de!r} / {fr!r} / {val!r})')
    pg.evaluate('DP.ui.setLang("de")'); pg.click('#clearBtn'); pg.wait_for_timeout(200); pg.click('#dlg .btn.danger'); pg.wait_for_timeout(300)
    check(pg.evaluate('[DP.state.profStd, DP.ui.undoDepth(), DP.state.profile]') == [None, 0, None], 'Sitzung leeren: Standardprofil-Auswahl, Rückgängig-Stapel und Profil zurückgesetzt')
    pg.context.close()
    for lang in ('de', 'fr', 'it'):
        pg = page(br, 375, 800); load(pg, ['weisung_de_demo.docx'])
        pg.evaluate(f'DP.ui.setLang("{lang}"); DP.ui.go("check")'); pg.wait_for_timeout(300)
        check(not pg.is_visible('[data-fid="kb-help"]'), f'375 px {lang}: keine Schaltfläche für Tastenkürzel')
        r = pg.evaluate('(() => { const b = document.querySelector("[data-fid=f-hidden]").getBoundingClientRect(); return [Math.round(b.left), Math.round(b.right)]; })()')
        check(r[0] >= 0 and r[1] <= 375, f'375 px {lang}: «Ausgeblendete zeigen» ganz sichtbar ({r})')
        pg.evaluate('document.getElementById("rvBar").scrollIntoView()'); pg.wait_for_timeout(200); pg.screenshot(path=os.path.join(SHOTS, f'sf375_filter_{lang}.png'))
        pg.context.close()

def update_dates(br):
    print('== Hinweis zur Version: Datum in der Sprache der Oberfläche')
    f = OFFLINE_FILE
    for lang, exp in (('de', '1. Dezember 2026'), ('fr', '1er décembre 2026'), ('it', '1° dicembre 2026')):
        ctx = br.new_context(viewport={'width': 1440, 'height': 900}, locale='de-CH', reduced_motion='reduce')
        mock_version(ctx, version='9.9.9')
        ctx.route(VERSION_URL, lambda r: r.fulfill(status=200, body=json.dumps({'version': '9.9.9', 'date': '2026-12-01', 'note': {'de': 'Test', 'fr': 'Test', 'it': 'Test'}}), headers={'Access-Control-Allow-Origin': '*'}))
        pg = ctx.new_page(); pg.goto('file://' + f); pg.wait_for_timeout(1500); pg.evaluate(f'DP.ui.setLang("{lang}")'); pg.wait_for_timeout(200)
        txt = pg.inner_text('#updBand') if pg.is_visible('#updBand') else ''
        check(exp in txt and '2026-12-01' not in txt, f'{lang}: {txt[:90]!r}')
        mark = pg.inner_text('#offMark .sr') if pg.query_selector('#offMark .sr') else ''
        check(not re.search(r'\d{4}-\d\d-\d\d', mark), f'{lang}: Offline-Kennzeichen ohne ISO-Datum ({mark})')
        pg.screenshot(path=os.path.join(SHOTS, f'sf1440_update_{lang}.png'))
        ctx.close()

if __name__ == '__main__':
    serve(8781)
    with sync_playwright() as pw:
        br = launch(pw)
        for fn in (x12_list, ai_bulk, columns, focus, rail_keys, mismatch, profile_and_narrow, update_dates):
            try: fn(br)
            except Exception as e:
                import traceback; traceback.print_exc(); errors.append(fn.__name__ + ': ' + str(e).splitlines()[0])
        br.close()
    print('FEHLER:', errors if errors else 'keine')
    sys.exit(1 if errors else 0)
