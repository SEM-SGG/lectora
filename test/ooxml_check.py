"""Eigene Prüfung der Office-Exporte von Lectora (Word .docx, PowerPoint .pptx). Ersetzt einen externen Validator.

Geprüft wird, was eine Datei für Word und PowerPoint unbrauchbar macht oder einen «Reparieren?»-Dialog auslöst:
  Paket       ZIP lesbar, keine doppelten oder unsicheren Namen, [Content_Types].xml und _rels/.rels vorhanden
  XML         jeder XML-Teil wohlgeformt (ohne DTD, ohne Entitäten), Präfixe in mc:Ignorable deklariert
  Typen       jeder Teil hat einen Inhaltstyp (Override oder Default), jeder Override zeigt auf einen vorhandenen Teil,
              Hauptteil, Kommentare und Kommentarautoren mit dem richtigen Typ
  Beziehungen Id je .rels-Datei eindeutig, interne Ziele vorhanden, jede r:id/r:embed/r:link eines Teils in dessen .rels
  Word        w:id der Änderungen (w:ins, w:del, …Change) eindeutig; Autor und gültiges Datum; in w:del nur w:delText,
              in w:ins kein w:delText; Änderungen nur an zulässigen Stellen; Kommentare: Id eindeutig, Bereich und Verweis
              vollständig und auf einen vorhandenen Kommentar; w14:paraId eindeutig und unter 0x80000000
  Rundlauf    mit --original und --author: Verwirft man alle Änderungen dieser Person (auch «NAME (Zusatz)», z. B. KI-Vorschläge), entsteht wieder der Text des Originals
              (Absatz für Absatz); vorhandene Änderungen und Kommentare anderer Personen bleiben erhalten
  PowerPoint  Kommentarautoren mit eindeutiger id, jeder Kommentar mit vorhandenem Autor, idx je Autor eindeutig und
              höchstens lastIdx, jeder Kommentarteil von genau einer Folie verknüpft, Folien-Ids eindeutig

Verwendung:  python3 test/ooxml_check.py DATEI [--original ORIGINAL] [--author NAME]
Ausgabe: eine Zeile je Befund, am Schluss «PASSED» oder «FAILED (n)»; Exit-Code 0 bzw. 1.
Optional: LECTORA_OOXML_VALIDATOR=/pfad/validate.py ruft zusätzlich einen externen Validator auf (gleiche Argumente).
"""
import os, re, sys, zipfile, posixpath, subprocess, datetime
from lxml import etree

NS = {
    'ct': 'http://schemas.openxmlformats.org/package/2006/content-types',
    'pr': 'http://schemas.openxmlformats.org/package/2006/relationships',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
    'w14': 'http://schemas.microsoft.com/office/word/2010/wordml',
    'mc': 'http://schemas.openxmlformats.org/markup-compatibility/2006',
    'p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
}
W = '{%s}' % NS['w']
REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/'
CT = {
    'docx-main': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml',
    'docx-comments': 'application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml',
    'pptx-main': 'application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml',
    'pptx-comments': 'application/vnd.openxmlformats-officedocument.presentationml.comments+xml',
    'pptx-authors': 'application/vnd.openxmlformats-officedocument.presentationml.commentAuthors+xml',
    'rels': 'application/vnd.openxmlformats-package.relationships+xml',
}
CHANGE_TAGS = {W + t for t in ('ins', 'del', 'moveFrom', 'moveTo', 'rPrChange', 'pPrChange', 'sectPrChange', 'tblPrChange', 'trPrChange', 'tcPrChange', 'tblGridChange', 'numberingChange', 'cellIns', 'cellDel', 'cellMerge')}
RUN_CONTAINERS = {W + t for t in ('p', 'hyperlink', 'smartTag', 'sdtContent', 'fldSimple', 'customXml', 'ins', 'del', 'moveFrom', 'moveTo', 'rPr', 'trPr', 'body', 'tbl', 'tc', 'tr', 'r', 'comment', 'footnote', 'endnote', 'hdr', 'ftr', 'txbxContent', 'bdo', 'dir')}
PARSER = etree.XMLParser(resolve_entities=False, no_network=True, load_dtd=False, huge_tree=False)


def _xml(z, name, errs):
    try:
        data = z.read(name)
    except KeyError:
        errs.append(f'{name}: fehlt'); return None
    if b'<!DOCTYPE' in data[:2048] or b'<!ENTITY' in data:
        errs.append(f'{name}: DTD oder Entitätsdeklaration'); return None
    try:
        return etree.fromstring(data, PARSER)
    except etree.XMLSyntaxError as e:
        errs.append(f'{name}: nicht wohlgeformt ({e})'); return None


