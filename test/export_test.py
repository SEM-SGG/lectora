"""Word-Export (nachverfolgte und bereinigte Fassung, Prüfbericht): eigene Office-Prüfung (test/ooxml_check.py), Rundlauf durch
LibreOffice und python-docx, dazu der Nachweis, dass die Prüfung echte Fehler findet: absichtlich beschädigte Kopien müssen
durchfallen. Schluss: «FEHLER: keine» (Exit-Code 0)."""
import sys, os, base64, subprocess, tempfile, shutil, zipfile, re
sys.path.insert(0, os.path.dirname(__file__))
from engine_test import *
from ooxml_check import check as ooxml_check, roundtrip
OUT = os.path.join(ROOT, 'test', 'out'); os.makedirs(OUT, exist_ok=True)
serve(8768)
errors = []
def ok(cond, msg):
    print(('  ok   ' if cond else '  FEHLER ') + msg)
    if not cond: errors.append(msg)
JS = '''async ([n, ref, mode]) => {
  const d = docs[n];
  let F = DP.rules.runRules(d, {}).findings;
  if (ref) F = F.concat(DP.align.compare(docs[ref], d, {}).findings);
  const changes = F.filter(f => f.fix).map(f => ({para: f.para, start: f.fix.start, end: f.fix.end, repl: f.fix.repl, minimal: true, fallback: 'FALLBACK ' + f.crit}));
  // eine Satzumformulierung wie von der KI: wortweiser Diff
  const p = d.paras.find(p => /informe la personne|informiert sie die gesuchstellende/.test(p.text));
  if (p) { const s = p.text.indexOf('. ') + 2; changes.push({para: p.i, start: s, end: p.text.length, repl: p.text.slice(s).replace('avant son échéance', 'par écrit avant son échéance').replace('nouvelle date', 'nouvelle échéance').replace('vor Ablauf der Frist', 'schriftlich vor Ablauf der Frist').replace('neuen Termin', 'neuen Zeitpunkt'), fallback: 'FALLBACK rewrite'}); }
  const comments = F.filter(f => !f.fix).slice(0, 8).map(f => ({para: f.para == null ? null : f.para, text: f.crit + ': ' + f.key + (f.quote ? ' «' + f.quote.slice(0, 60) + '»' : '')}));
  const r = await DP.exporter.exportTracked(d, changes, comments, {author: 'Lectora', initials: 'LE', generalLabel: 'Allgemeine Hinweise', mode: mode || 'tracked'});
  // Erwartete Absatztexte nach dem Einsetzen der angewendeten Änderungen (für die bereinigte Fassung)
  const ok = changes.filter(c => !r.failed.includes(c));
  const byP = new Map(); for (const c of ok) { if (!byP.has(c.para)) byP.set(c.para, []); byP.get(c.para).push(c); }
  const expect = [];
  for (const [pi, cs] of byP) {
    const text = d.paras[pi].text, ops = [];
    for (const c of cs) for (const o of (c.minimal ? [c] : DP.exporter.diffOps(text.slice(c.start, c.end), c.repl, c.start))) ops.push(o);
    let t = text, floor = Infinity;
    for (const o of ops.sort((a, b) => b.start - a.start || b.end - a.end)) { if (o.end > floor) continue; t = t.slice(0, o.start) + o.repl + t.slice(o.end); floor = o.start; }
    expect.push(t);
  }
  const buf = new Uint8Array(await r.blob.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 8192) s += String.fromCharCode.apply(null, buf.subarray(i, i + 8192));
  return {b64: btoa(s), applied: r.applied, failed: r.failed.length, comments: r.comments, changes: changes.length, expect};
}'''
REP = '''async () => {
  const blob = await DP.exporter.exportReport([{title:'Prüfbericht'},{kv:[['Dokument','weisung.pdf'],['Ergebnis','Nicht bestanden']]},{h1:'1 Befunde'},{h2:'Formales'},{table:{head:['Nr.','Fundstelle','Feststellung','Textstelle','Vorschlag'],widths:[600,1600,3000,2200,2100],rows:[['1','Seite 2\\nAbschnitt 4.3','Platzhalter im Text','TODO Artikel',[{text:'alt',strike:true,color:'B3261E'},{text:' neu',u:true,color:'146C2E'}]],['2','Seite 1','Typografisches Zeichen & <Test>','„Leitfaden“','«Leitfaden»']]}},{p:'Schluss.'},{list:['eins','zwei']}], {lang:'de', title:'Prüfbericht', footer:'Lectora · Prüfbericht', author:'Lectora'});
  const buf = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 8192) s += String.fromCharCode.apply(null, buf.subarray(i, i + 8192));
  return btoa(s); }'''
