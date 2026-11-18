/* Sprachvergleich: Segmente zweier Fassungen zuordnen und lokal abgleichen. */
(function (DP) {
  'use strict';
  const L = DP.lang;
  const R = DP.rules;

  const NUMWORDS = {
    de: ['zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn', 'elf', 'zwölf'],
    fr: ['deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze'],
    it: ['due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'otto', 'nove', 'dieci', 'undici', 'dodici'],
    en: ['two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve']
  };

  function findTimes(text) {
    const out = []; let m;
    const res = [
      /\b(\d{1,2})[.:](\d{2})[ \u00a0]?(?:Uhr|h)\b/g,
      /\b(\d{1,2})[ \u00a0]?h[ \u00a0]?(\d{2})\b/g,
      /\b(?:ore|alle|um|à)[ \u00a0](\d{1,2})[.:](\d{2})\b/g,
      /(?<![\d:])(\d{1,2}):(\d{2})(?![\d:])/g,
      /\b(\d{1,2})[ \u00a0]?Uhr\b()/g
    ];
    for (const re of res) while ((m = re.exec(text))) {
      const s = m.index, e = s + m[0].length;
      if (out.some(o => s < o.end && e > o.start)) continue;
      const h = +m[1], mi = +(m[2] || 0); if (h > 24 || mi > 59) continue;
      out.push({ key: String(h).padStart(2, '0') + ':' + String(mi).padStart(2, '0'), start: s, end: e, raw: m[0] });
    }
    return out;
  }

  /** Vergleichsmerkmale eines Segments. */
  function features(text, lang) {
    const dates = L.findDates(text);
    const refs = L.findLegalRefs(text);
    const urls = L.findUrls(text);
    const times = findTimes(text).filter(t => !dates.some(d => t.start < d.end && t.end > d.start));
    const skip = [].concat(dates, refs, urls, times).map(x => [x.start, x.end]);
    const nums = L.findNumbers(text, skip);
    const words = [];
    const nw = NUMWORDS[lang];
    if (nw) { const re = new RegExp('(?<![\\p{L}])(' + nw.join('|') + ')(?![\\p{L}])', 'giu'); let m; while ((m = re.exec(text))) words.push(String(nw.indexOf(m[1].toLowerCase()) + 2)); }
    return { dates, refs, urls, times, nums, numWords: words };
  }

  function quickNums(text) {
    const s = new Set();
    const re = /\d+(?:[.,]\d+)?/g; let m;
    while ((m = re.exec(text))) s.add(m[0].replace(',', '.'));
    return s;
  }

  /** Wortanfänge als sprachübergreifende Anker: Identität/identité/identità, Sektion/section/sezione. */
  function stems(text) {
    const s = new Set();
    const w = text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').match(/[a-z]{5,}/g) || [];
    for (const x of w) s.add(x.replace(/k/g, 'c').replace(/z/g, 'c').replace(/ph/g, 'f').slice(0, 4));
    return s;
  }

  /** Dynamische Programmierung nach Gale und Church, ergänzt um Absatzart und gemeinsame Zahlen. */
  function align(A, B) {
    const n = A.length, m = B.length;
    const la = A.map(p => p.text.length), lb = B.map(p => p.text.length);
    const ta = la.reduce((x, y) => x + y, 0) || 1, tb = lb.reduce((x, y) => x + y, 0) || 1;
    const c = tb / ta;
    const na = A.map(p => quickNums(p.text)), nb = B.map(p => quickNums(p.text));
    const sa = A.map(p => stems(p.text)), sb = B.map(p => stems(p.text));
    const isHead = (p) => p.kind === 'h' || p.kind === 'title';
    const lenCost = (x, y) => { const d = (y - x * c) / Math.sqrt(6.8 * Math.max(x, y, 1)); return Math.min(d * d, 30); };
    const match = (i, j) => {
      let cost = lenCost(la[i], lb[j]);
      const pa = A[i], pb = B[j];
      if (isHead(pa) !== isHead(pb)) cost += 7;
      else if (isHead(pa) && pa.level !== pb.level) cost += 2;
      else if (isHead(pa)) cost -= 2;
      if (!isHead(pa) && pa.kind !== pb.kind) cost += 1.5;
      if (na[i].size || nb[j].size) {
        let shared = 0; for (const x of na[i]) if (nb[j].has(x)) shared++;
        if (shared) cost -= Math.min(6, shared * 2); else if (na[i].size && nb[j].size) cost += 2;
      }
      const small = sa[i].size <= sb[j].size ? sa[i] : sb[j], big = small === sa[i] ? sb[j] : sa[i];
      if (small.size >= 2) { let sh = 0; for (const x of small) if (big.has(x)) sh++; cost -= 6 * sh / Math.max(3, small.size); }
      return cost;
    };
    const GAP = 9, MERGE = 6;
    const plain = (p) => p.kind === 'p';
    // Bei grossen Dokumenten nur ein Band um die Diagonale berechnen: spart Speicher, ohne die Zuordnung zu verändern
    const full = (n + 1) * (m + 1) <= 3e6;
    const w = full ? m : Math.max(120, Math.ceil(0.06 * Math.max(n, m)));
    const BW = full ? m + 1 : 2 * w + 1;
    const lo = (i) => full ? 0 : Math.min(Math.max(0, Math.round(i * m / Math.max(1, n)) - w), Math.max(0, m - BW + 1));
    const D = new Float64Array((n + 1) * BW).fill(Infinity);
    const T = new Uint8Array((n + 1) * BW);
    D[0] = 0;
    for (let i = 0; i <= n; i++) {
      const l = lo(i), hi = Math.min(m, l + BW - 1);
      for (let j = l; j <= hi; j++) {
        const cur = D[i * BW + (j - l)]; if (cur === Infinity) continue;
        const set = (ii, jj, cost, t) => { const k2 = jj - lo(ii); if (k2 < 0 || k2 >= BW) return; const k = ii * BW + k2; if (cur + cost < D[k]) { D[k] = cur + cost; T[k] = t; } };
        if (i < n && j < m) set(i + 1, j + 1, match(i, j), 1);
        if (i < n) set(i + 1, j, GAP + Math.min(4, la[i] / 60), 2);
        if (j < m) set(i, j + 1, GAP + Math.min(4, lb[j] / 60), 3);
        if (i + 1 < n && j < m && plain(A[i]) && plain(A[i + 1]) && !isHead(B[j])) set(i + 2, j + 1, MERGE + lenCost(la[i] + la[i + 1], lb[j]), 4);
        if (i < n && j + 1 < m && plain(B[j]) && plain(B[j + 1]) && !isHead(A[i])) set(i + 1, j + 2, MERGE + lenCost(la[i], lb[j] + lb[j + 1]), 5);
      }
    }
    const pairs = [];
    let i = n, j = m;
    while (i > 0 || j > 0) {
      const k2 = j - lo(i);
      const t = k2 >= 0 && k2 < BW ? T[i * BW + k2] : 0;
      if (t === 1) { pairs.push({ a: [i - 1], b: [j - 1] }); i--; j--; }
      else if (t === 2) { pairs.push({ a: [i - 1], b: [] }); i--; }
      else if (t === 3) { pairs.push({ a: [], b: [j - 1] }); j--; }
      else if (t === 4) { pairs.push({ a: [i - 2, i - 1], b: [j - 1] }); i -= 2; j--; }
      else if (t === 5) { pairs.push({ a: [i - 1], b: [j - 2, j - 1] }); i--; j -= 2; }
      else if (i > 0) { pairs.push({ a: [i - 1], b: [] }); i--; }
      else { pairs.push({ a: [], b: [j - 1] }); j--; }
    }
    pairs.reverse();
    return { pairs, ratio: c };
  }

  const pad = (n) => String(n).padStart(2, '0');
  function formatDate(iso, lang) {
    const [y, mo, d] = iso.split('-').map(Number);
    if (!d) return null;
    const mn = (L.MONTHS[lang] || L.MONTHS.de)[mo - 1];
    if (lang === 'de') return d + '. ' + mn.charAt(0).toUpperCase() + mn.slice(1) + ' ' + y;
    if (lang === 'fr') return (d === 1 ? '1er' : d) + ' ' + mn + ' ' + y;
    if (lang === 'it') return (d === 1 ? '1°' : d) + ' ' + mn + ' ' + y;
    return pad(d) + '.' + pad(mo) + '.' + y;
  }
  const normUrl = (u) => u.includes('@') ? u.toLowerCase() : u.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '');
  const diffSets = (a, b) => ({ onlyA: a.filter(x => !b.includes(x)), onlyB: b.filter(x => !a.includes(x)) });
  /** Dice-Koeffizient der Wörter zweier Texte (Kleinschreibung, mit Vielfachheit). */
  function wordDice(a, b) {
    const bag = (t) => { const m = new Map(); for (const w of t.toLowerCase().match(/[\p{L}\d]+/gu) || []) m.set(w, (m.get(w) || 0) + 1); return m; };
    const A = bag(a), B = bag(b); let na = 0, nb = 0, sh = 0;
    for (const v of A.values()) na += v; for (const v of B.values()) nb += v;
    for (const [k, v] of A) sh += Math.min(v, B.get(k) || 0);
    return na && nb ? 2 * sh / (na + nb) : 0;
  }
  const hasWord = (text, w) => new RegExp('(?<![\\p{L}\\d])' + L.esc(w) + '(?![\\p{L}\\d])', 'u').test(text);

  /** Gut zugeordnetes Paar: je ein Absatz, kein Titel, ähnliche Länge, gleich viele Sätze. Nur dann melden X11 und X12 einen
      einseitig fehlenden Ausdruck (als Hinweis). */
  function goodPair(pa, pb, ta, tb, ratio) {
    if (pa.length !== 1 || pb.length !== 1) return false;
    if (/^(?:h|title)$/.test(pa[0].kind) || /^(?:h|title)$/.test(pb[0].kind) || ta.length < 40) return false;
    const rr = (tb.length / ta.length) / (ratio || 1);
    return rr >= 0.7 && rr <= 1.45 && L.sentences(ta).length === L.sentences(tb).length;
  }

  /** X11: Pflicht, Verbot, Erlaubnis, Empfehlung im Abschnittspaar. Gemeldet werden nur eindeutige Gegensätze (DP.modal.diff) und,
      bei gut zugeordneten Paaren, eine Empfehlung («sollte», «devrait», «dovrebbe»), der auf der anderen Seite gar kein
      Modalausdruck gegenübersteht (Hinweis). */
  function checkModal(F, mk, base, r, pa, pb, la, lb, good) {
    const MA = [], MB = [];
    // rel: Lage im Abschnitt (0 bis 1), nur bei langen Abschnitten; kurze werden frei gepaart
    // si: Satznummer im Abschnitt; rel: Lage im Abschnitt (0 bis 1), nur bei langen Abschnitten
    const collect = (ps, lang, out) => { const tot = ps.reduce((a, p) => a + p.text.length + 1, 0); let off = 0, si = 0;
      for (const p of ps) { const ss = L.sentences(p.text);
        for (const x of DP.modal.find(p.text, lang)) out.push(Object.assign({ para: p.i, rel: tot > 260 ? (off + x.start) / tot : null, si: si + Math.max(0, ss.findIndex(s => x.start < s.end)) }, x));
        off += p.text.length + 1; si += ss.length; }
      return si; };
    const sentA = collect(pa, la, MA), sentB = collect(pb, lb, MB);
    if (!MA.length && !MB.length) return;
    const d = DP.modal.diff(MA, MB, { sentA, sentB });
    const mark = (x) => ({ para: x.para, start: x.start, end: x.end });
    for (const pr of d.pairs.slice(0, 2)) F.push(mk('X11', Object.assign({ key: 'f.X11', sev: pr.sev }, base, { para: pr.b.para, start: pr.b.start, end: pr.b.end, refMark: mark(pr.a),
      params: { ref: pr.a.raw, rc: 'mod.' + pr.a.cls, tgt: pr.b.raw, tc: 'mod.' + pr.b.cls, why: 'mod.why.' + pr.key } })));
    if (d.pairs.length || !good) return;
    // Nur die Empfehlung: «sollte» gegenüber dem Indikativ ändert die Verbindlichkeit. Pflicht und Verbot stehen in Erlassen oft
    // im Indikativ («Die Behörde prüft»); ein einseitiges «muss» ist dort keine Abweichung (Probe mit dem AIG in drei Sprachen).
    const strong = (x) => x.cls === 'rec' && !x.soft;
    const a = d.onlyA.find(strong), b = d.onlyB.find(strong);
    if (a && !MB.length) F.push(mk('X11', Object.assign({ key: 'f.X11.absent', sev: 'info' }, base, { refMark: mark(a), params: { ref: a.raw, rc: 'mod.' + a.cls } })));
    else if (b && !MA.length) F.push(mk('X11', Object.assign({ key: 'f.X11.added', sev: 'info' }, base, { para: b.para, start: b.start, end: b.end, params: { tgt: b.raw, tc: 'mod.' + b.cls } })));
  }

  /** X12: Erlasse im Abschnittspaar (Kürzel und SR-Nummern, DP.erlasse). Verschiedene Erlasse: Fehler. Derselbe Erlass mit dem
      Kürzel einer anderen Sprache: Warnung, ausser R04 meldet die Stelle schon. Fehlt die Angabe auf einer Seite ganz: Hinweis,
      nur bei gut zugeordneten Paaren. Was X04 schon über SR-Nummern meldet, meldet X12 nicht noch einmal. */
  function checkActs(F, mk, base, r, pa, pb, ref, tgt, good, settings, on) {
    const E = DP.erlasse, idx = E.index(settings && settings.acts);
    const collect = (ps, lang) => { const out = []; for (const p of ps) { const s = E.scan(p.text, idx, lang);
      for (const c of s.cites) if (c.act) out.push({ para: p.i, act: c.act, raw: c.tok, start: c.start, end: c.end, sure: c.sure, abbr: true, langs: c.langs });
      for (const x of s.srs) if (x.act) out.push({ para: p.i, act: x.act, raw: x.raw, start: x.start, end: x.end, sure: true, abbr: false }); } return out; };
    const CA = collect(pa, ref.lang), CB = collect(pb, tgt.lang);
    if (!CA.length && !CB.length) return;
    // Mehrdeutige Kürzel («OR», «CC») zählen nur, wenn sie sicher sind oder die andere Seite denselben Erlass nennt
    const actsOf = (X, Y) => new Set(X.filter(c => c.sure || Y.some(y => y.act === c.act)).map(c => c.act));
    const SA = actsOf(CA, CB), SB = actsOf(CB, CA);
    const onlyA = Array.from(SA).filter(a => !SB.has(a)), onlyB = Array.from(SB).filter(a => !SA.has(a));
    const of = (X, a) => X.filter(c => c.act === a);
    const first = (X, a) => of(X, a).find(c => c.abbr) || of(X, a)[0];
    const label = (X, acts) => acts.map(a => '«' + first(X, a).raw + '» (' + a.sr + ')').join(', ');
    const bySr = (X, acts) => on('X04') && acts.every(a => of(X, a).some(c => !c.abbr));
    const mark = (c) => c ? { para: c.para, start: c.start, end: c.end } : undefined;
    if (onlyA.length && onlyB.length) {
      if (!(bySr(CA, onlyA) && bySr(CB, onlyB))) { const b0 = first(CB, onlyB[0]); F.push(mk('X12', Object.assign({}, base, { para: b0.para, start: b0.start, end: b0.end, refMark: mark(first(CA, onlyA[0])), params: { ref: label(CA, onlyA), tgt: label(CB, onlyB) } }))); }
    } else if (good && onlyA.length && !onlyB.length && !bySr(CA, onlyA) && !onlyA.some(a => E.titleIn(a, pb[0].text, tgt.lang))) {
      // Fehlt ein Erlass ganz oder teilweise (die andere Seite nennt nur einen Teil): Hinweis
      F.push(mk('X12', Object.assign({ key: 'f.X12.missing', sev: 'info' }, base, { refMark: mark(first(CA, onlyA[0])), params: { ref: label(CA, onlyA) } })));
    } else if (good && onlyB.length && !onlyA.length && !bySr(CB, onlyB) && !onlyB.some(a => E.titleIn(a, pa[0].text, ref.lang))) {
      const b0 = first(CB, onlyB[0]); F.push(mk('X12', Object.assign({ key: 'f.X12.added', sev: 'info' }, base, { para: b0.para, start: b0.start, end: b0.end, params: { tgt: label(CB, onlyB) } })));
    }
    // Derselbe Erlass, aber mit dem Kürzel einer anderen Sprachfassung. Meldet R04 (auch in Überschriften), meldet X12 nichts.
    // Sonst nur Stellen, die auch R04 melden würde: keine Aufzählung der Sprachfassungen («AIG, LEI und LStrI»), keine ausdrücklich
    // fremdsprachige Angabe («all. AIG»), kein Kürzel in Anführungszeichen.
    if (on('R04')) return;
    const r04 = pb.map(p => ({ i: p.i, xs: E.check(p.text, tgt.lang, idx).filter(y => y.kind === 'lang') }));
    for (const c of CB) {
      if (!c.abbr || !SA.has(c.act) || E.validIn(idx, c.raw, tgt.lang) || !['de', 'fr', 'it'].includes(tgt.lang)) continue;
      if (!r04.some(x => x.i === c.para && x.xs.some(y => y.start < c.end && y.end > c.start))) continue;
      const dst = c.act.abbr[tgt.lang];
      F.push(mk('X12', Object.assign({ key: dst ? 'f.X12.lang' : 'f.X12.lang.none', sev: 'warn' }, base, { para: c.para, start: c.start, end: c.end, refMark: mark(first(CA, c.act)), fix: dst ? { start: c.start, end: c.end, repl: dst } : undefined,
        params: { tok: c.raw, sr: c.act.sr, from: 'lang.' + c.langs[0], here: 'lang.' + tgt.lang, dst: dst || '', title: c.act.short[tgt.lang] || '' } })));
    }
  }

  /** Synopse dreier Fassungen: c1 = ref→t1, c2 = ref→t2 mit derselben Referenz. Zeilen folgen der Referenz; Absätze der Referenz,
      die in einem der beiden Vergleiche zusammengefasst sind, bilden eine gemeinsame Zeile. Zusätzliche Abschnitte einer Zielfassung
      stehen als eigene Zeile hinter dem vorangehenden Referenzabschnitt, ohne die andere Spalte zu verschieben.
      Liefert [{a, b1, b2, r1, r2, extra}] (a, b1, b2: Absatzindizes; r1, r2: Zeilennummern der beiden Vergleiche; extra: 1, 2 oder 0). */
  function join3(c1, c2) {
    const parent = new Map();
    const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
    const union = (a, b) => { const x = find(a), y = find(b); if (x !== y) parent.set(y, x); };
    const order = [];
    for (const r of c1.rows) for (const i of r.a) { parent.set(i, i); order.push(i); }
    for (const r of c2.rows) for (const i of r.a) if (!parent.has(i)) { parent.set(i, i); order.push(i); }
    order.sort((a, b) => a - b);
    for (const c of [c1, c2]) for (const r of c.rows) for (let k = 1; k < r.a.length; k++) union(r.a[0], r.a[k]);
    const groups = [], gOf = new Map();
    for (const i of order) {
      const root = find(i), last = groups[groups.length - 1];
      if (last && last.root === root) last.a.push(i); else groups.push({ root, a: [i], b1: [], b2: [], r1: [], r2: [], extra: 0 });
      gOf.set(i, groups.length - 1);
    }
    const extras = [];
    [c1, c2].forEach((c, k) => {
      const key = k ? 2 : 1; let lastG = -1;
      for (const r of c.rows) {
        if (r.a.length) { const g = groups[gOf.get(r.a[0])]; g['b' + key].push(...r.b); g['r' + key].push(r.row); lastG = gOf.get(r.a[0]); }
        else extras.push({ after: lastG, key, r });
      }
    });
    const out = [];
    const emit = (after) => { for (const k of [1, 2]) for (const x of extras) if (x.after === after && x.key === k) out.push({ a: [], b1: k === 1 ? x.r.b.slice() : [], b2: k === 2 ? x.r.b.slice() : [], r1: k === 1 ? [x.r.row] : [], r2: k === 2 ? [x.r.row] : [], extra: k }); };
    emit(-1);
    groups.forEach((g, gi) => { out.push({ a: g.a, b1: g.b1, b2: g.b2, r1: g.r1, r2: g.r2, extra: 0 }); emit(gi); });
    return out;
  }

  /** Sprachunabhängige Anker beider Fassungen (Zahlen, Abkürzungen aus Grossbuchstaben, E-Mail- und Webadressen) und ihr
      Dice-Koeffizient mit Vielfachheit; n: Zahl der Anker beider Seiten. */
  function anchorDice(A, B) {
    const bag = (ps) => { const m = new Map(); for (const p of ps) for (const x of (p.text.match(/\d+(?:[.,]\d+)*|(?<![\p{L}])\p{Lu}{2,}\p{L}*|[\w.\-]+@[\w.\-]+|https?:\/\/\S+/gu) || [])) m.set(x, (m.get(x) || 0) + 1); return m; };
    const a = bag(A), b = bag(B); let na = 0, nb = 0, sh = 0;
    for (const v of a.values()) na += v; for (const v of b.values()) nb += v;
    for (const [k, v] of a) sh += Math.min(v, b.get(k) || 0);
    return { dice: na + nb ? 2 * sh / (na + nb) : 0, n: na + nb };
  }
  /** Vergleicht Zielfassung tgt mit Referenzfassung ref. Befunde gehören zur Zielfassung. */
  function compare(ref, tgt, settings) {
    const off = (settings && settings.off) || new Set();
    const P = R.resolveParams(settings);
    const A = ref.paras.filter(p => p.kind !== 'fn'), B = tgt.paras.filter(p => p.kind !== 'fn');
    const { pairs, ratio } = align(A, B);
    const F = [];
    const cmpId = ref.id + '>' + tgt.id;
    const mk = (crit, extra) => Object.assign({ crit, cat: 'trans', sev: R.BY_ID[crit].sev, source: 'compare', key: 'f.' + crit, params: {}, cmp: cmpId, refDoc: ref.id }, extra);
    const on = (id) => !off.has(id);
    const rows = [];
    let lastB = B.length ? B[0].i : null;
    const li = L.LIDX[ref.lang], lj = L.LIDX[tgt.lang];
    const actToks = DP.erlasse && (on('X12') || on('R04')) ? new Set(Array.from(DP.erlasse.index(settings && settings.acts).byTok.entries()).filter(([, e]) => e.some(x => x.langs.includes('de'))).map(([k]) => k)) : null;
    pairs.forEach((pr, row) => {
      const pa = pr.a.map(k => A[k]), pb = pr.b.map(k => B[k]);
      const ta = pa.map(p => p.text).join(' '), tb = pb.map(p => p.text).join(' ');
      const r = { row, a: pa.map(p => p.i), b: pb.map(p => p.i), flags: 0 };
      rows.push(r);
      const before = F.length;
      if (!pb.length) {
        if (on('X01')) F.push(mk('X01', { key: 'f.X01.missing', para: lastB, refPara: r.a, params: { text: ta.slice(0, 160) }, insertAfter: true }));
      } else if (!pa.length) {
        lastB = pb[pb.length - 1].i;
        if (on('X01')) F.push(mk('X01', { key: 'f.X01.extra', sev: 'warn', para: pb[0].i, refPara: [], start: 0, end: pb[0].text.length }));
      } else {
        lastB = pb[pb.length - 1].i;
        const para = pb[0].i, refPara = r.a;
        const single = pb.length === 1;
        const fa = features(ta, ref.lang), fb = features(tb, tgt.lang);
        const base = { para, refPara };
        const loc = (x) => single && x ? { start: x.start, end: x.end } : {};
        if (on('X01')) {
          const ha = pa[0].kind === 'h' || pa[0].kind === 'title', hb = pb[0].kind === 'h' || pb[0].kind === 'title';
          if (ha !== hb && tgt.format === ref.format) F.push(mk('X01', Object.assign({ key: 'f.X01.kind', sev: 'info' }, base)));
          if (pa.length !== pb.length) F.push(mk('X01', Object.assign({ key: pa.length > pb.length ? 'f.X01.merged' : 'f.X01.split', sev: 'info' }, base)));
        }
        if (on('X02')) {
          const na = fa.nums.map(x => x.norm).concat(fa.numWords), nb = fb.nums.map(x => x.norm).concat(fb.numWords);
          const d = diffSets(Array.from(new Set(na)), Array.from(new Set(nb)));
          // Zählwörter ausserhalb 2–12 und "ein/un/uno" führen zu einseitigen Einsen: 1 nicht melden
          d.onlyA = d.onlyA.filter(x => x !== '1'); d.onlyB = d.onlyB.filter(x => x !== '1');
          if (d.onlyA.length || d.onlyB.length) {
            const f = mk('X02', Object.assign({ params: { ref: d.onlyA.join(', ') || '–', tgt: d.onlyB.join(', ') || '–' } }, base));
            if (d.onlyA.length === 1 && d.onlyB.length === 1) {
              const tb1 = fb.nums.filter(x => x.norm === d.onlyB[0]), ra1 = fa.nums.find(x => x.norm === d.onlyA[0]);
              if (tb1.length === 1 && ra1) { Object.assign(f, loc(tb1[0])); if (single) f.fix = { start: tb1[0].start, end: tb1[0].end, repl: ra1.raw }; }
            } else if (d.onlyB.length) { const x = fb.nums.find(y => y.norm === d.onlyB[0]); Object.assign(f, loc(x)); }
            F.push(f);
          }
          const da = fa.times.map(x => x.key), db = fb.times.map(x => x.key);
          const dt = diffSets(da, db);
          if (dt.onlyA.length || dt.onlyB.length) F.push(mk('X02', Object.assign({ key: 'f.X02.time', params: { ref: dt.onlyA.join(', ') || '–', tgt: dt.onlyB.join(', ') || '–' } }, base, loc(fb.times.find(x => x.key === dt.onlyB[0])))));
        }
        if (on('X03')) {
          const da = fa.dates.map(x => x.iso), db = fb.dates.map(x => x.iso);
          const d = diffSets(Array.from(new Set(da)), Array.from(new Set(db)));
          if (d.onlyA.length || d.onlyB.length) {
            const ra = fa.dates.filter(x => d.onlyA.includes(x.iso)), rb = fb.dates.filter(x => d.onlyB.includes(x.iso));
            const f = mk('X03', Object.assign({ params: { ref: ra.map(x => x.raw).join(', ') || '–', tgt: rb.map(x => x.raw).join(', ') || '–' } }, base, loc(rb[0])));
            if (single && ra.length === 1 && rb.length === 1 && rb[0].form === 'long' && ra[0].iso.length === 10) { const repl = formatDate(ra[0].iso, tgt.lang); if (repl) f.fix = { start: rb[0].start, end: rb[0].end, repl }; }
            F.push(f);
          }
        }
        if (on('X04')) {
          const d = diffSets(Array.from(new Set(fa.refs.map(x => x.key))), Array.from(new Set(fb.refs.map(x => x.key))));
          if (d.onlyA.length || d.onlyB.length) {
            const ra = fa.refs.filter(x => d.onlyA.includes(x.key)), rb = fb.refs.filter(x => d.onlyB.includes(x.key));
            F.push(mk('X04', Object.assign({ params: { ref: ra.map(x => x.raw).join(', ') || '–', tgt: rb.map(x => x.raw).join(', ') || '–' } }, base, loc(rb[0]))));
          }
        }
        if (on('X05')) {
          const d = diffSets(fa.urls.map(x => normUrl(x.raw)), fb.urls.map(x => normUrl(x.raw)));
          if (d.onlyA.length || d.onlyB.length) F.push(mk('X05', Object.assign({ params: { ref: fa.urls.filter(x => d.onlyA.includes(normUrl(x.raw))).map(x => x.raw).join(', ') || '–', tgt: fb.urls.filter(x => d.onlyB.includes(normUrl(x.raw))).map(x => x.raw).join(', ') || '–' } }, base, loc(fb.urls.find(x => d.onlyB.includes(normUrl(x.raw)))))));
        }
        if (on('X06') && li != null && lj != null && li !== lj) {
          for (const g of L.GLOSSARY) {
            const src = g[li], dst = g[lj];
            // Abkürzungen von Erlassen prüfen R04 (im Dokument) und X12 (im Vergleich) genauer
            if (actToks && actToks.has(g[0])) continue;
            if (src === dst || !hasWord(ta, src)) continue;
            const left = new RegExp('(?<![\\p{L}\\d])' + L.esc(src) + '(?![\\p{L}\\d])', 'u').exec(tb);
            if (left) { const f = mk('X06', Object.assign({ key: 'f.X06.left', params: { src, dst } }, base)); if (single) { f.start = left.index; f.end = left.index + src.length; f.fix = { start: f.start, end: f.end, repl: dst }; } F.push(f); }
            else if (!hasWord(tb, dst)) F.push(mk('X06', Object.assign({ key: 'f.X06.miss', sev: 'info', params: { src, dst } }, base)));
          }
        }
        if (on('X07') && ref.lang !== tgt.lang) {
          const norm = (s) => s.replace(/\s+/g, ' ').trim().toLowerCase();
          // Unübersetzt: gleicher Text wie die Referenz, oder (Referenzkorpus: Demo DE→FR) ein Abschnitt, der eindeutig in der
          // Sprache der Referenz steht und fast dieselben Wörter hat wie der zugeordnete Referenzabschnitt (eine überarbeitete
          // Referenz, deren alte Fassung in die Übersetzung kopiert wurde)
          const dt = L.detect(tb);
          const near = dt.n >= 8 && dt.lang === ref.lang && dt.conf > 0.18 && wordDice(ta, tb) >= 0.6;
          if ((norm(ta) === norm(tb) || near) && L.wordCount(tb) >= 4 && dt.lang !== tgt.lang) F.push(mk('X07', Object.assign({ start: 0, end: pb[0].text.length }, base)));
        }
        const good = goodPair(pa, pb, ta, tb, ratio);
        if (on('X11') && DP.modal) checkModal(F, mk, base, r, pa, pb, ref.lang, tgt.lang, good);
        if (on('X12') && DP.erlasse) checkActs(F, mk, base, r, pa, pb, ref, tgt, good, settings, on);
        if (on('X08') && pa.length === 1 && pb.length === 1 && ta.length >= 90) {
          const rr = (tb.length / ta.length) / ratio;
          if (rr < P['X08.short'] / 100) F.push(mk('X08', Object.assign({ key: 'f.X08.short', params: { pct: Math.round(rr * 100) } }, base)));
          else if (rr > P['X08.long'] / 100) F.push(mk('X08', Object.assign({ key: 'f.X08.long', params: { pct: Math.round(rr * 100) } }, base)));
        }
      }
      r.flags = F.length - before;
    });
    // Klassifizierungsvermerk muss in beiden Fassungen gleich hoch sein
    const ca = ref.meta.classification, cb = tgt.meta.classification;
    if (on('X01') && ((ca && ca.level) || 0) !== ((cb && cb.level) || 0)) F.push(mk('X01', { key: 'f.X01.classif', sev: 'warn', params: { ref: ca ? ca.label : '–', tgt: cb ? cb.label : '–' } }));
    const ha = A.filter(p => p.kind === 'h').length, hb = B.filter(p => p.kind === 'h').length;
    if (on('X01') && ha !== hb) F.push(mk('X01', { key: 'f.X01.heads', sev: 'warn', params: { ref: ha, tgt: hb } }));
    let k = 0;
    for (const f of F) {
      f.id = tgt.id + '-c' + ref.id + '-' + (++k); f.docId = tgt.id;
      if (f.para != null && f.start != null) f.quote = tgt.paras[f.para].text.slice(f.start, f.end);
      f.accepted = false;
    }
    const checked = R.CATALOG.filter(c => c.cmp && !c.ai && on(c.id)).map(c => c.id);
    const stats = { aligned: pairs.filter(p => p.a.length && p.b.length).length, missing: pairs.filter(p => !p.b.length).length, extra: pairs.filter(p => !p.a.length).length, total: pairs.length };
    stats.anchor = anchorDice(A, B);
    // Entsprechen sich die Dokumente überhaupt? Gemessen an den Testdokumenten (alle Paare verschiedener Sprache): zusammengehörige
    // Fassungen ordnen mindestens 83 % der Abschnitte zu und teilen mindestens 58 % ihrer sprachunabhängigen Anker (Zahlen,
    // Abkürzungen in Grossbuchstaben, Adressen); verschiedene Dokumente höchstens 79 % bzw. 31 %. Beide Werte schwach: kein Gegenstück.
    stats.mismatch = stats.total >= 4 && stats.aligned / stats.total < 0.8 && stats.anchor.n >= 6 && stats.anchor.dice < 0.45;
    return { id: cmpId, ref: ref.id, tgt: tgt.id, rows, findings: F, checked, stats };
  }

  DP.align = { align, compare, features, formatDate, findTimes, join3 };
})(globalThis.DP = globalThis.DP || {});
