/* Nachprüfung: eine überarbeitete Fassung gegen die unmittelbar vorangehende Fassung desselben Dokuments (gleiche Sprache).
   1. Absätze zuordnen (mapParas): zuerst textgleiche Absätze (ohne führende Nummerierung, Leerzeichen und Anführungszeichen
      vereinheitlicht), auch wenn sie verschoben sind; danach geänderte Absätze über die Ähnlichkeit ihrer Wörter (Dice-Koeffizient),
      jeweils eins zu eins, die ähnlichsten Paare zuerst.
   2. Befunde zuordnen (classify): gleiches Kriterium, gleiche Befundart, gleiche Herkunft und dieselbe Stelle, das heisst der
      zugeordnete Absatz und dieselbe markierte Textstelle (bei langen Textstellen genügt eine grosse Ähnlichkeit). Befunde zum
      ganzen Dokument zählen über Kriterium, Befundart und ihren Gegenstand (fehlender Abschnitt, Folie). Im Zweifel ordnet das
      Modul nicht zu: dann zählt der alte Befund als erledigt und der neue als neu. Ausnahme: Dieselbe markierte Textstelle mit
      demselben Kriterium und derselben Befundart, die noch im Dokument steht, gilt immer als geblieben (zweiter Durchgang).
   Alte Befunde eines Kriteriums, das in der neuen Fassung nicht geprüft wurde (ausgeschaltet, KI nicht gestartet, Vergleich fehlt),
   zählen weder als erledigt noch als geblieben («nicht erneut geprüft»). */
