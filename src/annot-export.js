/* Export mit Kommentaren für PDF und PowerPoint: eine Kopie der Datei, in der jeder Befund als Anmerkung bzw. Kommentar steht.
   Das Original bleibt unverändert; der Text der Datei bleibt, wie er ist (Korrekturen lassen sich in PDF und PowerPoint nicht
   einsetzen, die Vorschläge stehen in den Kommentaren). Läuft vollständig im Browser. */
(function (DP) {
  'use strict';
  const P = DP.parse;

  /* ---------- PDF: Lage der Textstellen ---------- */

  // Laufweiten von Helvetica (1/1000 em) für ASCII; sie verteilen die Breite eines Textstücks auf seine Zeichen.
  // Nur eine Schätzung innerhalb eines Stücks: Anfang und Ende jedes Stücks liefert pdf.js genau.
  const HW = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556,
    278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722,
    667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556,
    333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
  const WIDE = { '«': 556, '»': 556, '–': 556, '—': 1000, '’': 222, '‘': 222, '“': 333, '”': 333, '„': 333, '…': 1000, 'ß': 611, '€': 556, '‹': 333, '›': 333, '•': 350, '\u00a0': 278, '\u202f': 200 };
  function cw(ch) {
    const c = ch.charCodeAt(0);
    if (c >= 32 && c < 127) return HW[c - 32];
    if (WIDE[ch]) return WIDE[ch];
    const base = ch.normalize('NFD').charAt(0);
    const b = base.charCodeAt(0);
    return b >= 32 && b < 127 ? HW[b - 32] : 556;
  }
  /** Lage der Zeichen ci0..ci1 (einschliesslich) im Textstück, gemessen vom Anfang des Stücks in dessen Schreibrichtung. */
  function span(it, ci0, ci1) {
    let tot = 0, a = 0, b = 0;
    for (let k = 0; k < it.s.length; k++) { const w = cw(it.s[k]); if (k < ci0) a += w; if (k <= ci1) b += w; tot += w; }
    return tot > 0 ? [it.w * a / tot, it.w * b / tot] : null;
  }
  const dot = (p, q) => p[0] * q[0] + p[1] * q[1];
  /** Rahmen eines Textstücks: Ursprung, Schreibrichtung u, Senkrechte n (zur Oberkante der Schrift), Schriftgrösse. */
  function frame(it) {
    const [a, b, c, d, e, f] = it.tr;
    const ul = Math.hypot(a, b), vl = Math.hypot(c, d);
    if (!(ul > 0 && vl > 0) || !isFinite(e) || !isFinite(f)) return null;
    const u = [a / ul, b / ul];
    let n = [-u[1], u[0]];
    if (dot(n, [c, d]) < 0) n = [-n[0], -n[1]];
    return { o: [e, f], u, n, size: vl };
  }

  /**
   * Vierecke (QuadPoints) über einer Textstelle eines PDF-Absatzes: eines je Zeile, auf der ersten Seite der Stelle.
   * Liefert {page, quads, rect} oder null, wenn sich die Stelle nicht zuverlässig bestimmen lässt.
   */
  function pdfQuads(doc, para, start, end) {
    const g = doc.geo, m = g && g.maps && g.maps[para], text = doc.paras[para] && doc.paras[para].text;
    if (!m || text == null || start == null || end == null || start < 0 || end > text.length) return null;
    // Einfügung (leere Stelle): das Wort davor und danach markieren
    if (end <= start) {
      let a = start, b = end;
      while (a > 0 && text[a - 1] !== ' ') a--;
      while (b < text.length && text[b] !== ' ') b++;
      if (a === start && a > 0) { a--; while (a > 0 && text[a - 1] !== ' ') a--; }
      if (a >= b) return null;
      start = a; end = b;
    }
    // Zeichen der Stelle nach Textstück gruppieren (in Textreihenfolge)
    const segs = [];
    for (let k = start; k < end; k++) {
      const r = m[k]; if (r < 0) continue;
      const gi = Math.floor(r / 65536), ci = r % 65536, it = g.items[gi];
      if (!it || it.s[ci] !== text[k]) return null;
      const last = segs[segs.length - 1];
      if (last && last.gi === gi && ci >= last.c0) { last.c1 = Math.max(last.c1, ci); } else segs.push({ gi, it, c0: ci, c1: ci });
    }
    if (!segs.length) return null;
    const page = segs[0].it.pg, pg = g.pages[page - 1];
    if (!pg) return null;
    // Zeilen bilden: gleiche Seite, gleiche Richtung, Grundlinie innerhalb einer halben Schriftgrösse
    const lines = [];
    for (const s of segs) {
      if (s.it.pg !== page) break;
      const fr = frame(s.it); if (!fr) return null;
      const sp = span(s.it, s.c0, s.c1); if (!sp || !(sp[1] > sp[0])) return null;
      const pts = [];
      for (const x of sp) for (const tt of [-0.24 * fr.size, 0.9 * fr.size]) pts.push([fr.o[0] + fr.u[0] * x + fr.n[0] * tt, fr.o[1] + fr.u[1] * x + fr.n[1] * tt]);
      const ln = lines[lines.length - 1];
      if (ln && Math.abs(dot(ln.fr.u, fr.u) - 1) < 0.01 && Math.abs(dot([fr.o[0] - ln.fr.o[0], fr.o[1] - ln.fr.o[1]], ln.fr.n)) < 0.5 * Math.min(fr.size, ln.fr.size)) ln.pts.push(...pts);
      else lines.push({ fr, pts });
    }
    const [vx0, vy0, vx1, vy1] = pg.view, tol = 4;
    const quads = [];
    let rx0 = Infinity, ry0 = Infinity, rx1 = -Infinity, ry1 = -Infinity;
    for (const ln of lines) {
      const { o, u, n } = ln.fr;
      let x0 = Infinity, x1 = -Infinity, t0 = Infinity, t1 = -Infinity;
      for (const p of ln.pts) { const d = [p[0] - o[0], p[1] - o[1]], x = dot(d, u), tt = dot(d, n); x0 = Math.min(x0, x); x1 = Math.max(x1, x); t0 = Math.min(t0, tt); t1 = Math.max(t1, tt); }
      if (!(x1 - x0 > 0.5)) return null;
      const at = (x, tt) => [o[0] + u[0] * x + n[0] * tt, o[1] + u[1] * x + n[1] * tt];
      // Reihenfolge wie Acrobat: oben links, oben rechts, unten links, unten rechts
      const q = [at(x0, t1), at(x1, t1), at(x0, t0), at(x1, t0)];
      for (const p of q) {
        // Liegt eine Ecke ausserhalb der sichtbaren Seite, ist die Lage unsicher: lieber eine Notiz als eine falsche Markierung
        if (p[0] < vx0 - tol || p[0] > vx1 + tol || p[1] < vy0 - tol || p[1] > vy1 + tol) return null;
        rx0 = Math.min(rx0, p[0]); ry0 = Math.min(ry0, p[1]); rx1 = Math.max(rx1, p[0]); ry1 = Math.max(ry1, p[1]);
      }
      quads.push(q.flat().map(v => Math.round(v * 100) / 100));
    }
    return { page, quads, rect: [rx0 - 1, ry0 - 1, rx1 + 1, ry1 + 1].map(v => Math.round(v * 100) / 100), start, end };
  }

  /** Punkt in Seitenkoordinaten zu einer Lage auf der angezeigten Seite (dx von links, dy von oben, in Punkt), mit /Rotate. */
  function shown(pg, dx, dy) {
    const [x0, y0, x1, y1] = pg.view, r = ((pg.rotate % 360) + 360) % 360;
    if (r === 90) return [x0 + dy, y0 + dx];
    if (r === 180) return [x1 - dx, y0 + dy];
    if (r === 270) return [x1 - dy, y1 - dx];
    return [x0 + dx, y1 - dy];
  }
  /** Breite der angezeigten Seite in Punkt. */
  const shownW = (pg) => { const [x0, y0, x1, y1] = pg.view; return (pg.rotate % 180) ? y1 - y0 : x1 - x0; };
  const NOTE = 20;

  /* ---------- PDF: Anmerkungen schreiben (pdf-lib) ---------- */

  const r2 = (v) => (Math.round(v * 100) / 100).toString();
  /** Prüft, ob die Datei digital signiert ist (Signaturfeld mit Wert oder SigFlags, sonst /ByteRange in den Rohdaten). */
  function pdfSigned(pdf, bytes) {
    const L = globalThis.PDFLib;
    try {
      const af = pdf.catalog.lookup(L.PDFName.of('AcroForm'));
      if (af instanceof L.PDFDict) {
        const fl = af.lookup(L.PDFName.of('SigFlags'));
        if (fl instanceof L.PDFNumber && (fl.asNumber() & 1)) return true;
        const seen = new Set();
        const walk = (arr) => {
          if (!(arr instanceof L.PDFArray)) return false;
          for (let i = 0; i < arr.size(); i++) {
            const f = arr.lookup(i); if (!(f instanceof L.PDFDict) || seen.has(f)) continue; seen.add(f);
            const ft = f.lookup(L.PDFName.of('FT'));
            if (ft === L.PDFName.of('Sig') && f.lookup(L.PDFName.of('V'))) return true;
            if (walk(f.lookup(L.PDFName.of('Kids')))) return true;
          }
          return false;
        };
        if (walk(af.lookup(L.PDFName.of('Fields')))) return true;
      }
    } catch (e) { /* Rohdaten prüfen */ }
    const u = new Uint8Array(bytes), chunk = 1 << 20;
    for (let i = 0; i < u.length; i += chunk - 16) if (/\/ByteRange\s*\[/.test(new TextDecoder('latin1').decode(u.subarray(i, Math.min(u.length, i + chunk))))) return true;
    return false;
  }

  /**
   * XMP-Metadaten der Kopie: Änderungsdatum wie im Info-Verzeichnis; eine PDF/A-Kennung (pdfaid) entfällt, weil die Kopie mit
   * Anmerkungen nicht mehr als PDF/A geprüft ist. Liefert true, wenn die Vorlage eine PDF/A-Kennung trug.
   */
  function xmpUpdate(pdf, now) {
    const L = globalThis.PDFLib;
    let ref, st;
    try { ref = pdf.catalog.get(L.PDFName.of('Metadata')); st = ref && pdf.context.lookup(ref); } catch (e) { return false; }
    if (!st || !st.dict || typeof st.getContents !== 'function') return false;
    let text;
    try {
      const filtered = !!st.dict.get(L.PDFName.of('Filter'));
      const bytes = filtered ? (typeof L.decodePDFRawStream === 'function' ? L.decodePDFRawStream(st).decode() : null) : st.getContents();
      if (!bytes) return false;
      text = new TextDecoder('utf-8').decode(bytes);
    } catch (e) { return false; }
    const iso = now.toISOString().replace(/\.\d+Z$/, 'Z');
    const was = /pdfaid:(?:part|conformance)/.test(text);
    let out = text
      .replace(/\s+pdfaid:(?:part|conformance|amd|rev)="[^"]*"/g, '')
      .replace(/<pdfaid:(part|conformance|amd|rev)>[^<]*<\/pdfaid:\1>/g, '')
      .replace(/(xmp:ModifyDate=")[^"]*(")/g, '$1' + iso + '$2').replace(/(<xmp:ModifyDate>)[^<]*(<\/xmp:ModifyDate>)/g, '$1' + iso + '$2')
      .replace(/(xmp:MetadataDate=")[^"]*(")/g, '$1' + iso + '$2').replace(/(<xmp:MetadataDate>)[^<]*(<\/xmp:MetadataDate>)/g, '$1' + iso + '$2');
    if (out === text) return was;
    const fresh = pdf.context.stream(new TextEncoder().encode(out), { Type: 'Metadata', Subtype: 'XML' });
    pdf.context.assign(ref, fresh);
    return was;
  }

  /** Lädt die PDF-Datei mit pdf-lib. Liefert {pdf, signed} oder wirft {code: 'encrypted'|'unreadable'}. */
  async function pdfOpen(doc) {
    const L = globalThis.PDFLib;
    if (!L || !doc.buffer) throw { code: 'unreadable' };
    let pdf;
    try { pdf = await L.PDFDocument.load(new Uint8Array(doc.buffer.slice(0)), { updateMetadata: false }); }
    catch (e) { throw { code: e && (e.name === 'EncryptedPDFError' || /encrypt/i.test(e.message || '')) ? 'encrypted' : 'unreadable' }; }
    if (pdf.isEncrypted) throw { code: 'encrypted' };
    // Gleiche Seitenzahl wie beim Einlesen mit pdf.js, sonst passen die Lagen nicht zu den Seiten
    let n = -1; try { n = pdf.getPageCount(); } catch (e) { /* unten abgewiesen */ }
    if (n < 1 || n !== (doc.geo ? doc.geo.pages.length : -1)) throw { code: 'unreadable' };
    return { pdf, signed: pdfSigned(pdf, doc.buffer) };
  }

  /**
   * Schreibt die Befunde als Anmerkungen in eine Kopie. items: [{para|null, start, end, kind: 'mark'|'strike'|'note', page?, text}]
   * opts: {author}. Liefert {blob, marks, notes, fallback}: fallback zählt Textstellen, die als Notiz statt als Markierung stehen.
   */
  async function exportPdf(doc, opened, items, opts) {
    const L = globalThis.PDFLib, pdf = opened.pdf, ctx = pdf.context, pages = pdf.getPages(), g = doc.geo;
    const now = new Date(), date = L.PDFString.fromDate(now), author = L.PDFHexString.fromText(opts.author || 'Lectora');
    const ann = (page, dict) => { const ref = ctx.register(ctx.obj(Object.assign({ Type: 'Annot', P: pages[page - 1].ref, F: 4, T: author, M: date, CreationDate: date }, dict))); pages[page - 1].node.addAnnot(ref); };
    const form = (bbox, content, extra) => ctx.register(ctx.stream(content, Object.assign({ Type: 'XObject', Subtype: 'Form', BBox: bbox }, extra || {})));
    const GS = { ExtGState: { GS0: { Type: 'ExtGState', BM: 'Multiply', CA: 1, ca: 1 } } };
    let marks = 0, notes = 0, fallback = 0, k = 0;
    const stack = {}; // Notizen je Seite: Anzahl oben bzw. je Absatz
    const pushNote = (page, at, text, subj) => {
      const pg = g.pages[page - 1];
      // Lage auf der angezeigten Seite: oben links, nebeneinander, bei Bedarf in weiteren Reihen
      let corner;
      if (at) corner = at;
      else {
        const n = stack[page] = (stack[page] || 0) + 1, per = Math.max(1, Math.floor((shownW(pg) - 24) / (NOTE + 6)));
        corner = [12 + ((n - 1) % per) * (NOTE + 6), 12 + Math.floor((n - 1) / per) * (NOTE + 6)];
      }
      const pts = [shown(pg, corner[0], corner[1]), shown(pg, corner[0] + NOTE, corner[1] + NOTE)];
      const rect = [Math.min(pts[0][0], pts[1][0]), Math.min(pts[0][1], pts[1][1]), Math.max(pts[0][0], pts[1][0]), Math.max(pts[0][1], pts[1][1])];
      // Erscheinungsbild: Notizzettel. Wie bei Notizen üblich mit NoZoom und NoRotate (F 4 + 8 + 16): Acrobat und Poppler zeigen
      // ihn auf gedrehten Seiten aufrecht; pdf.js beachtet NoRotate beim Zeichnen nicht und zeigt ihn dort mit der Seite gedreht
      const ap = form([0, 0, NOTE, NOTE], '1 0.86 0.27 rg 0.45 0.35 0 RG 1 w 0.5 0.5 19 19 re B 0.45 0.35 0 rg 4 13.5 12 1.2 re f 4 9.5 12 1.2 re f 4 5.5 8 1.2 re f');
      ann(page, { Subtype: 'Text', F: 28, Rect: rect.map(Number), Contents: L.PDFHexString.fromText(text), Subj: L.PDFHexString.fromText(subj), Name: 'Comment', Open: false, C: [1, 0.86, 0.27], NM: L.PDFString.of('lectora-' + (++k)), AP: { N: ap } });
      notes++;
    };
    for (const it of items) {
      const subj = it.subj || 'Lectora';
      if (it.para != null && doc.paras[it.para] && it.kind !== 'note') {
        const q = pdfQuads(doc, it.para, it.start, it.end);
        if (q) {
          const strike = it.kind === 'strike';
          const col = strike ? [0.85, 0.11, 0.11] : [1, 0.89, 0.25];
          const [bx0, by0, bx1, by1] = q.rect;
          let c = (strike ? '' : '/GS0 gs ') + col.join(' ') + (strike ? ' RG ' : ' rg ');
          for (const qp of q.quads) {
            const pt = (i) => [qp[i * 2] - bx0, qp[i * 2 + 1] - by0];
            const [ul, ur, ll, lr] = [pt(0), pt(1), pt(2), pt(3)];
            if (strike) {
              // Linie auf halber Höhe des Vierecks, etwas über der Mitte (Höhe der Kleinbuchstaben)
              const m = (a, b) => [a[0] + (b[0] - a[0]) * 0.42, a[1] + (b[1] - a[1]) * 0.42];
              const s = m(ll, ul), e = m(lr, ur), hgt = Math.hypot(ul[0] - ll[0], ul[1] - ll[1]);
              c += r2(Math.max(0.8, hgt * 0.07)) + ' w ' + r2(s[0]) + ' ' + r2(s[1]) + ' m ' + r2(e[0]) + ' ' + r2(e[1]) + ' l S ';
            } else c += [ul, ur, lr, ll].map((p, i) => r2(p[0]) + ' ' + r2(p[1]) + (i ? ' l ' : ' m ')).join('') + 'h f ';
          }
          const ap = form([0, 0, r2(bx1 - bx0), r2(by1 - by0)].map(Number), c, { Matrix: [1, 0, 0, 1, bx0, by0], Resources: strike ? {} : GS });
          ann(q.page, { Subtype: strike ? 'StrikeOut' : 'Highlight', Rect: q.rect, QuadPoints: q.quads.flat(), Contents: L.PDFHexString.fromText(it.text), Subj: L.PDFHexString.fromText(subj), C: col, CA: 1, NM: L.PDFString.of('lectora-' + (++k)), AP: { N: ap } });
          marks++;
          continue;
        }
        fallback++;
      }
      // Notiz: beim Absatz (erste Zeile), auf der Seite des Befunds oder oben auf der ersten Seite
      const para = it.para != null ? doc.paras[it.para] : null;
      const page = Math.min(Math.max(1, (para && para.loc.page) || it.page || 1), pages.length);
      let at = null;
      const q = para && pdfQuads(doc, it.para, 0, Math.min(para.text.length, 1));
      if (q && q.page === page) {
        // Linker Rand neben der ersten Zeile, in Koordinaten der angezeigten Seite
        const pg = g.pages[page - 1], [vx0, vy0, vx1, vy1] = pg.view, r = ((pg.rotate % 360) + 360) % 360;
        const ux = q.quads[0][0], uy = q.quads[0][1];
        const d = r === 90 ? [uy - vy0, ux - vx0] : r === 180 ? [vx1 - ux, uy - vy0] : r === 270 ? [vy1 - uy, vx1 - ux] : [ux - vx0, vy1 - uy];
        const key = page + ':' + it.para, n = stack[key] = (stack[key] || 0) + 1;
        // Im linken Rand (höchstens 36 pt vom Seitenrand), damit die Notiz keine Aufzählungszeichen verdeckt
        at = [Math.max(4, Math.min(d[0] - NOTE - 6, 36)), Math.max(4, d[1] + (n - 1) * (NOTE + 4))];
      }
      pushNote(page, at, it.text, subj);
    }
    pdf.setModificationDate(now);
    const pdfa = xmpUpdate(pdf, now);
    const bytes = await pdf.save({ useObjectStreams: false });
    return { blob: new Blob([bytes], { type: 'application/pdf' }), marks, notes, fallback, pdfa };
  }

  /* ---------- PowerPoint: Kommentare (klassisches Format p:cmLst) ---------- */

  const PML = 'http://schemas.openxmlformats.org/presentationml/2006/main';
  const REL_CM = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments';
  const REL_AUTH = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/commentAuthors';
  const CT_CM = 'application/vnd.openxmlformats-officedocument.presentationml.comments+xml';
  const CT_AUTH = 'application/vnd.openxmlformats-officedocument.presentationml.commentAuthors+xml';
  const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  // Zeichen, die XML nicht erlaubt, entfallen
  const clean = (s) => String(s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, '');
  // Nur die Beziehungen klassischer Kommentare (Transitional und Strict); moderne Kommentare (Microsoft, 2018) bleiben unberührt
  const isCmRel = (t) => t === REL_CM || t === 'http://purl.oclc.org/ooxml/officeDocument/relationships/comments';
  const isAuthRel = (t) => t === REL_AUTH || t === 'http://purl.oclc.org/ooxml/officeDocument/relationships/commentAuthors';
  /** Fügt eine Beziehung an (auch an eine leere, selbstschliessende Liste). */
  function addRel(rs, type, target) {
    rs = rs || '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
    let rid = 1; while (new RegExp('Id="rId' + rid + '"').test(rs)) rid++;
    const rel = '<Relationship Id="rId' + rid + '" Type="' + type + '" Target="' + target + '"/>';
    return /<\/Relationships>\s*$/.test(rs) ? rs.replace(/<\/Relationships>\s*$/, rel + '</Relationships>') : rs.replace(/<Relationships([^>]*?)\s*\/>\s*$/, '<Relationships$1>' + rel + '</Relationships>');
  }
  const hasAnc = (el, name) => { for (let p = el.parentNode; p; p = p.parentNode) if (p.nodeName === name) return true; return false; };
  const relTarget = (base, t) => {
    if (t.startsWith('/')) return t.slice(1);
    const parts = base.split('/'); parts.pop();
    for (const seg of t.split('/')) { if (seg === '..') parts.pop(); else if (seg !== '.') parts.push(seg); }
    return parts.join('/');
  };
  const relsPath = (part) => { const i = part.lastIndexOf('/'); return part.slice(0, i) + '/_rels/' + part.slice(i + 1) + '.rels'; };
  async function readRels(zip, part) {
    const f = zip.file(relsPath(part)); if (!f) return [];
    return Array.from(P.xml(await f.async('string')).getElementsByTagName('Relationship')).map(r => ({ id: r.getAttribute('Id'), type: r.getAttribute('Type'), target: r.getAttribute('Target'), mode: r.getAttribute('TargetMode') }));
  }
  /** Lage (EMU) aus a:xfrm bzw. p:xfrm: {x, y} oder null. */
  function off(el) {
    const o = el && el.getElementsByTagName('a:off')[0];
    return o ? { x: +o.getAttribute('x') || 0, y: +o.getAttribute('y') || 0 } : null;
  }
  const xfrmOf = (sp) => { const pr = P.kid(sp, 'p:spPr') || P.kid(sp, 'p:grpSpPr'); const x = pr && P.kid(pr, 'a:xfrm'); return x || P.kid(sp, 'p:xfrm'); };
  /** Lage eines Elements auf der Folie, mit den Verschiebungen und Skalierungen umgebender Gruppen. */
  function placeOf(sp, inherit) {
    let pt = off(xfrmOf(sp)) || inherit(sp);
    if (!pt) return null;
    for (let g = sp.parentNode; g && g.nodeName !== 'p:spTree'; g = g.parentNode) {
      if (g.nodeName !== 'p:grpSp') continue;
      const x = xfrmOf(g); if (!x) continue;
      const o = x.getElementsByTagName('a:off')[0], e = x.getElementsByTagName('a:ext')[0], co = x.getElementsByTagName('a:chOff')[0], ce = x.getElementsByTagName('a:chExt')[0];
      if (!o) continue;
      const sx = e && ce && +ce.getAttribute('cx') ? +e.getAttribute('cx') / +ce.getAttribute('cx') : 1, sy = e && ce && +ce.getAttribute('cy') ? +e.getAttribute('cy') / +ce.getAttribute('cy') : 1;
      pt = { x: +o.getAttribute('x') + (pt.x - (co ? +co.getAttribute('x') : 0)) * sx, y: +o.getAttribute('y') + (pt.y - (co ? +co.getAttribute('y') : 0)) * sy };
    }
    return pt;
  }
  /** Platzhalterlage aus Layout und Master (gleicher idx, sonst gleicher Typ). */
  function phFinder(docs) {
    const phs = docs.map(d => Array.from(d.getElementsByTagName('p:sp')).map(sp => { const ph = sp.getElementsByTagName('p:ph')[0]; return ph ? { sp, type: ph.getAttribute('type') || 'body', idx: ph.getAttribute('idx') } : null; }).filter(Boolean));
    return (sp) => {
      const ph = sp.getElementsByTagName('p:ph')[0]; if (!ph) return null;
      const type = ph.getAttribute('type') || 'body', idx = ph.getAttribute('idx');
      const norm = (t) => t === 'ctrTitle' ? 'title' : t === 'subTitle' || t === 'obj' ? 'body' : t;
      for (const list of phs) {
        const hit = (idx != null && list.find(p => p.idx === idx)) || list.find(p => p.type === type) || list.find(p => norm(p.type) === norm(type));
        const o = hit && off(xfrmOf(hit.sp));
        if (o) return o;
      }
      return null;
    };
  }
  /** Absätze einer Folie in der Reihenfolge des Parsers, je mit dem Element, das sie trägt (Form bzw. Tabellenrahmen). */
  function slideParas(d) {
    const out = [];
    for (const sp of Array.from(d.getElementsByTagName('p:sp'))) {
      if (hasAnc(sp, 'mc:Fallback')) continue;
      const ph = sp.getElementsByTagName('p:ph')[0], phType = ph ? (ph.getAttribute('type') || 'body') : null;
      if (phType === 'sldNum' || phType === 'dt' || phType === 'ftr') continue;
      const body = P.kid(sp, 'p:txBody'); if (!body) continue;
      for (const p of P.kids(body, 'a:p')) { const tx = aText(p); if (tx.trim()) out.push({ text: tx, el: sp }); }
    }
    for (const tc of Array.from(d.getElementsByTagName('a:tc'))) {
      const body = P.kid(tc, 'a:txBody'); if (!body) continue;
      let gf = tc; while (gf && gf.nodeName !== 'p:graphicFrame') gf = gf.parentNode;
      for (const p of P.kids(body, 'a:p')) { const tx = aText(p); if (tx.trim()) out.push({ text: tx, el: gf || null }); }
    }
    return out;
  }
  function aText(p) {
    let s = '';
    (function walk(n) {
      for (let c = n.firstElementChild; c; c = c.nextElementSibling) {
        if (c.nodeName === 'a:t') s += c.textContent;
        else if (c.nodeName === 'a:br') s += '\n';
        else if (c.nodeName === 'a:r' || c.nodeName === 'a:fld') walk(c);
      }
    })(p);
    return s;
  }
  /** PowerPoint misst die Lage klassischer Kommentare in Achtelpunkten (1/576 Zoll); 1 EMU = 1/914400 Zoll. */
  const emuToCm = (v) => Math.max(0, Math.round(v / 1587.5));

  /**
   * Schreibt Kommentare in eine Kopie der Präsentation. items: [{para|null, slide?, text}] · opts: {author, initials}.
   * Vorhandene Kommentare und Autoren bleiben erhalten. Liefert {blob, comments, atShape, atSlide}.
   */
  async function exportPptx(doc, items, opts) {
    if (doc.format !== 'pptx' || !doc.buffer) throw { code: 'unreadable' };
    let zip;
    try { zip = await P.loadZip(doc.buffer.slice(0)); } catch (e) { throw { code: 'unreadable' }; }
    const rd = async (p) => zip.file(p) ? zip.file(p).async('string') : null;
    const presStr = await rd('ppt/presentation.xml'); if (!presStr) throw { code: 'unreadable' };
    const pres = P.xml(presStr), presRels = await readRels(zip, 'ppt/presentation.xml');
    const relMap = {}; for (const r of presRels) relMap[r.id] = r.target;
    const slides = Array.from(pres.getElementsByTagName('p:sldId')).map(s => relMap[s.getAttribute('r:id')]).filter(Boolean).map(t => relTarget('ppt/presentation.xml', t));
    // Autor: vorhandene Liste übernehmen, eigenen Eintrag finden oder anfügen
    const authRel = presRels.find(r => isAuthRel(r.type));
    const authPath = authRel ? relTarget('ppt/presentation.xml', authRel.target) : 'ppt/commentAuthors.xml';
    const authStr = await rd(authPath);
    const ax = P.xml(authStr || '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<p:cmAuthorLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="' + PML + '"/>');
    const authors = Array.from(ax.getElementsByTagName('p:cmAuthor'));
    const name = (opts.author || 'Lectora').trim() || 'Lectora';
    let me = authors.find(a => a.getAttribute('name') === name);
    if (!me) {
      const id = authors.reduce((m, a) => Math.max(m, +a.getAttribute('id') + 1), 0), clr = authors.reduce((m, a) => Math.max(m, +a.getAttribute('clrIdx') + 1), 0);
      me = ax.createElementNS(PML, 'p:cmAuthor');
      me.setAttribute('id', String(id)); me.setAttribute('name', name); me.setAttribute('initials', opts.initials || name.slice(0, 2).toUpperCase()); me.setAttribute('lastIdx', '0'); me.setAttribute('clrIdx', String(clr % 8));
      const ext = ax.documentElement.getElementsByTagName('p:extLst')[0];
      ax.documentElement.insertBefore(me, ext && ext.parentNode === ax.documentElement ? ext : null);
    }
    const authorId = me.getAttribute('id');
    let idx = +me.getAttribute('lastIdx') || 0;
    // Befunde je Folie; ohne Folie: erste Folie
    const bySlide = new Map();
    for (const it of items) {
      const p = it.para != null ? doc.paras[it.para] : null;
      const n = Math.min(Math.max(1, (p && p.loc.slide) || it.slide || 1), slides.length);
      if (!bySlide.has(n)) bySlide.set(n, []);
      bySlide.get(n).push({ it, p });
    }
    const now = new Date(), dt = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().replace('Z', '');
    let ct = await rd('[Content_Types].xml');
    let made = 0, atShape = 0, atSlide = 0;
    const used = new Set(Object.keys(zip.files).map(k => k.toLowerCase()));
    let cmNo = 1;
    for (const [n, list] of Array.from(bySlide.entries()).sort((a, b) => a[0] - b[0])) {
      const sPath = slides[n - 1], sStr = await rd(sPath); if (!sStr) continue;
      const sd = P.xml(sStr), sRels = await readRels(zip, sPath);
      // Platzhalter ohne eigene Lage erben sie aus Layout und Master
      const lay = sRels.find(r => /\/slideLayout$/.test(r.type)), layPath = lay && relTarget(sPath, lay.target);
      const ld = layPath && await rd(layPath) ? P.xml(await rd(layPath)) : null;
      const mrel = layPath ? (await readRels(zip, layPath)).find(r => /\/slideMaster$/.test(r.type)) : null, mPath = mrel && relTarget(layPath, mrel.target);
      const md = mPath && await rd(mPath) ? P.xml(await rd(mPath)) : null;
      const inherit = phFinder([ld, md].filter(Boolean));
      const sp = slideParas(sd), mine = doc.paras.filter(p => p.loc.slide === n);
      const same = sp.length === mine.length && sp.every((x, k) => x.text === mine[k].text);
      // Kommentarteil der Folie: vorhandenen ergänzen, sonst neu anlegen
      const cmRel = sRels.find(r => isCmRel(r.type));
      let cPath;
      if (cmRel) cPath = relTarget(sPath, cmRel.target);
      else { while (used.has(('ppt/comments/comment' + cmNo + '.xml').toLowerCase())) cmNo++; cPath = 'ppt/comments/comment' + cmNo + '.xml'; used.add(cPath.toLowerCase()); }
      const cStr = await rd(cPath);
      const cx = P.xml(cStr || '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<p:cmLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="' + PML + '"/>');
      const atEl = new Map();
      for (const { it, p } of list) {
        let pt = null;
        if (p && same) {
          const k = mine.indexOf(p), el = sp[k] && sp[k].el;
          if (el) pt = placeOf(el, inherit);
        }
        const key = pt ? pt.x + ',' + pt.y : 'slide', j = atEl.get(key) || 0; atEl.set(key, j + 1);
        // Mehrere Kommentare an derselben Stelle stehen leicht versetzt nebeneinander
        const x = (pt ? emuToCm(pt.x) : 10) + j * 120, y = pt ? emuToCm(pt.y) : 10;
        if (pt) atShape++; else atSlide++;
        const cm = cx.createElementNS(PML, 'p:cm');
        cm.setAttribute('authorId', authorId); cm.setAttribute('dt', dt); cm.setAttribute('idx', String(++idx));
        const pos = cx.createElementNS(PML, 'p:pos'); pos.setAttribute('x', String(x)); pos.setAttribute('y', String(y));
        const tx = cx.createElementNS(PML, 'p:text'); tx.textContent = clean(it.text);
        cm.appendChild(pos); cm.appendChild(tx);
        cx.documentElement.appendChild(cm);
        made++;
      }
      zip.file(cPath, ser(cx));
      if (!cmRel) { const rp = relsPath(sPath); zip.file(rp, addRel(await rd(rp), REL_CM, '../comments/' + cPath.split('/').pop())); }
      if (!new RegExp('PartName="/' + cPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"', 'i').test(ct)) ct = ct.replace(/<\/Types>\s*$/, '<Override PartName="/' + cPath + '" ContentType="' + CT_CM + '"/></Types>');
    }
    me.setAttribute('lastIdx', String(idx));
    zip.file(authPath, ser(ax));
    if (!authRel) { const rp = relsPath('ppt/presentation.xml'); zip.file(rp, addRel(await rd(rp), REL_AUTH, authPath.replace(/^ppt\//, ''))); }
    if (!new RegExp('PartName="/' + authPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"', 'i').test(ct)) ct = ct.replace(/<\/Types>\s*$/, '<Override PartName="/' + authPath + '" ContentType="' + CT_AUTH + '"/></Types>');
    zip.file('[Content_Types].xml', ct);
    const blob = await DP.exporter.pack(zip, PPTX_MIME);
    return { blob, comments: made, atShape, atSlide };
  }
  function ser(d) {
    let s = new XMLSerializer().serializeToString(d);
    if (!s.startsWith('<?xml')) s = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' + s;
    return s;
  }

  DP.annot = { pdfQuads, pdfOpen, exportPdf, exportPptx, slideParas };
})(globalThis.DP = globalThis.DP || {});