def _rels_name(part):
    d, b = posixpath.split(part)
    return posixpath.join(d, '_rels', b + '.rels')


def _target(part, target):
    if target.startswith('/'): return posixpath.normpath(target[1:])
    return posixpath.normpath(posixpath.join(posixpath.dirname(part), target))


class Package:
    def __init__(self, path):
        self.path = path; self.errs = []; self.z = None; self.xml = {}; self.rels = {}; self.kind = None
        try:
            self.z = zipfile.ZipFile(path)
        except Exception as e:
            self.errs.append(f'kein lesbares ZIP-Paket: {e}'); return
        names = [i.filename for i in self.z.infolist()]
        self.names = set(names)
        if len(names) != len(self.names): self.errs.append('doppelte Teilnamen im ZIP')
        for n in names:
            if n.startswith('/') or '..' in n.split('/') or '\\' in n: self.errs.append(f'unsicherer Teilname: {n}')
        bad = self.z.testzip()
        if bad: self.errs.append(f'beschädigter ZIP-Eintrag: {bad}')
        for n in names:
            if n.endswith('.xml') or n.endswith('.rels'):
                x = _xml(self.z, n, self.errs)
                if x is not None: self.xml[n] = x
        self.kind = 'docx' if 'word/document.xml' in self.names else 'pptx' if 'ppt/presentation.xml' in self.names else None
        if self.kind is None: self.errs.append('weder word/document.xml noch ppt/presentation.xml')
        for need in ('[Content_Types].xml', '_rels/.rels'):
            if need not in self.names: self.errs.append(f'{need}: fehlt')

    def parts(self):
        return [n for n in self.names if not n.endswith('/') and n != '[Content_Types].xml' and '/_rels/' not in '/' + n and not n.endswith('.rels')]

    # ---------- Inhaltstypen ----------
    def check_content_types(self):
        ct = self.xml.get('[Content_Types].xml')
        if ct is None: return
        defaults = {d.get('Extension', '').lower(): d.get('ContentType') for d in ct.findall('ct:Default', NS)}
        overrides = {}
        for o in ct.findall('ct:Override', NS):
            pn = o.get('PartName') or ''
            if not pn.startswith('/'): self.errs.append(f'[Content_Types].xml: PartName ohne führenden Schrägstrich: {pn}')
            key = pn.lstrip('/')
            if key.lower() in {k.lower() for k in overrides}: self.errs.append(f'[Content_Types].xml: Override doppelt: {pn}')
            overrides[key] = o.get('ContentType')
            if key not in self.names: self.errs.append(f'[Content_Types].xml: Override für fehlenden Teil {pn}')
        if defaults.get('rels') != CT['rels']: self.errs.append('[Content_Types].xml: Default für .rels fehlt oder falsch')
        self.ctype = {}
        for n in self.names:
            if n.endswith('/') or n == '[Content_Types].xml': continue
            t = overrides.get(n) or defaults.get(n.rsplit('.', 1)[-1].lower() if '.' in n else '')
            if not t: self.errs.append(f'{n}: kein Inhaltstyp (weder Override noch Default)')
            self.ctype[n] = t
        want = [('word/document.xml', 'docx-main')] if self.kind == 'docx' else [('ppt/presentation.xml', 'pptx-main')] if self.kind == 'pptx' else []
        for n in self.names:
            if self.kind == 'docx' and n == 'word/comments.xml': want.append((n, 'docx-comments'))
            if self.kind == 'pptx' and re.fullmatch(r'ppt/comments/comment\d+\.xml', n): want.append((n, 'pptx-comments'))
            if self.kind == 'pptx' and n == 'ppt/commentAuthors.xml': want.append((n, 'pptx-authors'))
        for n, k in want:
            if n in self.names and self.ctype.get(n) != CT[k]: self.errs.append(f'{n}: Inhaltstyp {self.ctype.get(n)!r}, erwartet {CT[k]}')

    # ---------- Beziehungen ----------
    def check_relationships(self):
        for rn, x in self.xml.items():
            if not rn.endswith('.rels'): continue
            src = '' if rn == '_rels/.rels' else posixpath.join(posixpath.dirname(posixpath.dirname(rn)), posixpath.basename(rn)[:-5])
            if src and src not in self.names: self.errs.append(f'{rn}: Beziehungen für fehlenden Teil {src}')
            ids = {}
            for r in x.findall('pr:Relationship', NS):
                rid, typ, tgt, mode = r.get('Id'), r.get('Type'), r.get('Target'), r.get('TargetMode')
                if not rid or not re.fullmatch(r'[A-Za-z_][\w.-]*', rid): self.errs.append(f'{rn}: ungültige Id {rid!r}')
                if rid in ids: self.errs.append(f'{rn}: Id doppelt: {rid}')
                if not typ or not tgt: self.errs.append(f'{rn}: Beziehung {rid} ohne Type oder Target')
                ids[rid] = (typ, tgt, mode)
                if mode != 'External' and tgt:
                    t = _target(src or '/', tgt) if src else tgt.lstrip('/')
                    if t not in self.names: self.errs.append(f'{rn}: Ziel fehlt: {rid} → {tgt}')
            self.rels[src] = ids
        root = self.rels.get('', {})
        if not any(typ == REL + 'officeDocument' for typ, _, _ in root.values()): self.errs.append('_rels/.rels: keine Beziehung officeDocument')
        # Jede r:-Referenz eines Teils steht in dessen Beziehungen
        for n, x in self.xml.items():
            if n.endswith('.rels') or n == '[Content_Types].xml': continue
            ids = self.rels.get(n, {})
            for el in x.iter():
                for a, v in el.attrib.items():
                    if a.startswith('{%s}' % NS['r']) and a.split('}')[1] in ('id', 'embed', 'link', 'pict', 'href', 'dm', 'lo', 'qs', 'cs') and v and v not in ids:
                        self.errs.append(f'{n}: r:{a.split("}")[1]}="{v}" ohne Beziehung')

    # ---------- Namensräume ----------
    def check_namespaces(self):
        for n, x in self.xml.items():
            for el in x.iter():
                ig = el.get('{%s}Ignorable' % NS['mc'])
                if ig:
                    for pre in ig.split():
                        if pre not in (el.nsmap or {}): self.errs.append(f'{n}: mc:Ignorable nennt nicht deklariertes Präfix {pre!r}')

    # ---------- Word ----------
    def check_docx(self):
        doc = self.xml.get('word/document.xml')
        if doc is None: return
        parts = [n for n in self.xml if re.fullmatch(r'word/(document|comments|header\d*|footer\d*|footnotes|endnotes)\.xml', n)]
        seen = {}
        for n in parts:
            x = self.xml[n]
            for el in x.iter():
                if el.tag in CHANGE_TAGS:
                    i = el.get(W + 'id')
                    if i is None or not re.fullmatch(r'-?\d+', i): self.errs.append(f'{n}: <{el.tag.split("}")[1]}> ohne gültige w:id'); continue
                    if i in seen: self.errs.append(f'{n}: w:id {i} doppelt ({seen[i]} und {el.tag.split("}")[1]})')
                    seen[i] = el.tag.split('}')[1]
                    if not el.get(W + 'author'): self.errs.append(f'{n}: <{el.tag.split("}")[1]} w:id="{i}"> ohne w:author')
                    d = el.get(W + 'date')
                    if d is not None and not _isodate(d): self.errs.append(f'{n}: w:date {d!r} ist kein gültiges Datum')
                    if el.tag in (W + 'ins', W + 'del') and el.getparent() is not None and el.getparent().tag not in RUN_CONTAINERS:
                        self.errs.append(f'{n}: <{el.tag.split("}")[1]} w:id="{i}"> an unzulässiger Stelle (in {el.getparent().tag.split("}")[1]})')
            for d in x.iter(W + 'del'):
                if d.getparent() is not None and d.getparent().tag in (W + 'rPr', W + 'trPr'): continue
                for t in d.iter(W + 't', W + 'instrText'):
                    if not _inside(t, W + 'ins', d): self.errs.append(f'{n}: <w:{t.tag.split("}")[1]}> in <w:del w:id="{d.get(W + "id")}"> (verlangt: w:delText)'); break
            for ins in x.iter(W + 'ins'):
                if ins.getparent() is not None and ins.getparent().tag in (W + 'rPr', W + 'trPr'): continue
                for t in ins.iter(W + 'delText'):
                    if not _inside(t, W + 'del', ins): self.errs.append(f'{n}: <w:delText> in <w:ins w:id="{ins.get(W + "id")}"> ohne w:del'); break
            for t in x.iter(W + 'delText'):
                if not _inside(t, W + 'del') and not _inside(t, W + 'moveFrom'): self.errs.append(f'{n}: <w:delText> ausserhalb von w:del'); break
        # Kommentare
        cm = self.xml.get('word/comments.xml')
        ids = []
        if cm is not None:
            for c in cm.findall('w:comment', NS):
                i = c.get(W + 'id')
                if i in ids: self.errs.append(f'word/comments.xml: Kommentar-Id {i} doppelt')
                ids.append(i)
                if not c.get(W + 'author'): self.errs.append(f'word/comments.xml: Kommentar {i} ohne w:author')
                if c.get(W + 'date') is not None and not _isodate(c.get(W + 'date')): self.errs.append(f'word/comments.xml: Kommentar {i} mit ungültigem Datum')
            rels = self.rels.get('word/document.xml', {})
            if not any(typ == REL + 'comments' for typ, _, _ in rels.values()): self.errs.append('word/comments.xml vorhanden, aber nicht mit word/document.xml verknüpft')
        starts = [e.get(W + 'id') for e in doc.iter(W + 'commentRangeStart')]
        ends = [e.get(W + 'id') for e in doc.iter(W + 'commentRangeEnd')]
        refs = [e.get(W + 'id') for e in doc.iter(W + 'commentReference')]
        for kind, lst in (('commentRangeStart', starts), ('commentRangeEnd', ends), ('commentReference', refs)):
            for i in set(lst):
                if lst.count(i) > 1: self.errs.append(f'word/document.xml: {kind} w:id={i} mehrfach')
                if i not in ids: self.errs.append(f'word/document.xml: {kind} w:id={i} ohne Kommentar in comments.xml')
        for i in set(starts) ^ set(ends): self.errs.append(f'word/document.xml: Kommentarbereich {i} ohne Anfang oder Ende')
        for i in set(starts) - set(refs): self.errs.append(f'word/document.xml: Kommentarbereich {i} ohne commentReference')
        for i in set(ids) - set(refs): self.errs.append(f'word/comments.xml: Kommentar {i} wird im Dokument nirgends verwendet')
        # Reihenfolge: Anfang vor Ende
        order = [(e.tag, e.get(W + 'id')) for e in doc.iter(W + 'commentRangeStart', W + 'commentRangeEnd')]
        open_ = set()
        for tag, i in order:
            if tag == W + 'commentRangeStart': open_.add(i)
            elif i not in open_: self.errs.append(f'word/document.xml: commentRangeEnd {i} vor commentRangeStart')
        # w14:paraId: eindeutig, unter 0x80000000 (sonst meldet Word die Datei als beschädigt)
        pid = {}
        for n in parts:
            for el in self.xml[n].iter():
                v = el.get('{%s}paraId' % NS['w14'])
                if v is None: continue
                if not re.fullmatch(r'[0-9A-Fa-f]{8}', v) or int(v, 16) >= 0x80000000: self.errs.append(f'{n}: w14:paraId {v} ungültig (8 Hexziffern unter 80000000)')
                if v in pid: self.errs.append(f'{n}: w14:paraId {v} doppelt')
                pid[v] = n

    # ---------- PowerPoint ----------
    def check_pptx(self):
        pres = self.xml.get('ppt/presentation.xml')
        if pres is None: return
        sids = [s.get('id') for s in pres.iter('{%s}sldId' % NS['p'])]
        if len(sids) != len(set(sids)): self.errs.append('ppt/presentation.xml: sldId doppelt')
        for s in sids:
            if not s or not s.isdigit() or not (256 <= int(s) < 2147483648): self.errs.append(f'ppt/presentation.xml: sldId {s} ausserhalb 256 … 2147483647')
        cparts = sorted(n for n in self.names if re.fullmatch(r'ppt/comments/comment\d+\.xml', n))
        authors = {}
        ca = self.xml.get('ppt/commentAuthors.xml')
        if cparts and ca is None: self.errs.append('Kommentare ohne ppt/commentAuthors.xml')
        if ca is not None:
            if not any(typ == REL + 'commentAuthors' for typ, _, _ in self.rels.get('ppt/presentation.xml', {}).values()): self.errs.append('ppt/commentAuthors.xml nicht mit ppt/presentation.xml verknüpft')
            for a in ca.findall('p:cmAuthor', NS):
                i = a.get('id')
                if i in authors: self.errs.append(f'ppt/commentAuthors.xml: id {i} doppelt')
                if not a.get('name'): self.errs.append(f'ppt/commentAuthors.xml: Autor {i} ohne Namen')
                try: authors[i] = int(a.get('lastIdx'))
                except (TypeError, ValueError): self.errs.append(f'ppt/commentAuthors.xml: Autor {i} ohne gültiges lastIdx'); authors[i] = -1
        owners = {n: [] for n in cparts}
        for src, ids in self.rels.items():
            for typ, tgt, mode in ids.values():
                if typ == REL + 'comments':
                    t = _target(src, tgt)
                    if t in owners: owners[t].append(src)
                    if not re.fullmatch(r'ppt/slides/slide\d+\.xml', src): self.errs.append(f'{src}: Kommentarbeziehung von einem Teil, der keine Folie ist')
        for n, o in owners.items():
            if len(o) != 1: self.errs.append(f'{n}: von {len(o)} Folien verknüpft (verlangt: genau einer)')
        used = {}
        for n in cparts:
            x = self.xml.get(n)
            if x is None: continue
            for c in x.findall('p:cm', NS):
                a, idx = c.get('authorId'), c.get('idx')
                if a not in authors: self.errs.append(f'{n}: authorId {a} ohne Eintrag in commentAuthors.xml'); continue
                try: idx = int(idx)
                except (TypeError, ValueError): self.errs.append(f'{n}: Kommentar ohne gültiges idx'); continue
                if (a, idx) in used: self.errs.append(f'{n}: Kommentar idx {idx} von Autor {a} doppelt (auch in {used[(a, idx)]})')
                used[(a, idx)] = n
                if idx > authors[a]: self.errs.append(f'{n}: idx {idx} grösser als lastIdx {authors[a]} des Autors {a}')
                if c.get('dt') is not None and not _isodate(c.get('dt')): self.errs.append(f'{n}: Kommentar mit ungültigem dt')
                pos = c.find('p:pos', NS)
                if pos is None or not all(re.fullmatch(r'-?\d+', pos.get(k) or '') for k in ('x', 'y')): self.errs.append(f'{n}: Kommentar ohne gültige Position')
                if c.find('p:text', NS) is None: self.errs.append(f'{n}: Kommentar ohne p:text')

    def run(self):
        if self.z is None: return self.errs
        self.check_content_types(); self.check_relationships(); self.check_namespaces()
        if self.kind == 'docx': self.check_docx()
        if self.kind == 'pptx': self.check_pptx()
        return self.errs