with sync_playwright() as pw:
    br = launch(pw)
    pg = br.new_page(); pg.on('pageerror', lambda e: print('[pageerror]', e)); pg.on('console', lambda m: print('[console]', m.text) if m.type == 'error' and '404' not in m.text else None)
    pg.goto(url(8768) + '/test/harness.html')
    for n in ['weisung_de_flawed.docx', 'weisung_de_clean.docx', 'weisung_fr_errors.docx', 'weisung_de_demo.docx', 'komplex_de.docx', 'gross_de.docx']: pg.evaluate('([n,b]) => loadDoc(n,b)', [n, b64(n)])
    for n, ref in [('weisung_de_flawed.docx', None), ('weisung_fr_errors.docx', 'weisung_de_clean.docx'), ('weisung_de_demo.docx', None), ('komplex_de.docx', None), ('gross_de.docx', None)]:
        t0 = time.time(); r = pg.evaluate(JS, [n, ref]); print('  Dauer', round(time.time() - t0, 2), 's')
        out = os.path.join(OUT, n.replace('.docx', '_korr.docx'))
        open(out, 'wb').write(base64.b64decode(r['b64']))
        print(n, {k: v for k, v in r.items() if k not in ('b64', 'expect')})
        ev = ooxml_check(out, os.path.join(FX, n), 'Lectora')
        ok(not ev and r['applied'] > 0, f'{n}: Korrekturmodus, Office-Prüfung mit Rundlauf (Änderungen von Lectora verworfen = Original) ' + ('bestanden' if not ev else repr(ev[:3])))
        if n in ('weisung_de_flawed.docx', 'gross_de.docx'):
            tmp = tempfile.mkdtemp(); er = roundtrip(out, tmp); shutil.rmtree(tmp, ignore_errors=True)
            ok(not er, f'{n}: LibreOffice (nach PDF) und python-docx öffnen die Datei ' + ('ohne Fehler' if not er else repr(er)))
    # Bereinigte Fassung: Änderungen direkt im Text, keine w:ins/w:del von Lectora
    _re = re
    for n in ['weisung_de_flawed.docx', 'komplex_de.docx', 'gross_de.docx']:
        r = pg.evaluate(JS, [n, None, 'clean'])
        out = os.path.join(OUT, n.replace('.docx', '_bereinigt.docx'))
        open(out, 'wb').write(base64.b64decode(r['b64']))
        xml = zipfile.ZipFile(out).read('word/document.xml').decode('utf-8')
        marks = len(_re.findall(r'<w:(?:ins|del)\b[^>]*w:author="Lectora"', xml))
        # Absatztexte aus w:t (Tabulatoren und Umbrüche wie der Parser)
        paras = []
        for pm in _re.finditer(r'<w:p\b[^>]*>(.*?)</w:p>', xml, _re.S):
            body = _re.sub(r'<w:delText\b[^>]*>.*?</w:delText>', '', pm.group(1), flags=_re.S)
            txt = ''.join(_re.sub(r'<[^>]+>', '', m.group(0)) if m.group(0).startswith('<w:t') and not m.group(0).startswith('<w:tab') else ('\t' if m.group(0).startswith('<w:tab') else '\n') for m in _re.finditer(r'<w:t\b[^>]*>.*?</w:t>|<w:t/>|<w:tab/>|<w:br/>', body, _re.S))
            paras.append(txt.replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>').replace('&quot;', '"'))
        full = '\n'.join(paras)
        missing = [e for e in r['expect'] if e not in full]
        print(n, 'bereinigt:', {k: v for k, v in r.items() if k not in ('b64', 'expect')}, '| Lectora-Markierungen:', marks, '| erwartete Absätze fehlen:', len(missing))
        for e in missing[:3]: print('   fehlt:', e[:160])
        ev = ooxml_check(out)
        ok(not ev and marks == 0 and not missing and r['applied'] > 0, f'{n}: bereinigte Fassung ohne Markierungen von Lectora, mit allen Änderungen, Office-Prüfung ' + ('bestanden' if not ev else repr(ev[:3])))
    rep = os.path.join(OUT, 'bericht.docx'); open(rep, 'wb').write(base64.b64decode(pg.evaluate(REP)))
    ev = ooxml_check(rep); tmp = tempfile.mkdtemp(); er = roundtrip(rep, tmp); shutil.rmtree(tmp, ignore_errors=True)
    ok(not ev and not er, 'Prüfbericht: Office-Prüfung, LibreOffice und python-docx ' + ('ohne Befund' if not (ev or er) else repr((ev + er)[:3])))
    br.close()

# ===== Die Prüfung findet echte Fehler: beschädigte Kopien einer gültigen Ausgabe müssen durchfallen =====
print('\n== Gegenprobe: absichtlich beschädigte Exporte')
GOOD = os.path.join(OUT, 'weisung_de_flawed_korr.docx'); ORIG = os.path.join(FX, 'weisung_de_flawed.docx')
def mutate(src, dst, part, fn):
    zin = zipfile.ZipFile(src); zout = zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED)
    for i in zin.infolist():
        data = zin.read(i.filename)
        if i.filename == part:
            data = fn(data.decode('utf-8'))
            if data is None: continue
            data = data.encode('utf-8')
        zout.writestr(i, data)
    zout.close()
