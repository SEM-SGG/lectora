/* Export: Änderungen im Korrekturmodus ins Original-DOCX schreiben, Prüfbericht als DOCX erzeugen. */
(function (DP) {
  'use strict';
  const P = DP.parse;
  const MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const W_MAIN = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const XML_NS = 'http://www.w3.org/XML/1998/namespace';
  const xesc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');

  /** Packt ohne Ordnereinträge: Word lehnt solche Dateien in manchen Umgebungen ab. */
  async function pack(zip, mime) {
    const out = new JSZip();
    const names = Object.keys(zip.files).filter(n => !zip.files[n].dir);
    // [Content_Types].xml gehört an den Anfang des Pakets
    names.sort((a, b) => (a === '[Content_Types].xml' ? -1 : 0) - (b === '[Content_Types].xml' ? -1 : 0));
    for (const n of names) out.file(n, await zip.files[n].async('uint8array'), { createFolders: false });
    return out.generateAsync({ type: 'blob', mimeType: mime || MIME, compression: 'DEFLATE' });
  }

  /* ---------- Wortweiser Vergleich: aus einer Ersetzung werden möglichst kleine Änderungen ---------- */
  function tokens(s) { return s.match(/\p{L}+|\d+|\s+|[^\p{L}\d\s]/gu) || []; }
  function diffOps(oldText, newText, base) {
    base = base || 0;
    if (oldText === newText) return [];
    const a = tokens(oldText), b = tokens(newText);
    if (a.length * b.length > 250000) return [{ start: base, end: base + oldText.length, repl: newText }];
    const n = a.length, m = b.length, W = m + 1;
    const T = new Uint16Array((n + 1) * W);
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) T[i * W + j] = a[i] === b[j] ? T[(i + 1) * W + j + 1] + 1 : Math.max(T[(i + 1) * W + j], T[i * W + j + 1]);
    const ops = []; let i = 0, j = 0, pos = base, cur = null;
    const open = () => cur || (cur = { start: pos, end: pos, repl: '' });
    const close = () => { if (cur) { ops.push(cur); cur = null; } };
    while (i < n || j < m) {
      if (i < n && j < m && a[i] === b[j]) {
        // Ein einzelnes Leerzeichen zwischen zwei Änderungen gehört zur Änderung: ruhigeres Schriftbild
        if (cur && /^\s+$/.test(a[i]) && i + 1 < n && j + 1 < m && a[i + 1] !== b[j + 1]) { cur.end += a[i].length; cur.repl += b[j]; }
        else close();
        pos += a[i].length; i++; j++;
      } else if (j < m && (i === n || T[i * W + j + 1] >= T[(i + 1) * W + j])) { open().repl += b[j]; j++; }
      else { open().end += a[i].length; pos += a[i].length; i++; }
    }
    close();
    return ops;
  }

  /* ---------- Läufe teilen und Änderungen einsetzen ---------- */
  function runMap(p) {
    let o = 0;
    return P.docxRuns(p).map(r => { const len = P.docxRunText(r).length; const e = { r, start: o, end: o + len }; o += len; return e; });
  }
  function pieceLen(c) {
    const n = c.nodeName;
    if (n === 'w:t') return c.textContent.length;
    if (n === 'w:tab' || n === 'w:noBreakHyphen') return 1;
    if (n === 'w:br' || n === 'w:cr') return P.attr(c, 'type') === 'page' ? 0 : 1;
    return 0;
  }
  function splitRun(run, k) {
    const right = run.cloneNode(true);
    run.parentNode.insertBefore(right, run.nextSibling);
    const trim = (node, keepLeft) => {
      let pos = 0;
      for (const c of Array.from(node.children)) {
        if (c.nodeName === 'w:rPr') continue;
        const len = pieceLen(c);
        const s = pos, e = pos + len; pos = e;
        if (keepLeft) {
          if (s >= k) c.remove();
          else if (e > k) { c.textContent = c.textContent.slice(0, k - s); c.setAttributeNS(XML_NS, 'xml:space', 'preserve'); }
        } else {
          if (len > 0 ? e <= k : s < k) c.remove();
          else if (s < k) { c.textContent = c.textContent.slice(k - s); c.setAttributeNS(XML_NS, 'xml:space', 'preserve'); }
        }
      }
    };
    trim(run, true); trim(right, false);
  }
  function splitAt(p, offset) {
    for (const m of runMap(p)) if (m.start < offset && offset < m.end) { splitRun(m.r, offset - m.start); return; }
  }
  const OK_PARENT = new Set(['w:p', 'w:hyperlink', 'w:smartTag', 'w:sdtContent', 'w:fldSimple', 'w:customXml']);

  function applyOp(p, op, ctx) {
    const d = p.ownerDocument, ns = ctx.ns;
    const el = (name) => d.createElementNS(ns, name);
    const mark = (name) => { const e = el(name); e.setAttributeNS(ns, 'w:id', String(ctx.nextId++)); e.setAttributeNS(ns, 'w:author', ctx.author); e.setAttributeNS(ns, 'w:date', ctx.date); return e; };
    if (op.end > op.start) splitAt(p, op.end);
    splitAt(p, op.start);
    const map = runMap(p);
    const covered = map.filter(m => m.end > m.start && m.start >= op.start && m.end <= op.end);
    let anchor, parent, model;
    if (op.end > op.start) {
      if (!covered.length) return false;
      parent = covered[0].r.parentNode;
      if (!OK_PARENT.has(parent.nodeName) || covered.some(m => m.r.parentNode !== parent)) return false;
      const covLen = covered.reduce((s, m) => s + (m.end - m.start), 0);
      if (covLen !== op.end - op.start) return false;
      if (ctx.clean) {
        // Bereinigt: Text direkt ersetzen, ohne Änderungsmarkierung; der neue Lauf übernimmt die Formatierung des ersten Laufs
        model = covered[0].r;
        if (op.repl) parent.insertBefore(plainRun(d, ns, model, op.repl), model);
        for (const m of covered) m.r.remove();
        return true;
      }
      const del = mark('w:del');
      parent.insertBefore(del, covered[0].r);
      for (const m of covered) {
        del.appendChild(m.r);
        for (const t of Array.from(m.r.getElementsByTagName('w:t'))) {
          const dt = el('w:delText'); dt.textContent = t.textContent; dt.setAttributeNS(XML_NS, 'xml:space', 'preserve'); t.parentNode.replaceChild(dt, t);
        }
      }
      anchor = del.nextSibling; model = covered[0].r;
    } else {
      const prev = map.filter(m => m.end === op.start && m.end > m.start).pop();
      const next = map.find(m => m.start === op.start && m.end > m.start);
      model = (prev || next || {}).r;
      if (!model) return false;
      parent = model.parentNode;
      if (!OK_PARENT.has(parent.nodeName)) return false;
      anchor = prev ? prev.r.nextSibling : next.r;
    }
    if (op.repl) {
      const r = plainRun(d, ns, model, op.repl);
      if (ctx.clean) parent.insertBefore(r, anchor);
      else { const ins = mark('w:ins'); ins.appendChild(r); parent.insertBefore(ins, anchor); }
    }
    return true;
  }
  /** Normaler Lauf mit den Laufeigenschaften des Vorbilds. */
  function plainRun(d, ns, model, text) {
    const r = d.createElementNS(ns, 'w:r');
    const rPr = P.kid(model, 'w:rPr');
    if (rPr) r.appendChild(rPr.cloneNode(true));
    const t = d.createElementNS(ns, 'w:t'); t.textContent = text; t.setAttributeNS(XML_NS, 'xml:space', 'preserve');
    r.appendChild(t);
    return r;
  }

  function addComment(p, id, ctx) {
    const d = p.ownerDocument, ns = ctx.ns;
    const el = (name) => d.createElementNS(ns, name);
    const s = el('w:commentRangeStart'); s.setAttributeNS(ns, 'w:id', String(id));
    const e = el('w:commentRangeEnd'); e.setAttributeNS(ns, 'w:id', String(id));
    const r = el('w:r'); const ref = el('w:commentReference'); ref.setAttributeNS(ns, 'w:id', String(id)); r.appendChild(ref);
    const pPr = P.kid(p, 'w:pPr');
    p.insertBefore(s, pPr ? pPr.nextSibling : p.firstChild);
    p.appendChild(e); p.appendChild(r);
  }

  function serialize(doc) {
    let s = new XMLSerializer().serializeToString(doc);
    if (!s.startsWith('<?xml')) s = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' + s;
    return s;
  }

  /**
   * Schreibt Änderungen und Kommentare ins Original.
   * changes: [{para, start, end, repl, minimal, fallback?, author?, note?}] · comments: [{para|null, text}] · opts: {author, initials, mode}
   * author einer Änderung: eigener Autor der Markierung (KI-Vorschlag); note: Kommentar zur Herkunft, wenn die Änderung eingesetzt ist.
   * mode 'tracked' (Vorgabe): Änderungen als w:del/w:ins · mode 'clean': Änderungen direkt im Text, ohne Markierung.
   * Liefert {blob, applied, failed:[change], comments}.
   */
  async function exportTracked(doc, changes, comments, opts) {
    if (doc.format !== 'docx' || !doc.buffer) throw new Error('not_docx');
    const zip = await P.loadZip(doc.buffer.slice(0));
    const src = await zip.file('word/document.xml').async('string');
    const x = P.xml(src);
    const ns = x.documentElement.namespaceURI || W_MAIN;
    const ps = P.docxParagraphs(x);
    let maxId = 0; src.replace(/w:id="(\d+)"/g, (_, n) => { maxId = Math.max(maxId, +n); return _; });
    const baseAuthor = opts.author || 'Review';
    const ctx = { ns, author: baseAuthor, date: new Date().toISOString().replace(/\.\d+Z$/, 'Z'), nextId: maxId + 1000, clean: opts.mode === 'clean' };
    // Änderungen je Absatz, von hinten nach vorn, ohne Überschneidungen
    const byPara = new Map();
    for (const c of changes) {
      const para = doc.paras[c.para]; if (!para || para.x == null) continue;
      const ops = c.minimal ? [{ start: c.start, end: c.end, repl: c.repl }] : diffOps(para.text.slice(c.start, c.end), c.repl, c.start);
      if (!byPara.has(para.x)) byPara.set(para.x, []);
      for (const o of ops) byPara.get(para.x).push(Object.assign(o, { src: c }));
    }
    const failed = new Set(); let applied = 0;
    for (const [xi, ops] of byPara) {
      ops.sort((a, b) => b.start - a.start || b.end - a.end);
      let floor = Infinity;
      for (const o of ops) {
        if (o.end > floor) { failed.add(o.src); continue; }
        // Änderung aus einem KI-Vorschlag: eigener Autor (c.author), damit Word die Herkunft zeigt
        ctx.author = o.src.author || baseAuthor;
        if (applyOp(ps[xi], o, ctx)) { applied++; floor = o.start; } else failed.add(o.src);
      }
    }
    ctx.author = baseAuthor;
    // Kommentare; zu jeder eingesetzten Änderung mit Herkunftsvermerk (c.note) ein eigener Kommentar beim Absatz
    const all = comments.slice();
    for (const c of changes) if (c.note && !failed.has(c) && doc.paras[c.para] && doc.paras[c.para].x != null) all.push({ para: c.para, text: c.note });
    for (const c of failed) if (c.fallback) all.push({ para: c.para, text: c.fallback });
    let made = 0;
    if (all.length) {
      let cx, cstr = zip.file('word/comments.xml') ? await zip.file('word/comments.xml').async('string') : null;
      const fresh = !cstr;
      if (fresh) cstr = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:comments xmlns:w="' + ns + '"></w:comments>';
      cx = P.xml(cstr);
      let cid = 0; for (const c of Array.from(cx.getElementsByTagName('w:comment'))) cid = Math.max(cid, +P.attr(c, 'id') + 1);
      const first = doc.paras.find(p => p.x != null);
      const general = all.filter(c => c.para == null || doc.paras[c.para] == null || doc.paras[c.para].x == null);
      const list = all.filter(c => !general.includes(c)).map(c => ({ x: doc.paras[c.para].x, text: c.text }));
      if (general.length && first) list.unshift({ x: first.x, text: (opts.generalLabel ? opts.generalLabel + '\n' : '') + general.map(g => '• ' + g.text).join('\n') });
      for (const c of list) {
        const node = cx.createElementNS(ns, 'w:comment');
        node.setAttributeNS(ns, 'w:id', String(cid)); node.setAttributeNS(ns, 'w:author', ctx.author); node.setAttributeNS(ns, 'w:date', ctx.date); node.setAttributeNS(ns, 'w:initials', opts.initials || 'DP');
        for (const line of c.text.split('\n')) {
          const p = cx.createElementNS(ns, 'w:p'), r = cx.createElementNS(ns, 'w:r'), t = cx.createElementNS(ns, 'w:t');
          t.textContent = line; t.setAttributeNS(XML_NS, 'xml:space', 'preserve'); r.appendChild(t); p.appendChild(r); node.appendChild(p);
        }
        cx.documentElement.appendChild(node);
        addComment(ps[c.x], cid, ctx);
        cid++; made++;
      }
      zip.file('word/comments.xml', serialize(cx));
      if (fresh) {
        const ctPath = '[Content_Types].xml';
        let ct = await zip.file(ctPath).async('string');
        if (!/comments\.xml/.test(ct)) ct = ct.replace('</Types>', '<Override PartName="/word/comments.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/></Types>');
        zip.file(ctPath, ct);
        const relPath = 'word/_rels/document.xml.rels';
        let rels = zip.file(relPath) ? await zip.file(relPath).async('string') : '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
        let n = 900; while (rels.includes('"rId' + n + '"')) n++;
        const relType = ns === W_MAIN ? 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments' : 'http://purl.oclc.org/ooxml/officeDocument/relationships/comments';
        rels = rels.replace('</Relationships>', '<Relationship Id="rId' + n + '" Type="' + relType + '" Target="comments.xml"/></Relationships>');
        zip.file(relPath, rels);
      }
    }
    zip.file('word/document.xml', serialize(x));
    const blob = await pack(zip);
    return { blob, applied, failed: Array.from(failed), comments: made };
  }

  /* ---------- Prüfbericht ---------- */
  const run = (text, o) => '<w:r>' + (o ? '<w:rPr>' + (o.b ? '<w:b/>' : '') + (o.i ? '<w:i/>' : '') + (o.color ? '<w:color w:val="' + o.color + '"/>' : '') + (o.strike ? '<w:strike/>' : '') + (o.u ? '<w:u w:val="single"/>' : '') + '</w:rPr>' : '') + '<w:t xml:space="preserve">' + xesc(text) + '</w:t></w:r>';
  const para = (inner, style, extra) => '<w:p><w:pPr>' + (style ? '<w:pStyle w:val="' + style + '"/>' : '') + (extra || '') + '</w:pPr>' + inner + '</w:p>';
  /** Zelle: Text oder Liste von Läufen [{text,b,i,color,strike,u}], Zeilenumbruch über \n. */
  function cellXml(c, width, head) {
    const parts = Array.isArray(c) ? c : [{ text: c == null ? '' : String(c) }];
    const lines = [[]];
    for (const part of parts) { const seg = String(part.text).split('\n'); seg.forEach((s, k) => { if (k) lines.push([]); if (s) lines[lines.length - 1].push(Object.assign({}, part, { text: s })); }); }
    const body = lines.map(l => para(l.map(x => run(x.text, head ? { b: true } : x)).join(''), 'Zelle')).join('');
    return '<w:tc><w:tcPr><w:tcW w:w="' + width + '" w:type="dxa"/>' + (head ? '<w:shd w:val="clear" w:color="auto" w:fill="D9D9D9"/>' : '') + '</w:tcPr>' + body + '</w:tc>';
  }
  function tableXml(t) {
    const widths = t.widths, total = widths.reduce((a, b) => a + b, 0);
    const border = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(k => '<w:' + k + ' w:val="single" w:sz="4" w:space="0" w:color="808080"/>').join('');
    let s = '<w:tbl><w:tblPr><w:tblW w:w="' + total + '" w:type="dxa"/><w:tblBorders>' + border + '</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="60" w:type="dxa"/><w:left w:w="90" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:right w:w="90" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>' + widths.map(w => '<w:gridCol w:w="' + w + '"/>').join('') + '</w:tblGrid>';
    if (t.head) s += '<w:tr><w:trPr><w:cantSplit/><w:tblHeader/></w:trPr>' + t.head.map((c, i) => cellXml(c, widths[i], true)).join('') + '</w:tr>';
    for (const r of t.rows) s += '<w:tr><w:trPr><w:cantSplit/></w:trPr>' + r.map((c, i) => cellXml(c, widths[i], false)).join('') + '</w:tr>';
    return s + '</w:tbl>' + para('', null);
  }
  /** blocks: [{title}|{h1}|{h2}|{p}|{kv:[[k,v]]}|{table:{head,rows,widths}}|{list:[..]}] */
  async function exportReport(blocks, opts) {
    let body = '';
    for (const b of blocks) {
      if (b.title != null) body += para(run(b.title), 'Titel');
      else if (b.h1 != null) body += para(run(b.h1), 'berschrift1');
      else if (b.h2 != null) body += para(run(b.h2), 'berschrift2');
      else if (b.p != null) body += para(Array.isArray(b.p) ? b.p.map(x => run(x.text, x)).join('') : run(b.p));
      else if (b.kv) body += tableXml({ widths: [2600, 6900], rows: b.kv.map(r => [[{ text: r[0], b: true }], r[1]]) });
      else if (b.table) body += tableXml(b.table);
      else if (b.list) for (const li of b.list) body += para(run('–\u00a0' + li), null, '<w:ind w:left="284" w:hanging="284"/>');
    }
    const lang = { de: 'de-CH', fr: 'fr-CH', it: 'it-CH' }[opts.lang] || 'de-CH';
    const fld = (code) => '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> ' + code + ' </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>';
    const NSW = 'xmlns:w="' + W_MAIN + '" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
    const document = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document ' + NSW + '><w:body>' + body
      + '<w:sectPr><w:footerReference w:type="default" r:id="rId2"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1418" w:right="1134" w:bottom="1134" w:left="1134" w:header="709" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>';
    const rpr = (sz, b) => '<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial" w:eastAsia="Arial"/>' + (b ? '<w:b/>' : '') + '<w:sz w:val="' + sz + '"/><w:szCs w:val="' + sz + '"/></w:rPr>';
    const styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:styles ' + NSW + '>'
      + '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial" w:eastAsia="Arial"/><w:sz w:val="21"/><w:szCs w:val="21"/><w:lang w:val="' + lang + '"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>'
      + '<w:style w:type="paragraph" w:default="1" w:styleId="Standard"><w:name w:val="Normal"/><w:qFormat/></w:style>'
      + '<w:style w:type="paragraph" w:styleId="Titel"><w:name w:val="Title"/><w:basedOn w:val="Standard"/><w:next w:val="Standard"/><w:qFormat/><w:pPr><w:spacing w:before="0" w:after="240"/></w:pPr>' + rpr(40, true) + '</w:style>'
      + '<w:style w:type="paragraph" w:styleId="berschrift1"><w:name w:val="heading 1"/><w:basedOn w:val="Standard"/><w:next w:val="Standard"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="360" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr>' + rpr(28, true) + '</w:style>'
      + '<w:style w:type="paragraph" w:styleId="berschrift2"><w:name w:val="heading 2"/><w:basedOn w:val="Standard"/><w:next w:val="Standard"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="1"/></w:pPr>' + rpr(23, true) + '</w:style>'
      + '<w:style w:type="paragraph" w:styleId="Zelle"><w:name w:val="Table Cell"/><w:basedOn w:val="Standard"/><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr>' + rpr(18, false) + '</w:style>'
      + '<w:style w:type="paragraph" w:styleId="Fuss"><w:name w:val="footer"/><w:basedOn w:val="Standard"/><w:pPr><w:spacing w:after="0"/></w:pPr>' + rpr(16, false) + '</w:style>'
      + '</w:styles>';
    const footer = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:ftr ' + NSW + '><w:p><w:pPr><w:pStyle w:val="Fuss"/><w:tabs><w:tab w:val="right" w:pos="9638"/></w:tabs></w:pPr>' + run(opts.footer || '') + '<w:r><w:tab/></w:r>' + fld('PAGE') + run('\u00a0/\u00a0') + fld('NUMPAGES') + '</w:p></w:ftr>';
    const zip = new JSZip();
    zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>');
    zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>');
    zip.file('word/_rels/document.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>');
    zip.file('word/document.xml', document);
    zip.file('word/styles.xml', styles);
    zip.file('word/footer1.xml', footer);
    zip.file('docProps/core.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>' + xesc(opts.title || '') + '</dc:title><dc:creator>' + xesc(opts.author || '') + '</dc:creator><dc:language>' + lang + '</dc:language></cp:coreProperties>');
    return pack(zip);
  }

  /** Bericht als reiner Text für die Zwischenablage. */
  function reportText(blocks) {
    const flat = (c) => Array.isArray(c) ? c.map(x => x.strike ? '[' + x.text + ']' : x.text).join('') : (c == null ? '' : String(c));
    let out = '';
    for (const b of blocks) {
      if (b.title != null) out += b.title.toUpperCase() + '\n\n';
      else if (b.h1 != null) out += '\n' + b.h1 + '\n' + '='.repeat(Math.min(60, b.h1.length)) + '\n';
      else if (b.h2 != null) out += '\n' + b.h2 + '\n';
      else if (b.p != null) out += flat(b.p) + '\n';
      else if (b.kv) out += b.kv.map(r => r[0] + ': ' + flat(r[1])).join('\n') + '\n';
      else if (b.list) out += b.list.map(l => '– ' + l).join('\n') + '\n';
      else if (b.table) b.table.rows.forEach(r => { out += r.map((c, i) => (b.table.head && i > 0 ? flat(b.table.head[i]) + ': ' : '') + flat(c).replace(/\n/g, ' ')).filter(s => !/: $/.test(s)).join('\n   ') + '\n\n'; });
    }
    return out.trim() + '\n';
  }

  DP.exporter = { exportTracked, exportReport, reportText, diffOps, pack };
})(globalThis.DP = globalThis.DP || {});