def _isodate(s):
    try:
        datetime.datetime.fromisoformat(s.replace('Z', '+00:00')); return True
    except ValueError:
        return False


def _inside(el, tag, stop=None):
    p = el.getparent()
    while p is not None and p is not stop:
        if p.tag == tag: return True
        p = p.getparent()
    return False


# ---------- Rundlauf: Änderungen einer Person verwerfen ----------
def mine(name, author):
    """Änderung der prüfenden Person: ihr Name oder ihr Name mit Zusatz in Klammern (Änderungen aus KI-Vorschlägen, «Lectora (KI-Vorschlag)»)."""
    return bool(author) and name is not None and (name == author or name.startswith(author + ' ('))


def _para_texts(root, reject_author=None):
    """Absatztexte des Hauptdokuments. reject_author: dessen w:ins entfallen, dessen w:del zählen wieder als Text."""
    out = []
    body = root.find('w:body', NS)
    for p in body.iter(W + 'p'):
        buf = []
        for el in p.iter(W + 't', W + 'delText', W + 'tab', W + 'br'):
            ins = _anc(el, W + 'ins', p); dl = _anc(el, W + 'del', p)
            mine_ins = ins is not None and mine(ins.get(W + 'author'), reject_author)
            mine_del = dl is not None and mine(dl.get(W + 'author'), reject_author)
            if mine_ins and not mine_del: continue
            if el.tag == W + 'delText' and not mine_del: continue
            buf.append('\t' if el.tag == W + 'tab' else '\n' if el.tag == W + 'br' else (el.text or ''))
        # Absatz, den die Person eingefügt hat (Absatzmarke als w:ins im w:pPr/w:rPr), zählt beim Verwerfen nicht
        mark = p.find('w:pPr/w:rPr/w:ins', NS)
        if reject_author and mark is not None and mine(mark.get(W + 'author'), reject_author) and not ''.join(buf).strip(): continue
        out.append(''.join(buf))
    return out


