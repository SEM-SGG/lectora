"""Export mit Kommentaren für PDF und PowerPoint: Anmerkungen bzw. Kommentare schreiben, mit unabhängigen Lesern prüfen
(pdf.js im Browser, Poppler für Wortlagen und Bilder, pypdf; LibreOffice, python-pptx, Office-Validator), Grenzfälle
(gedrehte Seiten, verschobener Ursprung, verschlüsselt, signiert, unlesbar, vorhandene Kommentare), dazu der Ablauf in der
Oberfläche (Export-Seite, Dialog bei Signatur, Meldung bei Verschlüsselung) mit Bildschirmfotos in DE und FR.
Aufruf: python3 test/annot_test.py · Schluss: «FEHLER: keine»."""
import sys, os, re, json, base64, subprocess, zipfile, tempfile, shutil
sys.path.insert(0, os.path.dirname(__file__))
from engine_test import *
OUT = os.path.join(ROOT, 'test', 'out'); os.makedirs(OUT, exist_ok=True)
SHOTS = os.path.join(ROOT, 'test', 'shots'); os.makedirs(SHOTS, exist_ok=True)
from ooxml_check import check as ooxml_check
errors = []
def check(ok, msg):
    print(('  ok   ' if ok else '  FEHLER ') + msg)
    if not ok: errors.append(msg)

# Befunde wie in der Oberfläche (annotItems): Vorschlag → Bereich des Vorschlags, Streichung → strike, sonst Textstelle oder Notiz
ITEMS = '''(d, ref) => DP.rules.runRules(d, {}).findings.concat(ref ? DP.align.compare(ref, d, {}).findings : []).filter(f => f.crit !== 'D01' && f.crit !== 'D02').map((f, k) => {
  const p = f.para != null && d.paras[f.para] ? f.para : null;
  const rg = f.fix ? f.fix : f.start != null && f.end != null ? f : null;
  const kind = p == null || !rg ? 'note' : f.fix && !f.fix.repl && f.fix.end > f.fix.start ? 'strike' : 'mark';
  return { para: p, start: rg ? rg.start : null, end: rg ? rg.end : null, kind, slide: f.slide || null,
    text: '#' + k + ' [' + f.crit + '] ' + f.key + ' «' + (rg && p != null ? d.paras[p].text.slice(rg.start, rg.end) : '') + '»' + (f.fix ? '\\nVorschlag: ' + f.fix.repl : ''), subj: f.crit };
})'''
B64 = 'async (blob) => { const buf = new Uint8Array(await blob.arrayBuffer()); let s = ""; for (let i = 0; i < buf.length; i += 8192) s += String.fromCharCode.apply(null, buf.subarray(i, i + 8192)); return btoa(s); }'

PDF_EXPORT = '''async ([n, author, ref]) => {
  const d = docs[n], items = (''' + ITEMS + ''')(d, ref ? docs[ref] : null);
  const opened = await DP.annot.pdfOpen(d);
  // Erwartung je Eintrag: Seite und Vierecke (oder Notiz), berechnet aus den Lagen des Parsers
  const expect = items.map(it => { const q = it.kind !== 'note' && it.para != null ? DP.annot.pdfQuads(d, it.para, it.start, it.end) : null;
    return { kind: it.kind, text: it.text, page: q ? q.page : (it.para != null ? d.paras[it.para].loc.page : 1), quads: q ? q.quads : null, quote: q ? d.paras[it.para].text.slice(q.start, q.end) : null }; });
  const res = await DP.annot.exportPdf(d, opened, items, { author });
  return { b64: await (''' + B64 + ''')(res.blob), marks: res.marks, notes: res.notes, fallback: res.fallback, signed: opened.signed, expect,
    view: d.geo.pages.map(p => p.view), rotate: d.geo.pages.map(p => p.rotate) };
}'''
# Unabhängig von pdf-lib: die Kopie mit pdf.js lesen (Anmerkungen) — dieselbe Bibliothek wie der Parser, aber nur lesend
PDFJS_READ = '''async (b64) => {
  const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  const pdf = await pdfjsLib.getDocument({ data: u, isEvalSupported: false }).promise, out = [];
  for (let n = 1; n <= pdf.numPages; n++) { const pg = await pdf.getPage(n); for (const a of await pg.getAnnotations()) out.push({ page: n, subtype: a.subtype, contents: a.contentsObj && a.contentsObj.str, author: a.titleObj && a.titleObj.str, rect: a.rect, quads: a.quadPoints ? (a.quadPoints.length && a.quadPoints[0] && a.quadPoints[0].length === 4 && typeof a.quadPoints[0][0] === 'object' ? a.quadPoints.flat().map(q => [q.x, q.y]) : Array.from({ length: a.quadPoints.length / 2 }, (_, i) => [a.quadPoints[2 * i], a.quadPoints[2 * i + 1]])) : null }); }
  const meta = await pdf.getMetadata(); await pdf.destroy();
  return { annots: out, producer: meta.info.Producer || '', creator: meta.info.Creator || '' };
}'''