(function (DP) {
  'use strict';
  const norm = (s) => String(s || '').normalize('NFC').toLowerCase().replace(/[\u00a0\u202f\s]+/g, ' ').replace(/[’‘`]/g, "'").replace(/[“”„«»"‹›]/g, '"').trim();
  /** Führende Nummerierung von Überschriften und Listen («3.2 », «a) », «– ») zählt nicht: Umnummerieren ist keine Änderung. */
  const stripNum = (s) => s.replace(/^(?:\(?\d+(?:\.\d+)*[.)]?|\(?[a-z][.)]|[ivx]+[.)]|[-–—•·*▪])\s+/i, '');
  const key = (s) => norm(stripNum(norm(s)));
  const tokens = (s) => key(s).match(/[\p{L}\p{N}]+/gu) || [];
  function bag(toks) { const m = new Map(); for (const x of toks) m.set(x, (m.get(x) || 0) + 1); return m; }
  /** Dice-Koeffizient zweier Wortmengen mit Vielfachheit (0 bis 1). */
  function dice(a, b) {
    const A = a instanceof Map ? a : bag(a), B = b instanceof Map ? b : bag(b);
    let na = 0, nb = 0, sh = 0;
    for (const v of A.values()) na += v; for (const v of B.values()) nb += v;
    if (!na || !nb) return 0;
    for (const [k, v] of A) { const w = B.get(k); if (w) sh += Math.min(v, w); }
    return 2 * sh / (na + nb);
  }

  /** Zuordnung der Absätze: Int32Array alt → neu (−1: kein Gegenstück). */
  function mapParas(A, B) {
    const map = new Int32Array(A.length).fill(-1), used = new Uint8Array(B.length);
    const kb = B.map(p => key(p.text)), ka = A.map(p => key(p.text));
    // 1. Textgleich, in Dokumentreihenfolge (bei Wiederholungen der erste freie)
    const byKey = new Map();
    kb.forEach((k, j) => { if (!k) return; if (!byKey.has(k)) byKey.set(k, []); byKey.get(k).push(j); });
    ka.forEach((k, i) => { const q = k && byKey.get(k); if (!q) return; const j = q.find(x => !used[x]); if (j == null) return; map[i] = j; used[j] = 1; });
    // 2. Ähnlich: Kandidaten über gemeinsame, nicht zu häufige Wörter; Annahme ab Dice 0.6 (kurze Absätze ab 0.75)
    const ta = A.map(p => tokens(p.text)), tb = B.map(p => tokens(p.text));
    const inv = new Map();
    tb.forEach((ts, j) => { if (used[j] || ts.length < 2) return; for (const x of new Set(ts)) { if (x.length < 3) continue; if (!inv.has(x)) inv.set(x, []); inv.get(x).push(j); } });
    const bags = new Map(), bagOf = (side, k, ts) => { const id = side + k; let b = bags.get(id); if (!b) bags.set(id, b = bag(ts)); return b; };
    const cand = [];
    ta.forEach((ts, i) => {
      if (map[i] >= 0 || ts.length < 2) return;
      const hit = new Map();
      for (const x of new Set(ts)) { const l = inv.get(x); if (!l || l.length > 40) continue; for (const j of l) hit.set(j, (hit.get(j) || 0) + 1); }
      for (const [j, n] of hit) {
        if (n < 2 && ts.length > 3) continue;
        const d = dice(bagOf('a', i, ts), bagOf('b', j, tb[j])), min = Math.min(ts.length, tb[j].length) < 6 ? 0.75 : 0.6;
        if (d >= min) cand.push([d, Math.abs(i / Math.max(1, A.length) - j / Math.max(1, B.length)), i, j]);
      }
    });
    cand.sort((x, y) => y[0] - x[0] || x[1] - y[1]);
    for (const [, , i, j] of cand) if (map[i] < 0 && !used[j]) { map[i] = j; used[j] = 1; }
    return map;
  }

  /** Ähnlichkeit zweier Dokumente (Wörter ab vier Buchstaben, mit Vielfachheit). Ab 0.7 fragt die Oberfläche nach einer neuen Fassung. */
  function similarity(a, b) {
    const w = (d) => d.paras.flatMap(p => tokens(p.text)).filter(x => x.length >= 4);
    return dice(w(a), w(b));
  }

  /** Was die Nachprüfung von einem Befund braucht (ohne Verweise auf die Oberfläche). st: Status beim Ersetzen. */
  function slim(f, st, refText) {
    const o = { id: f.id, crit: f.crit, cat: f.cat, sev: f.sev, key: f.key, params: f.params ? Object.assign({}, f.params) : {}, msg: f.msg, source: f.source, cmp: f.cmp || null, refDoc: f.refDoc || null,
      para: f.para == null ? null : f.para, start: f.start == null ? null : f.start, end: f.end == null ? null : f.end, quote: f.quote || '', slide: f.slide || null, st, fa: !!f.fa, faNote: f.faNote || '', faParams: f.faParams || null, refText: refText || '' };
    if (f.fix) o.fix = { start: f.fix.start, end: f.fix.end, repl: f.fix.repl };
    return o;
  }

  const srcOf = (f) => f.source === 'ai' ? 'ai' : f.cmp ? 'cmp' : 'rule';
  const group = (f) => [f.crit, f.key || '', srcOf(f), f.cmp ? f.refDoc : ''].join('|');
  /** Gegenstand eines Befunds ohne Absatz. */
  const subject = (f) => JSON.stringify([f.params && f.params.sec || '', f.slide || (f.params && f.params.slide) || '', f.params && f.params.label || '', f.params && f.params.found || '']);
  const comparable = (f, ctx) => ctx.checked.has(f.crit) && (!f.cmp || (f.source === 'ai' ? ctx.aiPairs : ctx.pairs).has(f.refDoc));

  /** prev: {findings (slim), paraMap, checked, pairs, aiPairs, paras}; cur: {findings, checked, pairs, aiPairs, paras, refText(f)}.
      Liefert {stay: Map(neue id → alter Befund), fresh: Set(neue ids), resolved: [alte Befunde], skipped: [alte Befunde], unk: Set(neue ids)}. */
  function classify(prev, cur) {
    const stay = new Map(), fresh = new Set(), unk = new Set(), resolved = [], skipped = [];
    const olds = [], news = [];
    for (const o of prev.findings) { if (comparable(o, cur)) olds.push(o); else skipped.push(o); }
    for (const n of cur.findings) { if (comparable(n, prev)) news.push(n); else unk.add(n.id); }
    const rel = (f, paras) => f.para != null && f.start != null && paras[f.para] ? f.start / Math.max(1, paras[f.para].text.length) : 0;
    // Neue Befunde je Gruppe und Ort indizieren: Absatz, Referenztext (Vergleich) oder Gegenstand (ganzes Dokument)
    const idx = new Map();
    const put = (k, n) => { let l = idx.get(k); if (!l) idx.set(k, l = []); l.push(n); };
    const placeOf = (f, refText) => f.cmp && refText ? 'r:' + norm(refText) : f.para != null ? 'p:' + f.para : 's:' + subject(f);
    for (const n of news) put(group(n) + '#' + placeOf(n, cur.refText(n)), n);
    const cand = [];
    for (const o of olds) {
      let place;
      if (o.cmp && o.refText) place = 'r:' + norm(o.refText);
      else if (o.para != null) { const m = prev.paraMap[o.para]; if (m == null || m < 0) continue; place = 'p:' + m; }
      else place = 's:' + subject(o);
      const list = idx.get(group(o) + '#' + place); if (!list) continue;
      const oq = norm(o.quote);
      for (const n of list) {
        const nq = norm(n.quote); let score = 0;
        if (!oq && !nq) score = 1;
        else if (oq && nq && oq === nq) score = 1;
        else if (oq.length >= 40 && nq.length >= 40 && dice(tokens(oq), tokens(nq)) >= 0.7) score = 0.8;
        if (!score) continue;
        cand.push([score, Math.abs(rel(o, prev.paras) - rel(n, cur.paras)), o, n]);
      }
    }
    cand.sort((x, y) => y[0] - x[0] || x[1] - y[1]);
    const usedO = new Set();
    for (const [, , o, n] of cand) if (!usedO.has(o) && !stay.has(n.id)) { usedO.add(o); stay.set(n.id, o); }
    // Zweiter Durchgang: Steht dieselbe markierte Textstelle mit demselben Kriterium und derselben Befundart noch im Dokument
    // (Absatz stark umgeschrieben, verschoben oder zusammengelegt), ist der Befund geblieben, nicht erledigt. Bevorzugt wird ein
    // Absatz zwischen den zugeordneten Nachbarn des alten Absatzes, sonst der nächstgelegene.
    const span = (op) => {
      let lo = -1, hi = cur.paras.length;
      for (let k = op - 1; k >= 0; k--) if (prev.paraMap[k] >= 0) { lo = prev.paraMap[k]; break; }
      for (let k = op + 1; k < prev.paraMap.length; k++) if (prev.paraMap[k] >= 0) { hi = prev.paraMap[k]; break; }
      return [lo, hi];
    };
    const cand2 = [];
    for (const o of olds) {
      if (usedO.has(o) || o.para == null) continue;
      const oq = norm(o.quote); if (!oq) continue;
      const [lo, hi] = span(o.para), ro = o.para / Math.max(1, prev.paras.length);
      for (const n of news) {
        if (stay.has(n.id) || n.para == null || group(n) !== group(o) || norm(n.quote) !== oq) continue;
        const inGap = n.para > lo && n.para < hi ? 0 : 1;
        cand2.push([inGap, Math.abs(ro - n.para / Math.max(1, cur.paras.length)), o, n]);
      }
    }
    cand2.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
    for (const [, , o, n] of cand2) if (!usedO.has(o) && !stay.has(n.id)) { usedO.add(o); stay.set(n.id, o); }
    for (const o of olds) if (!usedO.has(o)) resolved.push(o);
    for (const n of news) if (!stay.has(n.id)) fresh.add(n.id);
    return { stay, fresh, resolved, skipped, unk };
  }

  DP.recheck = { mapParas, similarity, classify, slim, dice, tokens, key };
})(globalThis.DP = globalThis.DP || {});
