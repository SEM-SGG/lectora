/* Parser für DOCX, PPTX und PDF. Läuft vollständig im Browser, hält alles im Arbeitsspeicher. */
(function (DP) {
  'use strict';
  const L = DP.lang;

  /** XML lesen. OOXML kennt keine DTD; eine DTD oder ein Lesefehler (parsererror) macht die Datei unlesbar (Error('xml')),
      nie zu einem leeren Dokument. */
  function xml(s) {
    if (typeof s !== 'string' || /<!DOCTYPE/i.test(s.slice(0, 4096))) throw new Error('xml');
    const d = new DOMParser().parseFromString(s, 'application/xml');
    if (d.getElementsByTagName('parsererror').length || !d.documentElement || d.documentElement.nodeName === 'parsererror') throw new Error('xml');
    return d;
  }
  /* ---------- ZIP: Obergrenzen gegen Dateien, die sich beim Entpacken aufblähen ----------
     Jeder gelesene Teil höchstens PART_MAX Byte (beim Entpacken gezählt, nicht nur nach der Angabe im Archiv), alle Teile zusammen
     laut Archiv höchstens TOTAL_MAX. Sonst Error('unzip'). */
  const PART_MAX = 64 * 1024 * 1024, TOTAL_MAX = 1024 * 1024 * 1024;
  async function loadZip(buffer) {
    const zip = await JSZip.loadAsync(buffer);
    let total = 0;
    for (const n of Object.keys(zip.files)) {
      const e = zip.files[n]; if (e.dir) continue;
      const size = e._data && typeof e._data.uncompressedSize === 'number' ? e._data.uncompressedSize : 0;
      if (/\.(?:xml|rels)$/i.test(n) && size > PART_MAX) throw new Error('unzip');
      total += size;
    }
    if (total > TOTAL_MAX) throw new Error('unzip');
    return zip;
  }
  /** Text eines Teils, beim Entpacken gezählt; null, wenn der Teil fehlt. */
  function readPart(zip, name) {
    const f = zip.file(name);
    if (!f) return Promise.resolve(null);
    return new Promise((ok, fail) => {
      const parts = []; let n = 0, done = false;
      const st = f.internalStream('uint8array');
      st.on('data', (c) => { if (done) return; n += c.length; if (n > PART_MAX) { done = true; st.pause(); fail(new Error('unzip')); return; } parts.push(c); })
        .on('error', (e) => { if (!done) { done = true; fail(e); } })
        .on('end', () => { if (done) return; done = true; const all = new Uint8Array(n); let o = 0; for (const c of parts) { all.set(c, o); o += c.length; } ok(new TextDecoder('utf-8').decode(all)); })
        .resume();
    });
  }
  const attr = (el, name) => el ? (el.getAttribute('w:' + name) ?? el.getAttribute(name)) : null;
  const kids = (el, name) => { const o = []; for (let c = el.firstElementChild; c; c = c.nextElementSibling) if (c.nodeName === name) o.push(c); return o; };
  const kid = (el, name) => { for (let c = el ? el.firstElementChild : null; c; c = c.nextElementSibling) if (c.nodeName === name) return c; return null; };
  const hasAncestor = (el, name, stop) => { for (let p = el.parentNode; p && p !== stop; p = p.parentNode) if (p.nodeName === name) return true; return false; };

  /** Ein Dateiname als Beschreibung ist kein Alternativtext. */
  const realAlt = (s) => { s = (s || '').trim(); return !!s && !/\.(?:png|jpe?g|gif|bmp|tiff?|emf|wmf|svg|webp)$/i.test(s); };

  /* ---------- DOCX ---------- */

  /** Alle Absätze in Dokumentreihenfolge, ohne Fallback-Duplikate. Parser und Export nutzen dieselbe Liste. */
  function docxParagraphs(doc) {
    return Array.from(doc.getElementsByTagName('w:p')).filter(p => !hasAncestor(p, 'mc:Fallback'));
  }

  const SKIP_CONTAINERS = new Set(['w:del', 'w:moveFrom', 'w:pPr', 'mc:Fallback', 'w:p']);
  /** Textläufe, die direkt zu diesem Absatz gehören (ohne gelöschten Text, ohne verschachtelte Absätze). */
  function docxRuns(p) {
    const out = [];
    (function walk(node) {
      for (let c = node.firstElementChild; c; c = c.nextElementSibling) {
        const n = c.nodeName;
        if (n === 'w:r') out.push(c);
        else if (!SKIP_CONTAINERS.has(n)) walk(c);
      }
    })(p);
    return out;
  }
  function docxRunPieces(r) {
    const out = [];
    for (let c = r.firstElementChild; c; c = c.nextElementSibling) {
      const n = c.nodeName;
      if (n === 'w:t') out.push({ node: c, text: c.textContent });
      else if (n === 'w:tab') out.push({ node: c, text: '\t' });
      else if (n === 'w:br' || n === 'w:cr') out.push({ node: c, text: attr(c, 'type') === 'page' ? '' : '\n' });
      else if (n === 'w:noBreakHyphen') out.push({ node: c, text: '\u2011' });
    }
    return out;
  }
  function docxRunText(r) { let s = ''; for (const p of docxRunPieces(r)) s += p.text; return s; }
  function docxParaText(p) { let s = ''; for (const r of docxRuns(p)) s += docxRunText(r); return s; }

  function readStyles(stylesDoc) {
    const map = {};
    if (!stylesDoc) return map;
    for (const st of Array.from(stylesDoc.getElementsByTagName('w:style'))) {
      const id = attr(st, 'styleId'); if (!id) continue;
      const name = (attr(kid(st, 'w:name'), 'val') || '').toLowerCase();
      const based = attr(kid(st, 'w:basedOn'), 'val');
      const ol = kid(kid(st, 'w:pPr') || st, 'w:outlineLvl');
      map[id] = { name, based, outline: ol ? +attr(ol, 'val') : null };
    }
    return map;
  }
  const H_NAME = /^(?:heading|überschrift|ueberschrift|titre|titolo|intestazione)\s*(\d)$/;
  const TITLE_NAME = /^(?:title|titel|titre|titolo|titre du document)$/;
  const TOC_NAME = /^(?:toc|verzeichnis|tm|sommario|table des matières|inhaltsverzeichnis)\s*\d|toc heading|inhaltsverzeichnisüberschrift|en-tête de table des matières|titolo sommario/;
  function styleInfo(styles, id) {
    let cur = id, hops = 0, res = { level: 0, title: false, toc: false, list: false, name: '' };
    while (cur && styles[cur] && hops++ < 10) {
      const s = styles[cur];
      if (!res.name) res.name = s.name;
      if (TOC_NAME.test(s.name)) { res.toc = true; return res; }
      if (TITLE_NAME.test(s.name)) { res.title = true; return res; }
      const m = H_NAME.exec(s.name);
      if (m) { res.level = +m[1]; return res; }
      if (s.outline != null && s.outline < 9) { res.level = s.outline + 1; return res; }
      if (/list|liste|aufzählung|elenco|puce/.test(s.name)) res.list = true;
      cur = s.based;
    }
    return res;
  }

  async function parseDocx(buffer) {
    const zip = await loadZip(buffer);
    const f = (p) => readPart(zip, p);
    const docStr = await f('word/document.xml');
    if (!docStr) throw new Error('not_docx');
    const doc = xml(docStr);
    const stylesStr = await f('word/styles.xml');
    const styles = readStyles(stylesStr ? xml(stylesStr) : null);
    const paras = [];
    const meta = { headingStyles: 0, hasToc: false };
    const all = docxParagraphs(doc);
    all.forEach((p, x) => {
      const text = docxParaText(p);
      const pPr = kid(p, 'w:pPr');
      const sid = attr(kid(pPr, 'w:pStyle'), 'val');
      const si = styleInfo(styles, sid);
      if (si.toc) { meta.hasToc = true; return; }
      if (!text.trim()) return;
      let kind = 'p', level = 0;
      const direct = kid(pPr, 'w:outlineLvl');
      if (si.title) kind = 'title';
      else if (si.level) { kind = 'h'; level = si.level; }
      else if (direct && +attr(direct, 'val') < 9) { kind = 'h'; level = +attr(direct, 'val') + 1; }
      else if (hasAncestor(p, 'w:tc')) kind = 'cell';
      else if (kid(pPr, 'w:numPr') || si.list) kind = 'li';
      if (kind === 'h') meta.headingStyles++;
      const numbered = !!kid(pPr, 'w:numPr');
      paras.push({ text, kind, level, x, autoNum: numbered, loc: {} });
    });
    // TOC über Feldfunktion
    if (/<w:instrText[^>]*>[^<]*\bTOC\b/.test(docStr)) meta.hasToc = true;
    meta.tracked = { ins: doc.getElementsByTagName('w:ins').length, del: doc.getElementsByTagName('w:del').length };
    const cm = await f('word/comments.xml');
    meta.comments = cm ? (cm.match(/<w:comment[ >]/g) || []).length : 0;
    meta.highlights = Array.from(doc.getElementsByTagName('w:highlight')).filter(h => attr(h, 'val') !== 'none').length;
    let images = 0, noAlt = 0;
    for (const d of Array.from(doc.getElementsByTagName('wp:docPr'))) {
      if (hasAncestor(d, 'mc:Fallback')) continue;
      const holder = d.parentNode;
      if (!holder || !holder.getElementsByTagName('pic:pic').length) continue;
      if (/decorative[^>]*val="1"/.test(new XMLSerializer().serializeToString(d))) continue;
      images++;
      if (!realAlt(d.getAttribute('descr'))) noAlt++;
    }
    meta.images = images; meta.imagesNoAlt = noAlt;
    const core = await f('docProps/core.xml');
    if (core) {
      const c = xml(core);
      const g = (n) => { const e = c.getElementsByTagName(n)[0]; return e ? e.textContent.trim() : ''; };
      meta.title = g('dc:title'); meta.author = g('dc:creator');
    }
    const app = await f('docProps/app.xml');
    if (app) { const m = /<Pages>(\d+)<\/Pages>/.exec(app); if (m) meta.pages = +m[1]; }
    let hf = '';
    for (const name of Object.keys(zip.files)) {
      if (/^word\/(header|footer)\d*\.xml$/.test(name)) {
        const d = xml(await f(name));
        for (const p of Array.from(d.getElementsByTagName('w:p'))) { const t = docxParaText(p).trim(); if (t) hf += t + '\n'; }
      }
    }
    meta.headerFooter = hf;
    const fn = await f('word/footnotes.xml');
    if (fn) {
      const d = xml(fn);
      for (const n of Array.from(d.getElementsByTagName('w:footnote'))) {
        if (+attr(n, 'id') <= 0) continue;
        const t = Array.from(n.getElementsByTagName('w:p')).map(docxParaText).join(' ').trim();
        if (t) paras.push({ text: t, kind: 'fn', level: 0, loc: {} });
      }
    }
    return { paras, meta };
  }

  /* ---------- PPTX ---------- */

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

  async function parsePptx(buffer) {
    const zip = await loadZip(buffer);
    const f = (p) => readPart(zip, p);
    const presStr = await f('ppt/presentation.xml');
    if (!presStr) throw new Error('not_pptx');
    const pres = xml(presStr);
    const rels = xml(await f('ppt/_rels/presentation.xml.rels') || '<r/>');
    const relMap = {};
    for (const r of Array.from(rels.getElementsByTagName('Relationship'))) relMap[r.getAttribute('Id')] = r.getAttribute('Target');
    const slides = Array.from(pres.getElementsByTagName('p:sldId')).map(s => relMap[s.getAttribute('r:id')]).filter(Boolean)
      .map(t => t.startsWith('/') ? t.slice(1) : 'ppt/' + t.replace(/^\.\//, ''));
    const paras = [];
    const meta = { slides: slides.length, slidesNoTitle: [], images: 0, imagesNoAlt: 0, comments: 0, smallFont: [], slideMinFont: [], slideWords: [], markLines: [] };
    let n = 0;
    for (const path of slides) {
      n++;
      const str = await f(path); if (!str) continue;
      const d = xml(str);
      let hasTitle = false, words = 0, minSz = Infinity;
      for (const sp of Array.from(d.getElementsByTagName('p:sp'))) {
        if (hasAncestor(sp, 'mc:Fallback')) continue;
        const ph = sp.getElementsByTagName('p:ph')[0];
        const phType = ph ? (ph.getAttribute('type') || 'body') : null;
        if (phType === 'sldNum' || phType === 'dt' || phType === 'ftr') {
          // Fuss-, Datums- und Nummernfelder der Folie: nicht Teil des Textes, aber Ort von Klassifizierungsvermerken
          const fb = kid(sp, 'p:txBody'); if (fb) for (const p of kids(fb, 'a:p')) { const tx = aText(p).trim(); if (tx) meta.markLines.push(tx); }
          continue;
        }
        const isTitle = phType === 'title' || phType === 'ctrTitle';
        const body = kid(sp, 'p:txBody'); if (!body) continue;
        for (const p of kids(body, 'a:p')) {
          const text = aText(p); if (!text.trim()) continue;
          for (const rp of Array.from(p.getElementsByTagName('a:rPr'))) { const sz = +rp.getAttribute('sz'); if (sz) minSz = Math.min(minSz, sz / 100); }
          words += L.wordCount(text);
          if (isTitle) { hasTitle = true; paras.push({ text, kind: n === 1 && phType === 'ctrTitle' ? 'title' : 'h', level: 1, loc: { slide: n } }); }
          else paras.push({ text, kind: phType === 'subTitle' ? 'p' : 'li', level: 0, loc: { slide: n } });
        }
      }
      for (const tc of Array.from(d.getElementsByTagName('a:tc'))) {
        const body = kid(tc, 'a:txBody'); if (!body) continue;
        for (const p of kids(body, 'a:p')) { const text = aText(p); if (text.trim()) { words += L.wordCount(text); paras.push({ text, kind: 'cell', level: 0, loc: { slide: n } }); } }
      }
      for (const pic of Array.from(d.getElementsByTagName('p:pic'))) {
        if (hasAncestor(pic, 'mc:Fallback')) continue;
        meta.images++;
        const c = pic.getElementsByTagName('p:cNvPr')[0];
        if (!c || !realAlt(c.getAttribute('descr'))) meta.imagesNoAlt++;
      }
      if (!hasTitle) meta.slidesNoTitle.push(n);
      if (minSz < 14) meta.smallFont.push({ slide: n, size: minSz });
      meta.slideMinFont[n - 1] = minSz === Infinity ? null : minSz;
      meta.slideWords.push(words);
    }
    meta.comments = Object.keys(zip.files).filter(k => /^ppt\/comments\/.*\.xml$/.test(k)).length;
    const core = await f('docProps/core.xml');
    if (core) {
      const c = xml(core);
      const g = (nm) => { const e = c.getElementsByTagName(nm)[0]; return e ? e.textContent.trim() : ''; };
      meta.title = g('dc:title'); meta.author = g('dc:creator');
    }
    return { paras, meta };
  }

  /* ---------- PDF ---------- */

  /** Herkunft jedes Zeichens einer Zeile: Index des Textstücks × 65536 + Zeichen im Stück, −1 für eingefügte Leerzeichen.
      Baut den Zeilentext genau wie der Parser (Leerzeichen bei Lücken, Leerraum zusammengefasst, Ränder entfernt) und liefert
      null, wenn das Ergebnis nicht Zeichen für Zeichen dem Zeilentext entspricht. */
  function lineMap(ln, text, store) {
    const ch = [], ref = [];
    let prev = null, s = '';
    for (const it of ln.items) {
      if (it.gi == null) { it.gi = store.length; store.push(it); }
      if (prev) { const gap = it.x - (prev.x + prev.w); if (gap > prev.size * 0.18 && !s.endsWith(' ') && !it.s.startsWith(' ')) { s += ' '; ch.push(' '); ref.push(-1); } }
      if (it.s.length > 65535) return null;
      for (let k = 0; k < it.s.length; k++) { ch.push(it.s[k]); ref.push(it.gi * 65536 + k); }
      s += it.s; prev = it;
    }
    const oc = [], or = [];
    for (let k = 0; k < ch.length; k++) {
      if (/\s/.test(ch[k])) { if (oc.length && oc[oc.length - 1] === ' ' && /\s/.test(ch[k - 1])) continue; oc.push(' '); or.push(ref[k]); }
      else { oc.push(ch[k]); or.push(ref[k]); }
    }
    let a = 0, b = oc.length;
    while (a < b && oc[a] === ' ') a++;
    while (b > a && oc[b - 1] === ' ') b--;
    if (oc.slice(a, b).join('') !== text) return null;
    return or.slice(a, b);
  }

  async function parsePdf(buffer) {
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer.slice(0)), isEvalSupported: false, disableFontFace: true, useSystemFonts: false }).promise;
    const meta = { pages: pdf.numPages };
    // Lage der Textstellen für den PDF-Export mit Anmerkungen: Textstücke, Seiten und je Absatz die Herkunft jedes Zeichens
    const geo = { items: [], pages: [], maps: null };
    try { const md = await pdf.getMetadata(); meta.title = (md.info && md.info.Title || '').trim(); meta.author = (md.info && md.info.Author || '').trim(); meta.pdfLang = md.info && md.info.Language || ''; } catch (e) { /* ohne Metadaten weiter */ }
    try { const mi = await pdf.getMarkInfo(); meta.tagged = !!(mi && mi.Marked); } catch (e) { meta.tagged = false; }
    const pages = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const vp = page.getViewport({ scale: 1 });
      geo.pages[n - 1] = { view: page.view.slice(0, 4), rotate: page.rotate || 0 };
      const tc = await page.getTextContent();
      const items = tc.items.filter(it => it.str && it.str.trim() !== '' || it.hasEOL).map(it => ({
        s: it.str, x: it.transform[4], y: it.transform[5], w: it.width, size: Math.round(Math.hypot(it.transform[2], it.transform[3]) * 10) / 10,
        tr: it.transform.slice(0, 6), pg: n
      })).filter(it => it.s !== '');
      // Zeilen bilden
      items.sort((a, b) => b.y - a.y || a.x - b.x);
      const lines = [];
      for (const it of items) {
        const last = lines[lines.length - 1];
        if (last && Math.abs(last.y - it.y) <= Math.max(2, it.size * 0.35)) last.items.push(it);
        else lines.push({ y: it.y, items: [it] });
      }
      // Grosse waagrechte Lücken trennen Tabellenzellen: jede Zelle wird eine eigene Zeile
      const split = [];
      for (const ln of lines) {
        ln.items.sort((a, b) => a.x - b.x);
        let cur = { y: ln.y, items: [] }, prev = null, cells = 0;
        for (const it of ln.items) {
          if (prev && it.s.trim() && it.x - (prev.x + prev.w) > Math.max(18, prev.size * 2.4)) { split.push(cur); cur = { y: ln.y, items: [], cell: true }; cells++; }
          cur.items.push(it); if (it.s.trim()) prev = it;
        }
        if (cells) cur.cell = true;
        split.push(cur);
        if (cells) for (let k = split.length - 1 - cells; k < split.length; k++) split[k].cell = true;
      }
      lines.length = 0; for (const l of split) if (l.items.length) lines.push(l);
      for (const ln of lines) {
        let s = '', prev = null;
        for (const it of ln.items) {
          if (prev) { const gap = it.x - (prev.x + prev.w); if (gap > prev.size * 0.18 && !s.endsWith(' ') && !it.s.startsWith(' ')) s += ' '; }
          s += it.s; prev = it;
        }
        ln.text = s.replace(/\s+/g, ' ').trim();
        ln.map = lineMap(ln, ln.text, geo.items);
        ln.x = ln.items[0].x;
        const bySize = {}; for (const it of ln.items) bySize[it.size] = (bySize[it.size] || 0) + it.s.length;
        ln.size = +Object.keys(bySize).sort((a, b) => bySize[b] - bySize[a])[0];
        ln.rel = ln.y / vp.height;
      }
      pages.push({ n, lines: lines.filter(l => l.text), h: vp.height });
      page.cleanup();
    }
    await pdf.destroy();
    // Kopf- und Fusszeilen entfernen
    const norm = (t) => t.replace(/\d+/g, '#').toLowerCase();
    const freq = {};
    for (const pg of pages) { const seen = new Set(); for (const l of pg.lines) if (l.rel > 0.9 || l.rel < 0.09) { const k = norm(l.text); if (!seen.has(k)) { seen.add(k); freq[k] = (freq[k] || 0) + 1; } } }
    const PAGENO = /^(?:(?:seite|page|pagina|p\.)\s*)?\d+(?:\s*(?:\/|von|de|sur|di|of)\s*\d+)?$/i;
    let hf = '';
    // Randzeilen jeder Seite (oben und unten): Ort von Klassifizierungsvermerken, auch wenn sie im Text bleiben
    meta.markLines = [];
    for (const pg of pages) for (const l of pg.lines) if (l.rel > 0.9 || l.rel < 0.09) meta.markLines.push(l.text);
    for (const pg of pages) {
      pg.lines = pg.lines.filter(l => {
        const margin = l.rel > 0.9 || l.rel < 0.09;
        if (margin && (PAGENO.test(l.text) || (pages.length >= 3 && freq[norm(l.text)] >= Math.ceil(pages.length * 0.6)))) { if (pg.n === 1) hf += l.text + '\n'; return false; }
        return true;
      });
    }
    meta.headerFooter = hf;
    // Grundschrift bestimmen
    const sz = {};
    for (const pg of pages) for (const l of pg.lines) sz[l.size] = (sz[l.size] || 0) + l.text.length;
    const body = +(Object.keys(sz).sort((a, b) => sz[b] - sz[a])[0] || 10);
    const bigger = Object.keys(sz).map(Number).filter(s => s > body * 1.12).sort((a, b) => b - a);
    const paras = [];
    const pmap = new WeakMap();
    let cur = null;
    const flush = () => { if (cur && cur.text.trim()) paras.push(cur); cur = null; };
    const HNUM = /^(\d+(?:\.\d+)*)\.?\s+\p{Lu}/u;
    const BULLET = /^(?:[•·▪■‣◦–\-−\uf0b7\uf0a7\uf02d\uf0fc]|\d+[.)]|[a-z][.)])\s+/;
    let firstBig = true;
    for (const pg of pages) {
      let prev = null;
      for (const l of pg.lines) {
        const gap = prev ? prev.y - l.y : 0;
        const isBig = l.size > body * 1.12;
        const m = HNUM.exec(l.text);
        const looksNumHead = m && l.text.length < 90 && !/[.;:,]$/.test(l.text) && L.wordCount(l.text) <= 12 && (!prev || gap > l.size * 1.5);
        const newBlock = !cur || !prev || l.cell || prev.cell || gap > Math.max(prev.size, l.size) * 1.75 || gap < 0 || l.size !== prev.size || BULLET.test(l.text) || isBig !== cur.big || looksNumHead || cur.kind === 'h' && !isBig;
        if (newBlock) {
          flush();
          let kind = 'p', level = 0;
          if (isBig) {
            if (firstBig && pg.n === 1 && l.size === bigger[0] && !m) { kind = 'title'; firstBig = false; }
            else { kind = 'h'; level = m ? m[1].split('.').length : Math.min(3, Math.max(1, bigger.indexOf(l.size) + (bigger.length > 1 && paras.some(p => p.kind === 'title') ? 0 : 1))); }
          } else if (looksNumHead) { kind = 'h'; level = m[1].split('.').length; }
          else if (l.cell) kind = 'cell';
          else if (BULLET.test(l.text)) kind = 'li';
          cur = { text: l.text, kind, level, big: isBig, loc: { page: pg.n } };
          pmap.set(cur, l.map ? Array.from(l.map) : null);
        } else {
          const m = pmap.get(cur);
          if (/[\p{Ll}]-$/u.test(cur.text) && /^\p{Ll}/u.test(l.text) && !/^(?:und|oder|bzw|et|ou|e|o)\b/.test(l.text)) { cur.text = cur.text.slice(0, -1) + l.text; if (m) { m.pop(); pmap.set(cur, l.map ? m.concat(Array.from(l.map)) : null); } }
          else { cur.text += ' ' + l.text; if (m) { m.push(-1); pmap.set(cur, l.map ? m.concat(Array.from(l.map)) : null); } }
        }
        prev = l;
      }
      // Absatz darf über den Seitenwechsel laufen, wenn er nicht mit Satzzeichen endet
      if (cur && (cur.kind !== 'p' || /[.!?:;»")]$/.test(cur.text))) flush();
    }
    flush();
    for (const p of paras) {
      delete p.big;
      const len = p.text.length;
      if (p.kind === 'li') p.text = p.text.replace(/^[•·▪■‣◦–\-−\uf0b7\uf0a7\uf02d\uf0fc]\s+/, '');
      const m = pmap.get(p);
      if (m && len - p.text.length) m.splice(0, len - p.text.length);
    }
    meta.noText = paras.length === 0;
    // Nur Zuordnungen, die Zeichen für Zeichen zum Absatztext passen; sonst fehlt die Lage (der Export setzt dann eine Notiz)
    geo.maps = paras.map(p => { const m = pmap.get(p); return m && m.length === p.text.length ? Float64Array.from(m) : null; });
    return { paras, meta, geo };
  }

  /* ---------- Gemeinsam ---------- */

  const TYPE_RE = {
    weisung: /\b(?:weisung(?:en)?|directives?|direttiv[ae]|istruzion[ei])\b/i,
    konzept: /\b(?:(?:[\p{L}-]*)konzept|konzeption|concept|concetto|piano direttore)\b/iu,
    aktennotiz: /\b(?:aktennotiz|notiz|note (?:de|au|pour le) dossier|note d['’]information|note interne|notice|nota (?:informativa|agli atti|interna)|appunto)\b/i
  };
  function guessType(doc) {
    if (doc.format === 'pptx') return 'praesentation';
    const title = doc.paras.filter(p => p.kind === 'title' || p.kind === 'h').slice(0, 2).map(p => p.text).join(' ') + ' ' + (doc.meta.title || '') + ' ' + doc.name;
    for (const t in TYPE_RE) if (L.U(TYPE_RE[t]).test(title)) return t;
    const head = doc.paras.slice(0, 8).map(p => p.text).join(' ');
    for (const t in TYPE_RE) if (L.U(TYPE_RE[t]).test(head)) return t;
    return 'bericht';
  }

  let seq = 0;
  async function parseFile(file) {
    const name = file.name || 'document';
    const ext = (name.split('.').pop() || '').toLowerCase();
    const buffer = await file.arrayBuffer();
    const sig = new Uint8Array(buffer.slice(0, 5));
    let format = ext;
    if (sig[0] === 0x25 && sig[1] === 0x50 && sig[2] === 0x44 && sig[3] === 0x46) format = 'pdf';
    else if (sig[0] === 0x50 && sig[1] === 0x4b) format = ext === 'pptx' ? 'pptx' : ext === 'docx' ? 'docx' : null;
    else format = null;
    let res;
    if (format === 'pdf') res = await parsePdf(buffer);
    else if (format === 'docx' || format === null && sig[0] === 0x50) {
      try { res = await parseDocx(buffer); format = 'docx'; }
      catch (e) { if (e.message !== 'not_docx') throw e; res = await parsePptx(buffer); format = 'pptx'; }
    } else if (format === 'pptx') res = await parsePptx(buffer);
    else throw new Error('unsupported');
    // Ohne Text gibt es nichts zu prüfen: kein leeres Dokument, das alle Kriterien «erfüllt» (PDF ohne Text: Befund D07)
    if (format !== 'pdf' && !res.paras.some(p => p.kind !== 'fn' && p.text.trim())) throw new Error('empty');
    // Die Dateidaten bleiben im Arbeitsspeicher: für die Kopie mit Änderungen (Word) bzw. mit Kommentaren (PDF, PowerPoint)
    const doc = { id: 'd' + (++seq), name, format, size: buffer.byteLength, paras: res.paras, meta: res.meta, buffer };
    if (res.geo) doc.geo = res.geo;
    finalize(doc);
    return doc;
  }

  function finalize(doc) {
    let sec = null;
    doc.paras.forEach((p, i) => { p.i = i; if (p.kind === 'h' || p.kind === 'title') sec = i; else p.loc.sec = sec; });
    const body = doc.paras.filter(p => p.kind !== 'fn');
    doc.meta.words = body.reduce((n, p) => n + L.wordCount(p.text), 0);
    const sample = body.map(p => p.text).join(' ').slice(0, 6000);
    const det = L.detect(sample);
    doc.langAuto = ['de', 'fr', 'it', 'en'].includes(det.lang) ? det.lang : 'de';
    doc.lang = doc.langAuto;
    doc.typeAuto = guessType(doc);
    doc.type = doc.typeAuto;
    // Klassifizierungsvermerk: Kopf- und Fusszeilen, Folienfüsse, Randzeilen jeder PDF-Seite, die ersten sechs Absätze; je ganze Zeile
    const lines = (doc.meta.headerFooter || '').split('\n').concat(doc.meta.markLines || [], body.slice(0, 6).flatMap(p => p.text.split('\n')));
    doc.meta.classification = L.findClassification(lines);
    return doc;
  }

  DP.parse = { PART_MAX, TOTAL_MAX, loadZip, readPart, parseFile, finalize, docxParagraphs, docxRuns, docxRunPieces, docxRunText, docxParaText, xml, kid, kids, attr };
})(globalThis.DP = globalThis.DP || {});