def _anc(el, tag, stop):
    q = el.getparent()
    while q is not None and q is not stop:
        if q.tag == tag: return q
        q = q.getparent()
    return None


def check_redlining(path, original, author):
    errs = []
    a, b = Package(path), Package(original)
    if a.z is None or b.z is None or 'word/document.xml' not in a.xml or 'word/document.xml' not in b.xml: return ['Rundlauf: Dokument nicht lesbar']
    got, want = _para_texts(a.xml['word/document.xml'], author), _para_texts(b.xml['word/document.xml'], None)
    if got != want:
        for i, (x, y) in enumerate(zip(got, want)):
            if x != y: errs.append(f'Rundlauf: Absatz {i + 1} weicht nach dem Verwerfen der Änderungen von «{author}» ab: «{x[:80]}» statt «{y[:80]}»'); break
        else: errs.append(f'Rundlauf: {len(got)} statt {len(want)} Absätze nach dem Verwerfen der Änderungen von «{author}»')
    # Änderungen und Kommentare anderer Personen bleiben erhalten
    def others(pkg):
        d = pkg.xml['word/document.xml']
        ch = sorted((e.tag.split('}')[1], e.get(W + 'author'), ''.join(e.itertext())) for e in d.iter(W + 'ins', W + 'del') if not mine(e.get(W + 'author'), author))
        c = pkg.xml.get('word/comments.xml')
        cm = sorted((e.get(W + 'author'), ''.join(e.itertext())) for e in (c.findall('w:comment', NS) if c is not None else []) if not mine(e.get(W + 'author'), author))
        return ch, cm
    oa, ob = others(a), others(b)
    if oa[0] != ob[0]: errs.append('Rundlauf: Änderungen anderer Personen verändert oder verloren')
    if oa[1] != ob[1]: errs.append('Rundlauf: Kommentare anderer Personen verändert oder verloren')
    return errs