def poppler_words(path):
    """Wörter mit Lage aus Poppler (angezeigte Seite, Ursprung oben links)."""
    xml = subprocess.run(['pdftotext', '-bbox', path, '-'], capture_output=True, text=True).stdout
    pages = []
    for pm in re.finditer(r'<page width="([\d.]+)" height="([\d.]+)">(.*?)</page>', xml, re.S):
        ws = [(float(a), float(b), float(c), float(d), w) for a, b, c, d, w in re.findall(r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)</word>', pm.group(3))]
        pages.append(ws)
    return pages
def to_user(view, rot, dx, dy):
    x0, y0, x1, y1 = view; r = rot % 360
    if r == 90: return (x0 + dy, y0 + dx)
    if r == 180: return (x1 - dx, y0 + dy)
    if r == 270: return (x1 - dy, y1 - dx)
    return (x0 + dx, y1 - dy)
alnum = lambda s: re.sub(r'[^0-9A-Za-zÀ-ÿ]', '', s.replace('&amp;', '&'))
def unq(s): return s.replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>').replace('&quot;', '"')

def pdf_case(pg, name, author='Prüferin Muster', ref=None):
    print('\n== PDF', name, '(Vergleich mit ' + ref + ')' if ref else '')
    for n in (name, ref):
        if n: pg.evaluate('([n,b]) => loadDoc(n,b)', [n, b64(n)])
    r = pg.evaluate(PDF_EXPORT, [name, author, ref])
    out = os.path.join(OUT, name.replace('.pdf', '_Kommentare.pdf')); open(out, 'wb').write(base64.b64decode(r['b64']))
    exp = r['expect']; nm = sum(1 for e in exp if e['quads']); nn = len(exp) - nm
    print('   Einträge', len(exp), '| Markierungen', r['marks'], '| Notizen', r['notes'], '| davon Ersatznotizen', r['fallback'])
    check(r['marks'] == nm and r['notes'] == nn and r['marks'] > 5, f'{name}: Anzahl Markierungen {r["marks"]} und Notizen {r["notes"]} wie erwartet')
    # qpdf: Struktur der Datei
    q = subprocess.run(['qpdf', '--check', out], capture_output=True, text=True); check(q.returncode == 0, f'{name}: qpdf --check ohne Fehler')
    # pdf.js liest die Anmerkungen: Anzahl, Typ, Seite, Inhalt, Autor
    rd = pg.evaluate(PDFJS_READ, r['b64']); an = rd['annots']
    check(len(an) == len(exp), f'{name}: pdf.js liest {len(an)} Anmerkungen (erwartet {len(exp)})')
    check('pdf-lib' not in rd['producer'] + rd['creator'], f'{name}: Producer/Creator unverändert ({rd["producer"]!r})')
    by = {}
    for a in an: by.setdefault(a['contents'], []).append(a)
    ok_type = ok_page = ok_auth = 0; wrong = []
    for e in exp:
        cand = by.get(e['text'], [])
        want = 'Text' if not e['quads'] else ('StrikeOut' if e['kind'] == 'strike' else 'Highlight')
        hit = next((a for a in cand if a['subtype'] == want), None)
        ok_type += bool(hit); ok_page += bool(hit and hit['page'] == e['page']); ok_auth += bool(hit and hit['author'] == author)
        if hit and hit['page'] != e['page']: wrong.append((e['text'][:50], e['page'], hit['page']))
    check(ok_type == len(exp), f'{name}: Typ und Inhalt je Befund stimmen ({ok_type}/{len(exp)})')
    check(ok_page == len(exp), f'{name}: Seite je Befund stimmt ({ok_page}/{len(exp)})' + (' ' + repr(wrong) if wrong else ''))
    check(ok_auth == len(exp), f'{name}: Autor «{author}» bei allen Anmerkungen ({ok_auth}/{len(exp)})')
    # pypdf: dieselben Anmerkungen, Viereckpunkte vorhanden
    from pypdf import PdfReader
    rr = PdfReader(out); n_py = sum(len(p.get('/Annots') or []) for p in rr.pages)
    quads_ok = all(len(a.get_object().get('/QuadPoints', [])) % 8 == 0 and len(a.get_object().get('/QuadPoints', [])) > 0 for p in rr.pages for a in (p.get('/Annots') or []) if a.get_object()['/Subtype'] in ('/Highlight', '/StrikeOut'))
    check(n_py == len(exp) and quads_ok, f'{name}: pypdf liest {n_py} Anmerkungen, QuadPoints in Achtergruppen')
    # Poppler: Lage jeder Markierung über den erwarteten Wörtern (Wortlagen aus der Kopie, unabhängig von pdf.js)
    words = poppler_words(out); good = 0; bad = []
    for a in an:
        if a['subtype'] not in ('Highlight', 'StrikeOut'): continue
        e = next(x for x in exp if x['text'] == a['contents'])
        view, rot = r['view'][a['page'] - 1], r['rotate'][a['page'] - 1]
        boxes = []
        for i in range(0, len(a['quads']), 4):
            pts = a['quads'][i:i + 4]; xs = [p[0] for p in pts]; ys = [p[1] for p in pts]; boxes.append((min(xs), min(ys), max(xs), max(ys)))
        hit = []
        for (wx0, wy0, wx1, wy1, w) in words[a['page'] - 1]:
            p0, p1 = to_user(view, rot, wx0, wy0), to_user(view, rot, wx1, wy1)
            bx = (min(p0[0], p1[0]), min(p0[1], p1[1]), max(p0[0], p1[0]), max(p0[1], p1[1]))
            # Wort getroffen: Mitte in der Höhe innerhalb des Vierecks, waagrecht (in Schreibrichtung) mindestens zur Hälfte bedeckt
            # oder das Viereck liegt ganz im Wort (Teil eines langen Wortes, etwa «http://» in einer Adresse)
            for b in boxes:
                # Schreibrichtung in Seitenkoordinaten: x (auch auf gedrehten Seiten; die Drehung betrifft nur die Anzeige)
                lo, hi, blo, bhi = bx[0], bx[2], b[0], b[2]
                c0, c1, d0, d1 = bx[1], bx[3], b[1], b[3]
                ov = min(hi, bhi) - max(lo, blo)
                if d0 - 1 <= (c0 + c1) / 2 <= d1 + 1 and ov > 0 and (ov >= 0.5 * (hi - lo) or ov >= 0.9 * (bhi - blo)): hit.append(unq(w)); break
        got, want = alnum(''.join(hit)), alnum(e['quote'])
        # Gleiche Zeichen: die markierten Wörter enthalten die Textstelle und kaum mehr (ganze Wörter um eine Teilstelle)
        if want and want in got and len(got) <= len(want) + 40: good += 1
        else: bad.append((e['quote'][:40], ' '.join(hit)[:60]))
    nmk = sum(1 for a in an if a['subtype'] in ('Highlight', 'StrikeOut'))
    check(good == nmk, f'{name}: {good}/{nmk} Markierungen liegen auf den erwarteten Wörtern (Poppler)' + ('' if not bad else ' – ' + repr(bad[:3])))
    # Notizen liegen innerhalb der sichtbaren Seite
    inside = all((lambda v: v[0] - 1 <= a['rect'][0] and a['rect'][2] <= v[2] + 1 and v[1] - 1 <= a['rect'][1] and a['rect'][3] <= v[3] + 1)(r['view'][a['page'] - 1]) for a in an)
    check(inside, f'{name}: alle Anmerkungen liegen auf der sichtbaren Seite (CropBox)')
    return out, r

def render(pdf, stem, pages=(1, 2)):
    paths = []
    for p in pages:
        base = os.path.join(SHOTS, stem)
        subprocess.run(['pdftoppm', '-r', '70', '-png', '-f', str(p), '-l', str(p), pdf, base], check=True)
        cand = [f for f in os.listdir(SHOTS) if f.startswith(stem + '-') and f.endswith('.png') and int(re.search(r'-(\d+)\.png$', f).group(1)) == p]
        if cand: paths.append(os.path.join(SHOTS, cand[0]))
    return paths

PPTX_EXPORT = '''async ([n, author]) => {
  const d = docs[n], items = (''' + ITEMS + ''')(d);
  const res = await DP.annot.exportPptx(d, items, { author, initials: 'PM' });
  return { b64: await (''' + B64 + ''')(res.blob), n: res.comments, atShape: res.atShape, atSlide: res.atSlide, items: items.length, paras: d.paras.map(p => [p.text, p.kind, p.loc.slide]) };
}'''
REPARSE = '''async ([n, b64]) => { await loadDoc(n, b64); const d = docs[n]; return { paras: d.paras.map(p => [p.text, p.kind, p.loc.slide]), comments: d.meta.comments }; }'''
NS = {'p': 'http://schemas.openxmlformats.org/presentationml/2006/main'}
def pptx_comments(path):
    import xml.etree.ElementTree as ET
    z = zipfile.ZipFile(path); auth = {}
    if 'ppt/commentAuthors.xml' in z.namelist():
        for a in ET.fromstring(z.read('ppt/commentAuthors.xml')).findall('p:cmAuthor', NS): auth[a.get('id')] = (a.get('name'), int(a.get('lastIdx')))
    cms = []
    for n in z.namelist():
        if re.match(r'ppt/comments/comment\d+\.xml$', n):
            for c in ET.fromstring(z.read(n)).findall('p:cm', NS):
                pos = c.find('p:pos', NS); cms.append({'part': n, 'author': auth.get(c.get('authorId'), ('?', 0))[0], 'idx': int(c.get('idx')), 'x': int(pos.get('x')), 'y': int(pos.get('y')), 'text': c.find('p:text', NS).text})
    return auth, cms

def validate(path, original):
    """Eigene Office-Prüfung (test/ooxml_check.py): Paket, Inhaltstypen, Beziehungen, Kommentarautoren und idx je Autor."""
    errs = ooxml_check(path, original)
    return not errs, '\n'.join('FAILED ' + e for e in errs) or 'PASSED'

def pptx_case(pg, name, author):
    print('\n== PowerPoint', name)
    src = os.path.join(FX, name)
    pg.evaluate('([n,b]) => loadDoc(n,b)', [name, b64(name)])
    r = pg.evaluate(PPTX_EXPORT, [name, author])
    out = os.path.join(OUT, name.replace('.pptx', '_Kommentare.pptx')); open(out, 'wb').write(base64.b64decode(r['b64']))
    print('   Kommentare', r['n'], '| an Formen', r['atShape'], '| oben links', r['atSlide'])
    check(r['n'] == r['items'] and r['n'] > 0, f'{name}: ein Kommentar je Befund ({r["n"]}/{r["items"]})')
    ok, txt = validate(out, src)
    print('   Office-Prüfung:', ' | '.join(txt.splitlines())[:600])
    check(ok, f'{name}: Office-Prüfung ohne Befund (Paket, Typen, Beziehungen, Kommentarautoren, idx je Autor)')
    a0, c0 = pptx_comments(src); a1, c1 = pptx_comments(out)
    before = {(c['author'], c['idx'], c['text']) for c in c0}; after = {(c['author'], c['idx'], c['text']) for c in c1}
    check(before <= after and len(c1) == len(c0) + r['n'], f'{name}: vorhandene Kommentare erhalten ({len(c0)}), neue dazu ({len(c1) - len(c0)})')
    names = [v[0] for v in a1.values()]
    check(names.count(author) == 1 and all(v[0] in names for v in a0.values()), f'{name}: Autorenliste ergänzt, nicht ersetzt ({names})')
    mine = [c for c in c1 if c['author'] == author]
    last = [v[1] for v in a1.values() if v[0] == author][0]
    idxs = sorted(c['idx'] for c in mine)
    check(len(set(idxs)) == len(idxs) and last == max(idxs), f'{name}: idx eindeutig je Autor, lastIdx = {last}')
    # Erneut einlesen: derselbe Folientext
    rp = pg.evaluate(REPARSE, [name + '#neu', r['b64']])
    check(rp['paras'] == r['paras'], f'{name}: Lectora liest denselben Folientext ({len(rp["paras"])} Absätze)')
    # python-pptx öffnet die Datei und liest dieselben Folien
    from pptx import Presentation
    try:
        P = Presentation(out); texts = [sh.text_frame.text for s in P.slides for sh in s.shapes if sh.has_text_frame and sh.text_frame.text.strip()]
        check(len(P.slides) == len(Presentation(src).slides) and texts, f'{name}: python-pptx öffnet die Kopie ({len(P.slides)} Folien)')
    except Exception as e: check(False, f'{name}: python-pptx: {e}')
    # LibreOffice: ohne Fehler nach PDF umwandeln; nach ODP: Anzahl Anmerkungen und Autoren
    tmp = tempfile.mkdtemp()
    c = subprocess.run(['soffice', '--headless', '--convert-to', 'pdf', '--outdir', tmp, out], capture_output=True, text=True, timeout=180)
    pdf = os.path.join(tmp, os.path.basename(out).replace('.pptx', '.pdf'))
    check(c.returncode == 0 and os.path.exists(pdf) and os.path.getsize(pdf) > 1000, f'{name}: LibreOffice wandelt ohne Fehler nach PDF um')
    c = subprocess.run(['soffice', '--headless', '--convert-to', 'odp', '--outdir', tmp, out], capture_output=True, text=True, timeout=180)
    odp = os.path.join(tmp, os.path.basename(out).replace('.pptx', '.odp'))
    content = zipfile.ZipFile(odp).read('content.xml').decode()
    n_ann = len(re.findall(r'<officeooo:annotation\b', content)); creators = re.findall(r'<officeooo:annotation\b.*?<dc:creator>([^<]*)</dc:creator>', content, re.S)
    want_auth = r['n'] + sum(1 for c in c0 if c['author'] == author)
    check(n_ann == len(c1) and creators.count(author) == want_auth, f'{name}: LibreOffice Impress liest {n_ann} Kommentare, {creators.count(author)} von «{author}» (davon {want_auth - r["n"]} schon vorher)')
    shutil.rmtree(tmp, ignore_errors=True)
    return out, c1, r

with sync_playwright() as pw:
    serve(8781)
    br = launch(pw)
    pg = br.new_page(); pg.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
    pg.goto(url(8781) + '/test/harness.html')

    # ===== PDF =====
    o1, r1 = pdf_case(pg, 'weisung_de_flawed.pdf')
    o2, r2 = pdf_case(pg, 'weisung_de_flawed_rot90.pdf')
    o3, r3 = pdf_case(pg, 'weisung_de_flawed_versatz_rot270.pdf')
    o4, r4 = pdf_case(pg, 'weisung_fr_errors.pdf', 'Lectora', 'weisung_de_clean.docx')
    # Gedrehte Seite und verschobener Ursprung: dieselben Vierecke wie im Original, verschoben um den Ursprung (150, 250)
    key = lambda e: re.sub(r'^#\d+ ', '', e['text'])
    rq = lambda x: [[round(v, 1) for v in q] for q in x] if x else None
    q1 = {key(e): rq(e['quads']) for e in r1['expect']}; q2 = {key(e): rq(e['quads']) for e in r2['expect']}
    q3 = {key(e): [[round(v - (150 if k % 2 == 0 else 250), 1) for k, v in enumerate(q)] for q in e['quads']] if e['quads'] else None for e in r3['expect']}
    common = [k for k in q1 if k in q2 and k in q3 and q1[k]]
    check(len(common) == r1['marks'] and all(q1[k] == q2[k] for k in common), f'Seitendrehung 90°: Vierecke gleich wie ohne Drehung ({len(common)} Markierungen, Seitenkoordinaten)')
    near = lambda a, b: len(a) == len(b) and all(abs(x - y) <= 0.15 for qa, qb in zip(a, b) for x, y in zip(qa, qb))
    off = [(k[:30], len(q1[k]), len(q3[k]), max((abs(x - y) for qa, qb in zip(q1[k], q3[k]) for x, y in zip(qa, qb)), default=None)) for k in common if not near(q1[k], q3[k])]
    check(not off, 'Ursprung (150, 250) und Drehung 270°: Vierecke um den Ursprung verschoben' + (' ' + repr(off[:3]) if off else ''))
    print('   zusätzliche Befunde der gedrehten Fassungen:', sorted(set(q2) - set(q1)), sorted(set(q3) - set(q1)))
    # Streichung (Vorschlag ohne Ersatztext) als StrikeOut, Einfügung als Markierung um die Einfügestelle
    so = pg.evaluate('''async () => { const d = docs['weisung_de_flawed.pdf']; const i = d.paras.findIndex(p => /nicht nicht/.test(p.text)), s0 = d.paras[i].text.indexOf('nicht nicht');
      const items = [{ para: i, start: s0, end: s0 + 6, kind: 'strike', text: 'Streichen', subj: 'L02' }, { para: i, start: s0 + 11, end: s0 + 11, kind: 'mark', text: 'Einfügen', subj: 'X' }];
      const res = await DP.annot.exportPdf(d, await DP.annot.pdfOpen(d), items, {author: 'A'}); const q = DP.annot.pdfQuads(d, i, s0 + 11, s0 + 11);
      return [res.marks, res.notes, await (''' + B64 + ''')(res.blob), d.paras[i].text.slice(q.start, q.end)]; }''')
    fso = os.path.join(OUT, 'streichung_Kommentare.pdf'); open(fso, 'wb').write(base64.b64decode(so[2]))
    from pypdf import PdfReader
    kinds = sorted(str(a.get_object()['/Subtype']) for pp in PdfReader(fso).pages for a in (pp.get('/Annots') or []))
    check(so[:2] == [2, 0] and kinds == ['/Highlight', '/StrikeOut'] and so[3].startswith('nicht'), f'Streichung als StrikeOut, Einfügung markiert die Wörter um die Stelle («{so[3]}»)')
    render(fso, 'annot_pdf_streichung', (1,))
    # Notizen bei gedrehten Seiten: oben links der angezeigten Seite (Poppler: angezeigte Lage)
    shots = render(o1, 'annot_pdf_flawed') + render(o2, 'annot_pdf_rot90', (1,)) + render(o3, 'annot_pdf_versatz_rot270', (1,)) + render(o4, 'annot_pdf_weisung_fr', (1, 2))
    print('   Bilder:', ', '.join(os.path.basename(p) for p in shots))
    # Unsichere Lage → Notiz statt Markierung: eine Textstelle ohne Zeichenherkunft
    fb = pg.evaluate('''async () => { const d = docs['weisung_de_flawed.pdf']; const i = d.paras.findIndex(p => /TODO/.test(p.text)); const keep = d.geo.maps[i]; d.geo.maps[i] = null;
      const items = [{ para: i, start: 0, end: 4, kind: 'mark', text: 'Probe', subj: 'X' }];
      const res = await DP.annot.exportPdf(d, await DP.annot.pdfOpen(d), items, {author: 'A'}); d.geo.maps[i] = keep; return [res.marks, res.notes, res.fallback, d.paras[i].loc.page]; }''')
    check(fb[:3] == [0, 1, 1], f'Ohne sichere Lage: Notiz statt Markierung auf Seite {fb[3]} ({fb})')
    # Verschlüsselt, signiert, unlesbar
    for n in ('weisung_de_verschluesselt.pdf', 'weisung_de_signiert.pdf', 'weisung_de_clean.pdf'): pg.evaluate('([n,b]) => loadDoc(n,b)', [n, b64(n)])
    enc = pg.evaluate('async () => { try { await DP.annot.pdfOpen(docs["weisung_de_verschluesselt.pdf"]); return "geöffnet"; } catch (e) { return e.code; } }')
    check(enc == 'encrypted', f'verschlüsselte PDF-Datei abgewiesen ({enc}), pdf.js hatte sie gelesen: {pg.evaluate("docs[\'weisung_de_verschluesselt.pdf\'].paras.length")} Absätze')
    sig = pg.evaluate('async () => [(await DP.annot.pdfOpen(docs["weisung_de_signiert.pdf"])).signed, (await DP.annot.pdfOpen(docs["weisung_de_clean.pdf"])).signed, (await DP.annot.pdfOpen(docs["weisung_de_flawed.pdf"])).signed]')
    check(sig == [True, False, False], f'Signatur erkannt nur bei der signierten Datei ({sig})')
    bad = pg.evaluate('async () => { const d = Object.assign({}, docs["weisung_de_clean.pdf"], { buffer: new TextEncoder().encode("%PDF-1.4 kaputt").buffer }); try { await DP.annot.pdfOpen(d); return "geöffnet"; } catch (e) { return e.code; } }')
    check(bad == 'unreadable', f'unlesbare Datei: klare Ablehnung ({bad})')
    # Original unverändert
    same = pg.evaluate('async () => { const d = docs["weisung_de_flawed.pdf"]; const u = new Uint8Array(d.buffer); let h = 0; for (const b of u) h = (h * 31 + b) >>> 0; return [u.length, h]; }')
    raw = open(os.path.join(FX, 'weisung_de_flawed.pdf'), 'rb').read(); hh = 0
    for b in raw: hh = (hh * 31 + b) & 0xffffffff
    check(same == [len(raw), hh], 'Dateidaten des Originals im Arbeitsspeicher unverändert')

    # ===== PowerPoint =====
    p1, c1, rr1 = pptx_case(pg, 'praesentation_de.pptx', 'Prüferin Muster')
    p2, c2, rr2 = pptx_case(pg, 'praesentation_kommentare.pptx', 'Lectora')
    # Lage: Platzhalter erben die Lage aus dem Layout, Gruppe und Tabelle aus ihrem Rahmen (Achtelpunkte = EMU / 1587.5)
    mine = [c for c in c2 if c['author'] == 'Lectora' and 'Früherer' not in (c['text'] or '')]
    grp = tbl = [c for c in mine if '[L03]' in (c['text'] or '')]
    print('   Lagen:', [(c['x'], c['y'], c['text'][:30]) for c in mine][:8])
    check(any((c['x'], c['y']) == (2880, 2304) for c in grp), 'Kommentar an der Form in der Gruppe: Lage (2880, 2304) = (5 in, 4 in)')
    check(any((c['x'], c['y']) == (288, 1152) for c in tbl), 'Kommentar an der Tabelle: Lage (288, 1152) = (0,5 in, 2 in)')
    body = [c for c in c1 if 'Mitarbeiter' in (c['text'] or '')]
    check(any((c['x'], c['y']) == (288, 1008) for c in body), 'Platzhalter ohne eigene Lage: Lage aus dem Layout (288, 1008)')
    check(any(c['x'] <= 200 and c['y'] == 10 for c in c1 if c['author'] == 'Prüferin Muster' and 'D04' in c['text']), 'Folienbefund (Bild ohne Alternativtext) oben links')
    br.close()

    # ===== Oberfläche: Export-Seite für PDF und PowerPoint =====
    from ui_test import MOCK
    serve(8782)
    br = launch(pw)
    def page(w, h, locale='de-CH'):
        ctx = br.new_context(viewport={'width': w, 'height': h}, locale=locale, device_scale_factor=1); ctx.grant_permissions(['clipboard-read', 'clipboard-write'])
        p = ctx.new_page(); p.add_init_script(MOCK)
        p.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
        p.on('console', lambda m: errors.append('console: ' + m.text) if m.type == 'error' and 'favicon' not in m.text and '404' not in m.text else None)
        p.goto(url(8782) + '/dist-local/index.html'); p.wait_for_timeout(500); return p
    focus = lambda p: p.evaluate('document.activeElement === document.body ? "BODY" : (document.activeElement.getAttribute("data-fid") || "#" + document.activeElement.id)')
    def load(p, names):
        p.set_input_files('#file', [os.path.join(FX, n) for n in names]); p.wait_for_function(f'DP.state.docs.length === {len(names)} && !DP.state.busy', timeout=30000); p.wait_for_timeout(200)
    for w, h in ((1440, 900), (375, 812)):
        for lang in ('de', 'fr'):
            p = page(w, h); load(p, ['weisung_de_flawed.pdf', 'praesentation_de.pptx'])
            p.evaluate(f'DP.ui.setLang("{lang}")')
            for k, fmt in ((0, 'pdf'), (1, 'pptx')):
                p.evaluate(f'DP.state.cur = DP.state.docs[{k}].id; DP.ui.go("export")'); p.wait_for_timeout(400)
                prim = p.evaluate('Array.from(document.querySelectorAll("main .btn")).filter(b => !/(^| )(tonal|outlined|text|ghost|danger)( |$)/.test(b.className.replace(/^btn ?/, ""))).map(b => b.dataset.fid)')
                check(prim == ['dl-annot'], f'{fmt} {lang} {w}px: eine Hauptaktion «{p.inner_text("[data-fid=dl-annot]")}» ({prim})')
                check('tonal' in p.get_attribute('[data-fid="dl-rep"]', 'class') and p.query_selector('[data-fid="cp-fixed"]') and p.query_selector('[data-fid="cp-rep"]'), f'{fmt} {lang}: Bericht sekundär, Kopierfunktionen bleiben')
                # Knöpfe brechen nicht um und bleiben in der Karte
                ov = p.evaluate('Array.from(document.querySelectorAll("main .btn")).filter(b => b.getClientRects().length && (b.scrollWidth > b.clientWidth + 1 || b.getBoundingClientRect().right > document.documentElement.clientWidth)).map(b => b.dataset.fid)')
                check(not ov, f'{fmt} {lang} {w}px: keine abgeschnittenen Knöpfe ({ov})')
                p.evaluate('document.querySelector("#expF").scrollIntoView({block: "start"})'); p.wait_for_timeout(150)
                p.screenshot(path=os.path.join(SHOTS, f'50_export_{fmt}_{lang}_{w}.png'), full_page=False)
            p.context.close()
    # Ablauf: herunterladen, Inhalt im Mock, Sprache der Rückmeldung, Option, Autor
    p = page(1440, 900); load(p, ['weisung_de_flawed.pdf'])
    p.evaluate('DP.ui.go("export")'); p.wait_for_timeout(300)
    n_all = p.evaluate('DP.ui.annotItems(DP.state.docs[0]).length')
    p.fill('#author', 'Kim Muster'); p.select_option('#expLang', 'fr'); p.wait_for_timeout(100)
    p.click('[data-fid="dl-annot"]'); p.wait_for_function('window.__saved.length === 1', timeout=20000)
    sv = p.evaluate('window.__saved[0]'); f1 = os.path.join(OUT, 'ui_' + sv['filename']); open(f1, 'wb').write(base64.b64decode(sv['b64']))
    from pypdf import PdfReader
    an = [a.get_object() for pp in PdfReader(f1).pages for a in (pp.get('/Annots') or [])]
    check(sv['filename'] == 'weisung_de_flawed_Commentaires.pdf' and len(an) == n_all, f'UI: Datei {sv["filename"]} mit {len(an)} Anmerkungen (erwartet {n_all})')
    check(all(str(a['/T']) == 'Kim Muster' for a in an) and any('Proposition: ' in str(a['/Contents']) for a in an), 'UI: Autor aus dem Feld, Kommentare in der gewählten Sprache (FR)')
    check(focus(p) == 'dl-annot', f'UI: Fokus bleibt auf der Schaltfläche ({focus(p)})')
    # Option aus: nur angenommene Vorschläge
    p.click('[data-fid="optC"]'); p.wait_for_timeout(200)
    check(p.is_disabled('[data-fid="dl-annot"]') and p.inner_text('[data-fid="ann-n"]').startswith('0'), 'UI: ohne Option und ohne angenommene Vorschläge nichts zu exportieren (Knopf gesperrt)')
    p.evaluate('DP.ui.findings().filter(f => f.fix).slice(0, 3).forEach(f => f.accepted = true); DP.ui.findings().filter(f => f.fix).slice(3, 5).forEach(f => f.dismissed = true); DP.ui.render()'); p.wait_for_timeout(200)
    na = p.evaluate('DP.ui.annotItems(DP.state.docs[0]).length'); check(na == 3, f'UI: nur die 3 angenommenen Vorschläge ({na})')
    p.click('[data-fid="optC"]'); p.wait_for_timeout(200)
    nb = p.evaluate('DP.ui.annotItems(DP.state.docs[0]).length'); check(nb == n_all - 2, f'UI: mit Option alle ausser 2 abgelehnten ({nb} = {n_all} − 2)')
    p.context.close()
    # Signierte Datei: Dialog, Abbrechen speichert nichts, Weiter speichert
    p = page(1440, 900); load(p, ['weisung_de_signiert.pdf']); p.evaluate('DP.ui.go("export")'); p.wait_for_timeout(300)
    p.click('[data-fid="dl-annot"]'); p.wait_for_selector('#dlg[open] [data-fid="sig-go"]', timeout=20000)
    check(focus(p) == 'sig-cancel' and 'Signatur' in p.inner_text('#dlg'), 'Signatur: Dialog mit Warnung, Fokus auf «Abbrechen»')
    p.screenshot(path=os.path.join(SHOTS, '51_export_pdf_signed_dialog_de.png'))
    p.keyboard.press('Escape'); p.wait_for_timeout(400)
    check(p.evaluate('window.__saved.length') == 0 and focus(p) == 'dl-annot', f'Signatur: Escape speichert nichts, Fokus zurück ({focus(p)})')
    p.click('[data-fid="dl-annot"]'); p.wait_for_selector('#dlg[open] [data-fid="sig-go"]'); p.click('[data-fid="sig-go"]'); p.wait_for_function('window.__saved.length === 1', timeout=20000)
    check(p.evaluate('window.__saved[0].filename') == 'weisung_de_signiert_Kommentare.pdf', 'Signatur: «Trotzdem herunterladen» speichert die Kopie')
    p.context.close()
    # Verschlüsselt: klare Meldung, Bericht bleibt
    for lang in ('de', 'fr'):
        p = page(1440, 900); load(p, ['weisung_de_verschluesselt.pdf']); p.evaluate(f'DP.ui.setLang("{lang}"); DP.ui.go("export")'); p.wait_for_timeout(300)
        p.click('[data-fid="dl-annot"]'); p.wait_for_selector('[data-fid="ann-err"]', timeout=20000)
        check(p.is_disabled('[data-fid="dl-annot"]') and not p.is_disabled('[data-fid="dl-rep"]') and focus(p) == 'dl-rep' and p.evaluate('window.__saved.length') == 0, f'Verschlüsselt ({lang}): Meldung, Knopf gesperrt, Fokus auf dem Bericht ({focus(p)})')
        p.evaluate('document.querySelector("#expF").scrollIntoView({block: "start"})'); p.wait_for_timeout(100)
        p.screenshot(path=os.path.join(SHOTS, f'52_export_pdf_encrypted_{lang}.png'))
        p.click('[data-fid="dl-rep"]'); p.wait_for_function('window.__saved.length === 1', timeout=20000)
        check(p.evaluate('window.__saved[0].filename').endswith('.docx'), f'Verschlüsselt ({lang}): Prüfbericht weiterhin verfügbar')
        p.context.close()
    # PowerPoint über die Oberfläche
    p = page(1440, 900); load(p, ['praesentation_kommentare.pptx']); p.evaluate('DP.ui.go("export")'); p.wait_for_timeout(300)
    p.click('[data-fid="dl-annot"]'); p.wait_for_function('window.__saved.length === 1', timeout=20000)
    sv = p.evaluate('window.__saved[0]'); f2 = os.path.join(OUT, 'ui_' + sv['filename']); open(f2, 'wb').write(base64.b64decode(sv['b64']))
    a2, cm2 = pptx_comments(f2)
    check(sv['filename'] == 'praesentation_kommentare_Kommentare.pptx' and len(cm2) == 3 + p.evaluate('DP.ui.annotItems(DP.state.docs[0]).length'), f'UI PowerPoint: {sv["filename"]}, {len(cm2)} Kommentare (3 vorhandene)')
    p.context.close()
    br.close()

print('\nFEHLER:', 'keine' if not errors else '\n  ' + '\n  '.join(errors))
sys.exit(1 if errors else 0)