def first_sub(pat, repl):
    return lambda x: re.sub(pat, repl, x, count=1)
def dup_ins_id(x):
    ids = re.findall(r'<w:(?:ins|del) w:id="(\d+)" w:author="Lectora"', x)
    return x.replace(f'w:id="{ids[1]}" w:author="Lectora"', f'w:id="{ids[0]}" w:author="Lectora"', 1)
def drop_lectora_del(x):
    return re.sub(r'<w:del w:id="\d+" w:author="Lectora"[^>]*>.*?</w:del>', '', x, count=1, flags=re.S)
CASES = [
    ('XML nicht wohlgeformt', 'word/document.xml', lambda x: x.replace('</w:body>', '</w:bod>', 1), None, 'nicht wohlgeformt'),
    ('w:id einer Änderung doppelt', 'word/document.xml', dup_ins_id, None, 'doppelt'),
    ('w:t statt w:delText in einer Löschung', 'word/document.xml', lambda x: re.sub(r'(<w:del w:id="\d+" w:author="Lectora"[^>]*>(?:(?!</w:del>).)*?)<w:delText([^>]*)>(.*?)</w:delText>', r'\1<w:t\2>\3</w:t>', x, count=1, flags=re.S), None, 'verlangt: w:delText'),
    ('Änderung ohne Autor', 'word/document.xml', first_sub(r'(<w:ins w:id="\d+") w:author="Lectora"', r'\1'), None, 'ohne w:author'),
    ('Kommentarverweis ohne Kommentar', 'word/comments.xml', lambda x: re.sub(r'<w:comment w:id="0"[^>]*>.*?</w:comment>', '', x, count=1, flags=re.S), None, 'ohne Kommentar'),
    ('Inhaltstyp der Kommentare fehlt', '[Content_Types].xml', lambda x: re.sub(r'<Override PartName="/word/comments.xml"[^>]*/>', '', x), None, 'erwartet application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml'),
    ('Beziehung zeigt auf fehlenden Teil', 'word/_rels/document.xml.rels', lambda x: x.replace('Target="numbering.xml"', 'Target="numbering2.xml"'), None, 'Ziel fehlt'),
    ('Rundlauf: gelöschter Text verloren', 'word/document.xml', drop_lectora_del, 'Lectora', 'Rundlauf'),
]
tmpd = tempfile.mkdtemp()
ok(not ooxml_check(GOOD, ORIG, 'Lectora'), 'Ausgangsdatei besteht die Prüfung')
for name, part, fn, author, expect in CASES:
    bad = os.path.join(tmpd, 'bad.docx'); mutate(GOOD, bad, part, fn)
    ev = ooxml_check(bad, ORIG, author)
    ok(any(expect in e for e in ev), f'{name}: erkannt ({ev[0][:90] if ev else "NICHT erkannt"})')
# PowerPoint: Kommentare mit doppeltem idx und mit unbekanntem Autor (aus dem Testdokument mit vorhandenen Kommentaren)
PP = os.path.join(FX, 'praesentation_kommentare.pptx')
ok(not ooxml_check(PP), 'PowerPoint-Testdokument besteht die Prüfung')
cpart = sorted(n for n in zipfile.ZipFile(PP).namelist() if n.startswith('ppt/comments/'))[0]
for name, fn, expect in [
    ('PowerPoint: idx je Autor doppelt', lambda x: re.sub(r'(<p:cm [^>]*?)idx="\d+"', r'\1idx="1"', x), 'doppelt'),
    ('PowerPoint: Autor fehlt in commentAuthors', lambda x: re.sub(r'authorId="\d+"', 'authorId="99"', x, count=1), 'ohne Eintrag')]:
    bad = os.path.join(tmpd, 'bad.pptx'); mutate(PP, bad, cpart, fn)
    # idx="1" zweimal: nur wirksam, wenn der Teil mindestens zwei Kommentare desselben Autors hat; sonst im ersten Teil verdoppeln
    if 'doppelt' in expect and len(re.findall(r'<p:cm ', zipfile.ZipFile(PP).read(cpart).decode())) < 2:
        mutate(PP, bad, cpart, lambda x: re.sub(r'(<p:cm [^>]*>.*?</p:cm>)', r'\1\1', x, count=1, flags=re.S))
    ev = ooxml_check(bad)
    ok(any(expect in e for e in ev), f'{name}: erkannt ({ev[0][:90] if ev else "NICHT erkannt"})')
shutil.rmtree(tmpd, ignore_errors=True)
print('\nFEHLER:', 'keine' if not errors else '\n  ' + '\n  '.join(errors))
sys.exit(1 if errors else 0)