def check(path, original=None, author=None):
    """Liste der Befunde (leer = bestanden)."""
    errs = Package(path).run()
    if original and author and path.endswith('.docx') and not errs: errs += check_redlining(path, original, author)
    ext = os.environ.get('LECTORA_OOXML_VALIDATOR')
    if ext:
        cmd = [sys.executable, ext, path] + (['--original', original] if original else []) + (['--author', author] if author else [])
        v = subprocess.run(cmd, capture_output=True, text=True)
        if v.returncode != 0: errs.append('externer Validator: ' + (v.stdout + v.stderr).strip()[-600:])
    return errs


# ---------- Rundlauf durch LibreOffice und python-docx / python-pptx ----------
def roundtrip(path, tmpdir):
    """Öffnet die Datei mit python-docx bzw. python-pptx und wandelt sie mit LibreOffice (headless) nach PDF. Liste der Befunde."""
    errs = []
    try:
        if path.endswith('.docx'):
            import docx
            d = docx.Document(path)
            if not d.paragraphs: errs.append('python-docx: keine Absätze')
        else:
            import pptx
            P = pptx.Presentation(path)
            if not len(P.slides): errs.append('python-pptx: keine Folien')
    except Exception as e:
        errs.append(f'python-{"docx" if path.endswith(".docx") else "pptx"}: {type(e).__name__}: {e}')
    prof = os.path.join(tmpdir, 'lo-profil')
    cmd = [os.environ.get('LECTORA_SOFFICE', 'soffice'), '-env:UserInstallation=file://' + os.path.abspath(prof), '--headless', '--norestore', '--convert-to', 'pdf', '--outdir', tmpdir, path]
    try:
        c = subprocess.run(cmd, capture_output=True, text=True, timeout=240)
        pdf = os.path.join(tmpdir, os.path.splitext(os.path.basename(path))[0] + '.pdf')
        if c.returncode != 0 or not os.path.exists(pdf) or os.path.getsize(pdf) < 1000: errs.append('LibreOffice: Umwandlung nach PDF misslungen ' + (c.stdout + c.stderr).strip()[-300:])
    except FileNotFoundError:
        errs.append('LibreOffice (soffice) nicht gefunden')
    except subprocess.TimeoutExpired:
        errs.append('LibreOffice: Zeitüberschreitung')
    return errs


if __name__ == '__main__':
    import argparse
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('path'); ap.add_argument('--original'); ap.add_argument('--author')
    a = ap.parse_args()
    errs = check(a.path, a.original, a.author)
    for e in errs: print('  ' + e)
    print('PASSED' if not errs else f'FAILED ({len(errs)})')
    sys.exit(1 if errs else 0)
