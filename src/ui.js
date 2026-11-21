/* Oberfläche. Zustand lebt nur in S (Arbeitsspeicher): kein localStorage, kein sessionStorage, keine Netzwerkaufrufe (einzige Ausnahme: die Versionsabfrage der Offline-Ausgabe in src/update.js). */
(function (DP) {
  'use strict';
  const { t, tn, num } = DP.i18n;
  const R = DP.rules, L = DP.lang;
  const ICONS = globalThis.DP_ICONS || {};
  /** Offline-Ausgabe ohne Versionsabfrage (node build.mjs --offline --no-update-check): Texte mit der Endung .nc, wo es sie gibt. */
  const okey = (k) => DP.offline && !DP.updateCheck && (k + '.nc') in DP.i18n.DICT.de ? k + '.nc' : k;
  const SVGNS = 'http://www.w3.org/2000/svg';
  const SVG_TAGS = new Set(['svg', 'path', 'circle']);
  const MAX_BYTES = 60 * 1024 * 1024;
  /** Feste Adresse der neusten Ausgabe (Hinweis auf eine neue Version, «Als Datei speichern», Hinweise zu klassifizierten Dokumenten). */
  const RELEASE_URL = 'https://github.com/SEM-SGG/lectora/releases/latest';
  /** Offline-Ausgabe über http(s) geöffnet, also auf GitHub Pages oder einem Webserver: Dokumente mit Klassifizierungsvermerk werden dort
      nicht oder erst nach Rückfrage geprüft (readFiles). Als lokale Datei (file:) und in der Artefakt-Ausgabe gilt WEB nicht. */
  const WEB = !!DP.offline && /^https?:$/.test(location.protocol);

  /** Einstellungen und Ansichtszustände mit ihren Ausgangswerten; «Sitzung leeren» setzt alle darauf zurück. */
  const DEFAULTS = () => ({
    // rc: Filter der Nachprüfung ('new' neue, 'stay' gebliebene Befunde)
    filter: { sev: null, cat: null, hidden: false, rc: null }, cmpOnly: true, cmpMode: 'pair',
    // actsText/acts: eigene Erlasse (Zeilen «SR; DE; FR; IT» bzw. gelesen mit DP.erlasse.parseCustom); bleiben in settings für eine spätere Profildatei
    settings: { off: new Set(), custom: '', termsText: '', terms: [], params: {}, actsText: '', acts: [] },
    author: 'Lectora', expComments: true, expLang: {}, limit: 150, rowLimit: 300,
    // Prüfansicht: Dokument oder Liste, gewählter Befund, offene Werkzeugleiste, Anzahl gezeigter Absätze, erfüllte Kriterien offen bzw. vollständig
    view: 'doc', sel: null, tb: null, paraLimit: 150, metOpen: true, metAll: false, rcOpen: true, rcAll: false,
    // Kriterienkatalog: aufgeklappte Abschnitte; Anleitung: Sprungziel nach dem Wechsel
    critOpen: new Set(), anchor: null,
    // Prüfprofil: geladenes bzw. gespeichertes Profil {name, sig, how: 'loaded'|'saved'} und eingegebener Name (null: Vorgabe);
    // Rückmeldung zu den Regeln: Textstellen beilegen (aus, bis die Person es ausdrücklich einschaltet)
    profile: null, profName: null, fbQuotes: false, profStd: null,
    // Vergleiche, die trotz offensichtlich verschiedener Dokumente gezeigt werden sollen (Kennung des Vergleichs → true)
    cmpForce: {}
  });
  const S = Object.assign({
    // versions: je Dokument die unmittelbar vorangehende Fassung für die Nachprüfung (nur Absatztexte und Befunde mit Entscheiden)
    lang: 'de', route: 'docs', docs: [], res: {}, cmp: {}, cmpAi: {}, versions: {}, cur: null, ref: null, tgt: null, tgt2: null,
    busy: null, aiAvail: null, dlAvail: null, enter: true, focus: null, reveal: null,
    // keys: Einzeltasten-Kürzel der Prüfung (WCAG 2.1.4: abschaltbar; gilt für die Sitzung, «Sitzung leeren» lässt die Wahl stehen)
    keys: true
  }, DEFAULTS(), AIX());
  DP.state = S;
  /** Ergebnisse der KI-Funktionen (nur im Arbeitsspeicher; «Sitzung leeren» setzt sie zurück):
      duty: Pflichtenmatrix je Dokument; dutyCmp: Abgleich zweier Matrizen je Vergleich; dutyStale: Matrix einer ersetzten Fassung verworfen;
      bt: Rückübersetzung des gewählten Paars; btKept: von Hand festgehaltene Abweichungen je Vergleich; rwOk: Zustimmung zu
      Formulierungsvorschlägen für diese Sitzung; aiPause: nach «ausgelastet» bis zu diesem Zeitpunkt keine neue Anfrage;
      pin: Stelle aus der Pflichtenmatrix in der Dokumentansicht; dutyGaps, dutySort, dutySynAll, btShow, btSort, btNote: Ansicht */
  function AIX() { return { duty: {}, dutyCmp: {}, dutyStale: {}, bt: null, btKept: {}, rwOk: false, aiPause: 0, pin: null, dutyGaps: false, dutySort: null, dutySynAll: false, btShow: true, btSort: false, btNote: null }; }
  /** Weicht eine Einstellung oder ein Ansichtszustand vom Ausgangswert ab? */
  function settingsChanged() {
    const d = DEFAULTS(), s = S.settings, F = S.filter;
    return S.author !== d.author || S.expComments !== d.expComments || Object.keys(S.expLang).length > 0 || S.view !== d.view || S.metOpen !== d.metOpen || S.metAll !== d.metAll || S.rcOpen !== d.rcOpen || S.rcAll !== d.rcAll ||
      S.critOpen.size > 0 || !!(F.sev || F.cat || F.hidden || F.rc) || !!S.profile || S.profName != null || S.fbQuotes || S.cmpOnly !== d.cmpOnly || S.cmpMode !== d.cmpMode || s.off.size > 0 || !!s.custom || !!s.termsText || s.terms.length > 0 || !!s.actsText || s.acts.length > 0 ||
      Object.keys(s.params).length > 0 || S.limit !== d.limit || S.rowLimit !== d.rowLimit || S.paraLimit !== d.paraLimit;
  }
  const canClear = () => S.docs.length > 0 || settingsChanged();
  function updateClear() { const b = $('clearBtn'); if (b) b.disabled = !canClear(); profStateRefresh(); }

  /* ---------- Bausteine ---------- */
  function h(tag, props, ...kids) {
    const svg = SVG_TAGS.has(tag);
    const el = svg ? document.createElementNS(SVGNS, tag) : document.createElement(tag);
    for (const k in props || {}) {
      const v = props[k];
      if (v == null || v === false) continue;
      if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'style') for (const p in v) el.style.setProperty(p, v[p]);
      else if (!svg && (k === 'checked' || k === 'disabled' || k === 'selected' || k === 'hidden' || k === 'open')) el[k] = !!v;
      else if (k === 'value') el.value = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    add(el, kids);
    return el;
  }
  function app(el, ...kids) { add(el, kids); return el; }
  function add(el, kids) { for (const c of kids) { if (c == null || c === false) continue; if (Array.isArray(c)) add(el, c); else el.append(c.nodeType ? c : String(c)); } }
  /** Strich-Icon (Lucide, 24 × 24); das Innere stammt unverändert aus dem Build (window.DP_ICONS). */
  function icon(name, cls) {
    const s = h('svg', { class: 'ic' + (cls ? ' ' + cls : ''), viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' });
    s.innerHTML = ICONS[name] || '';
    return s;
  }
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const $ = (id) => document.getElementById(id);
  const docById = (id) => S.docs.find(d => d.id === id);
  const SEV_ICON = { error: 'error_fill', warn: 'warning_fill', info: 'info_fill' };
  const CAT_ICON = { formal: 'assignment_turned_in', struct: 'account_tree', lang: 'spellcheck', typo: 'format_quote', refs: 'link', tech: 'accessibility_new', quality: 'psychology', trans: 'translate' };
  const FMT_ICON = { docx: 'article', pdf: 'picture_as_pdf', pptx: 'slideshow' };
  const SEV_ORDER = { error: 0, warn: 1, info: 2 };

  function btn(label, opts) {
    opts = opts || {};
    return h('button', { type: 'button', class: 'btn ' + (opts.kind || ''), onclick: opts.onclick, disabled: opts.disabled, 'data-fid': opts.fid, 'aria-label': opts.aria, 'data-tip': opts.tip }, opts.icon ? icon(opts.icon, 'sm') : null, label);
  }
  function iconBtn(name, label, onclick, opts) {
    opts = opts || {};
    // Kurzinfo statt title: zeigt den Namen sichtbar an, die Beschreibung (opts.tip) kommt über aria-describedby dazu
    return h('button', { type: 'button', class: 'icon-btn ' + (opts.kind || ''), 'aria-label': label, 'data-tip': opts.tip || '', onclick, 'data-fid': opts.fid, disabled: opts.disabled }, icon(name));
  }
  function toggle(label, checked, onchange, fid, opts) {
    const id = 'sw-' + fid;
    return h('label', { class: 'switch', for: id }, h('input', { type: 'checkbox', id, checked, onchange: (e) => onchange(e.target.checked), 'data-fid': fid, 'aria-label': opts && opts.aria, 'data-tip': opts && opts.tip }), opts && opts.hide ? null : h('span', null, label));
  }
  /** Ruhige, unbestimmte Fortschrittsanzeige. */
  function progress(label) {
    return h('div', { class: 'progress', role: 'progressbar', 'aria-label': label }, h('span', { class: 'progress-bar' }));
  }
  /** Höchstens eine Meldung: eine neue ersetzt die sichtbare, derselbe Text startet nur deren Zeitgeber neu. */
  let snackEl = null, snackTimer = null;
  function clearSnack() { clearTimeout(snackTimer); snackEl = null; $('snacks').replaceChildren(); }
  /** action: {label, run} oder eine Liste davon (höchstens zwei Schaltflächen). */
  function snack(text, action) {
    const host = $('snacks');
    const acts = action ? [].concat(action) : [];
    const ms = acts.length > 1 ? 9000 : acts.length ? 7000 : 4500;
    if (snackEl && snackEl.isConnected && !acts.length && !snackEl.dataset.action && snackEl.dataset.text === text) {
      clearTimeout(snackTimer); snackTimer = setTimeout(snackEl.closeSnack, ms); return;
    }
    clearSnack();
    const el = h('div', { class: 'snack', 'data-text': text, 'data-action': acts.length ? '1' : null }, h('span', null, text));
    const close = () => { if (!el.isConnected) return; el.classList.add('out'); setTimeout(() => { el.remove(); if (snackEl === el) snackEl = null; }, 200); };
    el.closeSnack = close;
    for (const a of acts) app(el, h('button', { type: 'button', class: 'btn text sm', 'data-fid': a.fid, onclick: () => { close(); a.run(); } }, a.label));
    host.append(el); snackEl = el;
    snackTimer = setTimeout(close, ms);
  }
  /** Modaler Dialog. back: Fokusziele (data-fid oder #id), wenn der Dialog mit Escape schliesst und das auslösende Element
      nicht mehr bedienbar ist (etwa ein verstecktes Dateifeld); ohne Angabe der Inhaltsbereich. */
  function dialog(build, back) {
    hideTip();
    const d = $('dlg');
    d.replaceChildren();
    const opener = document.activeElement, close = () => { if (d.open) d.close(); };
    build(d, close);
    if (!d.open) {
      d.showModal();
      const usable = (el) => el && el.isConnected && el !== document.body && !el.disabled && el.getClientRects().length > 0;
      const fromOpener = usable(opener) && opener !== $('view');
      d.addEventListener('close', () => setTimeout(() => {
        if (d.open) return;
        const a = document.activeElement, moved = a && a !== document.body && a.isConnected && !d.contains(a);
        // Eine Schaltfläche im Dialog hat den Fokus schon gesetzt (etwa «Abbrechen» → zurück zum Auslöser)
        if (moved && ((fromOpener && a === opener) || (!fromOpener && !back))) return;
        if (moved && a !== $('view')) return;
        if (fromOpener) { opener.focus({ preventScroll: true }); return; }
        applyFocus([].concat(back || [], '#view'), true);
      }), { once: true });
    }
    const f = d.querySelector('[data-autofocus]') || d.querySelector('button');
    if (f) f.focus();
    return close;
  }

  /* ---------- Befunde: Zugriff und Darstellung ---------- */
  function findingsOf(doc) {
    const r = S.res[doc.id]; if (!r) return [];
    let out = r.rule.concat(r.ai || [], (S.duty[doc.id] && S.duty[doc.id].findings) || []);
    // Vergleiche zweier Dokumente, die einander offensichtlich nicht entsprechen, zählen erst mit, wenn die Person sie trotzdem zeigt
    for (const id in S.cmp) if (S.cmp[id].tgt === doc.id && cmpShown(S.cmp[id])) out = out.concat(S.cmp[id].findings, extraOf(id));
    return out;
  }
  const cmpShown = (c) => !c.stats.mismatch || !!S.cmpForce[c.id];
  /** Hinweis über dem Vergleich: die Dokumente entsprechen einander offensichtlich nicht (DP.align: Zuordnung und Anker schwach). */
  function mismatchNote(c) {
    const ref = docById(c.ref), tgt = docById(c.tgt);
    return h('div', { class: 'notice', role: 'status', 'data-fid': 'cmp-mismatch-' + c.tgt }, icon('warning_fill'), h('div', null,
      h('p', null, t('cmp.mismatch', { ref: ref.name, tgt: tgt.name, a: num(c.stats.aligned), b: num(c.stats.total) })),
      btn(t('cmp.mismatch.show'), { kind: 'text sm', icon: 'visibility', fid: 'cmp-force-' + c.tgt, onclick: () => { S.cmpForce[c.id] = true; S.focus = ['cmp-only', '#view']; render(); } })));
  }
  /** Befunde eines Vergleichs ausser den lokalen: Bedeutungsvergleich, Abgleich der Pflichtenmatrizen, festgehaltene Rückübersetzung. */
  function extraOf(id) {
    return ((S.cmpAi[id] && S.cmpAi[id].list) || []).concat((S.dutyCmp[id] && S.dutyCmp[id].findings) || [], S.settings.off.has('X17') ? [] : (S.btKept[id] || []));
  }
  const live = (list) => list.filter(f => !f.dismissed);
  /** Erledigt: abgelehnt, ignoriert oder als Vorschlag angenommen. Ergebnis, Zähler und Abzeichen zählen nur offene Befunde. */
  const isOpen = (f) => !f.dismissed && !(f.fix && f.accepted);
  function countsOf(list) { const c = { error: 0, warn: 0, info: 0 }; for (const f of list) if (isOpen(f)) c[f.sev]++; return c; }
  /** Nicht ausgeblendete Befunde je Schweregrad: Zahlen der Filter, die auch angenommene Vorschläge zeigen. */
  function liveCounts(list) { const c = { error: 0, warn: 0, info: 0 }; for (const f of live(list)) c[f.sev]++; return c; }
  const nAccepted = (list) => list.filter(f => f.fix && !f.dismissed && f.accepted).length;
  function verdictOf(c) { return c.error ? 'fail' : c.warn ? 'warn' : 'pass'; }
  function checkedOf(doc) {
    const r = S.res[doc.id]; const set = new Set(r ? r.checked : []);
    if (r && r.aiState === 'done') for (const c of R.CATALOG) if (c.ai && !c.cmp && !c.duty && !S.settings.off.has(c.id) && (c.id !== 'Q07' || S.settings.custom.trim())) set.add(c.id);
    // Lücken der Pflichtenmatrix gelten als geprüft, sobald die Matrix vollständig ist
    if (S.duty[doc.id] && S.duty[doc.id].state === 'done') for (const c of R.CATALOG) if (c.duty && !c.cmp && !S.settings.off.has(c.id) && R.applies(c, doc)) set.add(c.id);
    for (const id in S.cmp) if (S.cmp[id].tgt === doc.id) { for (const x of S.cmp[id].checked) set.add(x); if (S.cmpAi[id] && S.cmpAi[id].state === 'done') for (const x of ['X09', 'X10']) if (!S.settings.off.has(x)) set.add(x);
      if (S.dutyCmp[id] && S.dutyCmp[id].done) for (const x of ['X13', 'X14', 'X15', 'X16']) if (!S.settings.off.has(x)) set.add(x); }
    return set;
  }
  function metOf(doc) {
    const checked = checkedOf(doc);
    // Ein Kriterium gilt als erfüllt, sobald alle seine Befunde angenommen, abgelehnt oder ignoriert sind
    const bad = new Set(findingsOf(doc).filter(f => isOpen(f) && f.crit !== 'F06').map(f => f.crit));
    const met = Array.from(checked).filter(id => !bad.has(id));
    return { checked, met, pct: checked.size ? Math.round(met.length / checked.size * 100) : 100 };
  }
  /** Platzhalter der Prüfparameter eines Kriteriums, formatiert ({note: '32'} …). */
  function paramText(crit) { const v = R.paramValues(crit, S.settings), o = {}; for (const k in v) o[k] = num(v[k]); return o; }
  // {n} in R04: Zahl der eingebauten Erlasse (aus der Tabelle, damit Text und Tabelle nicht auseinanderlaufen)
  const critDesc = (id) => t('c.' + id + '.d', Object.assign(id === 'R04' && DP.erlasse ? { n: num(DP.erlasse.TABLE.length) } : {}, paramText(id)));
  function msgOf(f) {
    if (f.msg) return f.msg[S.lang] || f.msg.de;
    const p = paramText(f.crit);
    for (const k in f.params) { const v = f.params[k]; p[k] = typeof v === 'string' && /^(?:sec|lang|mod)\.[\w.]+$/.test(v) ? t(v) : typeof v === 'number' ? num(v) : v; }
    // Befundtexte mit Pluralformen (.one/.other) richten sich nach der Zahl n
    if (f.params && typeof f.params.n === 'number' && (f.key + '.one') in DP.i18n.DICT.de) return tn(f.key, f.params.n, p);
    return t(f.key, p);
  }
  function locOf(f, doc) {
    const parts = [];
    const p = f.para != null ? doc.paras[f.para] : null;
    const slide = f.slide || (p && p.loc.slide), page = p && p.loc.page;
    if (slide) parts.push(t('loc.slide', { n: slide }));
    if (page) parts.push(t('loc.page', { n: page }));
    if (p) {
      if (p.kind === 'fn') parts.push(t('loc.fn'));
      const sec = p.kind === 'h' || p.kind === 'title' ? p : (p.loc.sec != null ? doc.paras[p.loc.sec] : null);
      if (sec && !slide) parts.push(sec.text.length > 48 ? sec.text.slice(0, 46).trim() + '…' : sec.text);
      if (doc.format === 'docx' && p.kind !== 'fn') parts.push(t('loc.para', { n: p.i + 1 }));
    }
    return parts.length ? parts.join(' · ') : t('fd.doc');
  }
  /** Unsichtbare Zeichen sichtbar: ⍽ steht für ein geschütztes Leerzeichen, ␣ für ein sonst unsichtbares Leerzeichen.
      vis() für Bericht und kopierten Text (mit Legende), visN() für die Oberfläche: Symbol sichtbar, für Screenreader in Worten. */
  const vis = (s) => s.replace(/\u00a0/g, '⍽').replace(/^ +$| {2,}/g, (m) => '␣'.repeat(m.length));
  const hasVis = (s) => /\u00a0|^ +$| {2,}/.test(s || '');
  function visN(s) {
    const v = vis(s); if (!/[⍽␣]/.test(v)) return v;
    const out = [];
    for (const part of v.split(/([⍽␣])/)) {
      if (part === '⍽' || part === '␣') out.push(h('span', { 'aria-hidden': 'true' }, part), h('span', { class: 'sr', lang: uiLang() }, ' ' + t(part === '⍽' ? 'sym.nbsp' : 'sym.space') + ' '));
      else if (part) out.push(part);
    }
    return out;
  }
  /** Begleittext für Screenreader: die Zeichen in Worten. */
  const visW = (s) => vis(s).replace(/⍽/g, ' ' + t('sym.nbsp') + ' ').replace(/␣/g, ' ' + t('sym.space') + ' ').replace(/ {2,}/g, ' ');
  /** Textstelle mit Umfeld; bei Vorschlag als Streichung und Einfügung. */
  function quoteNode(f, doc, ctxLen) {
    if (f.para == null || f.start == null) return null;
    const text = doc.paras[f.para].text;
    ctxLen = ctxLen == null ? 70 : ctxLen;
    let a = Math.max(0, f.start - ctxLen), b = Math.min(text.length, f.end + ctxLen);
    if (a > 0) { const sp = text.indexOf(' ', a); if (sp > 0 && sp < f.start) a = sp + 1; }
    if (b < text.length) { const sp = text.lastIndexOf(' ', b); if (sp > f.end) b = sp; }
    const q = h('blockquote', { class: 'quote', lang: doc.lang });
    const ctx = (s) => s ? h('span', { class: 'ctx' }, s) : null;
    app(q, a > 0 ? '… ' : '');
    if (f.fix && !f.dismissed) {
      const ops = f.fix.words ? DP.exporter.diffOps(text.slice(f.fix.start, f.fix.end), f.fix.repl, f.fix.start) : [{ start: f.fix.start, end: f.fix.end, repl: f.fix.repl }];
      let pos = a;
      for (const o of ops) {
        if (o.start > pos) app(q, ctx(text.slice(pos, o.start)));
        if (o.end > o.start) app(q, h('del', null, visN(text.slice(o.start, o.end))));
        if (o.repl) app(q, h('ins', null, visN(o.repl)));
        pos = Math.max(pos, o.end);
      }
      if (pos < b) app(q, ctx(text.slice(pos, b)));
    } else {
      app(q, ctx(text.slice(a, f.start)), h('mark', null, text.slice(f.start, f.end)), ctx(text.slice(f.end, b)));
    }
    app(q, b < text.length ? ' …' : '');
    return q;
  }

  /* ---------- Status: offen, angenommen, abgelehnt (Vorschläge) bzw. offen, ignoriert (Befunde ohne Vorschlag) ----------
     Gespeichert bleiben die beiden Merker accepted und dismissed; der Status leitet sich daraus ab. */
  function stOf(f) { return f.fix ? (f.dismissed ? 'rejected' : f.accepted ? 'accepted' : 'open') : (f.dismissed ? 'ignored' : 'open'); }
  /** st 'fa': ausgeblendet wie «Ignorieren» bzw. «Ablehnen» und als Fehlalarm markiert (f.fa, mit den dabei geltenden Parametern).
      Jeder andere Entscheid entfernt die Markierung. */
  function setSt(f, st) {
    f.accepted = st === 'accepted'; f.dismissed = st === 'rejected' || st === 'ignored' || st === 'fa';
    if (st === 'fa') { f.fa = true; f.faParams = R.paramValues(f.crit, S.settings); } else f.fa = false;
  }
  const posOf = (f) => (f.fix ? f.fix.start : f.start) || 0;
  const docOrder = (a, b) => (a.para == null ? -1 : a.para) - (b.para == null ? -1 : b.para) || posOf(a) - posOf(b);
  /** Fokusziele nach einem Entscheid, falls das Element verschwindet: die nächste offene Stelle in Dokumentreihenfolge.
      ctx: 'tb' (Werkzeugleiste im Text), 'm' (Randkarte) oder 'list' (Liste). */
  function nextFocus(f, ctx) {
    // Vergleich (paarweise und Synopse): die nächste Befundkarte auf dem Bildschirm, sonst die vorherige, sonst der Schalter darüber
    if (S.route === 'compare') {
      const cards = Array.from($('view').querySelectorAll('.find[data-id]')), k = cards.findIndex(c => c.dataset.id === f.id);
      const near = k < 0 ? cards : cards.slice(k + 1).concat(cards.slice(0, k).reverse());
      const out = [];
      for (const c of near) { const b = c.querySelector('button[data-fid]'); if (b) out.push(b.dataset.fid); if (out.length >= 3) break; }
      return out.concat('cmp-only');
    }
    const doc = docById(S.cur); if (!doc) return [];
    // In der Liste in der Reihenfolge der Liste (Kategorie, Schweregrad, Stelle), sonst in Dokumentreihenfolge
    const order = ctx === 'list' && S.view === 'list' ? kbOrder(doc) : docOrder;
    const list = shownOf(findingsOf(doc)).filter(x => x !== f && stOf(x) === 'open').sort(order);
    const n = list.find(x => order(x, f) > 0) || list[0];
    if (!n) return [];
    return ctx === 'tb' ? ['chg-' + n.id, 'm-acc-' + n.id, 'm-dis-' + n.id] : ctx === 'm' ? ['m-acc-' + n.id, 'm-dis-' + n.id, 'sel-' + n.id] : ['acc-' + n.id, 'dis-' + n.id];
  }
  /** Entscheid zu einem Befund; focus: data-fid, das danach den Fokus erhält; ctx: Herkunft (siehe nextFocus). */
  function decide(f, st, focus, ctx, next) {
    const touched = [f.para, paraOfId(S.sel), paraOfId(S.tb)];
    const before = snapOf(f), from = stOf(f);
    animPrep(f);
    // Zurücksetzen stellt nach einer Bearbeitung den ursprünglichen Vorschlag des Tools wieder her
    if (st === 'open' && f.fix && f.fix.orig != null) { f.fix.repl = f.fix.orig; delete f.fix.orig; }
    setSt(f, st); S.tb = null; S.sel = f.id;
    pushUndo([[f, before]]);
    animWant(f, from, stOf(f));
    // Tastenkürzel: danach ist der nächste offene Befund gewählt und im Bild
    if (next && kbGoto(next, touched)) { animRun(); }
    else { S.focus = [focus].concat(nextFocus(f, ctx)).filter(Boolean); update(touched); animRun(); }
    if (st === 'fa' || (!f.fix && st === 'ignored')) snack(t(st === 'fa' ? 'fd.fa.done' : 'fd.ignored'), { label: t('fd.undo'), fid: 'snack-undo', run: () => { setSt(f, 'open'); S.focus = [focus]; update([f.para]); } });
    else snack(t(f.fix ? 'st.done.' + st : 'fd.restored'));
  }
  /** Markierung als Fehlalarm entfernen; der Befund bleibt ausgeblendet. */
  function unmarkFa(f, focus) {
    f.fa = false; S.focus = [focus]; update([f.para]);
    snack(t('fd.fa.unmarked'), { label: t('fd.undo'), fid: 'snack-undo', run: () => { f.fa = true; f.dismissed = true; S.focus = [focus]; update([f.para]); } });
  }
  const stTag = (f) => { const st = stOf(f); if (st === 'open') return null;
    if (f.fa) return h('span', { class: 'tag st st-fa' }, icon('flag', 'sm'), t('st.fa'));
    return h('span', { class: 'tag st st-' + st }, st === 'accepted' ? icon('check', 'sm') : null, t('st.' + st)); };
  /** Etikett «Neu» der Nachprüfung (RC: Zuordnung des Dokuments in der Prüfansicht, sonst null). */
  let RC = null;
  const rcTag = (f) => RC && RC.fresh.has(f.id) ? h('span', { class: 'tag rc-new' }, t('rc.tag.new')) : null;
  /** Notiz zu einem Fehlalarm: eine Zeile, freiwillig, nur in Liste und aufgeklappter Randkarte. */
  function faNoteField(f, pre) {
    if (!f.fa) return null;
    const id = (pre || '') + 'fan-' + f.id;
    return h('div', { class: 'field fa-note' }, h('label', { for: id }, t('fd.fa.note')),
      h('input', { type: 'text', id, 'data-fid': id, maxlength: 140, autocomplete: 'off', value: f.faNote || '', placeholder: t('fd.fa.note.ph'), oninput: (e) => { f.faNote = e.target.value; } }));
  }
  /** Aktionen eines Befunds, gleich in Liste, Randspalte und Werkzeugleiste. */
  /** part: 'main' ohne Bearbeiten, 'edit' nur Bearbeiten, sonst alle. */
  function findActions(f, card, pre, part) {
    pre = pre || '';
    const st = stOf(f), out = [], ctx = pre ? 'm' : 'list';
    if (part !== 'edit') {
      if (f.fix) {
        if (st === 'open') out.push(
          btn(t('fd.accept'), { kind: 'text sm', icon: 'check', fid: pre + 'acc-' + f.id, tip: t('tip.accept'), onclick: () => decide(f, 'accepted', pre + 'rst-' + f.id, ctx) }),
          btn(t('fd.reject'), { kind: 'text sm', icon: 'close', fid: pre + 'rej-' + f.id, tip: t('tip.reject'), onclick: () => decide(f, 'rejected', pre + 'rst-' + f.id, ctx) }));
        else out.push(btn(t('fd.reset'), { kind: 'text sm', icon: 'undo', fid: pre + 'rst-' + f.id, tip: t('tip.reset'), onclick: () => decide(f, 'open', pre + 'acc-' + f.id, ctx) }));
      } else out.push(st === 'ignored'
        ? btn(t('fd.restore'), { kind: 'text sm', icon: 'undo', fid: pre + 'dis-' + f.id, tip: t('tip.restore'), onclick: () => decide(f, 'open', pre + 'dis-' + f.id, ctx) })
        : btn(t('fd.ignore'), { kind: 'text sm', icon: 'visibility_off', fid: pre + 'dis-' + f.id, tip: t('tip.ignore'), onclick: () => decide(f, 'ignored', pre + 'dis-' + f.id, ctx) }));
    }
    if (part !== 'main' && f.fix && st !== 'rejected' && card) out.push(btn(t('fd.edit'), { kind: 'text sm', icon: 'edit', fid: pre + 'edit-' + f.id, tip: t('tip.edit'), onclick: () => editFix(f, card, pre) }));
    // Fehlalarm melden: in der Liste neben «Ignorieren» bzw. «Ablehnen», in der Randspalte erst in der aufgeklappten Karte
    if (part !== 'main') {
      const back = pre + (f.fix ? 'rst-' : 'dis-') + f.id;
      if (st === 'open') out.push(btn(t('fd.fa'), { kind: 'text sm', icon: 'flag', fid: pre + 'fa-' + f.id, tip: t('tip.fa'), onclick: () => decide(f, 'fa', back, ctx) }));
      else if (f.fa) out.push(btn(t('fd.fa.unmark'), { kind: 'text sm', icon: 'flag_off', fid: pre + 'fau-' + f.id, tip: t('tip.faUnmark'), onclick: () => unmarkFa(f, back) }));
    }
    return out;
  }
  function findCard(f, doc, i, opts) {
    opts = opts || {};
    const st = stOf(f);
    const card = h('article', { class: 'find ' + f.sev + ' st-' + st + (f.dismissed ? ' dismissed' : '') + (S.sel === f.id ? ' sel' : ''), style: { '--i': i }, 'data-id': f.id });
    const top = h('div', { class: 'find-top' },
      h('span', { class: 'find-title' }, t('c.' + f.crit + '.t')),
      h('span', { class: 'tag id' }, f.crit),
      h('span', { class: 'tag sev-' + f.sev }, t('sev.' + f.sev)),
      f.source === 'ai' ? h('span', { class: 'tag ai' }, h('span', { class: 'swatch acc-ai', 'aria-hidden': 'true' }), t('src.ai')) : null,
      f.cmp && !opts.inCmp ? h('span', { class: 'tag cmp' }, h('span', { class: 'swatch acc-cmp', 'aria-hidden': 'true' }), t('src.compare')) : null, opts.pair || null, opts.inCmp ? null : rcTag(f), stTag(f));
    const bodyEl = h('div', null, top, h('p', { class: 'find-msg' }, msgOf(f)));
    if (!opts.inCmp) app(bodyEl, h('div', { class: 'find-loc' }, locOf(f, doc)));
    const q = quoteNode(f, doc); if (q) app(bodyEl, q);
    app(bodyEl, rwNote(f));
    if (f.hint) app(bodyEl, h('blockquote', { class: 'quote', lang: doc.lang }, h('span', { class: 'lbl' }, t('fd.suggest')), f.hint));
    if (f.bt) app(bodyEl, h('blockquote', { class: 'quote ref', lang: f.btLang || null }, h('span', { class: 'lbl' }, t('bt.col.plain')), f.bt));
    if (f.refPara && f.refPara.length && !opts.inCmp) {
      const rd = docById(f.refDoc);
      if (rd) app(bodyEl, h('blockquote', { class: 'quote ref', lang: rd.lang }, h('span', { class: 'lbl' }, t('fd.ref') + ' · ' + rd.name), clip(f.refPara.map(k => rd.paras[k].text).join(' '), 320)));
    }
    app(bodyEl, h('div', { class: 'find-actions' }, findActions(f, card), rwActs(f, doc, '')), faNoteField(f, ''));
    app(card, h('span', { class: 'sev-ico', 'aria-hidden': 'true' }, icon(SEV_ICON[f.sev], 'sm')), bodyEl);
    return card;
  }
  const clip = (s, n) => s.length > n ? s.slice(0, n - 1).trim() + '…' : s;
  function editFix(f, card, pre) {
    pre = pre || '';
    const acts = card.querySelector('.find-actions');
    if (card.querySelector('.edit-row')) return;
    const id = pre + 'fix-' + f.id;
    const input = h('input', { type: 'text', id, value: f.fix.repl, 'aria-label': t('fd.edit') });
    // Der ursprüngliche Vorschlag des Tools bleibt in fix.orig, damit «Zurücksetzen» ihn wiederherstellt
    const save = () => { const before = snapOf(f); if (input.value !== f.fix.repl && f.fix.orig == null) f.fix.orig = f.fix.repl; f.fix.repl = input.value; setSt(f, 'accepted'); pushUndo([[f, before]]); S.sel = f.id; S.focus = [pre + 'edit-' + f.id, pre + 'rst-' + f.id]; update([f.para]); snack(t('st.done.accepted')); };
    // Enter: preventDefault, sonst löst derselbe Tastendruck den Stift aus, der eben den Fokus erhalten hat
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } if (e.key === 'Escape') { e.stopPropagation(); S.focus = [pre + 'edit-' + f.id]; update([f.para]); } });
    acts.before(h('div', { class: 'edit-row' }, input, iconBtn('check', t('fd.accept'), save, { kind: 'tonal' })));
    layoutMargin(); placeTb();
    input.focus(); input.select();
  }

  /* ---------- Prüfläufe ---------- */
  function sig(f) { return [f.crit, f.key, f.para, f.start, f.quote].join('|'); }
  /** Entscheide (und Fehlalarm, Notiz, Stand der Nachprüfung) von einer früheren Prüfung derselben Fassung übernehmen. */
  function keepDecisions(fresh, old) {
    const keep = new Map();
    for (const f of old || []) keep.set(sig(f), f);
    for (const f of fresh) { const o = keep.get(sig(f)); if (!o) continue;
      f.dismissed = o.dismissed; f.accepted = o.accepted; f.fa = o.fa; f.faNote = o.faNote; f.faParams = o.faParams; f.rcSeen = o.rcSeen;
      if (o.fix && f.fix) { f.fix.repl = o.fix.repl; if (o.fix.orig != null) f.fix.orig = o.fix.orig; }
      // Formulierungsvorschlag von Claude zu einem Befund ohne eigenen Vorschlag: bleibt bei gleicher Stelle erhalten
      else if (o.fix && o.fixAi && !f.fix) { f.fix = Object.assign({}, o.fix); f.fixAi = true; f.fixWarn = o.fixWarn; } }
  }
  function runRules(doc) {
    const old = S.res[doc.id];
    const r = R.runRules(doc, S.settings);
    keepDecisions(r.findings, old && old.rule);
    S.res[doc.id] = Object.assign(old || { ai: [], aiState: 'idle' }, { rule: r.findings, checked: r.checked });
  }
  /** Vergleich neu berechnen; Entscheide zu Befunden, die gleich bleiben, gehen nicht verloren. */
  function compareKeep(a, b) {
    const id = a.id + '>' + b.id, old = S.cmp[id], c = DP.align.compare(a, b, S.settings);
    keepDecisions(c.findings, old && old.findings);
    return (S.cmp[id] = c);
  }
  function rerunAll() {
    for (const d of S.docs) runRules(d);
    for (const id in S.cmp) { const c = S.cmp[id]; const a = docById(c.ref), b = docById(c.tgt); if (a && b) compareKeep(a, b); else delete S.cmp[id]; }
    for (const d of S.docs) dutyGapsOf(d);
    dutySync();
    for (const d of S.docs) recheckOf(d);
  }
  function cmpOf(a, b) {
    if (!a || !b || a === b) return null;
    const id = a.id + '>' + b.id;
    if (!S.cmp[id]) { S.cmp[id] = DP.align.compare(a, b, S.settings); recheckOf(b); }
    return S.cmp[id];
  }
  const ensureCmp = () => cmpOf(docById(S.ref), docById(S.tgt));
  function suggestPair() {
    if (!(docById(S.ref) && docById(S.tgt) && S.ref !== S.tgt)) {
      if (S.docs.length < 2) { S.ref = S.docs[0] ? S.docs[0].id : null; S.tgt = null; S.tgt2 = null; return; }
      const ref = S.docs.find(d => d.lang === 'de') || S.docs[0];
      const tgt = S.docs.find(d => d !== ref && d.lang !== ref.lang) || S.docs.find(d => d !== ref);
      S.ref = ref.id; S.tgt = tgt.id;
    }
    // Dritte Fassung für «Alle drei»: möglichst eine weitere Sprache
    if (docById(S.tgt2) && S.tgt2 !== S.ref && S.tgt2 !== S.tgt) return;
    const a = docById(S.ref), b = docById(S.tgt), rest = S.docs.filter(d => d !== a && d !== b);
    const c = rest.find(d => d.lang !== a.lang && d.lang !== b.lang) || rest[0];
    S.tgt2 = c ? c.id : null;
  }

  let pdfLoading = null, pdfLibLoading = null;
  /** Offline-Ausgabe: pdf.js ist eingebettet; die Hilfsdatei (Worker) startet aus dem eingebetteten Text über eine blob:-Adresse. */
  function offlineWorker() {
    const W = pdfjsLib.GlobalWorkerOptions;
    if (!DP.offline || W.workerPort) return;
    const src = $('pdfWorkerSrc');
    if (src) W.workerPort = new Worker(URL.createObjectURL(new Blob([src.textContent], { type: 'text/javascript' })));
  }
  function loadPdfJs() {
    if (globalThis.pdfjsLib) { offlineWorker(); return Promise.resolve(); }
    if (!pdfLoading) pdfLoading = new Promise((ok, fail) => {
      const libs = globalThis.DP_LIBS || {};
      const s = document.createElement('script'); s.src = libs.pdf;
      if (libs.pdfSri) { s.integrity = libs.pdfSri; s.crossOrigin = 'anonymous'; s.referrerPolicy = 'no-referrer'; }
      // Artefakt- und Testausgabe: Die Hilfsdatei (Worker) kommt ebenfalls als Skript-Element mit Integritätsprüfung. pdf.js findet dann
      // globalThis.pdfjsWorker und liest PDF-Dateien im Hauptthread (kein nachgeladener Code ohne Prüfung).
      s.onload = () => {
        const w = document.createElement('script'); w.src = libs.worker;
        if (libs.workerSri) { w.integrity = libs.workerSri; w.crossOrigin = 'anonymous'; w.referrerPolicy = 'no-referrer'; }
        w.onload = () => ok();
        w.onerror = () => { pdfLoading = null; fail(new Error('pdfjs')); };
        document.head.append(w);
      };
      s.onerror = () => { pdfLoading = null; fail(new Error('pdfjs')); };
      document.head.append(s);
    });
    return pdfLoading;
  }
  /** pdf-lib (Anmerkungen in PDF-Kopien) erst laden, wenn jemand eine PDF-Datei mit Kommentaren exportiert. */
  function loadPdfLib() {
    if (globalThis.PDFLib) return Promise.resolve();
    if (!pdfLibLoading) pdfLibLoading = new Promise((ok, fail) => {
      const libs = globalThis.DP_LIBS || {};
      if (!libs.pdflib) { pdfLibLoading = null; fail(new Error('pdflib')); return; }
      const s = document.createElement('script'); s.src = libs.pdflib;
      if (libs.pdflibSri) { s.integrity = libs.pdflibSri; s.crossOrigin = 'anonymous'; s.referrerPolicy = 'no-referrer'; }
      s.onload = () => ok();
      s.onerror = () => { pdfLibLoading = null; fail(new Error('pdflib')); };
      document.head.append(s);
    });
    return pdfLibLoading;
  }

  const nextPaint = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
  const isJsonFile = (f) => /\.json$/i.test(f.name) || f.type === 'application/json';
  /** Dateien einlesen. Profildateien (.json oder Inhalt eines Lectora-Profils) gehen an loadProfileFile, Dokumente in die Prüfung.
      opts.versionOf: Kennung des Dokuments, das die Datei als neue Fassung ersetzt; ohne diese Angabe fragt das Tool nach, wenn eine
      Datei gleich heisst wie ein schon geladenes Dokument oder dessen Text weitgehend gleicht (gleiche Sprache). opts.focus: Fokusziel. */
  let adding = false;
  async function addFiles(files, demo, opts) {
    files = Array.from(files); opts = opts || {};
    // Während der Rückfrage zu einer neuen Fassung ist S.busy leer: ein zweites Ablegen wartet nicht, es wird übergangen
    if (!files.length || S.busy || adding) return;
    adding = true;
    try { await readFiles(files, demo, opts); } finally { adding = false; }
  }
  async function readFiles(files, demo, opts) {
    const before = S.docs.slice(), profs = files.filter(isJsonFile);
    let ok = 0, ver = null;
    for (const file of files.filter(f => !isJsonFile(f))) {
      S.busy = t('docs.reading', { name: file.name }); render();
      try {
        if (file.size > MAX_BYTES) { snack(t('docs.err.big', { name: file.name })); continue; }
        if (/\.pdf$/i.test(file.name) || file.type === 'application/pdf') await loadPdfJs();
        // Erst die Fortschrittsanzeige zeichnen lassen: das Lesen kann den Hauptthread eine Weile beanspruchen
        await nextPaint();
        const doc = await DP.parse.parseFile(file);
        doc.demo = !!demo;
        // Auf GitHub Pages: VERTRAULICH und GEHEIM (und Entsprechungen) nie prüfen, INTERN erst nach ausdrücklicher Bestätigung.
        // Vor der Fassungsrückfrage, damit auch «Neue Fassung laden» geschützt ist; ein verworfenes Dokument bleibt nirgends liegen.
        const cl = WEB && !demo ? doc.meta.classification : null;
        if (cl && cl.level >= 2) { S.busy = null; render(); await webClassifBlocked(doc.name, cl.label, opts.focus || 'pick'); continue; }
        if (cl && cl.level >= 1) { S.busy = null; render(); if (!await askWebIntern(doc.name, cl.label, opts.focus || 'pick')) continue; }
        let target = opts.versionOf ? docById(opts.versionOf) : null;
        if (!target && !demo) {
          const m = versionCandidate(doc, before);
          if (m) { S.busy = null; render(); if (await askVersion(doc, m) === 'version') target = m.doc; }
        }
        if (target) { const r = replaceVersion(target, doc); if (r) ver = r; continue; }
        S.docs.push(doc); runRules(doc); ok++;
        if (!S.cur) S.cur = doc.id;
      } catch (e) {
        // Ohne Endung .json, aber mit dem Inhalt eines Profils: als Profil behandeln statt als nicht unterstütztes Dokument
        if (e && e.message === 'unsupported' && file.size <= DP.profile.MAX_BYTES && DP.profile.looksLikeProfile(await file.text().catch(() => ''))) { profs.push(file); continue; }
        const m = e && e.message;
        snack(t(m === 'unsupported' ? 'docs.err.unsupported' : m === 'xml' ? 'docs.err.xml' : m === 'empty' ? 'docs.err.empty' : m === 'unzip' ? 'docs.err.unzip' : 'docs.err.read', { name: file.name, mb: num(DP.parse.PART_MAX / 1048576) }));
      }
    }
    S.busy = null; suggestPair();
    if (ver) snack(t('ver.done', ver)); else if (ok) snack(tn('docs.added', ok));
    if (opts.focus) S.focus = [opts.focus];
    render();
    if (profs.length) loadProfileFile(profs[0], profs.slice(1));
  }

  /* ---------- Nachprüfung: neue Fassung eines Dokuments ---------- */
  /** Text der Referenzabsätze eines Vergleichsbefunds (Ort des Befunds in der Nachprüfung). */
  function refTextOf(f) {
    const rd = f.refPara && f.refPara.length ? docById(f.refDoc) : null;
    return rd ? clip(f.refPara.map(k => rd.paras[k] ? rd.paras[k].text : '').join(' '), 400) : '';
  }
  const cmpsOf = (doc) => Object.values(S.cmp).filter(c => c.tgt === doc.id);
  const pairsOf = (doc) => new Set(cmpsOf(doc).map(c => c.ref));
  const aiPairsOf = (doc) => new Set(cmpsOf(doc).filter(c => S.cmpAi[c.id] && S.cmpAi[c.id].state === 'done').map(c => c.ref));
  /** Zuordnung gegenüber der vorherigen Fassung (DP.recheck.classify), zwischengespeichert, solange sich die Befundlisten nicht ändern.
      Übernimmt beim ersten Mal je Befund «ignoriert» und den Fehlalarm, wo der Befund geblieben ist; angenommene und abgelehnte
      Vorschläge bleiben offen, weil der Text neu ist. */
  const rcCache = new WeakMap();
  function recheckOf(doc) {
    const v = doc && S.versions[doc.id]; if (!v) return null;
    const all = findingsOf(doc), r = S.res[doc.id];
    const dy = S.duty[doc.id];
    const parts = [v, r && r.rule, r && r.ai, r && r.aiState, dy && dy.findings, dy && dy.state].concat(cmpsOf(doc).flatMap(c => [c, S.cmpAi[c.id] && S.cmpAi[c.id].list, S.cmpAi[c.id] && S.cmpAi[c.id].state, S.dutyCmp[c.id] && S.dutyCmp[c.id].findings, S.btKept[c.id] && S.btKept[c.id].length]), S.settings.off.size);
    const c = rcCache.get(doc);
    if (c && c.n === all.length && c.parts.length === parts.length && c.parts.every((x, k) => x === parts[k])) return c.res;
    const res = DP.recheck.classify({ findings: v.findings, paraMap: v.paraMap, checked: new Set(v.checked), pairs: new Set(v.pairs), aiPairs: new Set(v.aiPairs), paras: v.paras },
      { findings: all, checked: checkedOf(doc), pairs: pairsOf(doc), aiPairs: aiPairsOf(doc), paras: doc.paras, refText: refTextOf });
    for (const f of all) {
      if (f.rcSeen) continue; f.rcSeen = true;
      const o = res.stay.get(f.id); if (!o) continue;
      if (o.fa) Object.assign(f, { fa: true, faNote: o.faNote, faParams: o.faParams, dismissed: true, accepted: false });
      else if (o.st === 'ignored' && !f.fix) f.dismissed = true;
    }
    rcCache.set(doc, { parts, n: all.length, res });
    return res;
  }
  /** Geladenes Dokument derselben Sprache, das die neue Datei ersetzen könnte: gleicher Name, sonst sehr ähnlicher Text (Dice ab 0.7; Fassungen derselben Weisung liegen in den Testdateien bei 0.75 bis 1, verschiedene Dokumente höchstens bei 0.42). */
  function versionCandidate(doc, pool) {
    const same = (d) => S.docs.includes(d) && (d.lang === doc.langAuto || d.langAuto === doc.langAuto);
    const byName = pool.find(d => same(d) && d.name === doc.name);
    if (byName) return { doc: byName, why: 'same' };
    let best = null, bs = 0;
    for (const d of pool) if (same(d)) { const x = DP.recheck.similarity(d, doc); if (x > bs) { bs = x; best = d; } }
    return bs >= 0.7 ? { doc: best, why: 'sim' } : null;
  }
  /** Rückfrage: neue Fassung oder eigenes Dokument? Escape und Schliessen gelten als «eigenes Dokument» (nichts geht verloren). */
  function askVersion(doc, m) {
    return new Promise((done) => {
      let ans = 'separate';
      dialog((d, close) => {
        d.setAttribute('aria-labelledby', 'dlgTitle');
        app(d, h('div', { class: 'dlg-body' }, h('h2', { id: 'dlgTitle' }, t('ver.dlg.t', { name: m.doc.name })),
          h('p', null, t('ver.dlg.' + m.why, { file: doc.name, name: m.doc.name, lang: cap(t('lang.' + m.doc.lang)) })), h('p', null, t('ver.dlg.q'))),
          h('div', { class: 'dlg-actions' },
            h('button', { type: 'button', class: 'btn text', 'data-fid': 'ver-separate', 'data-autofocus': true, onclick: () => { ans = 'separate'; close(); } }, t('ver.dlg.separate')),
            h('button', { type: 'button', class: 'btn', 'data-fid': 'ver-version', onclick: () => { ans = 'version'; close(); } }, icon('file_diff', 'sm'), t('ver.dlg.version'))));
        d.addEventListener('close', () => done(ans), { once: true });
      });
    });
  }
  /** Auf GitHub Pages (WEB): Dokument mit Vermerk VERTRAULICH oder GEHEIM. Erklärung statt Prüfung; das Dokument wird nicht geladen.
      Erhält nur Dateiname und Vermerk (keinen Verweis auf das Dokumentobjekt). Löst auf, sobald der Dialog schliesst. */
  function webClassifBlocked(name, label, back) {
    return new Promise((done) => {
      dialog((d, close) => {
        d.setAttribute('aria-labelledby', 'dlgTitle');
        app(d, h('div', { class: 'dlg-body', 'data-fid': 'web-classif-blocked' }, h('h2', { id: 'dlgTitle' }, t('web.block.t')),
          h('div', { class: 'notice err' }, icon('gpp_maybe'), h('span', null, t('web.block.p', { name, label }))),
          h('p', null, t('web.block.p2')), h('p', { class: 'help' }, t('web.heur'))),
          h('div', { class: 'dlg-actions' },
            h('a', { class: 'btn text', href: RELEASE_URL, target: '_blank', rel: 'noopener noreferrer', 'data-fid': 'webblock-dl' }, icon('download', 'sm'), t('web.save')),
            h('button', { type: 'button', class: 'btn', 'data-fid': 'webblock-close', 'data-autofocus': true, onclick: close }, t('btn.close'))));
        d.addEventListener('close', () => done(), { once: true });
      }, back);
    });
  }
  /** Auf GitHub Pages (WEB): Dokument mit Vermerk INTERN (und Entsprechungen). Prüfen erst nach angehakter Bestätigung; Abbrechen,
      Escape und Schliessen gelten als «nicht prüfen». Erhält nur Dateiname und Vermerk, damit ein verworfenes Dokument nicht im DOM hängt. */
  function askWebIntern(name, label, back) {
    return new Promise((done) => {
      let ans = false;
      dialog((d, close) => {
        d.setAttribute('aria-labelledby', 'dlgTitle');
        const okBtn = btn(t('web.intern.ok'), { icon: 'fact_check', fid: 'webintern-ok', disabled: true, onclick: () => { ans = true; close(); } });
        app(d, h('div', { class: 'dlg-body', 'data-fid': 'web-intern-dlg' }, h('h2', { id: 'dlgTitle' }, t('web.intern.t', { label })),
          h('p', null, t('web.intern.p', { name })),
          h('div', { class: 'notice' }, icon('gpp_maybe'), h('span', null, t('web.intern.classif', { label }))),
          h('p', null, h('a', { class: 'linkish', href: RELEASE_URL, target: '_blank', rel: 'noopener noreferrer', 'data-fid': 'webintern-dl' }, t('web.intern.dl'))),
          h('label', { class: 'check', for: 'webInternAck' }, h('input', { type: 'checkbox', id: 'webInternAck', 'data-fid': 'webInternAck', onchange: (e) => { okBtn.disabled = !e.target.checked; } }), h('span', null, t('web.intern.check'))),
          h('p', { class: 'help' }, t('web.heur'))),
          h('div', { class: 'dlg-actions' },
            h('button', { type: 'button', class: 'btn text', 'data-fid': 'webintern-cancel', 'data-autofocus': true, onclick: () => { ans = false; close(); } }, t('btn.cancel')), okBtn));
        d.addEventListener('close', () => done(ans), { once: true });
      }, back);
    });
  }
  /** «Neue Fassung laden»: Dateiauswahl für genau dieses Dokument. */
  let verFor = null;
  function pickVersion(doc, focus) { verFor = { id: doc.id, focus }; $('verFile').click(); }
  /** Ersetzt old durch die neue Fassung nu. Behalten wird nur, was die Nachprüfung braucht: Absatztexte und Befunde mit Entscheiden
      der alten Fassung, im Arbeitsspeicher; die Dateidaten der alten Fassung gibt das Tool frei. Liefert die Angaben der Meldung. */
  function replaceVersion(old, nu) {
    if (nu.langAuto !== old.lang && nu.langAuto !== old.langAuto) { snack(t('ver.err.lang', { file: nu.name, name: old.name, lang: cap(t('lang.' + old.lang)) })); return null; }
    recheckOf(old);
    const prev = S.versions[old.id];
    const snap = { name: old.name, format: old.format, lang: old.lang, n: (prev ? prev.n : 1) + 1,
      paras: old.paras.map(p => ({ i: p.i, text: p.text, kind: p.kind, level: p.level, loc: Object.assign({}, p.loc) })),
      findings: findingsOf(old).map(f => DP.recheck.slim(f, stOf(f), refTextOf(f))),
      checked: Array.from(checkedOf(old)), pairs: Array.from(pairsOf(old)), aiPairs: Array.from(aiPairsOf(old)),
      paraMap: DP.recheck.mapParas(old.paras, nu.paras) };
    const r = S.res[old.id]; if (r && r.ctl) r.ctl.abort();
    // Pflichtenmatrix der alten Fassung verwerfen (die Ansicht sagt es); Rückübersetzung und Abgleich mit dieser Fassung ebenso
    const dy = S.duty[old.id]; if (dy) { if (dy.ctl) dy.ctl.abort(); delete S.duty[old.id]; S.dutyStale[old.id] = true; }
    dropAiOf(old.id);
    const pairs = [];
    for (const cid in S.cmp) {
      const c = S.cmp[cid]; if (c.ref !== old.id && c.tgt !== old.id) continue;
      pairs.push([c.ref, c.tgt]); if (S.cmpAi[cid] && S.cmpAi[cid].ctl) S.cmpAi[cid].ctl.abort(); delete S.cmpAi[cid];
      // Vergleiche mit der alten Fassung als Zielfassung beginnen neu; als Referenz behalten sie die Entscheide der anderen Fassung
      if (c.tgt === old.id) delete S.cmp[cid];
    }
    old.buffer = null; old.geo = null;
    const types = nu.format === 'pptx' ? ['praesentation', 'bericht'] : ['weisung', 'konzept', 'aktennotiz', 'bericht'];
    Object.assign(nu, { id: old.id, lang: old.lang, type: types.includes(old.type) ? old.type : nu.typeAuto, demo: old.demo });
    S.docs[S.docs.indexOf(old)] = nu;
    delete S.res[old.id];
    runRules(nu);
    for (const [a, b] of pairs) { const A = docById(a), B = docById(b); if (A && B) compareKeep(A, B); }
    S.versions[old.id] = snap;
    for (const d of S.docs) recheckOf(d);
    const rc = recheckOf(nu);
    S.cur = nu.id;
    const n1 = rc.resolved.length, n2 = rc.stay.size, n3 = rc.fresh.size;
    return { file: nu.name, name: old.name, a: num(n1) + ' ' + tn('rc.done', n1), b: num(n2) + ' ' + tn('rc.stay', n2), c: num(n3) + ' ' + tn('rc.new', n3) };
  }
  function loadDemo() {
    const files = Object.entries(globalThis.DP_DEMO || {}).map(([name, b64]) => { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new File([u], name); });
    addFiles(files, true);
  }
  function removeDoc(doc) {
    const at = S.docs.indexOf(doc);
    S.docs = S.docs.filter(d => d !== doc); delete S.res[doc.id]; delete S.versions[doc.id];
    for (const id in S.cmp) if (S.cmp[id].ref === doc.id || S.cmp[id].tgt === doc.id) { delete S.cmp[id]; delete S.cmpAi[id]; }
    if (S.duty[doc.id] && S.duty[doc.id].ctl) S.duty[doc.id].ctl.abort();
    delete S.duty[doc.id]; delete S.dutyStale[doc.id]; dropAiOf(doc.id);
    doc.buffer = null; doc.geo = null;
    if (S.cur === doc.id) S.cur = S.docs[0] ? S.docs[0].id : null;
    if (S.ref === doc.id) S.ref = null; if (S.tgt === doc.id) S.tgt = null; if (S.tgt2 === doc.id) S.tgt2 = null;
    // Fokus auf das nächste Dokument (sonst das vorherige), ohne Dokumente auf «Dateien auswählen»
    const k = Math.min(at, S.docs.length - 1);
    S.focus = k >= 0 ? ['rm-' + S.docs[k].id, 'pick', '#view'] : ['pick', 'demo', '#view'];
    suggestPair(); snack(t('docs.removed', { name: doc.name })); render();
  }
  /** Alles verwerfen ohne Rückmeldung (beim Verlassen der Seite). */
  function dropAll() {
    for (const d of S.docs) { d.buffer = null; d.geo = null; }
    rwClear(); undoStack.length = 0; revokeBlobs();
    Object.assign(S, { docs: [], res: {}, cmp: {}, cmpAi: {}, versions: {}, cur: null, ref: null, tgt: null, tgt2: null, route: 'docs', enter: true, focus: null, reveal: null }, DEFAULTS(), AIX());
    clearSnack(); $('dlg').replaceChildren(); $('view').replaceChildren();
  }
  function clearSession() {
    for (const d of S.docs) { d.buffer = null; d.geo = null; }
    for (const id in S.res) if (S.res[id].ctl) S.res[id].ctl.abort();
    for (const id in S.cmpAi) if (S.cmpAi[id].ctl) S.cmpAi[id].ctl.abort();
    for (const id in S.duty) if (S.duty[id].ctl) S.duty[id].ctl.abort();
    if (S.bt && S.bt.ctl) S.bt.ctl.abort();
    rwClear();
    // Rückgängig-Stapel und noch gültige Download-Adressen (blob:) gehören zur Sitzung
    undoStack.length = 0;
    revokeBlobs();
    // Alles auf den Ausgangszustand: Dokumente, Ergebnisse, Einstellungen, Filter, Prüfparameter, eigene Kriterien, Ansichten, KI-Ergebnisse
    Object.assign(S, { docs: [], res: {}, cmp: {}, cmpAi: {}, versions: {}, cur: null, ref: null, tgt: null, tgt2: null, route: 'docs', enter: true, focus: null, reveal: null }, DEFAULTS(), AIX());
    clearSnack(); $('dlg').replaceChildren();
    render();
    // Die Schaltfläche zum Leeren ist danach gesperrt: der Fokus geht auf den Inhaltsbereich
    $('view').focus({ preventScroll: true });
    snack(t('ses.clear.done'));
  }

  /* ---------- Prüfprofil: Einstellungen als Datei auf der eigenen Festplatte ---------- */
  const PF = DP.profile;
  const profDefaultName = () => t('prof.name.def', { date: DP.i18n.date(new Date()) });
  const stdName = (p) => { const e = p && p.std && STD.find(x => x.id === p.std); return e ? e.names[S.lang] || e.names.de : p ? p.name : ''; };
  const profName = () => (S.profName != null ? S.profName : stdName(S.profile)).trim() || profDefaultName();
  /** Zustand für die Anzeige: aktives Profil (Name), geändert seit dem Laden bzw. Speichern, Abweichung vom Standard. */
  function profState() {
    const cur = PF.sig(S);
    return { p: S.profile, dirty: !!S.profile && cur !== S.profile.sig, std: cur === PF.defaultSig() };
  }
  function profStateNodes() {
    const st = profState();
    if (!st.p) return [h('span', null, t(st.std ? 'prof.none' : 'prof.none.chg'))];
    // Standardprofil: Name in der Sprache der Oberfläche
    const pname = stdName(st.p);
    return [h('span', null, t('prof.active'), ' ', h('b', { class: 'prof-name' }, pname)), ' ',
      st.dirty ? h('span', { class: 'tag par-tag', 'data-fid': 'prof-dirty' }, t('prof.changed')) : null,
      h('span', { class: 'help' }, t(st.dirty ? 'prof.state.dirty.' + st.p.how : 'prof.state.' + st.p.how))];
  }
  function profStateRefresh() { const el = $('profState'); if (el) el.replaceChildren(...profStateNodes()); }
  /**
   * Einziger Weg, eine Datei zu speichern (Word, Bericht, PDF und PowerPoint mit Kommentaren, Prüfprofil, Rückmeldung).
   * In Claude über die Downloads von Claude. In der Offline-Ausgabe (DP.offline) über eine blob:-Adresse und einen vorübergehenden
   * Link mit download-Attribut: die einzige Stelle mit einem solchen Link, und nur dort erreichbar. Sonst: Downloads fehlen.
   * Liefert 'saved', 'declined', 'failed' oder 'na' (keine Downloads).
   */
  /** blob:-Adressen der letzten Downloads: «Sitzung leeren» gibt sie sofort frei. */
  const BLOBS = new Set();
  function revokeBlobs() { for (const u of BLOBS) URL.revokeObjectURL(u); BLOBS.clear(); }
  async function saveFile(blob, filename) {
    if (DP.offline) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = filename; a.hidden = true;
      document.body.append(a); a.click(); a.remove();
      BLOBS.add(url); setTimeout(() => { URL.revokeObjectURL(url); BLOBS.delete(url); }, 60000);
      snack(t('exp.saved', { name: filename })); return 'saved';
    }
    const dl = await DP.ai.getDownloads();
    if (!dl) return 'na';
    try { await dl.save({ filename, data: blob }); snack(t('exp.saved', { name: filename })); return 'saved'; }
    catch (e) { const d = e && e.code === 'declined'; snack(t(d ? 'exp.declined' : 'exp.fail')); return d ? 'declined' : 'failed'; }
  }
  /** JSON-Datei speichern; ohne Downloads zeigt ein Dialog den Inhalt zum Kopieren (kein Download-Link). */
  async function saveJson(obj, filename, focus) {
    const text = JSON.stringify(obj, null, 2) + '\n';
    const r = await saveFile(new Blob([text], { type: 'application/json' }), filename);
    if (r === 'na') { copyDialog(text, filename, focus); return true; }
    return r === 'saved';
  }
  function copyDialog(text, filename, focus) {
    dialog((d, close) => {
      d.setAttribute('aria-labelledby', 'dlgTitle');
      const ta = h('textarea', { id: 'copyText', class: 'copy-text', readonly: true, rows: 10, spellcheck: 'false', 'aria-label': filename }, text);
      const copy = () => navigator.clipboard.writeText(text).then(() => snack(t('prof.copy.done')), () => { ta.focus(); ta.select(); snack(t('prof.copy.fail')); });
      app(d, h('div', { class: 'dlg-body' }, h('h2', { id: 'dlgTitle' }, t('prof.copy.t')), h('p', null, t('prof.copy.d', { name: filename })), ta),
        h('div', { class: 'dlg-actions' }, h('button', { type: 'button', class: 'btn text', 'data-fid': 'copy-close', onclick: () => { close(); if (focus) applyFocus([focus], false); } }, t('btn.close')),
          h('button', { type: 'button', class: 'btn', 'data-fid': 'copy-go', 'data-autofocus': true, onclick: copy }, icon('content_copy', 'sm'), t('prof.copy.btn'))));
    });
  }
  async function saveProfile() {
    const name = profName(), obj = PF.build(S, name);
    if (await saveJson(obj, PF.fileName(name), 'prof-save')) { S.profile = { name, sig: PF.sig(S), how: 'saved' }; S.profName = null; S.focus = ['prof-save']; render(); }
  }
  /** Profildatei lesen, prüfen und nach Rückfrage übernehmen. rest: weitere gleichzeitig abgelegte Profile (übergangen). */
  async function loadProfileFile(file, rest) {
    if (rest && rest.length) snack(t('prof.many', { list: rest.map(f => f.name).join(', ') }));
    let text;
    if (file.size > PF.MAX_BYTES) { snack(t('prof.err.size', { name: file.name })); return; }
    try { text = await file.text(); } catch (e) { snack(t('prof.err.read', { name: file.name })); return; }
    const r = PF.parse(text);
    if (!r.ok) { snack(t('prof.err.' + r.err, { name: file.name })); return; }
    confirmProfile(r, file.name);
  }
  function confirmProfile(r, fileName, back) {
    back = back || 'prof-load';
    const P = r.profile, s = P.settings, rep = r.report, F = (k) => t('prof.field.' + k);
    const nTerms = R.parseTerms(s.terms).length, nActs = DP.erlasse ? DP.erlasse.parseCustom(s.acts).valid : 0;
    const li = (txt, ic) => h('li', null, icon(ic || 'check', 'sm'), h('span', null, txt));
    const what = [
      li(tn('prof.dlg.off', s.off.length)), li(tn('prof.dlg.par', Object.keys(s.params).length)), li(tn('prof.dlg.terms', nTerms)), li(tn('prof.dlg.acts', nActs)),
      li(t(s.custom.trim() ? 'prof.dlg.custom.yes' : 'prof.dlg.custom.no')), li(t('prof.dlg.author', { v: s.author.trim() || 'Lectora' })), li(t(s.comments ? 'prof.dlg.comments.on' : 'prof.dlg.comments.off'))];
    const ign = [];
    if (rep.unknownCrit.length) ign.push(li(tn('prof.dlg.ign.crit', rep.unknownCrit.length, { list: rep.unknownCrit.slice(0, 6).join(', ') }), 'info'));
    if (rep.unknownParam.length) ign.push(li(tn('prof.dlg.ign.par', rep.unknownParam.length, { list: rep.unknownParam.slice(0, 4).join(', ') }), 'info'));
    if (rep.clamped.length) ign.push(li(tn('prof.dlg.clamped', rep.clamped.length, { list: rep.clamped.map(k => k.split('.')[0] + ' ' + t('par.' + k)).join('; ') }), 'info'));
    if (rep.cut.length) ign.push(li(t('prof.dlg.cut', { list: rep.cut.map(F).join(', ') }), 'info'));
    if (rep.badField.length) ign.push(li(t('prof.dlg.bad', { list: rep.badField.map(F).join(', ') }), 'info'));
    const name = P.name || fileName.replace(/\.json$/i, '');
    dialog((d, close) => {
      d.setAttribute('aria-labelledby', 'dlgTitle');
      const meta = [[t('prof.dlg.name'), name], [t('prof.dlg.created'), P.created ? DP.i18n.date(new Date(P.created)) : '–'], [t('prof.dlg.ver'), P.lectora || '–']];
      app(d, h('div', { class: 'dlg-body prof-dlg' }, h('h2', { id: 'dlgTitle' }, t('prof.dlg.t')),
        h('dl', { class: 'prof-meta' }, meta.map(([k, v]) => [h('dt', null, k), h('dd', null, v)])),
        h('h3', null, t('prof.dlg.what')), h('ul', { class: 'prof-list' }, what),
        ign.length ? [h('h3', null, t('prof.dlg.ign')), h('ul', { class: 'prof-list ign' }, ign)] : null,
        rep.newer ? h('p', { class: 'help' }, t('prof.dlg.newer')) : null,
        h('p', null, t('prof.dlg.p'))),
        h('div', { class: 'dlg-actions' }, h('button', { type: 'button', class: 'btn text', 'data-fid': 'prof-cancel', 'data-autofocus': true, onclick: () => { close(); applyFocus([back], false); } }, t('btn.cancel')),
          h('button', { type: 'button', class: 'btn', 'data-fid': 'prof-apply', onclick: () => { close(); applyProfile(P, name, back); } }, t('prof.dlg.ok'))));
    }, [back, 'prof-load']);
  }
  function applyProfile(P, name, back) {
    PF.apply(S, P.settings);
    rerunAll();
    S.profile = { name, sig: PF.sig(S), how: 'loaded', std: P.std || null }; S.profName = null;
    S.focus = [S.route === 'criteria' ? (back || 'prof-load') : '#view'];
    render();
    snack(t('prof.applied', { name }));
  }
  /** Standardprofile der Sektion: beim Build aus profile/*.json eingebettet (window.DP_PROFILES), gelesen wie eine Profildatei. */
  const STD = Array.isArray(globalThis.DP_PROFILES) ? globalThis.DP_PROFILES : [];
  function loadStdProfile() {
    const sel = $('profStd'), e = sel && STD.find(x => x.id === sel.value); if (!e) return;
    S.profStd = e.id;
    const r = PF.parse(e.text);
    if (!r.ok) { snack(t('prof.err.' + r.err, { name: e.id })); return; }
    const name = e.names[S.lang] || e.names.de;
    r.profile.name = name; r.profile.std = e.id;
    confirmProfile(r, name, 'prof-std');
  }
  function profileBand() {
    const nameIn = h('input', { type: 'text', id: 'profName', 'data-fid': 'profName', maxlength: PF.LIMITS.name, autocomplete: 'off', value: profName(),
      oninput: (e) => { S.profName = e.target.value; updateClear(); } });
    return h('section', { class: 'card tight prof-band', id: 'profBand', 'aria-labelledby': 'profT' },
      h('div', { class: 'prof-main' },
        h('h2', { id: 'profT' }, icon('file_json', 'sm'), t('prof.h')),
        h('p', { class: 'prof-state', id: 'profState', 'aria-live': 'polite' }, profStateNodes()),
        h('p', { class: 'help' }, t('prof.d'))),
      h('div', { class: 'prof-acts' },
        h('div', { class: 'field' }, h('label', { for: 'profName' }, t('prof.name')), nameIn),
        h('div', { class: 'prof-btns' },
          btn(t('prof.save'), { kind: 'outlined', icon: 'save', fid: 'prof-save', tip: t('tip.profSave'), onclick: saveProfile }),
          btn(t('prof.load'), { kind: 'text', icon: 'folder_open', fid: 'prof-load', tip: t('tip.profLoad'), onclick: () => $('profFile').click() })),
        STD.length ? h('div', { class: 'prof-std' },
          h('div', { class: 'field' }, h('label', { for: 'profStd' }, t('prof.std.l')),
            h('select', { id: 'profStd', 'data-fid': 'profStd', onchange: (e) => { S.profStd = e.target.value; } },
              STD.map(x => h('option', { value: x.id, selected: (S.profStd || STD[0].id) === x.id }, x.names[S.lang] || x.names.de)))),
          btn(t('prof.std.btn'), { kind: 'text', icon: 'file_json', fid: 'prof-std', tip: t('tip.profStd'), onclick: loadStdProfile })) : null));
  }

  /* ---------- KI ---------- */
  /** Zustimmung vor dem Senden. o: intro (was geschieht), items (was genau gesendet wird), quotes ([{label, text, lang}]: der Wortlaut,
      der gesendet wird), classif (Klassifizierungsvermerk: zusätzliche Bestätigung), remember (Beschriftung: «in dieser Sitzung nicht
      mehr fragen», nur ohne Vermerk), title, ok (Beschriftung), back (Fokusziel beim Abbrechen). onOk(remember). */
  function aiAsk(o, onOk) {
    // VERTRAULICH, GEHEIM (und die Entsprechungen): nie an Claude; ruhige Erklärung, keine Möglichkeit, trotzdem zu senden
    if (o.classif && o.classif.level >= 2) return aiBlocked(o.classif, o.back);
    dialog((d, close) => {
      let okBtn; const need = !!(o.classif && o.classif.level >= 1);
      const body = h('div', { class: 'dlg-body ai-dlg' }, h('h2', { id: 'dlgTitle' }, o.title || t('ai.dlg.t')), h('p', null, o.intro));
      if (o.items && o.items.length) app(body, h('h3', { class: 'ai-send-h' }, t('ai.dlg.what')), h('ul', { class: 'ai-send', 'data-fid': 'ai-send' }, o.items.map(x => h('li', null, icon('check', 'sm'), h('span', null, x)))));
      for (const q of o.quotes || []) app(body, h('figure', { class: 'ai-quote' }, h('figcaption', null, q.label), h('blockquote', { class: 'quote', lang: q.lang, tabindex: '0', 'data-fid': q.fid || null }, q.text)));
      app(body, h('p', null, t('ai.dlg.p2')));
      if (need) {
        app(body, h('div', { class: 'notice err' }, icon('gpp_maybe'), h('span', null, t('ai.dlg.classif', { label: o.classif.label }))));
        app(body, h('label', { class: 'check', for: 'aiAck' }, h('input', { type: 'checkbox', id: 'aiAck', 'data-fid': 'aiAck', onchange: (e) => { okBtn.disabled = !e.target.checked; } }), h('span', null, t('ai.dlg.check'))));
      } else if (o.remember) app(body, h('label', { class: 'check', for: 'aiRemember' }, h('input', { type: 'checkbox', id: 'aiRemember', 'data-fid': 'aiRemember' }), h('span', null, o.remember)));
      app(body, h('p', { class: 'help' }, t('ai.dlg.heur')));
      okBtn = btn(o.ok || t('ai.dlg.ok'), { icon: 'auto_awesome', disabled: need, fid: 'aiask-ok', onclick: () => { const rem = !need && !!o.remember && !!($('aiRemember') && $('aiRemember').checked); close(); onOk(rem); } });
      d.setAttribute('aria-labelledby', 'dlgTitle');
      app(d, body, h('div', { class: 'dlg-actions' }, h('button', { type: 'button', class: 'btn text', 'data-fid': 'aiask-cancel', onclick: () => { close(); if (o.back) applyFocus([o.back], false); }, 'data-autofocus': true }, t('btn.cancel')), okBtn));
    });
  }
  /** Dokument mit Vermerk VERTRAULICH oder GEHEIM: Erklärung statt Zustimmung; nichts wird gesendet. */
  function aiBlocked(cl, back) {
    dialog((d, close) => {
      d.setAttribute('aria-labelledby', 'dlgTitle');
      app(d, h('div', { class: 'dlg-body ai-dlg', 'data-fid': 'ai-blocked' }, h('h2', { id: 'dlgTitle' }, t('ai.block.t')),
        h('div', { class: 'notice' }, icon('gpp_maybe'), h('span', null, t('ai.block.p', { label: cl.label }))), h('p', null, t('ai.block.p2')), h('p', { class: 'help' }, t('ai.dlg.heur'))),
        h('div', { class: 'dlg-actions' }, h('button', { type: 'button', class: 'btn', 'data-fid': 'aiblock-close', 'data-autofocus': true, onclick: () => { close(); if (back) applyFocus([back], false); } }, t('btn.close'))));
    });
  }
  /** Was die KI-Prüfung sendet: Liste für die Zustimmung (Teile, eigene Kriterien, Obergrenze). */
  function aiDocItems(doc) {
    const P = DP.ai.docPlan(doc), custom = DP.ai.customLines(S.settings), items = [t('ai.dlg.doc.i1', { name: doc.name, lang: t('lang.' + doc.lang) }), t('ai.dlg.doc.i2', { type: t('type.' + doc.type) })];
    if (P.outline) items.push(t('duty.dlg.i2'));
    items.push(custom.length ? tn('ai.dlg.custom', custom.length) : t('ai.dlg.custom.none'));
    if (P.cut) items.push(t('ai.dlg.limit', { n: num(P.sent), m: num(P.total) }));
    items.push(t('ai.dlg.doc.i3'));
    return { items, quotes: custom.length ? [{ label: t('ai.dlg.custom.l'), text: custom.join('\n'), lang: null, fid: 'ai-custom' }] : [] };
  }
  function startAi(doc) {
    if (aiPaused()) { snack(t('ai.paused')); return; }
    const w = aiDocItems(doc);
    aiAsk({ intro: t('ai.dlg.p1', { name: doc.name }), items: w.items, quotes: w.quotes, classif: doc.meta.classification, back: 'aiDoc-go' }, async () => {
      const r = S.res[doc.id];
      r.ctl = new AbortController(); r.aiState = 'running'; r.aiProg = [1, 1]; r.aiErr = null; r.ai = []; r.aiPlan = null; render();
      try {
        const out = await DP.ai.runDoc(doc, S.settings, { signal: r.ctl.signal, onPlan: (P) => { r.aiPlan = { sent: P.sent, total: P.total, cut: P.cut }; }, onProgress: (i, n) => { r.aiProg = [i, n]; render(); }, onPart: (list) => { r.ai = list; } });
        r.ai = out; r.aiState = 'done'; recheckOf(doc); snack(tn('chk.ai.done', out.length));
      } catch (e) {
        const key = DP.ai.errKey(e);
        r.aiState = r.ai.length ? 'partial' : 'idle';
        if (key === 'cancelled') snack(t('ai.cancelled')); else { r.aiErr = key; if (key === 'ai.err.unavailable') S.aiAvail = false; if (key === 'ai.err.rate_limited') pauseAi(); }
      }
      r.ctl = null; render();
    });
  }
  function startCmpAi(cmp) {
    if (aiPaused()) { snack(t('ai.paused')); return; }
    const a = docById(cmp.ref), b = docById(cmp.tgt);
    const cl = classOf(a, b), P = DP.ai.cmpPlan(a, b, cmp);
    const items = [t('ai.dlg.cmp.i1', { a: a.name, b: b.name, n: num(P.sent) }), t('ai.dlg.cmp.i2'), t('ai.dlg.cmp.i3')];
    if (P.cut) items.push(t('ai.dlg.cmp.limit', { n: num(P.sent), m: num(P.total) }));
    items.push(t('ai.dlg.doc.i3'));
    aiAsk({ intro: t('ai.dlg.cmp', { a: a.name, b: b.name }), items, classif: cl, back: 'aiCmp-go' }, async () => {
      const st = S.cmpAi[cmp.id] = { state: 'running', prog: [1, 1], list: [], ctl: new AbortController(), err: null, plan: null }; render();
      try {
        const out = await DP.ai.runCompare(a, b, cmp, S.settings, { signal: st.ctl.signal, onPlan: (Q) => { st.plan = { sent: Q.sent, total: Q.total, cut: Q.cut }; }, onProgress: (i, n) => { st.prog = [i, n]; render(); }, onPart: (list) => { st.list = list; } });
        st.list = out; st.state = 'done'; recheckOf(b); snack(tn('chk.ai.done', out.length));
      } catch (e) {
        const key = DP.ai.errKey(e);
        st.state = st.list.length ? 'partial' : 'idle';
        if (key === 'cancelled') snack(t('ai.cancelled')); else { st.err = key; if (key === 'ai.err.unavailable') S.aiAvail = false; if (key === 'ai.err.rate_limited') pauseAi(); }
      }
      st.ctl = null; render();
    });
  }
  /** Offline-Ausgabe: an jeder Stelle, an der sonst die KI angeboten wird, dieselbe ruhige Erklärung (kein Fehler, keine tote Schaltfläche). */
  function aiOffNote(id, compact) {
    return h('section', { class: 'card tight ai-off' + (compact ? ' compact' : ''), 'aria-labelledby': id, 'data-fid': 'ai-off' },
      h('span', { class: 'ico', 'aria-hidden': 'true' }, icon('cloud_off')),
      h('div', null, h('h2', { id }, t('ai.off.t')), h('p', null, t('ai.off.d'), compact ? ' ' : null,
        h('button', { type: 'button', class: 'linkish' + (compact ? '' : ' ai-off-more'), 'data-fid': id + '-more', onclick: () => go('help', 'ai') }, t('ai.off.more')))));
  }
  /** KI-Karte: Titel, Beschreibung, Start, Fortschritt, Abbruch, Fehler. o.extra: weitere Zeilen, o.second: zweite Aktion,
      o.pause: nach «ausgelastet» für eine Weile gesperrt (neue KI-Funktionen), o.runParams: weitere Platzhalter der Fortschrittszeile. */
  function aiCard(o) {
    if (DP.offline) return aiOffNote(o.id, o.compact);
    const running = o.state === 'running', wait = o.pause && !running ? aiPaused() : 0;
    const card = h('section', { class: 'ai-card' + (running ? ' running' : '') + (o.compact ? ' compact' : ''), 'aria-labelledby': o.id });
    const runText = running ? t(o.runKey, Object.assign({ i: o.prog[0], n: o.prog[1] }, o.runParams)) : null;
    const body = h('div', { class: 'ai-body' }, h('h2', { id: o.id }, h('span', { class: 'ai-ico', 'aria-hidden': 'true' }, icon('auto_awesome', 'sm')), o.title), h('p', null, running ? runText : o.desc));
    if (running) app(body, progress(runText));
    for (const x of o.extra || []) app(body, x);
    if (o.err) app(body, h('p', { role: 'alert', class: 'ai-note' }, t(o.err) + (o.state === 'partial' ? ' ' + t('ai.partial') : '')));
    if (S.aiAvail === false && !running) app(body, h('p', { class: 'ai-note' }, t('chk.ai.na')));
    if (o.allOff && !running) app(body, h('p', { class: 'ai-note' }, t('chk.ai.off')));
    if (wait) app(body, h('p', { class: 'ai-note' }, t('ai.paused')));
    const act = running
      ? btn(t('btn.stop'), { kind: 'outlined', icon: 'stop_circle', fid: o.id + '-stop', onclick: o.stop })
      : btn(o.state === 'done' || o.state === 'partial' ? o.again : o.start, { kind: 'outlined', icon: 'auto_awesome', fid: o.id + '-go', tip: o.tip, disabled: S.aiAvail === false || o.allOff || !!wait, onclick: o.run });
    app(card, body, h('div', { class: 'ai-bar' }, o.compact ? null : h('span', { class: 'ai-by', 'aria-hidden': 'true' }, h('span', { class: 'swatch' }), 'Claude'),
      o.second && !running ? h('div', { class: 'ai-acts' }, o.second, act) : act));
    return card;
  }
  /* ---------- KI-Funktionen: Formulierungsvorschlag, Rückübersetzung, Pflichtenmatrix ----------
     Jede startet nur auf Klick, sagt vorher, was gesendet wird, lässt sich abbrechen und zeigt den Fortschritt. Nach «ausgelastet»
     (rate_limited) nimmt Lectora für PAUSE_MS keine neue Anfrage an (kein automatisches Wiederholen). */
  const PAUSE_MS = 30000;
  const aiPaused = () => Math.max(0, S.aiPause - Date.now());
  let pauseTimer = null;
  function pauseAi() { S.aiPause = Date.now() + PAUSE_MS; clearTimeout(pauseTimer); pauseTimer = setTimeout(() => { if (!aiPaused()) render(); }, PAUSE_MS + 200); }
  /** KI-Funktionen anbieten? Nicht in der Offline-Ausgabe und nicht, wenn die Schnittstelle fehlt. */
  const aiOn = () => !DP.offline && S.aiAvail !== false;
  /** Höchster Klassifizierungsvermerk mehrerer Dokumente. */
  const classOf = (...ds) => ds.filter(Boolean).map(d => d.meta.classification).filter(Boolean).sort((x, y) => y.level - x.level)[0] || null;
  /** Ergebnisse der KI-Funktionen zu einem Dokument verwerfen (Fassung ersetzt, Dokument entfernt). */
  function dropAiOf(docId) {
    if (S.bt && S.bt.id.split('>').includes(docId)) dropBt();
    for (const id of Object.keys(S.dutyCmp)) if (id.split('>').includes(docId)) delete S.dutyCmp[id];
    for (const id of Object.keys(S.btKept)) if (id.split('>').includes(docId)) delete S.btKept[id];
  }
  /** Gründe einer Warnung oder Ablehnung in Worten. */
  function rwWhy(list) {
    const q = (vals) => vals.slice(0, 4).map(v => '«' + v + '»').join(', ');
    const cls = (xs) => xs.length ? xs.map(c => t('mod.' + c)).join(', ') : t('rw.mod.none');
    return list.map(x => x.vals && x.vals.length && /^(?:num|time|date|ref|url|name)$/.test(x.kind) ? t('rw.w.' + x.kind + '.' + x.dir, { v: q(x.vals) })
      : x.kind === 'lang' ? t('rw.w.lang', { v: x.vals ? t('lang.' + x.vals[0]) : '' })
      : x.kind === 'mod' ? t('rw.w.mod', { a: cls(x.from || []), b: cls(x.to || []) })
      : t('rw.w.' + x.kind, { v: x.vals ? q(x.vals) : '' })).join(' ');
  }
  /** Vorschlag aus einer KI-Funktion (KI-Prüfung, Bedeutungsvergleich, Formulierungsvorschlag)? Solche Vorschläge nimmt nur an,
      wer sie einzeln gelesen hat; Sammelentscheide übergehen sie, und jeder Export kennzeichnet sie. */
  const aiFix = (f) => !!(f.fix && (f.fixAi || f.source === 'ai'));

  /* ----- 1. Formulierungsvorschlag je Befund: eine Anfrage nach der anderen, Warteschlange höchstens RW_MAX_Q ----- */
  const RWQ = []; let rwCur = null;
  const RW_MAX_Q = 5;
  function rwClear() { RWQ.length = 0; if (rwCur && rwCur.ctl) rwCur.ctl.abort(); rwCur = null; }
  /** KI-Vorschlag mit Warnung: «Alle annehmen» übergeht ihn. */
  const rwJobOf = (f, doc) => f.dismissed && !f.fix ? null : DP.ai.rewordJob(doc, f, f.refDoc ? docById(f.refDoc) : null, S.settings);
  const rwState = (f) => rwCur && rwCur.f === f ? 'running' : RWQ.some(x => x.f === f) ? 'queued' : null;
  function requestReword(f, doc, pre) {
    if (aiPaused()) { snack(t('ai.paused')); return; }
    const job = rwJobOf(f, doc); if (!job || rwState(f)) return;
    if (RWQ.length + (rwCur ? 1 : 0) >= RW_MAX_Q) { snack(t('rw.full')); return; }
    const rd = f.refDoc ? docById(f.refDoc) : null, cl = classOf(doc, job.ref ? rd : null), back = pre + 'rw-' + f.id;
    const go2 = () => { RWQ.push({ f, doc, job, pre }); f.rwErr = null; S.focus = [pre + 'rwx-' + f.id, back]; refresh(f); rwPump(); };
    if (S.rwOk && !cl) { go2(); return; }
    const quotes = [{ label: t('rw.dlg.passage', { lang: t('lang.' + doc.lang) }), text: job.passage, lang: doc.lang }];
    if (job.ref) quotes.push({ label: t('rw.dlg.ref', { lang: t('lang.' + rd.lang) }), text: job.ref, lang: rd.lang });
    aiAsk({ title: t('rw.dlg.t'), intro: t('rw.dlg.p'), quotes, classif: cl, remember: t('rw.dlg.remember'), ok: t('rw.dlg.ok'), back,
      items: [t(job.ref ? 'rw.dlg.i1.cmp' : 'rw.dlg.i1'), t('rw.dlg.i2', { crit: f.crit + ' ' + t('c.' + f.crit + '.t') }), t('rw.dlg.i3', { lang: t('lang.' + doc.lang), type: t('type.' + doc.type) }), t('rw.dlg.i4')] },
    (rem) => { if (rem) S.rwOk = true; go2(); });
  }
  /** Teilweiser Neuaufbau, wenn möglich (Prüfansicht mit Dokument), sonst ganz. */
  function refresh(f) { if (S.route === 'check' && f && f.para != null && S.view === 'doc') update([f.para]); else render(); }
  function cancelReword(f, pre) {
    S.focus = [pre + 'rw-' + f.id];
    if (rwCur && rwCur.f === f) { rwCur.ctl.abort(); return; }
    const k = RWQ.findIndex(x => x.f === f); if (k >= 0) RWQ.splice(k, 1);
    refresh(f); snack(t('rw.cancelled'));
  }
  function rwDropQueue(key) { for (const x of RWQ) x.f.rwErr = { key }; RWQ.length = 0; }
  async function rwPump() {
    if (rwCur || !RWQ.length) return;
    const it = rwCur = RWQ.shift(); it.ctl = new AbortController();
    refresh(it.f);
    let res = null, err = null;
    try { res = await DP.ai.runReword(it.job, { signal: it.ctl.signal }); } catch (e) { err = e; }
    if (rwCur !== it) return;
    rwCur = null;
    // Gilt der Befund noch (Regeln neu ausgeführt: gleiche Stelle)? Steht derselbe Text noch dort?
    const doc = docById(it.doc.id), all = doc ? findingsOf(doc) : [];
    const f = all.find(x => x === it.f) || all.find(x => sig(x) === sig(it.f));
    const still = f && doc.paras[it.job.para] && doc.paras[it.job.para].text.slice(it.job.start, it.job.end) === it.job.passage;
    const a = document.activeElement, afid = a && a.getAttribute ? a.getAttribute('data-fid') : '';
    if (afid === it.pre + 'rwx-' + it.f.id) S.focus = [it.pre + 'acc-' + it.f.id, it.pre + 'rw-' + it.f.id, it.pre + 'dis-' + it.f.id, 'sel-' + it.f.id];
    if (err) {
      const key = DP.ai.errKey(err);
      if (key === 'cancelled') snack(t('rw.cancelled'));
      else {
        if (f) f.rwErr = { key };
        if (key === 'ai.err.rate_limited') { pauseAi(); rwDropQueue(key); }
        else if (key === 'ai.err.not_granted' || key === 'ai.err.unavailable') { if (key === 'ai.err.unavailable') S.aiAvail = false; rwDropQueue(key); }
        snack(t(key));
      }
    } else if (still) {
      if (res.status === 'ok') {
        Object.assign(f, { fix: { start: it.job.start, end: it.job.end, repl: res.text, words: true }, fixAi: true, fixWarn: res.warn && res.warn.length ? res.warn : null, accepted: false, dismissed: false, fa: false, rwErr: null });
        recheckOf(doc); snack(t(f.fixWarn ? 'rw.done.warn' : 'rw.done'));
      } else if (res.status === 'same') { f.rwErr = { key: 'rw.same' }; snack(t('rw.same')); }
      else { f.rwErr = { key: 'rw.reject', why: res.why }; snack(t('rw.rejected')); }
    }
    refresh(f || it.f); rwPump();
  }
  function removeReword(f, pre) {
    delete f.fix; delete f.fixAi; delete f.fixWarn; f.accepted = false; f.dismissed = false;
    S.focus = [pre + 'rw-' + f.id, pre + 'dis-' + f.id]; refresh(f); snack(t('rw.removed'));
  }
  /** Hinweis an der Karte: in Arbeit, Vorschlag von Claude (bitte prüfen, mit Warnung) oder Grund, weshalb keiner kam. */
  function rwNote(f) {
    const st = rwState(f), ai = h('span', { class: 'tag ai' }, h('span', { class: 'swatch acc-ai', 'aria-hidden': 'true' }), t('rw.tag'));
    if (st) return h('div', { class: 'rw-note' }, ai, h('span', { class: 'help' }, t(st === 'running' ? 'rw.running' : 'rw.queued')), st === 'running' ? progress(t('rw.running')) : null);
    if (f.fix && f.fixAi) return h('div', { class: 'rw-note' }, ai, h('span', { class: 'help' }, t('rw.check')),
      f.fixWarn ? h('p', { class: 'rw-warn', 'data-fid': 'rww-' + f.id }, icon('warning_fill', 'sm'), h('span', null, t('rw.warn') + ' ' + rwWhy(f.fixWarn))) : null);
    if (f.rwErr) return h('p', { class: 'rw-err', 'data-fid': 'rwe-' + f.id }, icon('info', 'sm'), h('span', null, f.rwErr.key === 'rw.reject' ? t('rw.reject') + ' ' + rwWhy(f.rwErr.why) : t(f.rwErr.key)));
    if (f.fixRej) return h('p', { class: 'rw-err', 'data-fid': 'rwj-' + f.id }, icon('info', 'sm'), h('span', null, t('ai.fix.rej') + ' ' + rwWhy(f.fixRej)));
    return null;
  }
  /** Schaltflächen: anfordern, erneut anfordern, entfernen, abbrechen. pre: Präfix der Kennungen ('' Liste, 'm-' Randkarte). */
  function rwActs(f, doc, pre) {
    if (!aiOn()) return [];
    if (!rwJobOf(f, doc)) return [];
    if (rwState(f)) return [btn(t('rw.cancel'), { kind: 'text sm', icon: 'stop_circle', fid: pre + 'rwx-' + f.id, onclick: () => cancelReword(f, pre) })];
    const wait = !!aiPaused();
    if (f.fix && f.fixAi) return stOf(f) !== 'open' ? [] : [
      btn(t('rw.again'), { kind: 'text sm', icon: 'refresh', fid: pre + 'rw-' + f.id, tip: t('tip.rwAgain'), disabled: wait, onclick: () => requestReword(f, doc, pre) }),
      btn(t('rw.remove'), { kind: 'text sm', icon: 'remove', fid: pre + 'rwd-' + f.id, tip: t('tip.rwRemove'), onclick: () => removeReword(f, pre) })];
    return [btn(t('rw.ask'), { kind: 'text sm', icon: 'wand', fid: pre + 'rw-' + f.id, tip: t('tip.rw'), disabled: wait, onclick: () => requestReword(f, doc, pre) })];
  }

  /* ----- 2. Rückübersetzung (paarweiser Vergleich) ----- */
  function dropBt() { if (S.bt && S.bt.ctl) S.bt.ctl.abort(); S.bt = null; S.btNote = null; }
  function startBt(cmp) {
    if (aiPaused()) { snack(t('ai.paused')); return; }
    const ref = docById(cmp.ref), tgt = docById(cmp.tgt), seg = DP.ai.btSegments(ref, tgt, cmp);
    const resume = !!(S.bt && S.bt.id === cmp.id && S.bt.state === 'partial');
    const items = [t('bt.dlg.i1', { name: tgt.name, lang: t('lang.' + tgt.lang) }), t('bt.dlg.i2'), t('bt.dlg.i3', { lang: t('lang.' + ref.lang) })];
    if (seg.segs.length < seg.all) items.push(t('bt.dlg.limit', { n: num(seg.segs.length), m: num(seg.all) }));
    aiAsk({ intro: t('bt.dlg.p', { name: tgt.name }), items, classif: classOf(tgt), ok: t('bt.dlg.ok'), back: 'aiBt-go' }, () => runBt(cmp, resume));
  }
  async function runBt(cmp, resume) {
    const ref = docById(cmp.ref), tgt = docById(cmp.tgt); if (!ref || !tgt) return;
    const B = resume && S.bt && S.bt.id === cmp.id ? S.bt : (S.bt = { id: cmp.id, rows: new Map(), stats: { lang: 0, bad: 0 } });
    const seg = DP.ai.btSegments(ref, tgt, cmp), byId = new Map(seg.segs.map(x => [x.id, x])), base = Object.assign({}, B.stats);
    Object.assign(B, { state: 'running', prog: [1, 1], err: null, ctl: new AbortController(), total: seg.segs.length, all: seg.all });
    S.focus = ['aiBt-stop']; render();
    try {
      await DP.ai.runBack(ref, tgt, cmp, { signal: B.ctl.signal,
        onProgress: (i, n) => { B.prog = [i, n]; if (S.bt === B && S.route === 'compare') render(); },
        onPart: (ok, st) => { for (const [id, text] of ok) { const x = byId.get(id); B.rows.set(id, { text, ref: x.refText, sig: x.refText ? DP.ai.btSignals(x.refText, text, ref.lang) : [], dev: DP.ai.btDeviation(x.refText, text) }); }
          B.stats = { lang: base.lang + st.lang, bad: base.bad + st.bad }; } }, new Set(B.rows.keys()));
      if (S.bt !== B) return;
      B.state = B.rows.size >= B.total ? 'done' : 'partial';
      snack(tn('bt.done', B.rows.size));
    } catch (e) {
      if (S.bt !== B) return;
      const key = DP.ai.errKey(e);
      B.state = B.rows.size ? 'partial' : 'idle';
      if (key === 'cancelled') snack(t('bt.cancelled'));
      else { B.err = key; if (key === 'ai.err.unavailable') S.aiAvail = false; if (key === 'ai.err.rate_limited') pauseAi(); }
    }
    B.ctl = null; S.focus = ['aiBt-go']; if (S.route === 'compare') render();
  }
  function btCard(cmp, ref, tgt) {
    if (DP.offline) return null;
    const B = S.bt && S.bt.id === cmp.id ? S.bt : null, seg = DP.ai.btSegments(ref, tgt, cmp), extra = [];
    if (seg.segs.length < seg.all) extra.push(h('p', { class: 'help', 'data-fid': 'bt-limit' }, t('bt.limit', { n: num(seg.segs.length), m: num(seg.all), k: num(seg.limit) })));
    if (B && B.rows.size && B.state !== 'running') extra.push(h('p', { class: 'help', 'data-fid': 'bt-status' }, tn('bt.status', B.rows.size, { m: num(B.total) }) + (B.stats.lang + B.stats.bad ? ' ' + tn('bt.dropped', B.stats.lang + B.stats.bad) : '')));
    return aiCard({ id: 'aiBt', title: t('bt.t'), desc: t('bt.d', { a: t('lang.' + tgt.lang), b: t('lang.' + ref.lang) }), state: B ? B.state : 'idle', prog: B ? B.prog : [1, 1], runKey: 'bt.run', err: B && B.err,
      start: t('bt.start'), again: B && B.state === 'partial' ? t('bt.resume') : t('bt.again'), tip: t('tip.bt'), pause: true, extra, run: () => startBt(cmp), stop: () => B && B.ctl && B.ctl.abort() });
  }
  /** Rang einer Zeile für «Grösste Abweichungen zuerst»: zuerst harte Signale, dann die Abweichung im Wortlaut. */
  const btRank = (B, r) => { const x = B.rows.get(r.row); return x ? x.sig.length * 10 + (x.dev || 0) : -1; };
  function btDevNode(dev) {
    const lvl = dev == null ? 'none' : dev < 0.35 ? 'low' : dev < 0.6 ? 'mid' : 'high';
    return h('span', { class: 'bt-dev' }, dev == null ? null : h('span', { class: 'bt-bar', 'aria-hidden': 'true' }, h('span', { style: { width: Math.round(Math.max(0.04, dev) * 100) + '%' } })), h('span', null, t('bt.dev.' + lvl)));
  }
  function btSigText(x) {
    const list = (v) => v.length ? v.join(', ') : '–';
    if (x.kind === 'num' || x.kind === 'date' || x.kind === 'ref') return t('bt.sig.' + x.kind, { a: list(x.a), b: list(x.b) });
    if (x.kind === 'mod') return t('bt.sig.mod', { a: x.a[0], ac: t('mod.' + x.ac), b: x.b[0], bc: t('mod.' + x.bc) });
    return t('bt.sig.neg.' + x.side);
  }
  function keepBt(cmp, r, br) {
    const ref = docById(cmp.ref), tgt = docById(cmp.tgt), note = (S.btNote && S.btNote.text || '').trim().slice(0, 140);
    const f = { id: tgt.id + '-bk' + ref.id + '-' + r.row + '-' + Date.now().toString(36), docId: tgt.id, crit: 'X17', cat: 'trans', sev: 'warn', source: 'ai', manual: true, cmp: cmp.id, refDoc: ref.id,
      refPara: r.a.slice(), para: r.b[0], key: note ? 'f.X17.note' : 'f.X17', params: note ? { note } : {}, bt: br.text, btRow: r.row, btLang: ref.lang, accepted: false };
    (S.btKept[cmp.id] = S.btKept[cmp.id] || []).push(f);
    S.btNote = null; S.focus = ['dis-' + f.id]; recheckOf(tgt); render(); snack(t('bt.kept.done'));
  }
  function btKeepUi(cmp, r, br) {
    const kept = (S.btKept[cmp.id] || []).find(f => f.btRow === r.row);
    if (kept) return h('span', { class: 'tag st-accepted', 'data-fid': 'btkd-' + r.row }, icon('check', 'sm'), t('bt.kept'));
    if (S.settings.off.has('X17')) return null;
    if (S.btNote && S.btNote.id === cmp.id && S.btNote.row === r.row) {
      const id = 'btNote-' + r.row, cancel = () => { S.btNote = null; S.focus = ['btk-' + r.row]; render(); };
      return h('div', { class: 'bt-keep' }, h('div', { class: 'field' }, h('label', { for: id }, t('bt.note')),
        h('input', { type: 'text', id, 'data-fid': 'btn-' + r.row, maxlength: 140, autocomplete: 'off', value: S.btNote.text, placeholder: t('bt.note.ph'),
          oninput: (e) => { S.btNote.text = e.target.value; }, onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); keepBt(cmp, r, br); } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancel(); } } })),
        h('div', { class: 'row' }, btn(t('bt.keep.ok'), { kind: 'outlined sm', icon: 'pin', fid: 'btk-ok-' + r.row, onclick: () => keepBt(cmp, r, br) }), btn(t('btn.cancel'), { kind: 'text sm', fid: 'btk-x-' + r.row, onclick: cancel })));
    }
    return btn(t('bt.keep'), { kind: 'text sm', icon: 'pin', fid: 'btk-' + r.row, tip: t('tip.btKeep'), onclick: () => { S.btNote = { id: cmp.id, row: r.row, text: '' }; S.focus = ['btn-' + r.row]; render(); } });
  }
  /** Dritte Spalte: Rückübersetzung mit wortweisem Abgleich zur Referenz (gestrichen: nur in der Referenz, eingefügt: nur in der
      Rückübersetzung), Abweichung im Wortlaut, harte Signale, «Als Befund festhalten». Screenreader erhalten den Text ohne Abgleich. */
  function btCell(cmp, ref, r, br) {
    const mob = h('span', { class: 'mob', lang: uiLang() }, h('span', { class: 'swatch acc-ai', 'aria-hidden': 'true' }), t('bt.col', { lang: langLbl(ref) }), h('span', { class: 'sr' }, ': '));
    if (!br) return h('div', { class: 'cell none bt-cell' }, mob, t(!r.b.length ? 'bt.row.none' : S.bt && S.bt.state === 'running' ? 'bt.row.wait' : 'bt.row.missing'));
    const el = h('div', { class: 'cell bt-cell', lang: ref.lang }, mob);
    if (br.ref) {
      const vis = h('span', { 'aria-hidden': 'true' }), ops = DP.exporter.diffOps(br.ref, br.text, 0); let pos = 0;
      for (const o of ops) { if (o.start > pos) app(vis, br.ref.slice(pos, o.start)); if (o.end > o.start) app(vis, h('del', null, br.ref.slice(o.start, o.end))); if (o.repl) app(vis, h('ins', null, o.repl)); pos = Math.max(pos, o.end); }
      if (pos < br.ref.length) app(vis, br.ref.slice(pos));
      app(el, vis, h('span', { class: 'sr' }, br.text));
    } else app(el, br.text);
    app(el, h('div', { class: 'bt-meta', lang: uiLang() }, btDevNode(br.dev),
      br.sig.map(x => h('span', { class: 'bt-sig', 'data-fid': 'bts-' + r.row + '-' + x.kind }, icon('flag', 'sm'), h('span', null, btSigText(x)))), btKeepUi(cmp, r, br)));
    return el;
  }

  /* ----- 3. Pflichtenmatrix ----- */
  const dutyDone = (id) => !!(S.duty[id] && S.duty[id].state === 'done');
  /** Fassungen für «Für alle Fassungen erstellen»: die Auswahl des Sprachvergleichs (Referenz und Zielfassungen), wenn das Dokument dazugehört. */
  function dutySet(doc) {
    const ds = Array.from(new Set([S.ref, S.tgt, S.docs.length >= 3 ? S.tgt2 : null].filter(Boolean))).map(docById).filter(Boolean);
    return ds.includes(doc) && ds.length > 1 ? ds : [doc];
  }
  function dutyCount(doc) { const D = S.duty[doc.id]; return D && D.rows.length ? tn('duty.count', D.rows.length) : t('duty.count.none'); }
  /** Lücken (Q08–Q10) aus den Zeilen neu berechnen; Entscheide an gleicher Stelle bleiben. */
  function dutyGapsOf(doc) {
    const D = S.duty[doc.id]; if (!D) return;
    const F = DP.duties.gaps(doc, D.rows, (id) => !S.settings.off.has(id));
    F.forEach((f, k) => { f.id = doc.id + '-q' + (k + 1); });
    keepDecisions(F, D.findings); D.findings = F;
  }
  /** Abgleich der Matrizen: für jeden Vergleich, dessen beide Fassungen eine vollständige Matrix haben (Teilergebnisse ergäben
      scheinbar fehlende Pflichten). Für die Auswahl des Sprachvergleichs wird der Vergleich bei Bedarf erstellt. */
  function dutySync() {
    const offSig = Array.from(S.settings.off).sort().join();
    const ref = docById(S.ref);
    if (ref && dutyDone(ref.id)) for (const tid of [S.tgt, S.tgt2]) { const tg = docById(tid); if (tg && tg !== ref && dutyDone(tg.id)) cmpOf(ref, tg); }
    for (const id of Object.keys(S.dutyCmp)) { const c = S.cmp[id]; if (!c || !dutyDone(c.ref) || !dutyDone(c.tgt)) delete S.dutyCmp[id]; }
    for (const id in S.cmp) {
      const c = S.cmp[id]; if (!dutyDone(c.ref) || !dutyDone(c.tgt)) continue;
      const A = S.duty[c.ref], B = S.duty[c.tgt], old = S.dutyCmp[id], key = [A.rows, B.rows, c, offSig];
      if (old && old.key.every((x, k) => x === key[k])) continue;
      const res = DP.duties.synopsis(docById(c.ref), docById(c.tgt), c, A.rows, B.rows, c.findings, (x) => !S.settings.off.has(x));
      keepDecisions(res.findings, old && old.findings);
      S.dutyCmp[id] = { key, diffs: res.diffs, findings: res.findings, al: res.al, done: true };
    }
  }
  function startDuty(list, back) {
    if (aiPaused()) { snack(t('ai.paused')); return; }
    const items = list.map(d => t('duty.dlg.i1', { name: d.name, lang: t('lang.' + d.lang) })).concat(t('duty.dlg.i2'));
    const cut = list.filter(d => DP.duties.plan(d).cut);
    if (cut.length) items.push(t('duty.dlg.limit', { list: cut.map(d => '«' + d.name + '»').join(', ') }));
    if (list.length > 1 || list.some(d => dutyLabelsFor(d))) items.push(t('duty.dlg.i3'));
    aiAsk({ intro: t(list.length > 1 ? 'duty.dlg.p.all' : 'duty.dlg.p', { name: list[0].name, n: num(list.length) }), items, classif: classOf(...list), ok: t(list.length > 1 ? 'duty.dlg.ok.all' : 'duty.dlg.ok'), back }, () => runDuty(list));
  }
  /** Kanonische Bezeichnungen der Matrix einer anderen Fassung (Referenz eines Vergleichs, sonst die erste fertige), damit die Zeilen
      über die Sprachen zusammenpassen. Nur Bezeichnungen (englische Kurzformen), kein Dokumenttext; null, wenn es keine gibt. */
  function dutyLabelsFor(doc) {
    const refs = Object.values(S.cmp).filter(c => c.tgt === doc.id).map(c => c.ref).concat(S.docs.map(d => d.id)).filter(id => id !== doc.id);
    for (const id of refs) { const D = S.duty[id]; if (D && D.state === 'done' && D.rows.length) { const l = DP.duties.labelsOf(D.rows); if (l.actors.length || l.actions.length) return l; } }
    return null;
  }
  async function runDuty(list) {
    let k = 0;
    for (const doc of list) {
      k++;
      if (!docById(doc.id)) continue;
      const prev = S.duty[doc.id], resume = !!(prev && prev.state === 'partial' && prev.stats && list.length === 1);
      const D = S.duty[doc.id] = resume ? prev : { rows: [], stats: null, findings: [] };
      Object.assign(D, { state: 'running', prog: [1, 1], err: null, ctl: new AbortController(), batch: list.length > 1 ? [k, list.length] : null });
      delete S.dutyStale[doc.id];
      S.focus = ['aiDuty-stop']; render();
      const base = resume ? D.rows.slice() : [];
      try {
        await DP.duties.run(doc, { signal: D.ctl.signal, onProgress: (i, n) => { D.prog = [i, n]; if (S.route === 'check') render(); },
          onPart: (rows, st) => { D.rows = base.concat(rows); D.stats = st; dutyGapsOf(doc); } }, resume ? D.stats.done : 0, dutyLabelsFor(doc));
        if (S.duty[doc.id] !== D) return;
        D.state = 'done'; D.ctl = null; dutyGapsOf(doc); dutySync(); recheckOf(doc);
        snack(tn('duty.done', D.rows.length, { name: doc.name }));
      } catch (e) {
        if (S.duty[doc.id] !== D) return;
        const key = DP.ai.errKey(e);
        D.ctl = null; D.state = D.stats && D.stats.done ? 'partial' : 'idle';
        if (key === 'cancelled') snack(t('duty.cancelled'));
        else { D.err = key; if (key === 'ai.err.unavailable') S.aiAvail = false; if (key === 'ai.err.rate_limited') pauseAi(); }
        dutyGapsOf(doc); dutySync(); S.focus = ['aiDuty-go']; render();
        return;
      }
    }
    S.focus = ['aiDuty-go']; render();
  }
  const MOD_ORDER = { obligation: 0, prohibition: 1, permission: 2, recommendation: 3 };
  /** Frist als Tage für die Sortierung (Näherung); ohne Frist zuletzt. */
  function dueDays(r) {
    const d = r.due; if (!d) return r.deadline ? 5e5 : 1e6;
    if (d.n != null) return d.n * { hours: 1 / 24, days: 1, working_days: 1.4, weeks: 7, months: 30, years: 365 }[d.unit];
    if (d.every) return { day: 1, week: 7, month: 30, quarter: 91, year: 365 }[d.every] + 0.5;
    if (d.date) return 2e5 + Date.parse(d.date) / 864e5; return 4e5;
  }
  const rowGaps = (D, r) => D.findings.filter(f => !f.dismissed && f.para === r.p && f.start === r.start);
  const dutyMod = (m) => t('duty.mod.' + m);
  function dutyRowsOf(doc, D) {
    let rows = D.rows.map((r, k) => ({ r, k, gaps: rowGaps(D, r) }));
    const so = S.dutySort;
    if (so) {
      const key = so.col === 'actor' ? (x) => (x.r.actor || '￿').toLocaleLowerCase(S.lang) : so.col === 'mod' ? (x) => MOD_ORDER[x.r.modality] : (x) => dueDays(x.r);
      rows.sort((a, b) => { const x = key(a), y = key(b); return (x < y ? -1 : x > y ? 1 : 0) * (so.dir === 'desc' ? -1 : 1) || a.k - b.k; });
    }
    return rows;
  }
  /** Sprung zur Stelle in der Dokumentansicht; die Zeile ist markiert, der Absatz hat den Fokus, die Meldung führt zurück. */
  function dutyJump(doc, x) {
    S.view = 'doc'; S.pin = { para: x.r.p }; S.tb = null; S.sel = null;
    if (x.r.p >= S.paraLimit) S.paraLimit = x.r.p + 100;
    S.focus = ['pin-p']; render();
    const row = document.querySelector('.dv-row[data-row="' + x.r.p + '"]');
    if (row) row.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    snack(t('duty.jumped'), { label: t('duty.back'), fid: 'snack-duty', run: () => { S.view = 'duty'; S.pin = null; S.focus = ['dj-' + x.k]; render(); } });
  }
  /** Tabulatorgetrennt für Excel und Word; Zellen ohne Tabulator und Zeilenumbruch, Formeln entschärft. */
  function dutyTsv(doc, D) {
    const cell = (s) => { s = String(s == null ? '' : s).replace(/[\t\r\n]+/g, ' ').trim(); return /^[=+\-@]/.test(s) ? "'" + s : s; };
    const head = ['duty.col.where', 'duty.col.actor', 'duty.col.mod', 'duty.col.action', 'duty.col.object', 'duty.col.due', 'duty.col.cond', 'duty.col.quote', 'duty.col.gaps'].map(k => t(k));
    const lines = [head.join('\t')].concat(dutyRowsOf(doc, D).map(x => [paraLoc(doc, x.r.p), x.r.actor || t('duty.noactor'), dutyMod(x.r.modality) + (x.r.disagree ? ' (' + t('duty.disagree.short') + ')' : ''), x.r.action, x.r.object, x.r.deadline, x.r.condition, x.r.quote,
      x.gaps.map(f => f.crit + ' ' + t('c.' + f.crit + '.t')).join('; ')].map(cell).join('\t')));
    return lines.join('\r\n') + '\r\n';
  }
  function dutyTable(doc, D) {
    const all = dutyRowsOf(doc, D), nGap = all.filter(x => x.gaps.length).length, rows = S.dutyGaps ? all.filter(x => x.gaps.length) : all;
    const chip = (label, pressed, onclick, fid, n) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(pressed), 'data-fid': fid, onclick }, label, h('span', { class: 'n' }, num(n)));
    const sec = h('section', { class: 'duty', 'aria-labelledby': 'dutyT' },
      h('div', { class: 'duty-head' }, h('h2', { id: 'dutyT', class: 'sec' }, t('duty.h')),
        h('div', { class: 'chips', role: 'group', 'aria-label': t('duty.filter') },
          chip(t('duty.f.all'), !S.dutyGaps, () => { S.dutyGaps = false; S.focus = ['duty-f-all']; render(); }, 'duty-f-all', all.length),
          chip(t('duty.f.gaps'), S.dutyGaps, () => { S.dutyGaps = true; S.focus = ['duty-f-gaps']; render(); }, 'duty-f-gaps', nGap)),
        btn(t('duty.copy'), { kind: 'outlined sm', icon: 'content_copy', fid: 'duty-copy', tip: t('tip.dutyCopy'), onclick: () => navigator.clipboard.writeText(dutyTsv(doc, D)).then(() => snack(tn('duty.copied', D.rows.length)), () => snack(t('dv.copy.fail'))) })),
      h('p', { class: 'help' }, t('duty.help')));
    if (!rows.length) { app(sec, h('p', { class: 'help', 'data-fid': 'duty-nogaps' }, t('duty.f.none'))); return sec; }
    const so = S.dutySort;
    const th = (col, key) => {
      if (!col) return h('th', { scope: 'col' }, t(key));
      const cur = so && so.col === col, dir = cur ? so.dir : null;
      return h('th', { scope: 'col', 'aria-sort': cur ? (dir === 'asc' ? 'ascending' : 'descending') : null },
        h('button', { type: 'button', class: 'th-sort' + (cur ? ' on' : ''), 'data-fid': 'duty-sort-' + col, 'data-tip': t('tip.dutySort'),
          onclick: () => { S.dutySort = cur && dir === 'asc' ? { col, dir: 'desc' } : cur ? null : { col, dir: 'asc' }; S.focus = ['duty-sort-' + col]; render(); } },
        h('span', null, t(key)), icon(cur ? 'expand_more' : 'sort', 'sm' + (cur && dir === 'asc' ? ' flip' : ''))));
    };
    const lbl = (key) => h('span', { class: 'mob', 'aria-hidden': 'true' }, t(key));
    const none = (key) => h('span', { class: 'none' }, t(key));
    const body = h('tbody', null, rows.map(x => {
      const r = x.r;
      return h('tr', { 'data-k': x.k, class: x.gaps.length ? 'gap' : null, onclick: (e) => { if (e.target.closest('button, a, input')) return; dutyJump(doc, x); } },
        h('td', { class: 'c-where' }, lbl('duty.col.where'), h('button', { type: 'button', class: 'linkish', 'data-fid': 'dj-' + x.k, 'aria-label': t('duty.jump', { loc: paraLoc(doc, r.p) }) }, paraLoc(doc, r.p)),
          x.gaps.length ? h('span', { class: 'duty-gaps' }, x.gaps.map(f => h('span', { class: 'tag sev-' + f.sev }, f.crit + ' ' + t('duty.gap.' + f.crit)))) : null),
        h('td', null, lbl('duty.col.actor'), r.actor || none('duty.noactor')),
        h('td', null, lbl('duty.col.mod'), h('span', { class: 'tag duty-mod' }, dutyMod(r.modality)),
          r.disagree ? h('span', { class: 'duty-dis' }, icon('help', 'sm'), h('span', null, t('duty.disagree', { raw: r.local.raw, cls: t('mod.' + r.local.cls) }))) : null),
        h('td', null, lbl('duty.col.action'), r.action, r.object ? h('span', { class: 'duty-obj' }, t('duty.obj', { v: r.object })) : null),
        h('td', null, lbl('duty.col.due'), r.deadline || none('duty.none')),
        h('td', null, lbl('duty.col.cond'), r.condition || none('duty.none')),
        h('td', { class: 'c-quote', lang: doc.lang }, lbl('duty.col.quote'), r.quote));
    }));
    // Klick auf die Stelle: Sprung (Tastatur über die Schaltfläche in der ersten Spalte)
    body.addEventListener('click', (e) => { const b = e.target.closest('button[data-fid^="dj-"]'); if (!b) return; const x = all.find(y => 'dj-' + y.k === b.dataset.fid); if (x) dutyJump(doc, x); });
    app(sec, h('div', { class: 'duty-wrap' }, h('table', { class: 'duty-table' },
      h('caption', { class: 'sr' }, t('duty.caption', { name: doc.name })),
      h('thead', null, h('tr', null, th(null, 'duty.col.where'), th('actor', 'duty.col.actor'), th('mod', 'duty.col.mod'), th(null, 'duty.col.action'), th('due', 'duty.col.due'), th(null, 'duty.col.cond'), th(null, 'duty.col.quote'))),
      body)));
    return sec;
  }
  /** Kurzfassung einer Zeile in der Synopse. */
  function synCell(d, r, key, lblKey, lblP) {
    const mob = h('span', { class: 'mob', 'aria-hidden': 'true' }, t(lblKey, lblP));
    if (!r) return h('td', { class: 'syn-none' }, mob, t(key));
    return h('td', { lang: d.lang }, mob, h('span', { class: 'syn-act' }, r.actor || t('duty.noactor')), ' ', h('span', { class: 'tag duty-mod', lang: uiLang() }, dutyMod(r.modality)), ' ', r.action,
      r.deadline ? h('span', { class: 'syn-due' }, r.deadline) : null);
  }
  function dutySynopsis(doc) {
    const ref = docById(S.ref); if (!ref) return null;
    const tg = Array.from(new Set([S.tgt, S.docs.length >= 3 ? S.tgt2 : null])).map(docById).filter(d => d && d !== ref);
    const set = [ref].concat(tg); if (set.length < 2 || !set.includes(doc)) return null;
    const sec = h('section', { class: 'duty-syn', 'aria-labelledby': 'dutySynT' }, h('h2', { id: 'dutySynT', class: 'sec' }, t('duty.syn.h')));
    const missing = set.filter(d => !dutyDone(d.id));
    const syns = tg.map(d => ({ d, s: S.dutyCmp[ref.id + '>' + d.id] })).filter(x => x.s && dutyDone(x.d.id));
    if (!dutyDone(ref.id) || !syns.length) { app(sec, h('p', { class: 'help', 'data-fid': 'duty-syn-need' }, t('duty.syn.need', { list: missing.map(d => '«' + d.name + '»').join(', ') }))); return sec; }
    if (missing.length) app(sec, h('p', { class: 'help' }, t('duty.syn.part', { list: missing.map(d => '«' + d.name + '»').join(', ') })));
    app(sec, h('p', { class: 'help' }, t('duty.syn.d')));
    // Zeilen: je Pflicht der Referenz die zugeordneten Pflichten der Zielfassungen, danach Pflichten, die nur in einer Zielfassung stehen
    const A = S.duty[ref.id].rows, lines = [];
    const mapOf = syns.map(x => { const m = new Map(); for (const p of x.s.al.pairs) m.set(p.a, p.b); return m; });
    const diffsOf = (x, pred) => x.s.diffs.filter(pred);
    for (const a of A) lines.push({ a, b: mapOf.map(m => m.get(a) || null), diffs: syns.map(x => diffsOf(x, d => d.a === a)) });
    syns.forEach((x, k) => { for (const o of x.s.al.onlyB) lines.push({ a: null, b: syns.map((_, j) => j === k ? o.b : null), diffs: syns.map((y, j) => j === k ? diffsOf(y, d => d.b === o.b && d.kind === 'extra') : []) }); });
    const shown = S.dutySynAll ? lines : lines.filter(l => l.diffs.some(ds => ds.length));
    const nDiff = lines.filter(l => l.diffs.some(ds => ds.length)).length;
    app(sec, h('div', { class: 'duty-head' }, h('p', { class: 'syn-count', 'data-fid': 'duty-syn-n' }, tn('duty.syn.n', nDiff)),
      h('button', { type: 'button', class: 'chip', 'aria-pressed': String(S.dutySynAll), 'data-fid': 'duty-syn-all', onclick: () => { S.dutySynAll = !S.dutySynAll; S.focus = ['duty-syn-all']; render(); } }, S.dutySynAll ? icon('check', 'sm') : null, t('duty.syn.all'))));
    if (!shown.length) { app(sec, h('div', { class: 'notice ok' }, icon('check_circle_fill'), h('span', null, t('duty.syn.clean')))); return sec; }
    const diffNode = (d, x) => h('li', null, h('span', { class: 'tag sev-' + d.sev }, t('sev.' + d.sev)), ' ', h('span', null, t('duty.syn.k.' + d.kind + (d.one ? '.single' : ''), { lang: t('lang.' + x.d.lang) })),
      d.dup ? h('span', { class: 'help' }, ' ' + t('duty.syn.dup', { crit: d.dup })) : null);
    app(sec, h('div', { class: 'duty-wrap' }, h('table', { class: 'duty-table syn-table' },
      h('caption', { class: 'sr' }, t('duty.syn.caption')),
      h('thead', null, h('tr', null, h('th', { scope: 'col' }, t('duty.syn.col.ref', { lang: langLbl(ref) })), syns.map(x => h('th', { scope: 'col' }, langLbl(x.d) + ' · ' + clip(x.d.name, 28))), h('th', { scope: 'col' }, t('duty.syn.col.diff')))),
      h('tbody', null, shown.map(l => h('tr', { class: l.diffs.some(ds => ds.length) ? 'gap' : null },
        synCell(ref, l.a, 'duty.syn.only', 'duty.syn.col.ref', { lang: langLbl(ref) }),
        syns.map((x, k) => synCell(x.d, l.b[k], l.a ? 'duty.syn.miss' : 'duty.syn.only', 'duty.syn.col.tgt', { lang: langLbl(x.d) })),
        h('td', { class: 'syn-diff' }, h('span', { class: 'mob', 'aria-hidden': 'true' }, t('duty.syn.col.diff')),
          l.diffs.some(ds => ds.length) ? h('ul', null, syns.map((x, k) => l.diffs[k].map(d => diffNode(d, x)))) : h('span', { class: 'none' }, t('duty.syn.same')))))))));
    return sec;
  }
  function viewDuty(doc, page) {
    const D = S.duty[doc.id], vers = dutySet(doc), plan = DP.duties.plan(doc), extra = [];
    if (S.dutyStale[doc.id] && !D) extra.push(h('p', { class: 'ai-note', 'data-fid': 'duty-stale' }, t('duty.stale')));
    if (plan.cut) extra.push(h('p', { class: 'help', 'data-fid': 'duty-limit' }, tn('duty.limit', plan.cut, { m: num(plan.paras) })));
    if (D && D.stats && D.state !== 'running') extra.push(h('p', { class: 'help', 'data-fid': 'duty-status' }, tn('duty.status', D.rows.length) + (D.stats.dropped ? ' ' + tn('duty.dropped', D.stats.dropped) : '') + (D.stats.capped ? ' ' + tn('duty.capped', D.stats.capped, { max: num(DP.duties.MAX_ROWS) }) : '') + (D.state === 'partial' ? ' ' + tn('duty.partial', D.stats.done, { a: num(D.stats.done), b: num(D.stats.parts) }) : '')));
    const busy = vers.some(d => S.duty[d.id] && S.duty[d.id].state === 'running');
    const second = vers.length > 1 && aiOn() ? btn(t('duty.all', { n: num(vers.length) }), { kind: 'text', icon: 'auto_awesome', fid: 'aiDuty-all', tip: t('tip.dutyAll'), disabled: !!aiPaused() || busy, onclick: () => startDuty(vers, 'aiDuty-all') }) : null;
    app(page, aiCard({ id: 'aiDuty', title: t('duty.t'), desc: t('duty.d'), state: D ? D.state : 'idle', prog: D ? D.prog : [1, 1], runKey: D && D.batch ? 'duty.run.all' : 'duty.run', runParams: D && D.batch ? { k: num(D.batch[0]), m: num(D.batch[1]) } : null,
      err: D && D.err, start: t('duty.start'), again: D && D.state === 'partial' ? t('duty.resume') : t('duty.again'), tip: t('tip.duty'), pause: true, extra, second, run: () => startDuty([doc], 'aiDuty-go'), stop: () => D && D.ctl && D.ctl.abort() }));
    if (D && D.rows.length) app(page, dutyTable(doc, D));
    else if (D && D.state === 'done') app(page, emptyState('table', t('duty.none.t'), t('duty.none.d')));
    const syn = dutySynopsis(doc); if (syn) app(page, syn);
  }

  /* ---------- Ansicht: Dokumente ---------- */
  function docTabs(label) {
    if (S.docs.length < 2) return null;
    return h('div', { class: 'chips tabs', role: 'group', 'aria-label': label }, S.docs.map(d => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(d.id === S.cur), 'data-fid': 'tab-' + d.id, onclick: () => { S.cur = d.id; S.enter = true; render(); } }, h('span', { class: 'swatch fmt-' + d.format, 'aria-hidden': 'true' }), clip(d.name, 34))));
  }
  function verdictChip(v) { return h('span', { class: 'verdict-chip v-' + v }, icon(v === 'pass' ? 'check_circle_fill' : v === 'warn' ? 'warning_fill' : 'error_fill', 'sm'), t('verdict.' + v)); }
  function countsNode(c) {
    return h('span', { class: 'counts' }, ['error', 'warn', 'info'].map(s => h('span', { class: 'c-' + s + (c[s] ? '' : ' zero'), title: t('sev.' + s + '.n') }, icon(SEV_ICON[s], 'sm'), num(c[s]), h('span', { class: 'sr' }, ' ' + t('sev.' + s + '.n')))));
  }
  function viewDocs() {
    const page = h('div', { class: 'page' });
    app(page, h('header', { class: 'page-head hero' }, h('h1', null, t('docs.h')), h('p', { class: 'lead' }, t('docs.lead'))));
    const hasDemo = S.docs.some(d => d.demo);
    const drop = h('section', { class: 'drop' + (S.busy ? ' busy' : ''), id: 'drop', 'aria-labelledby': 'dropT' },
      h('div', { class: 'drop-main' },
        h('span', { class: 'drop-ico', 'aria-hidden': 'true' }, icon('upload_file')),
        h('div', { class: 'grow' },
          h('h2', { id: 'dropT' }, S.busy || t('docs.drop.t')),
          S.busy ? progress(S.busy) : h('p', null, t('docs.drop.d')))),
      h('div', { class: 'drop-bar' },
        h('div', { class: 'drop-pills' },
          hasDemo ? null : btn(t('docs.demo'), { kind: 'pill', icon: 'science', fid: 'demo', disabled: !!S.busy, onclick: loadDemo }),
          hasDemo ? null : h('p', { class: 'note' }, t('docs.demo.note'))),
        btn(t('docs.pick'), { icon: 'upload_file', fid: 'pick', disabled: !!S.busy, onclick: () => $('file').click() })));
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', (e) => { if (!drop.contains(e.relatedTarget)) drop.classList.remove('over'); });
    drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); addFiles(e.dataTransfer.files); });
    // GitHub Pages: dauerhaft sichtbar, wofür diese Webseite gedacht ist und wie klassifizierte Dokumente geprüft werden (readFiles)
    if (WEB) app(page, h('div', { class: 'notice web-note', 'data-fid': 'web-classif-note' }, icon('gpp_maybe'),
      h('div', null, h('p', null, t('web.note')),
        h('a', { class: 'btn text sm', href: RELEASE_URL, target: '_blank', rel: 'noopener noreferrer', 'data-fid': 'web-note-dl', 'data-tip': t('tip.webSave') }, icon('download', 'sm'), t('web.save')))));
    app(page, drop);
    if (S.docs.length) {
      const list = h('div', { class: 'docs' });
      S.docs.forEach((d, i) => {
        const c = countsOf(findingsOf(d));
        const sel = (id, label, value, options, onchange) => h('div', { class: 'field' }, h('label', { for: id }, label), h('select', { id, 'data-fid': id, onchange: (e) => onchange(e.target.value) }, options.map(o => h('option', { value: o[0], selected: o[0] === value }, o[1]))));
        const meta = [t('fmt.' + d.format), tn('docs.words', d.meta.words)];
        if (d.meta.slides) meta.push(tn('docs.slides', d.meta.slides)); else if (d.meta.pages) meta.push(tn('docs.pages', d.meta.pages));
        const types = d.format === 'pptx' ? ['praesentation', 'bericht'] : ['weisung', 'konzept', 'aktennotiz', 'bericht'];
        const v = S.versions[d.id];
        app(list, h('article', { class: 'card tight doc fmt-' + d.format, style: { '--i': i }, 'aria-label': d.name },
          h('div', { class: 'doc-head' },
            h('span', { class: 'fmt ' + d.format, 'aria-hidden': 'true' }, icon(FMT_ICON[d.format])),
            h('div', { class: 'grow' }, h('div', { class: 'doc-name' }, d.name), h('div', { class: 'doc-meta' }, h('span', { class: 'swatch', 'aria-hidden': 'true' }), meta.join(' · '))),
            d.demo ? h('span', { class: 'tag demo' }, t('docs.demo.tag')) : null,
            iconBtn('delete', t('docs.remove', { name: d.name }), () => removeDoc(d), { fid: 'rm-' + d.id })),
          d.meta.classification ? h('div', { class: 'notice' }, icon('gpp_maybe'), h('span', null, t('docs.classif', { label: d.meta.classification.label }))) : null,
          v ? h('p', { class: 'doc-ver' }, icon('history', 'sm'), h('span', null, t('docs.ver', { n: v.n, name: v.name }))) : null,
          h('div', { class: 'fields' },
            sel('lang-' + d.id, t('docs.f.lang'), d.lang, ['de', 'fr', 'it', 'en'].map(l => [l, cap(t('lang.' + l))]), (v) => { d.lang = v; if (S.bt && S.bt.id.split('>').includes(d.id)) dropBt(); rerunAll(); render(); }),
            sel('type-' + d.id, t('docs.f.type'), d.type, types.map(x => [x, t('type.' + x)]), (v) => { d.type = v; rerunAll(); render(); })),
          h('div', { class: 'doc-status' }, verdictChip(verdictOf(c)), countsNode(c)),
          h('div', { class: 'row' }, btn(t('docs.open'), { kind: 'tonal sm', icon: 'arrow_forward', fid: 'open-' + d.id, onclick: () => { S.cur = d.id; go('check'); } }),
            btn(t('ver.load'), { kind: 'text sm', icon: 'file_diff', fid: 'ver-' + d.id, tip: t('tip.verLoad'), disabled: !!S.busy, onclick: () => pickVersion(d, 'ver-' + d.id) }))));
      });
      app(page, h('h2', { class: 'sec' }, t('docs.list')), list);
    }
    // Aus dem Katalog gezählt: lokal geprüfte Kriterien (Regeln und formaler Sprachvergleich), Kriterien der KI-Prüfung, alle
    const nLocal = R.CATALOG.filter(c => !c.ai).length, nAi = R.CATALOG.length - nLocal;
    app(page, h('section', { class: 'grid3', 'aria-label': t('ses.title') },
      [['lock', 'docs.fact1', null, 'data'], ['computer', 'docs.fact2', { n: nLocal }, null], DP.offline ? ['cloud_off', 'docs.fact3', null, 'ai', '.off'] : ['auto_awesome', 'docs.fact3', null, 'ai']].map(([ic, k, p, anc, v]) => h('div', { class: 'card tight fact' + (anc === 'ai' && !v ? ' acc-ai' : '') }, h('span', { class: 'ico', 'aria-hidden': 'true' }, icon(ic)), h('h3', null, t(okey(k + '.t' + (v || '')), p)), h('p', null, t(okey(k + '.d' + (v || '')), k === 'docs.fact2' ? { all: num(R.CATALOG.length), ai: num(nAi) } : null)),
        anc ? h('p', { class: 'fact-more' }, h('button', { type: 'button', class: 'linkish', 'data-fid': 'fm-' + anc, onclick: () => go('help', anc) }, t(k + '.more' + (v || '')))) : null))));
    app(page, h('div', { class: 'row' }, btn(t('docs.guide'), { kind: 'text', icon: 'help', fid: 'toguide', onclick: () => go('help') }), btn(t('docs.catalog'), { kind: 'text', icon: 'checklist', fid: 'tocat', onclick: () => go('criteria') })));
    return page;
  }

  /* ---------- Ansicht: Prüfung ---------- */
  function emptyState(ic, title, text, action) {
    return h('div', { class: 'empty' }, h('span', { class: 'ico', 'aria-hidden': 'true' }, icon(ic)), h('h2', null, title), h('p', null, text), action || null);
  }
  /** Ring des Ergebnisses. play: das Ergebnis erscheint zum ersten Mal (neue Prüfung oder neue Fassung); dann füllt sich der Ring
      einmal und die Zahl zählt hoch (nur sichtbar: im DOM steht von Anfang an der Endwert). Sonst steht er sofort am Wert. */
  function ring(pct, v, play) {
    const C = 2 * Math.PI * 54, end = (C * (1 - pct / 100)).toFixed(1);
    const bar = h('circle', { class: 'bar', cx: 66, cy: 66, r: 54, 'stroke-dasharray': C.toFixed(1), 'stroke-dashoffset': play ? C.toFixed(1) : end });
    if (play) requestAnimationFrame(() => requestAnimationFrame(() => { bar.setAttribute('stroke-dashoffset', end); }));
    return h('div', { class: 'ring' + (play ? ' count' : ''), role: 'img', 'aria-label': t('chk.ring', { p: pct }), style: { '--ring': 'var(--' + (v === 'pass' ? 'success' : v === 'warn' ? 'warning' : 'error') + ')' } },
      h('svg', { viewBox: '0 0 132 132' }, h('circle', { class: 'track', cx: 66, cy: 66, r: 54 }), bar), h('div', { class: 'mid' }, h('span', countProps(pct, play), String(pct), h('small', null, '\u00a0%'))));
  }
  /** Filter nach Schweregrad, Kategorie und Nachprüfung (neu, geblieben; nur, wenn das Dokument eine vorherige Fassung hat). */
  const inFilter = (f) => { const F = S.filter, rc = F.rc && RC; return (!F.sev || f.sev === F.sev) && (!F.cat || f.cat === F.cat) && (!rc || (F.rc === 'new' ? rc.fresh.has(f.id) : rc.stay.has(f.id))); };
  const shownOf = (all) => all.filter(f => (S.filter.hidden || !f.dismissed) && inFilter(f));
  /** Angenommene Vorschläge eines Absatzes angewendet: so liest sich der Absatz nach der Korrektur. */
  function fixedText(doc, i, all) {
    const fx = all.filter(f => f.para === i && f.fix && stOf(f) === 'accepted').map(f => f.fix).sort((a, b) => b.start - a.start || b.end - a.end);
    let out = doc.paras[i].text, floor = Infinity;
    for (const x of fx) { if (x.end > floor) continue; out = out.slice(0, x.start) + x.repl + out.slice(x.end); floor = x.start; }
    return out;
  }
  function paraLoc(doc, i) {
    const p = doc.paras[i];
    return p.loc.slide ? t('loc.slide', { n: p.loc.slide }) : p.loc.page ? t('loc.page', { n: p.loc.page }) : p.kind === 'fn' ? t('loc.fn') : t('loc.para', { n: i + 1 });
  }
  const accParas = (all) => Array.from(new Set(all.filter(f => f.fix && f.para != null && stOf(f) === 'accepted').map(f => f.para))).sort((a, b) => a - b);
  function copyPara(doc, i) {
    // writeText direkt im Klick: sonst verweigert der Browser die Zwischenablage
    navigator.clipboard.writeText(fixedText(doc, i, findingsOf(doc))).then(() => snack(t('dv.copied')), () => snack(t('dv.copy.fail')));
  }
  function copyFixed(doc) {
    const all = findingsOf(doc), ps = accParas(all);
    const txt = ps.map(i => paraLoc(doc, i) + '\n' + fixedText(doc, i, all)).join('\n\n') + '\n';
    navigator.clipboard.writeText(txt).then(() => snack(tn('exp.fix.copied', ps.length)), () => snack(t('dv.copy.fail')));
  }

  /* ---------- Überarbeiten: Auswahl, Werkzeugleiste, Schritte, Sammelentscheide ---------- */
  /** Absatz eines Befunds (null: ohne Absatz); undefined, wenn keiner gewählt ist. */
  const paraOfId = (id) => { if (!id) return undefined; const d = docById(S.cur); const f = d && findingsOf(d).find(x => x.id === id); return f ? f.para : undefined; };
  /** Wählt einen Befund. o.tb öffnet die Werkzeugleiste an der Textstelle, o.focus setzt den Fokus, o.reveal rollt 'chg' (Textstelle) oder 'card' ins Bild. */
  function select(f, o) {
    o = o || {};
    const touched = [f.para, paraOfId(S.sel), paraOfId(S.tb)];
    S.sel = f.id; S.tb = o.tb ? f.id : null;
    let full = false;
    if (S.view === 'doc' && f.para != null && f.para >= S.paraLimit) { S.paraLimit = f.para + 100; full = true; }
    S.focus = o.focus ? [].concat(o.focus) : null; S.reveal = o.reveal ? { id: f.id, what: o.reveal } : null;
    if (full) render(); else update(touched);
  }
  /** Auswahl ohne neuen Aufbau: Randkarte auf- bzw. zuklappen, Markierung im Text, Randspalte neu ausrichten. */
  function markSel(id) {
    const main = $('view');
    for (const el of main.querySelectorAll('.mc.sel, .chg.sel, .dv-row.sel')) setSelCls(el, false);
    S.sel = id;
    if (id) { const q = '[data-id="' + CSS.escape(id) + '"]'; for (const el of main.querySelectorAll('.mc' + q + ', .chg' + q)) setSelCls(el, true); }
    layoutMargin(); placeTb(); railDraw();
  }
  function setSelCls(el, on) {
    el.classList.toggle('sel', on);
    if (el.classList.contains('mc')) { const b = el.querySelector('.mc-title'), m = el.querySelector('.mc-more'); if (b) b.setAttribute('aria-expanded', String(on)); if (m) m.hidden = !on; }
    if (on) { const r = el.closest('.dv-row'); if (r) r.classList.add('sel'); }
  }
  function closeTb(focusBack) {
    const id = S.tb; S.tb = null;
    const tb = $('dvTb'); if (tb) tb.remove();
    const c = id && document.querySelector('.chg[data-id="' + CSS.escape(id) + '"]');
    if (c) { c.setAttribute('aria-expanded', 'false'); c.removeAttribute('aria-controls'); if (focusBack) c.focus(); }
  }
  function step(doc, dir) {
    const list = shownOf(findingsOf(doc)).filter(f => f.fix && stOf(f) === 'open').sort(docOrder);
    if (!list.length) { snack(t('rv.none.open')); return; }
    const cur = findingsOf(doc).find(f => f.id === S.sel);
    let f, k = cur ? list.indexOf(cur) : -1;
    if (k >= 0) f = list[(k + dir + list.length) % list.length];
    else if (!cur) f = dir > 0 ? list[0] : list[list.length - 1];
    else f = dir > 0 ? (list.find(x => docOrder(x, cur) > 0) || list[0]) : (list.slice().reverse().find(x => docOrder(x, cur) < 0) || list[list.length - 1]);
    // In der Dokumentansicht landet der Fokus auf der Änderung (wie die Einfügemarke in Word), in der Liste auf «Annehmen»
    select(f, { tb: S.view === 'doc', reveal: S.view === 'doc' ? 'chg' : 'card', focus: S.view === 'doc' ? 'chg-' + f.id : 'acc-' + f.id });
  }
  /** Filter nach Schweregrad oder Kategorie aktiv? Dann wirken Sammelentscheide und Zähler nur auf die gezeigten Vorschläge. */
  const filtered = () => !!(S.filter.sev || S.filter.cat || (S.filter.rc && RC));
  /** Sammelentscheid über alle offenen Vorschläge der aktuellen Auswahl; mit Rückgängig und, nach dem Annehmen, dem Weg zum Export. */
  function bulk(doc, st, o) {
    o = o || {};
    const pool = o.all ? findingsOf(doc) : shownOf(findingsOf(doc));
    // KI-Vorschläge mit Warnung (Namen oder Kürzel geändert) nimmt nur an, wer sie einzeln gelesen hat
    const open = pool.filter(f => f.fix && stOf(f) === 'open'), skipped = open.filter(aiFix).length;
    const targets = open.filter(f => !aiFix(f));
    if (!targets.length) { snack(skipped ? tn('rv.ai.only', skipped) : t('rv.none.open')); return; }
    const prev = targets.map(f => [f, f.accepted, f.dismissed]);
    const snaps = targets.map(f => [f, snapOf(f)]);
    for (const f of targets) setSt(f, st);
    pushUndo(snaps);
    S.tb = null; if (o.focus) S.focus = [].concat(o.focus); render();
    const back = o.focus || (st === 'accepted' ? 'bulk-all' : 'bulk-none');
    const undo = { label: t('fd.undo'), fid: 'snack-undo', run: () => { for (const [f, a, d] of prev) { f.accepted = a; f.dismissed = d; } S.focus = [].concat(back); render(); snack(t('rv.undone')); } };
    const msg = tn(st === 'accepted' ? 'rv.acc' : 'rv.rej', targets.length) + (skipped ? ' ' + tn('rv.ai.left', skipped) : '');
    snack(msg, st === 'accepted' && S.route !== 'export' ? [undo, { label: t('rv.toexp'), fid: 'snack-exp', run: () => go('export') }] : undo);
  }

  /* ---------- Dokumentansicht: Text in Lesereihenfolge, Befunde in der Randspalte ---------- */
  /** Sprache der Oberfläche als Sprachkennung; aus S.lang, damit sie beim Sprachwechsel sofort stimmt. */
  const uiLang = () => DP.i18n.LOCALE[S.lang] || S.lang;
  /** Änderung oder Markierung im Text: eine echte Schaltfläche (role=button), die Randkarte und Werkzeugleiste öffnet.
      Der Name entsteht aus dem Inhalt: Der sichtbare Text steht an seinem Platz, unsichtbarer Begleittext (.sr) sagt, was er ist,
      etwa «Vorschlag: «alt» ersetzen durch «neu», offen». So enthält der Name immer den sichtbaren Text (WCAG 2.5.3). */
  function chgNode(doc, text, it) {
    const f = it.f, st = it.st, old = text.slice(it.s, it.e), kids = [];
    const state = t('st.' + st).toLocaleLowerCase(S.lang), ui = uiLang();
    const sr = (s) => s ? h('span', { class: 'sr', lang: ui }, s) : null;
    /** Vorlage zerlegen: Platzhalter werden zu Knoten, der Rest zu unsichtbarem Text. */
    const fill = (key, nodes) => { for (const part of t(key, { state, title: t('c.' + f.crit + '.t') }).split(/(\{old\}|\{new\}|\{text\})/)) { const n = nodes[part.slice(1, -1)]; if (/^\{\w+\}$/.test(part) && n !== undefined) kids.push(n); else if (part) kids.push(sr(part)); } };
    const caret = () => h('span', { class: 'caret', 'aria-hidden': 'true' });
    if (f.fix) {
      const repl = f.fix.repl, key = old && repl ? 'dv.chg.repl' : old ? 'dv.chg.del' : 'dv.chg.ins';
      if (st === 'open') {
        const ops = f.fix.words ? DP.exporter.diffOps(old, repl, it.s) : [{ start: it.s, end: it.e, repl }];
        if (ops.length === 1 && ops[0].start === it.s && ops[0].end === it.e) fill(key, { old: h('del', null, visN(old)), new: h('ins', null, visN(repl)) });
        else {
          // Wortweise Änderung: Kontext bleibt sichtbar, jede Streichung und Einfügung trägt ihren Begleittext
          const parts = []; let pos = it.s;
          for (const o of ops) {
            if (o.start > pos) parts.push(text.slice(pos, o.start));
            if (o.end > o.start) parts.push(sr(t('dv.sr.del')), h('del', null, visN(text.slice(o.start, o.end))));
            if (o.repl) parts.push(sr(t('dv.sr.ins')), h('ins', null, visN(o.repl)));
            pos = Math.max(pos, o.end);
          }
          if (pos < it.e) parts.push(text.slice(pos, it.e));
          fill('dv.chg.words', { text: parts });
        }
      } else {
        const shown = st === 'accepted' ? repl : old;
        const vis1 = h('span', null, shown, shown.trim() ? null : caret());
        fill(key, st === 'accepted' ? { old: sr(clip(visW(old), 60)), new: vis1 } : { old: vis1, new: sr(clip(visW(repl), 60)) });
        // Bei «löschen» bzw. «einfügen» fehlt ein Platzhalter für den sichtbaren Text: dann steht er am Schluss
        if (!kids.includes(vis1)) kids.push(vis1);
      }
    } else fill('dv.mark', { text: old });
    const open = S.tb === f.id;
    const el = h('span', { class: 'chg ' + (f.fix ? 'c-' + st : 'mk mk-' + f.sev + (st === 'ignored' ? ' c-ignored' : '')) + (S.sel === f.id ? ' sel' : ''), role: 'button', tabindex: '0',
      'aria-expanded': String(open), 'aria-controls': open ? 'dvTb' : null, 'data-fid': 'chg-' + f.id, 'data-id': f.id,
      onclick: (e) => { e.stopPropagation(); if (S.tb === f.id) closeTb(false); else select(f, { tb: true, reveal: 'card', focus: 'chg-' + f.id }); },
      onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (S.tb === f.id) closeTb(true); else select(f, { tb: true, reveal: 'card', focus: 'chg-' + f.id }); } } }, kids);
    const out = [el];
    if (open) {
      const fx = f.fix, after = 'chg-' + f.id, acts = [];
      if (fx && st === 'open') acts.push(btn(t('fd.accept'), { kind: 'sm', icon: 'check', fid: 'tb-acc', tip: t('tip.accept'), onclick: () => decide(f, 'accepted', after, 'tb') }), btn(t('fd.reject'), { kind: 'outlined sm', icon: 'close', fid: 'tb-rej', tip: t('tip.reject'), onclick: () => decide(f, 'rejected', after, 'tb') }));
      else if (fx) acts.push(btn(t('fd.reset'), { kind: 'outlined sm', icon: 'undo', fid: 'tb-rst', tip: t('tip.reset'), onclick: () => decide(f, 'open', after, 'tb') }));
      else acts.push(st === 'ignored' ? btn(t('fd.restore'), { kind: 'outlined sm', icon: 'undo', fid: 'tb-ign', tip: t('tip.restore'), onclick: () => decide(f, 'open', after, 'tb') }) : btn(t('fd.ignore'), { kind: 'outlined sm', icon: 'visibility_off', fid: 'tb-ign', tip: t('tip.ignore'), onclick: () => decide(f, 'ignored', after, 'tb') }));
      acts.push(iconBtn('arrow_forward', t('rv.next.l'), () => step(doc, 1), { fid: 'tb-next', kind: 'flat', tip: t('tip.next') }));
      out.push(h('span', { class: 'dv-tb', id: 'dvTb', role: 'group', 'aria-label': t('dv.tb'), lang: uiLang(), onclick: (e) => e.stopPropagation() }, acts));
    }
    return out;
  }
  /** Zwei Stellen überschneiden sich (eine Einfügung nur, wenn sie im Inneren der anderen liegt). */
  const clash = (a, b) => Math.max(a.s, b.s) < Math.min(a.e, b.e) || (a.s === a.e && b.s < a.s && a.s < b.e) || (b.s === b.e && a.s < b.s && b.s < a.e);
  /** Text eines Absatzes mit seinen Befunden. Vorschläge haben Vorrang: zuerst die Vorschläge (bei Überschneidung gewinnt der erste),
      danach die Markierungen ohne Vorschlag, soweit sie keine gesetzte Stelle überschneiden. Die übrigen stehen nur am Rand, mit Textstelle. */
  function inlineNodes(doc, text, fs, inl) {
    const items = [];
    for (const f of fs) {
      if (f.fix) items.push({ f, st: stOf(f), s: f.fix.start, e: f.fix.end });
      else if (f.start != null && f.end > f.start) items.push({ f, st: stOf(f), s: f.start, e: f.end });
    }
    const byPos = (a, b) => a.s - b.s || a.e - b.e;
    const placed = [];
    for (const it of items.filter(x => x.f.fix).sort(byPos).concat(items.filter(x => !x.f.fix).sort(byPos))) {
      if (it.e > text.length || it.s < 0 || placed.some(p => clash(p, it))) continue;
      placed.push(it);
    }
    placed.sort(byPos);
    const out = []; let pos = 0;
    for (const it of placed) {
      if (it.s > pos) out.push(text.slice(pos, it.s));
      out.push(chgNode(doc, text, it)); inl.add(it.f.id);
      pos = Math.max(pos, it.e);
    }
    if (pos < text.length) out.push(text.slice(pos));
    return out;
  }
  /** Kompakte Karte in der Randspalte, wie ein Kommentar in Word: Titel, Kennung und Entscheid in ein bis zwei Zeilen.
      Gewählt (Klick, Fokus in der Karte oder über die Stelle im Text) zeigt sie Erklärung, Textstelle und weitere Aktionen. */
  function marginCard(f, doc, inline) {
    const st = stOf(f), open = S.sel === f.id, mid = 'mcm-' + f.id;
    const card = h('article', { class: 'mc ' + f.sev + ' st-' + st + (open ? ' sel' : ''), 'data-id': f.id, 'aria-labelledby': 'mct-' + f.id,
      onclick: (e) => { if (e.target.closest('button, input, a, [role="button"]')) return; e.stopPropagation(); if (S.sel !== f.id) markSel(f.id); reveal({ id: f.id, what: 'chg' }); },
      onfocusin: () => { if (S.sel !== f.id) markSel(f.id); } });
    const more = h('div', { class: 'mc-more', id: mid, hidden: !open },
      h('div', { class: 'mc-tags' }, h('span', { class: 'tag sev-' + f.sev }, t('sev.' + f.sev)), f.cmp ? h('span', { class: 'tag cmp' }, h('span', { class: 'swatch acc-cmp', 'aria-hidden': 'true' }), t('src.compare')) : null),
      h('p', { class: 'mc-msg' }, msgOf(f)));
    if (!inline && f.para != null) { const q = quoteNode(f, doc, 30); if (q) app(more, q); }
    app(more, rwNote(f));
    if (f.hint) app(more, h('blockquote', { class: 'quote', lang: doc.lang }, h('span', { class: 'lbl' }, t('fd.suggest')), f.hint));
    if (f.bt) app(more, h('blockquote', { class: 'quote ref', lang: f.btLang || null }, h('span', { class: 'lbl' }, t('bt.col.plain')), f.bt));
    const sec = findActions(f, card, 'm-', 'edit').concat(rwActs(f, doc, 'm-'));
    if (sec.length) app(more, h('div', { class: 'find-actions mc-sec' }, sec));
    app(more, faNoteField(f, 'm-'));
    app(card,
      h('div', { class: 'mc-top' }, h('span', { class: 'sev-ico', 'aria-hidden': 'true' }, icon(SEV_ICON[f.sev], 'sm')),
        h('button', { type: 'button', class: 'mc-title', id: 'mct-' + f.id, 'data-fid': 'sel-' + f.id, 'aria-expanded': String(open), 'aria-controls': mid,
          // Zustand vor dem Mausdruck merken: der Fokus beim Drücken klappt die Karte schon auf (focusin), der Klick soll sie dann nicht gleich wieder zuklappen
          onpointerdown: (e) => { e.currentTarget.dataset.was = String(S.sel === f.id); },
          onclick: (e) => { e.stopPropagation(); const b = e.currentTarget, was = b.dataset.was ? b.dataset.was === 'true' : S.sel === f.id; delete b.dataset.was;
            if (was) markSel(null); else { markSel(f.id); reveal({ id: f.id, what: 'chg', near: true }); } } }, t('c.' + f.crit + '.t')),
        rcTag(f),
        // KI: Befund von Claude oder Vorschlag von Claude zu einem Befund der Regeln
        f.source === 'ai' || (f.fix && f.fixAi) ? h('span', { class: 'tag ai' }, h('span', { class: 'swatch acc-ai', 'aria-hidden': 'true' }), t('src.ai')) : null,
        h('span', { class: 'tag id' }, f.crit)),
      h('div', { class: 'find-actions mc-acts' }, findActions(f, card, 'm-', 'main'), stTag(f)),
      more);
    return card;
  }
  /** Legende, wenn Vorschläge des Dokuments unsichtbare Zeichen enthalten (⍽, ␣). */
  function usesVis(doc, all) { return all.some(f => f.fix && f.para != null && doc.paras[f.para] && (hasVis(f.fix.repl) || hasVis(doc.paras[f.para].text.slice(f.fix.start, f.fix.end)))); }
  const visLegend = () => h('p', { class: 'help dv-help' }, icon('info', 'sm'), h('span', null, t('leg.vis')));
  /** Eine Zeile der Dokumentansicht: Absatz und Kartenstapel. */
  function buildRow(doc, i, fs, canCopy) {
    const p = doc.paras[i];
    fs = fs.slice().sort((a, b) => posOf(a) - posOf(b) || SEV_ORDER[a.sev] - SEV_ORDER[b.sev]);
    const inl = new Set();
    const kind = p.kind === 'h' ? 'k-h l' + Math.min(Math.max(p.level || 1, 1), 4) : 'k-' + p.kind;
    const pin = S.pin && S.pin.para === i;
    const text = h('div', { class: 'dv-p ' + kind, lang: doc.lang, 'data-p': i, tabindex: pin ? '-1' : null, 'data-fid': pin ? 'pin-p' : null, style: p.kind === 'li' && p.level ? { '--lvl': Math.min(p.level, 4) } : null }, inlineNodes(doc, p.text, fs, inl));
    const cards = [canCopy.has(i) ? btn(t('dv.copy'), { kind: 'outlined sm', icon: 'content_copy', fid: 'cpp-' + i, tip: t('tip.copyPara'), onclick: () => copyPara(doc, i) }) : null, fs.map(f => marginCard(f, doc, inl.has(f.id)))];
    const margin = h('div', { class: 'dv-margin' }, canCopy.has(i) || fs.length ? h('div', { class: 'dv-stack' }, cards) : null);
    return h('div', { class: 'dv-row' + (fs.some(f => f.id === S.sel) ? ' sel' : '') + (pin ? ' pin' : ''), 'data-row': i }, text, margin);
  }
  function viewDocument(doc, shown, all) {
    const wrap = h('div', { class: 'dv' }, h('p', { class: 'help dv-help' }, icon('info', 'sm'), h('span', null, t('dv.help') + (usesVis(doc, all) ? ' ' + t('leg.vis') : ''))));
    // Übersicht am Rand (fest positioniert): früh in der Tabulatorfolge, vor den Befunden
    app(wrap, railEl(doc));
    // Folienbefunde ohne Absatz stehen am Rand der Foliengrenze, alle übrigen ohne Absatz unter «Ganzes Dokument»
    const bySlide = new Map();
    if (doc.format === 'pptx') for (const f of shown) if ((f.para == null || !doc.paras[f.para]) && f.slide && doc.paras.some(p => p.loc.slide === f.slide)) { let l = bySlide.get(f.slide); if (!l) bySlide.set(f.slide, l = []); l.push(f); }
    const onSlide = new Set(Array.from(bySlide.values()).flat());
    const general = shown.filter(f => (f.para == null || !doc.paras[f.para]) && !onSlide.has(f)).sort((a, b) => SEV_ORDER[a.sev] - SEV_ORDER[b.sev]);
    if (general.length) app(wrap, h('section', { class: 'dv-general', 'aria-labelledby': 'dvGen' }, h('h2', { id: 'dvGen' }, t('fd.doc'), h('span', { class: 'n' }, num(general.length))), h('div', { class: 'dv-gen-list' }, general.map(f => marginCard(f, doc, false)))));
    const byPara = new Map();
    for (const f of shown) if (f.para != null && doc.paras[f.para]) { let l = byPara.get(f.para); if (!l) byPara.set(f.para, l = []); l.push(f); }
    const canCopy = doc.format !== 'docx' ? new Set(accParas(all)) : new Set();
    const rows = h('div', { class: 'dv-rows' });
    const n = Math.min(doc.paras.length, S.paraLimit);
    const sep = (label, fs) => h('div', { class: 'dv-row dv-row-sep' + (fs && fs.some(f => f.id === S.sel) ? ' sel' : '') }, h('div', { class: 'dv-sep' }, h('span', null, label)), h('div', { class: 'dv-margin' }, fs && fs.length ? h('div', { class: 'dv-stack' }, fs.map(f => marginCard(f, doc, false))) : null));
    let lastLoc = null, fnSep = false;
    for (let i = 0; i < n; i++) {
      const p = doc.paras[i];
      const loc = doc.format === 'pdf' ? p.loc.page : doc.format === 'pptx' ? p.loc.slide : null;
      if (loc != null && loc !== lastLoc) { app(rows, sep(t(doc.format === 'pdf' ? 'loc.page' : 'loc.slide', { n: loc }), bySlide.get(loc))); lastLoc = loc; }
      if (p.kind === 'fn' && !fnSep) { app(rows, sep(t('dv.fn'))); fnSep = true; }
      app(rows, buildRow(doc, i, byPara.get(i) || [], canCopy));
    }
    // Verbindungslinie zwischen gewählter Randkarte und Textstelle (Überlagerung ohne Zeigerereignisse)
    app(rows, h('div', { class: 'dv-link', id: 'dvLink', 'aria-hidden': 'true', hidden: true }, h('span', { class: 'l1' }), h('span', { class: 'l2' }), h('span', { class: 'l3' })));
    app(wrap, rows);
    if (doc.paras.length > n) app(wrap, h('div', null, btn(t('dv.more', { n: num(doc.paras.length - n) }), { kind: 'tonal', icon: 'south', fid: 'more-p', onclick: () => { S.paraLimit += 300; render(); } })));
    return wrap;
  }
  function viewList(doc, shown, all, page) {
    if (usesVis(doc, all)) app(page, visLegend());
    if (!shown.length) app(page, emptyState('verified', t('chk.none.t'), all.length ? t('chk.none.d') : t('verdict.pass.d')));
    let i = 0;
    for (const k of R.CATS) {
      const group = shown.filter(f => f.cat === k).sort((a, b) => SEV_ORDER[a.sev] - SEV_ORDER[b.sev] || (a.para == null ? -1 : a.para) - (b.para == null ? -1 : b.para) || (a.start || 0) - (b.start || 0));
      if (!group.length) continue;
      app(page, h('h2', { class: 'group-head' }, h('span', { class: 'ico', 'aria-hidden': 'true' }, icon(CAT_ICON[k], 'sm')), t('cat.' + k), h('span', { class: 'n' }, num(group.length))));
      const room = Math.max(0, S.limit - i);
      app(page, h('div', { class: 'finds' }, group.slice(0, room).map(f => findCard(f, doc, i++))));
      if (group.length > room) { i += group.length - room; }
    }
    if (shown.length > S.limit) app(page, h('div', null, btn(t('more.findings', { n: num(shown.length - S.limit) }), { kind: 'tonal', icon: 'south', fid: 'more-f', onclick: () => { S.limit += 300; render(); } })));
  }
  function reviewBar(doc, all) {
    const F = S.filter, filt = filtered();
    // Mit Filter beziehen sich Zähler und Sammelentscheide auf die gezeigten Vorschläge
    const pool = filt ? all.filter(inFilter) : all;
    const sugg = pool.filter(f => f.fix), nOpen = sugg.filter(f => stOf(f) === 'open').length, nAi = sugg.filter(f => stOf(f) === 'open' && aiFix(f)).length;
    const bulkTip = (filt ? t('tip.bulk.shown') : t('tip.bulk')) + (nAi ? ' ' + tn('tip.bulk.ai', nAi) : '');
    const chip = (label, pressed, onclick, fid, extra, cls, tip) => h('button', { type: 'button', class: 'chip ' + (cls || ''), 'aria-pressed': String(pressed), 'data-fid': fid, 'data-tip': tip, onclick }, extra || null, label);
    const liveAll = live(all), c = liveCounts(all);
    const cats = R.CATS.filter(k => liveAll.some(f => f.cat === k) || F.cat === k);
    const catSel = h('div', { class: 'tb-field' }, h('label', { for: 'catFilter' }, t('chk.f.cat')),
      h('select', { id: 'catFilter', 'data-fid': 'catFilter', 'data-tip': t('tip.cat'), onchange: (e) => { F.cat = e.target.value || null; render(); } },
        h('option', { value: '', selected: !F.cat }, t('chk.f.all')), cats.map(k => h('option', { value: k, selected: F.cat === k }, t('cat.' + k)))));
    const setView = (v) => { S.view = v; S.tb = null; S.pin = null; render(); };
    const seg = h('div', { class: 'seg view-seg', role: 'group', 'aria-label': t('chk.view') },
      h('button', { type: 'button', 'aria-pressed': String(S.view === 'doc'), 'data-fid': 'view-doc', 'data-tip': t('tip.viewDoc'), onclick: () => setView('doc') }, icon('article', 'sm'), t('chk.view.doc')),
      h('button', { type: 'button', 'aria-pressed': String(S.view === 'list'), 'data-fid': 'view-list', 'data-tip': t('tip.viewList'), onclick: () => setView('list') }, icon('checklist', 'sm'), t('chk.view.list')),
      // Pflichtenmatrix: dritte Ansicht der Prüfung; in der Offline-Ausgabe gibt es sie nicht
      DP.offline ? null : h('button', { type: 'button', 'aria-pressed': String(S.view === 'duty'), 'data-fid': 'view-duty', 'data-tip': t('tip.viewDuty'), onclick: () => setView('duty') }, icon('table', 'sm'), t('chk.view.duty')));
    if (S.view === 'duty') return h('section', { class: 'toolbar review-bar', id: 'rvBar', 'aria-label': t('rv.label') }, h('div', { class: 'rv-row' }, seg,
      h('span', { class: 'rv-count', id: 'rvCount', tabindex: '-1' }, dutyCount(doc)),
      h('div', { class: 'rv-acts' }, btn(t('rv.export'), { kind: 'outlined sm', icon: 'download', fid: 'rv-export', onclick: () => go('export') }))));
    const row1 = h('div', { class: 'rv-row' }, seg,
      // tabindex −1: stabiles Fokusziel, wenn die bearbeitete Stelle nach einem Entscheid verschwindet
      h('span', { class: 'rv-count', id: 'rvCount', tabindex: '-1' }, sugg.length ? (filt ? tn('rv.count.f', sugg.length, { a: num(nOpen) }) : tn('rv.count', sugg.length, { a: num(nOpen) })) : filt ? t('rv.none.f') : t('rv.none')),
      sugg.length ? h('div', { class: 'rv-step' },
        btn(t('rv.prev'), { kind: 'text sm', icon: 'arrow_back', fid: 'rv-prev', tip: t('tip.prev'), onclick: () => step(doc, -1) }),
        btn(t('rv.next'), { kind: 'text sm', icon: 'arrow_forward', fid: 'rv-next', tip: t('tip.next'), onclick: () => step(doc, 1) })) : null,
      h('div', { class: 'rv-acts' },
        sugg.length ? btn(filt ? t('chk.bulk.shown') : t('chk.bulk.all'), { kind: 'text sm', icon: 'done_all', fid: 'bulk-all', tip: bulkTip, onclick: () => bulk(doc, 'accepted') }) : null,
        sugg.length ? btn(filt ? t('chk.bulk.shown.none') : t('chk.bulk.none'), { kind: 'text sm', icon: 'remove_done', fid: 'bulk-none', tip: bulkTip, onclick: () => bulk(doc, 'rejected') }) : null,
        btn(t('rv.export'), { kind: 'outlined sm', icon: 'download', fid: 'rv-export', onclick: () => go('export') }),
        iconBtn('keyboard', t('kb.btn'), () => kbDialog(), { fid: 'kb-help', kind: 'flat', tip: t('tip.kb') })));
    const row2 = h('div', { class: 'rv-row' },
      h('div', { class: 'chips', role: 'group', 'aria-label': t('chk.filter') },
        chip(t('chk.f.all'), !F.sev && !F.cat && !(F.rc && RC), () => { F.sev = null; F.cat = null; F.rc = null; render(); }, 'f-all', h('span', { class: 'n' }, num(liveAll.length))),
        ['error', 'warn', 'info'].map(s => chip(t('sev.' + s + '.n'), F.sev === s, () => { F.sev = F.sev === s ? null : s; render(); }, 'f-' + s, h('span', { class: 'n' }, num(c[s])), 'sev-' + s)),
        chip(t('chk.f.hidden'), F.hidden, () => { F.hidden = !F.hidden; render(); }, 'f-hidden', icon(F.hidden ? 'visibility' : 'visibility_off', 'sm'), null, t('tip.hidden'))),
      // Nachprüfung: nur neue bzw. nur gebliebene Befunde
      RC ? h('div', { class: 'chips', role: 'group', 'aria-label': t('rc.f') }, [['new', RC.fresh], ['stay', RC.stay]].map(([k, set]) =>
        chip(t('rc.f.' + k), F.rc === k, () => { F.rc = F.rc === k ? null : k; render(); }, 'f-rc-' + k, h('span', { class: 'n' }, num(liveAll.filter(f => set.has(f.id)).length)), null, t('tip.rc.' + k)))) : null,
      cats.length > 1 || F.cat ? catSel : null);
    return h('section', { class: 'toolbar review-bar', id: 'rvBar', 'aria-label': t('rv.label') }, row1, row2);
  }
  /** Ergebnis: Ring, Urteil und Kennzahlen links, erfüllte Kriterien kompakt rechts (zuklappbar). Angenommene Vorschläge gelten als erledigt. */
  function summaryCard(doc) {
    const all = findingsOf(doc), c = countsOf(all), v = verdictOf(c), m = metOf(doc), nAcc = nAccepted(all);
    // Hochzählen einmal je Prüfergebnis (S.res[doc.id] entsteht neu bei einem neuen Dokument und bei einer neuen Fassung)
    const r = S.res[doc.id], play = !!r && !ringSeen.has(r) && S.route === 'check' && motionOk();
    if (r) ringSeen.add(r);
    const main = h('div', { class: 'sum-main' }, ring(m.pct, v, play),
      h('div', { class: 'sum-text' }, h('h2', null, t('verdict.' + v)), h('p', { class: 'sub' }, t('verdict.' + v + '.d')),
        nAcc ? h('p', { class: 'sum-acc' }, icon('check', 'sm'), h('span', null, t('chk.withacc'))) : null,
        h('p', { class: 'help met' }, t('chk.met', { a: m.met.length, b: m.checked.size })),
        h('div', { class: 'stats' }, ['error', 'warn', 'info'].map(s => h('div', { class: 'stat ' + s }, h('b', countProps(c[s], play), num(c[s])), t('sev.' + s + '.n'))),
          h('div', { class: 'stat acc' + (nAcc ? '' : ' zero') }, h('b', countProps(nAcc, play), num(nAcc)), t('chk.st.acc')))));
    let metBox = null;
    if (m.met.length) {
      const LIM = 12, list = R.CATALOG.filter(x => m.met.includes(x.id)), cut = !S.metAll && list.length > LIM + 2;
      const items = (cut ? list.slice(0, LIM) : list).map(x => h('li', null, icon('check', 'sm c-ok'), h('span', { class: 'tag id' }, x.id), h('span', null, t('c.' + x.id + '.t'))));
      metBox = h('details', { class: 'met-box', id: 'metList', open: S.metOpen, ontoggle: (e) => { if (e.target === e.currentTarget) { S.metOpen = e.target.open; updateClear(); } } },
        h('summary', { 'data-fid': 'd-met' }, icon('check_circle_fill', 'sm c-ok'), h('span', null, t('chk.passed', { n: m.met.length })), icon('expand_more', 'chev')),
        h('ul', { id: 'metUl' }, items),
        list.length > LIM + 2 ? h('button', { type: 'button', class: 'btn text sm met-more', 'data-fid': 'met-all', 'aria-expanded': String(!cut), 'aria-controls': 'metUl',
          onclick: () => { S.metAll = !S.metAll; S.focus = ['met-all']; update([]); } }, cut ? t('chk.met.all', { n: num(list.length) }) : t('chk.met.less')) : null);
    }
    const card = h('section', { class: 'card summary' + (metBox ? ' has-met' : ''), id: 'sumCard', 'aria-label': doc.name }, main, metBox);
    if (play) countDone(card);
    return card;
  }
  /** Band der Nachprüfung: Zahlen erledigt, geblieben, neu; darunter die erledigten Befunde der vorherigen Fassung (zuklappbar). */
  function rcBand(doc, rc) {
    const v = S.versions[doc.id], old = { paras: v.paras, format: v.format };
    const list = rc.resolved.slice().sort((a, b) => (a.para == null ? -1 : a.para) - (b.para == null ? -1 : b.para) || (a.start || 0) - (b.start || 0));
    const LIM = 8, cut = !S.rcAll && list.length > LIM + 2;
    const RCK = { done: (n) => tn('rc.done', n), stay: (n) => tn('rc.stay', n), new: (n) => tn('rc.new', n) };
    const cnt = (k, n) => h('span', { class: 'rc-n rc-' + k }, h('b', null, num(n)), ' ' + RCK[k](n));
    const items = (cut ? list.slice(0, LIM) : list).map(o => h('li', null, icon('check', 'sm c-ok'), h('span', { class: 'tag id' }, o.crit),
      h('span', { class: 'rc-what' }, h('span', { class: 'rc-t' }, t('c.' + o.crit + '.t')), o.quote ? h('span', { class: 'rc-q', lang: v.lang }, '«' + clip(o.quote, 90) + '»') : null, h('small', null, locOf(o, old)))));
    return h('section', { class: 'card rc-band', id: 'rcBand', 'aria-labelledby': 'rcT' },
      h('h2', { class: 'rc-head', id: 'rcT' }, icon('history', 'sm'), h('span', null, t('rc.h', { name: v.name }))),
      h('p', { class: 'rc-counts' }, cnt('done', rc.resolved.length), cnt('stay', rc.stay.size), cnt('new', rc.fresh.size)),
      h('p', { class: 'help' }, t('rc.d'), rc.skipped.length ? ' ' + tn('rc.skip', rc.skipped.length) : ''),
      list.length ? h('details', { class: 'met-box rc-box', id: 'rcList', open: S.rcOpen, ontoggle: (e) => { if (e.target === e.currentTarget) { S.rcOpen = e.target.open; updateClear(); } } },
        h('summary', { 'data-fid': 'd-rc' }, icon('check_circle_fill', 'sm c-ok'), h('span', null, t('rc.list', { n: num(list.length) })), icon('expand_more', 'chev')),
        h('ul', { id: 'rcUl' }, items),
        list.length > LIM + 2 ? h('button', { type: 'button', class: 'btn text sm met-more', 'data-fid': 'rc-all', 'aria-expanded': String(!cut), 'aria-controls': 'rcUl',
          onclick: () => { S.rcAll = !S.rcAll; S.focus = ['rc-all']; render(); } }, cut ? t('chk.met.all', { n: num(list.length) }) : t('chk.met.less')) : null)
        : h('p', { class: 'help' }, t('rc.list.none')));
  }
  function viewCheck() {
    const page = h('div', { class: 'page page-check' });
    const doc = docById(S.cur);
    // «Neue Fassung laden» rechts neben dem Titel: braucht keine eigene Zeile über dem Text
    app(page, h('header', { class: 'page-head' }, h('div', { class: 'ph-row' }, h('h1', null, t('chk.h')),
      doc ? btn(t('ver.load'), { kind: 'text sm', icon: 'file_diff', fid: 'chk-ver', tip: t('tip.verLoad'), onclick: () => pickVersion(doc, 'chk-ver') }) : null)));
    if (!doc) { app(page, emptyState('fact_check', t('chk.empty.t'), t('chk.empty.d'), btn(t('chk.empty.b'), { icon: 'upload_file', onclick: () => go('docs') }))); return page; }
    const tabs = docTabs(t('chk.doc')); if (tabs) app(page, tabs);
    RC = recheckOf(doc);
    const all = findingsOf(doc), m = metOf(doc), r = S.res[doc.id];
    // Erfüllte Kriterien zuerst, in der Ergebniskarte: offen, kompakt, zuklappbar; bei einer neuen Fassung danach die erledigten Befunde
    app(page, summaryCard(doc));
    if (RC) app(page, rcBand(doc, RC));
    if (doc.meta.classification) app(page, h('div', { class: 'notice' }, icon('gpp_maybe'), h('span', null, t('f.F06', { label: doc.meta.classification.label }))));
    const chp = changedParams(true);
    if (chp.length) {
      const crits = Array.from(new Set(chp.map(p => p.crit)));
      app(page, h('div', { class: 'par-hint' }, icon('tune', 'sm'), h('p', null, t('chk.params', { list: crits.map(id => id + ' ' + t('c.' + id + '.t')).join(', ') }), ' ',
        h('button', { type: 'button', class: 'linkish', 'data-fid': 'par-hint', onclick: () => { for (const id of crits) S.critOpen.add(R.BY_ID[id].cat); go('criteria'); } }, t('chk.params.go')))));
    }
    const li = (id, note, ic, cls) => h('li', null, icon(ic, 'sm ' + cls), h('span', null, h('span', { class: 'tag id' }, id), ' ' + t('c.' + id + '.t'), note ? h('small', null, note) : null));
    const qOn = R.CATALOG.filter(x => x.cat === 'quality' && !x.duty && !S.settings.off.has(x.id) && (x.id !== 'Q07' || S.settings.custom.trim()));
    app(page, aiCard({ id: 'aiDoc', compact: true, title: t('chk.ai.t'), desc: t('chk.ai.d'), state: r.aiState, prog: r.aiProg || [1, 1], runKey: 'chk.ai.run', err: r.aiErr, pause: true,
      extra: r.aiPlan && r.aiPlan.cut && r.aiState !== 'running' ? [h('p', { class: 'help', 'data-fid': 'aiDoc-cut' }, t('chk.ai.cut', { n: num(r.aiPlan.sent), m: num(r.aiPlan.total) }))] : null, start: t('chk.ai.start'), again: t('chk.ai.again'), allOff: !qOn.length, tip: t('tip.aiDoc'), run: () => startAi(doc), stop: () => r.ctl && r.ctl.abort() }));
    app(page, reviewBar(doc, all));
    const shown = shownOf(all);
    if (S.view === 'doc') app(page, viewDocument(doc, shown, all)); else if (S.view === 'duty' && !DP.offline) viewDuty(doc, page); else viewList(doc, shown, all, page);
    // X17 ist keine Prüfung, sondern ein von Hand festgehaltener Befund; in der Offline-Ausgabe entfallen die Lücken der Pflichtenmatrix
    const notRun = R.CATALOG.filter(x => !m.checked.has(x.id) && !x.manual && !(DP.offline && x.duty) && R.applies(x, doc) && !(x.custom && x.id === 'T09' && !S.settings.terms.length) && !(x.id === 'Q07' && !S.settings.custom.trim()));
    if (notRun.length) app(page, h('details', { class: 'more' }, h('summary', { 'data-fid': 'd-not' }, icon('info'), t('chk.notrun', { n: notRun.length }), icon('expand_more', 'chev')), h('ul', null, notRun.map(x => li(x.id, S.settings.off.has(x.id) ? t('chk.notrun.off') : x.duty ? t(x.cmp ? 'chk.notrun.dutycmp' : 'chk.notrun.duty') : x.cmp && !Object.values(S.cmp).some(cm => cm.tgt === doc.id) ? t('chk.notrun.cmp') : x.ai ? t('chk.notrun.ai') : t('chk.notrun.cmp'), 'info', '')))));
    return page;
  }

  /* ---------- Ansicht: Sprachvergleich ---------- */
  function markText(text, ranges) {
    if (!ranges.length) return [text];
    ranges = ranges.slice().sort((a, b) => a.start - b.start);
    const out = []; let pos = 0;
    for (const r of ranges) { if (r.start < pos) continue; if (r.start > pos) out.push(text.slice(pos, r.start)); out.push(h('mark', { class: r.sev }, text.slice(r.start, r.end))); pos = r.end; }
    if (pos < text.length) out.push(text.slice(pos));
    return out;
  }
  /** Zeile eines Vergleichs zu einem Befund: über den Referenzabsatz, sonst über den Absatz der Zielfassung. */
  function rowFinder(cmp) {
    const byA = new Map(), byB = new Map();
    for (const r of cmp.rows) { if (r.a.length) byA.set(r.a[0], r.row); for (const i of r.b) if (!byB.has(i)) byB.set(i, r.row); }
    return (f) => f.refPara && f.refPara.length ? byA.get(f.refPara[0]) : byB.get(f.para);
  }
  const langLbl = (d) => cap(t('lang.' + d.lang));
  /** Sprachpaar als Etikett: sichtbar «DE → FR», für Screenreader in Worten. */
  function pairTag(ref, tgt) {
    return h('span', { class: 'tag pair' }, h('span', { 'aria-hidden': 'true' }, t('cmp.pair', { a: ref.lang.toUpperCase(), b: tgt.lang.toUpperCase() })), h('span', { class: 'sr' }, t('cmp.pair.sr', { a: langLbl(ref), b: t('lang.' + tgt.lang) })));
  }
  /** Zelle der Gegenüberstellung: Absätze mit markierten Stellen (ranges je Absatz). */
  function segCell(doc, idx, mob, none, ranges) {
    // Spaltenname (.mob): sichtbar, wenn die Spalten gestapelt sind, sonst nur für Screenreader; in der Sprache der Oberfläche
    const lbl = () => h('span', { class: 'mob', lang: uiLang() }, mob, h('span', { class: 'sr' }, ': '));
    if (!idx.length) return h('div', { class: 'cell none' }, lbl(), none);
    const head = idx.some(i => doc.paras[i].kind === 'h' || doc.paras[i].kind === 'title');
    const el = h('div', { class: 'cell' + (head ? ' h' : ''), lang: doc.lang }, lbl());
    idx.forEach((i, k) => { if (k) app(el, '\n'); add(el, markText(doc.paras[i].text, ranges(i))); });
    return el;
  }
  const tgtRanges = (fs) => (i) => fs.filter(f => f.para === i && f.start != null && !f.dismissed).map(f => ({ start: f.start, end: f.end, sev: f.sev }));
  const refRanges = (fs) => (i) => fs.filter(f => f.refMark && f.refMark.para === i && !f.dismissed).map(f => ({ start: f.refMark.start, end: f.refMark.end, sev: f.sev }));
  const worstOf = (fs) => fs.length ? fs.map(f => f.sev).sort((x, y) => SEV_ORDER[x] - SEV_ORDER[y])[0] : null;
  const rowSev = (w) => w ? { '--rowsev': 'var(--' + (w === 'error' ? 'error' : w === 'warn' ? 'warning' : 'ink-subtle') + ')' } : null;
  function cmpStats(cmp, all) {
    const liveAll = live(all), c = countsOf(all);
    return [h('div', { class: 'stats', style: { 'margin-top': '0' } },
      h('div', { class: 'stat' }, h('b', null, num(cmp.stats.aligned)), t('cmp.st.aligned')),
      h('div', { class: 'stat ' + (cmp.stats.missing ? 'error' : '') }, h('b', null, num(cmp.stats.missing)), t('cmp.st.missing')),
      h('div', { class: 'stat ' + (cmp.stats.extra ? 'warn' : '') }, h('b', null, num(cmp.stats.extra)), t('cmp.st.extra')),
      h('div', { class: 'stat ' + (c.error ? 'error' : c.warn ? 'warn' : '') }, h('b', null, num(liveAll.length)), t('cmp.st.findings'))), countsNode(c)];
  }
  function viewCompare() {
    const page = h('div', { class: 'page' });
    app(page, h('header', { class: 'page-head' }, h('h1', null, t('cmp.h')), h('p', { class: 'lead' }, t('cmp.lead'))));
    if (S.docs.length < 2) { app(page, emptyState('compare_arrows', t('cmp.empty.t'), t('cmp.empty.d'), btn(t('chk.empty.b'), { icon: 'upload_file', onclick: () => go('docs') }))); return page; }
    suggestPair();
    const tri = S.cmpMode === 'tri' && S.docs.length >= 3;
    // Rückübersetzung gehört zum gewählten Paar: ein anderes Paar verwirft sie
    if (S.bt && S.bt.id !== S.ref + '>' + S.tgt) dropBt();
    if (S.docs.length >= 3) {
      const mode = (m, ic) => h('button', { type: 'button', 'aria-pressed': String(S.cmpMode === m), 'data-fid': 'cmp-mode-' + m, 'data-tip': t('tip.cmpMode'), onclick: () => { if (S.cmpMode === m) return; S.cmpMode = m; S.focus = ['cmp-mode-' + m]; render(); } }, icon(ic, 'sm'), t('cmp.mode.' + m));
      app(page, h('div', { class: 'cmp-mode' }, h('span', { class: 'cmp-mode-l', id: 'cmpModeL' }, t('cmp.mode')),
        h('div', { class: 'seg view-seg', role: 'group', 'aria-labelledby': 'cmpModeL' }, mode('pair', 'compare_arrows'), mode('tri', 'view_column'))));
    }
    const sel = (id, label, value, onchange) => h('div', { class: 'field' }, h('label', { for: id }, label), h('select', { id, 'data-fid': id, onchange: (e) => { onchange(e.target.value); S.enter = true; render(); } }, S.docs.map(d => h('option', { value: d.id, selected: d.id === value }, d.name + ' (' + cap(t('lang.' + d.lang)) + ')'))));
    const swap = iconBtn('swap_horiz', t('cmp.swap'), () => { const x = S.ref; S.ref = S.tgt; S.tgt = x; S.enter = true; render(); }, { kind: 'tonal', fid: 'swap', tip: t('tip.swap') });
    app(page, h('section', { class: 'card tight pick' + (tri ? ' tri' : '') }, sel('cmpRef', t('cmp.ref'), S.ref, (v) => { S.ref = v; }), swap,
      sel('cmpTgt', tri ? t('cmp.tgt1') : t('cmp.tgt'), S.tgt, (v) => { S.tgt = v; }), tri ? sel('cmpTgt2', t('cmp.tgt2'), S.tgt2, (v) => { S.tgt2 = v; }) : null));
    if (tri) return viewCompareTri(page);
    const cmp = ensureCmp();
    if (!cmp) { app(page, h('div', { class: 'notice plain' }, icon('info'), h('span', null, t('cmp.same')))); return page; }
    const ref = docById(cmp.ref), tgt = docById(cmp.tgt);
    if (ref.lang === tgt.lang) app(page, h('div', { class: 'notice' }, icon('warning_fill'), h('span', null, t('cmp.samelang', { lang: cap(t('lang.' + ref.lang)) }))));
    if (!cmpShown(cmp)) { app(page, mismatchNote(cmp)); return page; }
    const st = S.cmpAi[cmp.id] || { state: 'idle', list: [], prog: [1, 1] };
    const all = cmp.findings.concat(extraOf(cmp.id)), liveAll = live(all);
    app(page, h('section', { class: 'card tight', 'aria-label': t('cmp.st.findings') }, h('div', { class: 'row between' }, cmpStats(cmp, all)), h('p', { class: 'help', style: { 'margin-top': 'var(--space-sm)' } }, t('cmp.to.export'))));
    const xOn = ['X09', 'X10'].some(x => !S.settings.off.has(x));
    app(page, aiCard({ id: 'aiCmp', title: t('cmp.ai.t'), desc: t('cmp.ai.d'), state: st.state, prog: st.prog, runKey: 'cmp.ai.run', err: st.err, pause: true,
      extra: st.plan && st.plan.cut && st.state !== 'running' ? [h('p', { class: 'help', 'data-fid': 'aiCmp-cut' }, t('cmp.ai.cut', { n: num(st.plan.sent), m: num(st.plan.total) }))] : null, start: t('cmp.ai.start'), again: t('cmp.ai.again'), allOff: !xOn, tip: t('tip.aiCmp'), run: () => startCmpAi(cmp), stop: () => st.ctl && st.ctl.abort() }));
    app(page, btCard(cmp, ref, tgt));
    const B = S.bt && S.bt.id === cmp.id && S.bt.rows.size ? S.bt : null, showBt = !!(B && S.btShow);
    const general = all.filter(f => f.para == null && !f.refPara);
    if (general.length) app(page, h('div', { class: 'finds' }, general.filter(f => S.filter.hidden || !f.dismissed).map((f, i) => findCard(f, tgt, i, { inCmp: true }))));
    if (!liveAll.length) app(page, h('div', { class: 'notice ok' }, icon('check_circle_fill'), h('span', null, t('cmp.clean'))));
    app(page, onlyBar(B ? [
      h('button', { type: 'button', class: 'chip', 'aria-pressed': String(S.btShow), 'data-fid': 'bt-show', 'data-tip': t('tip.btShow'), onclick: () => { S.btShow = !S.btShow; S.focus = ['bt-show']; render(); } }, S.btShow ? icon('check', 'sm') : null, t('bt.show')),
      showBt ? h('button', { type: 'button', class: 'chip', 'aria-pressed': String(S.btSort), 'data-fid': 'bt-sort', 'data-tip': t('tip.btSort'), onclick: () => { S.btSort = !S.btSort; S.focus = ['bt-sort']; render(); } }, icon('sort', 'sm'), t('bt.sort')) : null] : null));
    if (showBt) app(page, h('p', { class: 'help bt-legend' }, icon('info', 'sm'), h('span', null, t('bt.legend', { lang: t('lang.' + ref.lang) }))));
    const byRow = new Map(), rowOf = rowFinder(cmp);
    for (const f of all) {
      if (f.para == null && !f.refPara) continue;
      const row = rowOf(f);
      if (row != null) { if (!byRow.has(row)) byRow.set(row, []); byRow.get(row).push(f); }
    }
    const segs = h('div', { class: 'segs' + (showBt ? ' bt' : '') });
    app(segs, h('div', { class: 'seg-head', 'aria-hidden': 'true' }, h('span', null, h('span', { class: 'swatch fmt-' + ref.format }), t('cmp.ref') + ' · ' + langLbl(ref)), h('span', null, h('span', { class: 'swatch fmt-' + tgt.format }), t('cmp.tgt') + ' · ' + langLbl(tgt)),
      showBt ? h('span', null, h('span', { class: 'swatch acc-ai' }), t('bt.col', { lang: langLbl(ref) })) : null));
    let n = 0, fi = 0, more = 0;
    // «Grösste Abweichungen zuerst»: Zeilen mit harten Signalen, dann nach Abweichung im Wortlaut
    const order = showBt && S.btSort ? cmp.rows.slice().sort((x, y) => btRank(B, y) - btRank(B, x) || x.row - y.row) : cmp.rows;
    for (const r of order) {
      const fs = (byRow.get(r.row) || []).filter(f => S.filter.hidden || !f.dismissed), br = showBt ? B.rows.get(r.row) : null;
      if (S.cmpOnly && !fs.length && !(br && br.sig.length)) continue;
      if (++n > S.rowLimit) { more++; continue; }
      const rowEl = h('div', { class: 'seg-row' + (fs.length ? ' flag' : ''), style: rowSev(worstOf(fs)), 'data-row': r.row },
        segCell(ref, r.a, t('cmp.ref') + ' · ' + langLbl(ref), t('cmp.noref'), refRanges(fs)), segCell(tgt, r.b, t('cmp.tgt') + ' · ' + langLbl(tgt), t('cmp.missing'), tgtRanges(fs)), showBt ? btCell(cmp, ref, r, br) : null);
      if (fs.length) app(rowEl, h('div', { class: 'seg-finds' }, fs.map(f => findCard(f, tgt, fi++, { inCmp: true }))));
      app(segs, rowEl);
    }
    app(page, segs);
    if (more) app(page, h('div', null, btn(t('more.rows', { n: num(more) }), { kind: 'tonal', icon: 'south', fid: 'more-r', onclick: () => { S.rowLimit += 600; render(); } })));
    return page;
  }
  function onlyBar(extra) {
    return h('div', { class: 'toolbar' }, h('h2', { class: 'sec' }, t('cmp.table')), h('div', { class: 'chips' },
      h('button', { type: 'button', class: 'chip', 'aria-pressed': String(S.cmpOnly), 'data-fid': 'cmp-only', 'data-tip': t('tip.cmpOnly'), onclick: () => { S.cmpOnly = !S.cmpOnly; render(); } }, S.cmpOnly ? icon('check', 'sm') : null, t('cmp.only')), extra || null));
  }
  /** Synopse: Referenz und zwei Zielfassungen nebeneinander, Zeilen über die Referenz verbunden (DP.align.join3).
      Der Bedeutungsvergleich mit KI bleibt paarweise; vorhandene KI-Befunde erscheinen hier mit. */
  function viewCompareTri(page) {
    const ref = docById(S.ref), T = [docById(S.tgt), docById(S.tgt2)];
    if (!ref || !T[0] || !T[1] || new Set([ref, T[0], T[1]]).size < 3) { app(page, h('div', { class: 'notice plain' }, icon('info'), h('span', null, t('cmp.same3')))); return page; }
    const C = T.map(d => cmpOf(ref, d));
    const same = T.filter(d => d.lang === ref.lang);
    if (same.length) app(page, h('div', { class: 'notice' }, icon('warning_fill'), h('span', null, t('cmp.samelang', { lang: cap(t('lang.' + ref.lang)) }))));
    const odd = C.filter(c => !cmpShown(c));
    if (odd.length) { for (const c of odd) app(page, mismatchNote(c)); return page; }
    const ALL = C.map(c => c.findings.concat(extraOf(c.id)));
    const tags = T.map(d => () => pairTag(ref, d));
    app(page, h('section', { class: 'card tight tri-stats', 'aria-label': t('cmp.st.findings') },
      C.map((c, k) => h('div', { class: 'pair-stats' }, h('h2', { class: 'pair-h' }, h('span', { class: 'swatch fmt-' + T[k].format, 'aria-hidden': 'true' }), t('cmp.pair.sr', { a: langLbl(ref), b: t('lang.' + T[k].lang) }) + ' · ' + clip(T[k].name, 40)),
        h('div', { class: 'row between' }, cmpStats(c, ALL[k])))),
      h('p', { class: 'help', style: { 'margin-top': 'var(--space-sm)' } }, t('cmp.to.export'))));
    if (DP.offline) app(page, aiOffNote('aiTri', true));
    else app(page, h('div', { class: 'notice plain tri-ai' }, icon('auto_awesome'), h('div', null, h('p', null, t('cmp.tri.ai')),
      btn(t('cmp.tri.ai.go'), { kind: 'text sm', icon: 'compare_arrows', fid: 'cmp-tri-ai', onclick: () => { S.cmpMode = 'pair'; S.focus = ['cmp-mode-pair']; render(); } }))));
    const general = [];
    ALL.forEach((all, k) => { for (const f of all) if (f.para == null && !f.refPara && (S.filter.hidden || !f.dismissed)) general.push([f, k]); });
    if (general.length) app(page, h('div', { class: 'finds' }, general.map(([f, k], i) => findCard(f, T[k], i, { inCmp: true, pair: tags[k]() }))));
    if (!ALL.some(a => live(a).length)) app(page, h('div', { class: 'notice ok' }, icon('check_circle_fill'), h('span', null, t('cmp.clean'))));
    app(page, onlyBar());
    const rows = DP.align.join3(C[0], C[1]);
    // Befunde je Synopsezeile: Zeile des Paarvergleichs → Zeile der Synopse
    const syn = [new Map(), new Map()];
    rows.forEach((r, k) => { for (const x of r.r1) syn[0].set(x, k); for (const x of r.r2) syn[1].set(x, k); });
    const byRow = new Map();
    C.forEach((c, k) => { const rowOf = rowFinder(c); for (const f of ALL[k]) { if (f.para == null && !f.refPara) continue; const r = syn[k].get(rowOf(f)); if (r == null) continue; if (!byRow.has(r)) byRow.set(r, [[], []]); byRow.get(r)[k].push(f); } });
    const segs = h('div', { class: 'segs tri' });
    const headL = [t('cmp.ref') + ' · ' + langLbl(ref), t('cmp.tgt1') + ' · ' + langLbl(T[0]), t('cmp.tgt2') + ' · ' + langLbl(T[1])];
    const mobL = (d, k) => [h('span', { class: 'swatch fmt-' + d.format, 'aria-hidden': 'true' }), headL[k]];
    app(segs, h('div', { class: 'seg-head', 'aria-hidden': 'true' }, [ref, T[0], T[1]].map((d, k) => h('span', null, h('span', { class: 'swatch fmt-' + d.format }), headL[k]))));
    let n = 0, fi = 0, more = 0;
    rows.forEach((r, k) => {
      const both = byRow.get(k) || [[], []];
      const fs = both.map(l => l.filter(f => S.filter.hidden || !f.dismissed));
      const flat = fs[0].concat(fs[1]);
      if (S.cmpOnly && !flat.length) return;
      if (++n > S.rowLimit) { more++; return; }
      const noneOf = (j) => r.extra && r.extra !== j + 1 ? t('cmp.tri.na') : t('cmp.missing');
      const rowEl = h('div', { class: 'seg-row' + (flat.length ? ' flag' : ''), style: rowSev(worstOf(flat)) },
        segCell(ref, r.a, mobL(ref, 0), t('cmp.noref'), refRanges(flat)),
        segCell(T[0], r.b1, mobL(T[0], 1), noneOf(0), tgtRanges(fs[0])),
        segCell(T[1], r.b2, mobL(T[1], 2), noneOf(1), tgtRanges(fs[1])));
      if (flat.length) app(rowEl, h('div', { class: 'seg-finds' }, fs.map((l, j) => l.map(f => findCard(f, T[j], fi++, { inCmp: true, pair: tags[j]() })))));
      app(segs, rowEl);
    });
    app(page, segs);
    if (more) app(page, h('div', null, btn(t('more.rows', { n: num(more) }), { kind: 'tonal', icon: 'south', fid: 'more-r', onclick: () => { S.rowLimit += 600; render(); } })));
    return page;
  }

  /* ---------- Ansicht: Export ---------- */
  /** Befund aus einer KI-Funktion (KI-Prüfung, Bedeutungsvergleich, Pflichtenmatrix, festgehaltene Rückübersetzung)? */
  const aiFinding = (f) => f.source === 'ai';
  /** Kennung eines Befunds in Exporten: «KI-Befund (Claude) · Q02 Widerspruchsfreiheit» bzw. «Q02 Widerspruchsfreiheit». */
  const expLabel = (f) => (aiFinding(f) ? t('exp.ai.mark') + ' · ' : '') + f.crit + ' ' + t('c.' + f.crit + '.t');
  /** Herkunft eines angenommenen KI-Vorschlags (für Kommentar, Anmerkung und Bericht). */
  const aiNote = (f, name) => t(f.fix && f.fix.orig != null ? 'exp.ai.note.edit' : 'exp.ai.note', { name });
  function commentText(f) {
    let s = '[' + expLabel(f) + '] ' + msgOf(f);
    const sug = f.fix ? f.fix.repl : f.hint;
    if (sug) s += '\n' + t('fd.suggest') + ': ' + sug;
    if (aiFix(f)) s += '\n' + (f.accepted ? aiNote(f, S.author.trim() || 'Lectora') : t('rw.exp'));
    else if (!f.fix && f.hint && aiFinding(f)) s += '\n' + t('rw.exp');
    if (f.bt) s += '\n' + t('bt.col.plain') + ': ' + f.bt;
    return s;
  }
  function exportPlan(doc) {
    const all = live(findingsOf(doc));
    const changes = all.filter(f => f.fix && f.accepted && f.para != null && doc.paras[f.para] && doc.paras[f.para].x != null);
    const rest = all.filter(f => !changes.includes(f) && f.crit !== 'D01' && f.crit !== 'D02');
    return { all, changes, comments: S.expComments ? rest : [] };
  }
  /** Exportdatei speichern; ohne Downloads (ausserhalb von Claude und nicht offline) meldet die Seite das und bietet den Text an. */
  async function save(blob, filename) {
    const r = await saveFile(blob, filename);
    if (r === 'na') { S.dlAvail = false; snack(t('exp.na')); render(); }
    return r;
  }
  const baseName = (d) => d.name.replace(/\.[^.]+$/, '').replace(/[^\p{L}\p{N}._-]+/gu, '_').slice(0, 80);
  const expLangOf = (doc) => S.expLang[doc.id] || (['de', 'fr', 'it'].includes(doc.lang) ? doc.lang : S.lang);
  /** Führt fn in der Sprache der Rückmeldung aus und stellt die Sprache der Oberfläche wieder her. */
  function inLang(l, fn) { const ui = S.lang; S.lang = l; DP.i18n.set(l); try { return fn(); } finally { S.lang = ui; DP.i18n.set(ui); } }
  /** mode 'tracked': angenommene Vorschläge als nachverfolgte Änderungen; 'clean': direkt im Text. Der Rest wird in beiden Fällen Kommentar. */
  async function exportWord(doc, mode) {
    mode = mode === 'clean' ? 'clean' : 'tracked';
    const plan = exportPlan(doc);
    try {
      const L2 = expLangOf(doc), author = S.author.trim() || 'Lectora';
      // Änderungen aus einem KI-Vorschlag: eigener Autor «<Name> (KI-Vorschlag)» in der Sprache des Exports
      const aiAuthor = inLang(L2, () => t('exp.ai.author', { name: author }));
      const args = inLang(L2, () => ({
        changes: plan.changes.map(f => ({ para: f.para, start: f.fix.start, end: f.fix.end, repl: f.fix.repl, minimal: !f.fix.words, fallback: commentText(f),
          author: aiFix(f) ? aiAuthor : null, note: aiFix(f) ? '[' + expLabel(f) + '] ' + aiNote(f, author) : null })),
        comments: plan.comments.map(f => ({ para: f.para == null || !doc.paras[f.para] || doc.paras[f.para].x == null ? null : f.para, text: commentText(f) })),
        general: t('rep.general'), file: t(mode === 'clean' ? 'exp.file.clean' : 'exp.file.korr') }));
      const res = await DP.exporter.exportTracked(doc, args.changes, args.comments,
        { mode, author, initials: initialsOf(author), generalLabel: args.general });
      if (res.failed.length) snack(t('exp.partial', { n: res.failed.length }));
      await save(res.blob, baseName(doc) + '_' + args.file + '.docx');
    } catch (e) { snack(t('exp.fail')); }
  }
  /** Inhalt der Kopie mit Kommentaren (PDF, PowerPoint), nach den Regeln des Word-Exports: angenommene Vorschläge immer (in Word
      nachverfolgte Änderungen, hier Kommentare mit dem Vorschlag), die übrigen offenen Befunde nur mit der Kommentaroption;
      abgelehnte, ignorierte und als Fehlalarm markierte fehlen. Textstelle: der Bereich des Vorschlags bzw. des Befunds. */
  function annotPlan(doc) {
    const all = live(findingsOf(doc));
    const acc = all.filter(f => f.fix && f.accepted && f.para != null && doc.paras[f.para]);
    const rest = all.filter(f => !acc.includes(f) && f.crit !== 'D01' && f.crit !== 'D02');
    return acc.concat(S.expComments ? rest : []);
  }
  function annotItems(doc) {
    return inLang(expLangOf(doc), () => annotPlan(doc).map(f => {
      const p = f.para != null && doc.paras[f.para] ? f.para : null;
      const rg = f.fix ? f.fix : f.start != null && f.end != null ? f : null;
      const kind = p == null || !rg ? 'note' : f.fix && !f.fix.repl && f.fix.end > f.fix.start ? 'strike' : 'mark';
      return { para: p, start: rg ? rg.start : null, end: rg ? rg.end : null, kind, slide: f.slide || null, page: f.page || null, text: commentText(f), subj: expLabel(f), f };
    }).sort((a, b) => (a.para == null ? -1 : a.para) - (b.para == null ? -1 : b.para) || (a.start || 0) - (b.start || 0)));
  }
  const initialsOf = (name) => name.split(/\s+/).map(w => w[0]).join('').slice(0, 3).toUpperCase();
  /** Signierte PDF-Datei: vor dem Export fragen. Liefert true (weiter) oder false. */
  function confirmSigned() {
    return new Promise((done) => {
      let answered = false;
      const end = (v) => { if (answered) return; answered = true; done(v); };
      dialog((d, close) => {
        d.setAttribute('aria-labelledby', 'dlgTitle');
        d.addEventListener('close', () => end(false), { once: true });
        app(d, h('div', { class: 'dlg-body' }, h('h2', { id: 'dlgTitle' }, t('exp.ann.sig.t')), h('div', { class: 'notice' }, icon('warning_fill'), h('span', null, t('exp.ann.sig.p')))),
          h('div', { class: 'dlg-actions' }, h('button', { type: 'button', class: 'btn text', 'data-fid': 'sig-cancel', 'data-autofocus': true, onclick: () => { end(false); close(); } }, t('btn.cancel')),
            h('button', { type: 'button', class: 'btn', 'data-fid': 'sig-go', onclick: () => { end(true); close(); } }, icon('download', 'sm'), t('exp.ann.sig.ok'))));
      });
    });
  }
  /** Kopie mit Kommentaren herunterladen (PDF: Anmerkungen über pdf-lib, PowerPoint: klassische Kommentare). */
  let annBusy = false;
  async function exportAnnot(doc) {
    if (annBusy) return;
    annBusy = true;
    const author = S.author.trim() || 'Lectora', file = inLang(expLangOf(doc), () => t('exp.file.ann'));
    try {
      const items = annotItems(doc);
      if (doc.format === 'pdf') {
        let opened;
        try { await loadPdfLib(); opened = await DP.annot.pdfOpen(doc); }
        catch (e) { doc.annErr = e && e.code === 'encrypted' ? 'encrypted' : 'unreadable'; S.focus = ['dl-rep']; render(); snack(t('exp.ann.err.' + doc.annErr)); return; }
        if (opened.signed && !(await confirmSigned())) { applyFocus(['dl-annot'], false); return; }
        const res = await DP.annot.exportPdf(doc, opened, items, { author });
        if (res.fallback) snack(tn('exp.ann.fallback', res.fallback));
        const r2 = await save(res.blob, baseName(doc) + '_' + file + '.pdf');
        // Vorlage im Format PDF/A: Die Kopie trägt die Kennung nicht mehr (Anmerkungen sind nicht als PDF/A geprüft)
        if (res.pdfa && r2 === 'saved') snack(t('exp.ann.pdfa'));
      } else {
        let res;
        try { res = await DP.annot.exportPptx(doc, items, { author, initials: initialsOf(author) }); }
        catch (e) { doc.annErr = 'unreadable'; S.focus = ['dl-rep']; render(); snack(t('exp.ann.err.unreadable')); return; }
        await save(res.blob, baseName(doc) + '_' + file + '.pptx');
      }
      applyFocus(['dl-annot'], false);
    } catch (e) { snack(t('exp.fail')); }
    finally { annBusy = false; }
  }
  function reportBlocks(doc) {
    const all = live(findingsOf(doc)), c = countsOf(all), v = verdictOf(c), m = metOf(doc), r = S.res[doc.id], nAcc = nAccepted(all);
    const scope = [t('rep.scope.rule')];
    if (r.aiState === 'done' || r.aiState === 'partial') scope.push(t('rep.scope.ai'));
    for (const id in S.cmp) if (S.cmp[id].tgt === doc.id) { const rd = docById(S.cmp[id].ref); if (rd) scope.push(t('rep.scope.cmp', { name: rd.name })); }
    const B = [{ title: t('rep.title') }, { kv: [[t('rep.doc'), doc.name], [t('rep.format'), t('fmt.' + doc.format)], [t('rep.lang'), cap(t('lang.' + doc.lang))], [t('rep.type'), t('type.' + doc.type)], [t('rep.date'), DP.i18n.date(new Date())], [t('rep.scope'), scope.join(', ')], [t('rep.result'), t('verdict.' + v) + ' (' + (nAcc ? t('rep.withacc') + '; ' : '') + t('chk.met', { a: m.met.length, b: m.checked.size }) + ')'], [t('rep.counts'), ['error', 'warn', 'info'].map(s => num(c[s]) + ' ' + t('sev.' + s + '.n')).join(', ')], [t('rep.acc'), num(nAcc)]] }, { p: [{ text: t('rep.note'), i: true }] }];
    // Angenommene Vorschläge gelten als erledigt: Ergebnis und Zahlen beziehen sich auf den korrigierten Stand
    if (nAcc) B.push({ p: [{ text: t('rep.acc.d'), i: true }] });
    if (usesVis(doc, all)) B.push({ p: [{ text: t('leg.vis'), i: true }] });
    // Nachvollziehbarkeit: abweichende Prüfparameter stehen vor den Befunden
    const chp = changedParams(true);
    if (chp.length) {
      const P = R.resolveParams(S.settings);
      B.push({ h1: t('rep.params') }, { p: t('rep.params.d') }, { table: { head: [t('rep.col.crit'), t('rep.col.param'), t('rep.col.value'), t('rep.col.def')], widths: [3000, 2900, 1860, 1860],
        rows: chp.map(p => [p.crit + ' ' + t('c.' + p.crit + '.t'), t('par.' + p.id), parVal(p, P[p.id]), parVal(p, p.def)]) } });
    }
    // Nachprüfung: Zahlen gegenüber der vorherigen Fassung und die erledigten Befunde
    const rc = recheckOf(doc), ver = S.versions[doc.id];
    if (rc) {
      B.push({ h1: t('rep.rc') }, { p: t('rep.rc.d', { name: ver.name, a: num(rc.resolved.length), b: num(rc.stay.size), c: num(rc.fresh.size) }) + (rc.skipped.length ? ' ' + tn('rc.skip', rc.skipped.length) : '') }, { p: [{ text: t('rep.rc.method'), i: true }] });
      const old = { paras: ver.paras, format: ver.format }, res = rc.resolved.slice().sort((a, b) => (a.para == null ? -1 : a.para) - (b.para == null ? -1 : b.para));
      if (res.length) B.push({ table: { head: [t('rep.col.no'), t('rep.col.crit'), t('rep.col.oldwhere'), t('rep.col.quote')], widths: [520, 3400, 2600, 3100],
        rows: res.map((o, k) => [String(k + 1), o.crit + ' ' + t('c.' + o.crit + '.t'), locOf(o, old).split(' · ').join('\n'), o.quote ? clip(o.quote, 260) : '–']) } });
    }
    B.push({ h1: t('rep.findings') });
    if (!all.length) B.push({ p: t('rep.nofindings') });
    let n = 0;
    for (const k of R.CATS) {
      const group = all.filter(f => f.cat === k).sort((a, b) => SEV_ORDER[a.sev] - SEV_ORDER[b.sev] || (a.para == null ? -1 : a.para) - (b.para == null ? -1 : b.para));
      if (!group.length) continue;
      B.push({ h2: t('cat.' + k) });
      B.push({ table: { head: [t('rep.col.no'), t('rep.col.where'), t('rep.col.what'), t('rep.col.quote'), t('rep.col.fix')], widths: [520, 1700, 3100, 2200, 2100], rows: group.map(f => {
        const fix = f.fix ? [{ text: f.fix.repl.replace(/\u00a0/g, '⍽') }, { text: '\n' + t('st.' + stOf(f)) + (aiFix(f) ? ' · ' + t('rw.tag') + (f.accepted ? ' · ' + aiNote(f, S.author.trim() || 'Lectora') : '') : ''), i: true }] : f.hint ? [{ text: f.hint }].concat(aiFinding(f) ? [{ text: '\n' + t('rw.tag'), i: true }] : []) : '';
        return [String(++n), locOf(f, doc).split(' · ').join('\n'), [{ text: t('sev.' + f.sev) + ' · ' + expLabel(f) + (rc && rc.fresh.has(f.id) ? ' · ' + t('rc.tag.new') : '') + '\n', b: true }, { text: msgOf(f) }], f.quote ? clip(f.quote, 260) : '', fix];
      }) } });
    }
    // Angenommene Korrekturen: bisher → neu, mit Fundstelle; vor allem für PDF und PowerPoint, deren Original das Tool nicht ändert
    const acc = all.filter(f => f.fix && f.para != null && doc.paras[f.para] && stOf(f) === 'accepted').sort(docOrder);
    if (acc.length) {
      B.push({ h1: t('rep.fixed') }, { p: t('rep.fixed.d') });
      B.push({ table: { head: [t('rep.col.no'), t('rep.col.where'), t('rep.col.old'), t('rep.col.new')], widths: [520, 2100, 3500, 3500], rows: acc.map((f, k) => {
        const old = doc.paras[f.para].text.slice(f.fix.start, f.fix.end);
        return [String(k + 1), locOf(f, doc).split(' · ').join('\n'), old ? clip(vis(old), 400) : '–', f.fix.repl ? [{ text: clip(vis(f.fix.repl), 400) }].concat(aiFix(f) ? [{ text: '\n' + aiNote(f, S.author.trim() || 'Lectora'), i: true }] : []) : '–'];
      }) } });
    }
    dutyReport(doc, B);
    B.push({ h1: t('rep.criteria') });
    B.push({ table: { head: [t('rep.col.no'), t('rep.col.crit'), t('rep.col.state')], widths: [900, 6600, 2120], rows: R.CATALOG.filter(x => m.checked.has(x.id)).map(x => [x.id, t('c.' + x.id + '.t'), m.met.includes(x.id) ? t('rep.ok') : [{ text: t('rep.nok'), b: true }]]) } });
    return B;
  }
  /** Prüfbericht: Pflichtenmatrix des Dokuments und, wenn es Zielfassung eines Abgleichs ist, die Unterschiede zur Referenz. */
  function dutyReport(doc, B) {
    const D = S.duty[doc.id];
    if (!D || !D.rows.length) return;
    B.push({ h1: t('rep.duty') }, { p: t(D.state === 'done' ? 'rep.duty.d' : 'rep.duty.part', { n: num(D.rows.length) }) }, { p: [{ text: t('duty.help'), i: true }] });
    B.push({ table: { head: [t('rep.col.no'), t('duty.col.where'), t('duty.col.actor'), t('duty.col.mod'), t('duty.col.action'), t('duty.col.due'), t('duty.col.cond'), t('duty.col.quote')], widths: [420, 1000, 1300, 1150, 1650, 1200, 1100, 1800],
      rows: D.rows.map((r, k) => [String(k + 1), paraLoc(doc, r.p), r.actor || t('duty.noactor'), dutyMod(r.modality) + (r.disagree ? '\n' + t('duty.disagree', { raw: r.local.raw, cls: t('mod.' + r.local.cls) }) : ''),
        r.action + (r.object ? '\n' + t('duty.obj', { v: r.object }) : ''), r.deadline || '–', r.condition || '–', clip(r.quote, 300)]) } });
    for (const id in S.dutyCmp) {
      const c = S.cmp[id], sy = S.dutyCmp[id]; if (!c || c.tgt !== doc.id || !sy.diffs.length) continue;
      const rd = docById(c.ref); if (!rd) continue;
      B.push({ h2: t('rep.duty.syn', { name: rd.name }) }, { table: { head: [t('rep.col.no'), t('duty.syn.col.diff'), t('duty.syn.col.ref', { lang: langLbl(rd) }), t('rep.duty.this'), t('rep.duty.f')], widths: [420, 2300, 2700, 2700, 1500],
        rows: sy.diffs.map((d, k) => [String(k + 1), t('sev.' + d.sev) + ' · ' + t('duty.syn.k.' + d.kind + (d.one ? '.single' : ''), { lang: t('lang.' + doc.lang) }),
          d.a ? clip(d.a.quote, 240) : '–', d.b ? clip(d.b.quote, 240) : '–', d.dup ? t('duty.syn.dup', { crit: d.dup }) : (d.fid ? R.BY_ID[{ missing: 'X13', extra: 'X13', mod: 'X14', due: 'X15', actor: 'X16' }[d.kind]].id : '–')]) } });
    }
  }
  async function exportReport(doc) {
    try {
      const L2 = expLangOf(doc);
      const a = inLang(L2, () => ({ blocks: reportBlocks(doc), title: t('rep.title') + ' ' + doc.name, footer: t('rep.title') + ' · ' + doc.name, file: t('exp.file.rep') }));
      const blob = await DP.exporter.exportReport(a.blocks, { lang: L2, title: a.title, footer: a.footer, author: S.author.trim() || 'Lectora' });
      await save(blob, baseName(doc) + '_' + a.file + '.docx');
    }
    catch (e) { snack(t('exp.fail')); }
  }
  async function copyReport(doc) {
    try { await navigator.clipboard.writeText(DP.exporter.reportText(inLang(expLangOf(doc), () => reportBlocks(doc)))); snack(t('exp.copied')); } catch (e) { snack(t('exp.copy.fail')); }
  }
  /* ---------- Rückmeldung zu den Regeln: Fehlalarme dieser Sitzung ---------- */
  /** Alle als Fehlalarm markierten Befunde: in den geladenen Fassungen und, falls erledigt, in der vorherigen Fassung. */
  function faList() {
    const out = [];
    for (const d of S.docs) {
      for (const f of findingsOf(d)) if (f.fa && f.dismissed) out.push({ f, doc: d });
      const v = S.versions[d.id], rc = v && recheckOf(d);
      if (rc) for (const o of rc.resolved.concat(rc.skipped)) if (o.fa) out.push({ f: o, doc: d, old: v });
    }
    return out;
  }
  /** Satz um die markierte Stelle (für die Rückmeldung mit Textstellen). */
  function sentenceOf(text, start) {
    if (start == null) return '';
    const s = L.sentences(text).find(x => start >= x.start && start < x.end);
    return s ? clip(s.text, 600) : clip(text, 600);
  }
  function feedbackEntries(withQuotes) {
    return faList().map(({ f, doc, old }) => {
      const e = { crit: f.crit, key: f.key || null, source: f.source === 'ai' ? 'ai' : f.cmp ? 'compare' : 'rule', sev: f.sev, lang: doc.lang, type: doc.type, format: doc.format,
        params: f.faParams || R.paramValues(f.crit, S.settings) };
      if (f.cmp) { const rd = docById(f.refDoc); if (rd) e.refLang = rd.lang; }
      if (old) e.version = 'previous';
      if ((f.faNote || '').trim()) e.note = f.faNote.trim().slice(0, 140);
      if (withQuotes) {
        const paras = old ? old.paras : doc.paras, p = f.para != null ? paras[f.para] : null;
        e.quote = clip(f.quote || '', 300); e.sentence = p ? sentenceOf(p.text, f.start) : ''; e.file = old ? old.name : doc.name;
      }
      return e;
    });
  }
  async function saveFeedback() {
    const obj = PF.feedback(feedbackEntries(S.fbQuotes), S.fbQuotes);
    await saveJson(obj, 'Lectora-Rueckmeldung_' + obj.created + '.json', 'fb-save');
  }
  function feedbackCard() {
    const n = faList().length; if (!n) return null;
    return h('section', { class: 'card exp-card fb-card', 'aria-labelledby': 'expFb' },
      h('h2', { id: 'expFb' }, h('span', { class: 'ico', 'aria-hidden': 'true' }, icon('flag')), t('fb.t')),
      h('p', null, t('fb.d')),
      h('div', { class: 'chips' }, h('span', { class: 'tag st-fa' }, icon('flag', 'sm'), tn('fb.n', n))),
      h('label', { class: 'check', for: 'fbQuotes' }, h('input', { type: 'checkbox', id: 'fbQuotes', 'data-fid': 'fbQuotes', checked: S.fbQuotes, onchange: (e) => { S.fbQuotes = e.target.checked; updateClear(); } }), h('span', null, t('fb.quotes'))),
      S.dlAvail === false ? h('p', { class: 'help' }, t('fb.na')) : null,
      h('div', null, btn(t('fb.btn'), { kind: 'outlined', icon: 'download', fid: 'fb-save', tip: t('tip.fb'), onclick: saveFeedback })));
  }
  function viewExport() {
    const page = h('div', { class: 'page' });
    app(page, h('header', { class: 'page-head' }, h('h1', null, t('exp.h')), h('p', { class: 'lead' }, t('exp.lead'))));
    const doc = docById(S.cur);
    if (!doc) { app(page, emptyState('download', t('exp.empty.t'), t('exp.empty.d'), btn(t('chk.empty.b'), { icon: 'upload_file', onclick: () => go('docs') }))); return page; }
    const tabs = docTabs(t('chk.doc')); if (tabs) app(page, tabs);
    const plan = exportPlan(doc);
    app(page, h('section', { class: 'card tight', 'aria-label': t('exp.lang') }, h('div', { class: 'field', style: { 'max-width': '420px' } }, h('label', { for: 'expLang' }, t('exp.lang')),
      h('select', { id: 'expLang', 'data-fid': 'expLang', 'aria-describedby': 'expLangHelp', 'data-tip': t('tip.expLang'), onchange: (e) => { S.expLang[doc.id] = e.target.value; updateClear(); } }, ['de', 'fr', 'it'].map(l => h('option', { value: l, selected: l === expLangOf(doc) }, cap(t('lang.' + l))))),
      h('p', { class: 'help', id: 'expLangHelp' }, t('exp.lang.d')))));
    const grid = h('div', { class: 'exp-grid' });
    const sugg = findingsOf(doc).filter(f => f.fix), nSt = { accepted: 0, open: 0, rejected: 0 };
    for (const f of sugg) nSt[stOf(f)]++;
    const stTags = h('div', { class: 'exp-st' }, h('span', { class: 'help' }, t('exp.st')),
      h('span', { class: 'tag' }, tn('exp.st.acc', nSt.accepted)), h('span', { class: 'tag' }, tn('exp.st.open', nSt.open)), h('span', { class: 'tag' }, tn('exp.st.rej', nSt.rejected)));
    const accHint = !nSt.accepted && nSt.open ? h('div', { class: 'notice plain exp-acc' }, icon('info'), h('div', { class: 'grow' }, h('p', null, t('exp.none') + ' ' + tn('exp.open.hint', nSt.open)),
      btn(t('chk.bulk.all'), { kind: 'outlined sm', icon: 'done_all', fid: 'exp-accall', tip: t('tip.bulk') + (sugg.some(f => stOf(f) === 'open' && aiFix(f)) ? ' ' + tn('tip.bulk.ai', sugg.filter(f => stOf(f) === 'open' && aiFix(f)).length) : ''), onclick: () => bulk(doc, 'accepted', { all: true, focus: doc.format === 'docx' ? 'dl-word' : 'dl-annot' }) }))) : null;
    let word;
    if (doc.format === 'docx') {
      const none = !plan.changes.length && !plan.comments.length, off = none || S.dlAvail === false;
      word = h('section', { class: 'card exp-card fmt-docx', 'aria-labelledby': 'expW' }, h('h2', { id: 'expW' }, h('span', { class: 'ico', 'aria-hidden': 'true' }, icon('edit_document')), h('span', { class: 'swatch', 'aria-hidden': 'true' }), t('exp.word.t')),
        h('p', null, t('exp.word.d')), stTags, accHint,
        h('div', { class: 'chips' }, h('span', { class: 'tag' }, tn('exp.changes', plan.changes.length)), h('span', { class: 'tag' }, tn('exp.comments', plan.comments.length))),
        h('div', { class: 'field' }, h('label', { for: 'author' }, t('exp.author')), h('input', { type: 'text', id: 'author', value: S.author, maxlength: 60, autocomplete: 'off', oninput: (e) => { S.author = e.target.value; updateClear(); } })),
        h('label', { class: 'check', for: 'optC' }, h('input', { type: 'checkbox', id: 'optC', 'data-fid': 'optC', 'data-tip': t('tip.optC'), checked: S.expComments, onchange: (e) => { S.expComments = e.target.checked; render(); } }), h('span', null, t('exp.opt.comments'))),
        h('div', { class: 'exp-vars' },
          h('div', { class: 'exp-var' }, h('h3', null, t('exp.v.tracked.t')), h('p', null, t('exp.v.tracked.d')), h('div', null, btn(t('exp.word.btn'), { icon: 'download', fid: 'dl-word', tip: t('tip.dlWord'), disabled: off, onclick: () => exportWord(doc, 'tracked') }))),
          h('div', { class: 'exp-var' }, h('h3', null, t('exp.v.clean.t')), h('p', null, t('exp.v.clean.d')), h('div', null, btn(t('exp.clean.btn'), { kind: 'tonal', icon: 'download', fid: 'dl-clean', tip: t('tip.dlClean'), disabled: off, onclick: () => exportWord(doc, 'clean') })))),
        h('p', { class: 'help' }, t('exp.v.rest')));
    } else {
      // PDF und PowerPoint: Kopie mit einem Kommentar je Befund (Hauptaktion), dazu die korrigierten Textstellen zum Kopieren
      const nP = accParas(findingsOf(doc)).length, nA = annotPlan(doc).length, err = doc.annErr;
      word = h('section', { class: 'card exp-card fmt-' + doc.format, 'aria-labelledby': 'expF' }, h('h2', { id: 'expF' }, h('span', { class: 'ico', 'aria-hidden': 'true' }, icon('rate_review')), h('span', { class: 'swatch', 'aria-hidden': 'true' }), t('exp.ann.t.' + doc.format)),
        h('p', null, t('exp.ann.d.' + doc.format)), stTags, accHint,
        h('div', { class: 'chips' }, h('span', { class: 'tag', 'data-fid': 'ann-n' }, tn('exp.comments', nA))),
        err ? h('div', { class: 'notice err', role: 'alert', 'data-fid': 'ann-err' }, icon('error_fill'), h('span', null, t('exp.ann.err.' + err))) : null,
        h('div', { class: 'field' }, h('label', { for: 'author' }, t('exp.author.ann')), h('input', { type: 'text', id: 'author', value: S.author, maxlength: 60, autocomplete: 'off', oninput: (e) => { S.author = e.target.value; updateClear(); } })),
        h('label', { class: 'check', for: 'optC' }, h('input', { type: 'checkbox', id: 'optC', 'data-fid': 'optC', 'data-tip': t('tip.optC.ann'), checked: S.expComments, onchange: (e) => { S.expComments = e.target.checked; render(); } }), h('span', null, t('exp.opt.comments'))),
        h('div', null, btn(t('exp.ann.btn'), { icon: 'download', fid: 'dl-annot', tip: t('tip.dlAnn'), disabled: !nA || !!err || S.dlAvail === false, onclick: () => exportAnnot(doc) })),
        h('p', { class: 'help' }, t('exp.ann.rest')),
        h('div', { class: 'exp-fix' }, h('h3', null, t('exp.fix.t')), h('p', null, t('exp.fix.d')),
          h('div', { class: 'row' }, h('span', { class: 'tag' }, tn('exp.fix.n', nP)), btn(t('exp.fix.btn'), { kind: 'outlined', icon: 'content_copy', fid: 'cp-fixed', tip: t('tip.cpFixed'), disabled: !nP, onclick: () => copyFixed(doc) }))));
    }
    const rep = h('section', { class: 'card exp-card', 'aria-labelledby': 'expR' }, h('h2', { id: 'expR' }, h('span', { class: 'ico', 'aria-hidden': 'true' }, icon('summarize')), t('exp.rep.t')), h('p', null, t('exp.rep.d')),
      h('div', { class: 'row between' }, verdictChip(verdictOf(countsOf(plan.all))), countsNode(countsOf(plan.all))),
      S.dlAvail === false ? h('div', { class: 'notice plain' }, icon('info'), h('span', null, t('exp.na'))) : null,
      h('div', { class: 'row' }, btn(t('exp.rep.btn'), { kind: 'tonal', icon: 'download', fid: 'dl-rep', tip: t('tip.dlRep'), disabled: S.dlAvail === false, onclick: () => exportReport(doc) }), btn(t('exp.rep.copy'), { kind: 'outlined', icon: 'content_copy', fid: 'cp-rep', tip: t('tip.cpRep'), onclick: () => copyReport(doc) })));
    app(grid, word, rep); app(page, grid, feedbackCard());
    if (doc.format === 'docx' && plan.changes.length) {
      app(page, h('h2', { class: 'sec' }, t('exp.preview') + ' (' + num(plan.changes.length) + ')'));
      app(page, h('div', { class: 'diff-list' }, plan.changes.slice().sort((a, b) => a.para - b.para || a.start - b.start).slice(0, 200).map(f => { const q = quoteNode(f, doc, 36); q.className = 'diff'; q.prepend(h('span', { class: 'where' }, f.crit + ' · ' + locOf(f, doc))); return q; })));
    }
    return page;
  }

  /* ---------- Ansicht: Kriterien ---------- */
  /** Prüfparameter mit abweichendem Wert, in Katalogreihenfolge; active: nur solche eingeschalteter Kriterien. */
  function changedParams(active) { const o = S.settings.params || {}; return R.PARAMS.filter(p => p.id in o && o[p.id] !== p.def && !(active && S.settings.off.has(p.crit))); }
  const parVal = (p, v) => num(v) + ' ' + t('par.unit.' + p.unit);
  const parFid = (p) => 'par-' + p.id.replace('.', '-');
  /** Wert übernehmen: prüfen, auf die Schrittweite runden, in die Grenzen setzen, Prüfungen neu ausführen, Rückmeldung als Meldung. */
  function setParam(p, raw, focusFid) {
    const o = S.settings.params, before = R.resolveParams(S.settings);
    const str = String(raw == null ? '' : raw).trim(), n = Number(str.replace(/[\s\u00a0\u202f’']/g, '').replace(',', '.'));
    let v = R.clampParam(p, str), msg = null;
    if (!str || !Number.isFinite(n)) msg = t('par.invalid', { v: parVal(p, p.def) });
    // Die Warnschwelle der Satzlänge liegt nie unter der Hinweisschwelle
    const lo = p.id === 'L01.warn' ? Math.max(p.min, before['L01.note']) : p.min;
    if (v < lo) v = lo;
    // Innerhalb der Grenzen, aber nicht auf der Schrittweite: gerundet, nicht begrenzt
    if (!msg && n !== v) msg = n >= lo && n <= p.max ? t('par.rounded', { step: num(p.step), v: parVal(p, v) }) : t('par.clamped', { min: num(lo), max: num(p.max), v: parVal(p, v) });
    if (v === p.def) delete o[p.id]; else o[p.id] = v;
    let raised = null;
    if (p.id === 'L01.note' && v > before['L01.warn']) {
      const w = R.PARAM_BY_ID['L01.warn']; if (v === w.def) delete o[w.id]; else o[w.id] = v;
      raised = t('par.raised', { old: parVal(w, before['L01.warn']), v: parVal(w, v) });
    }
    const after = R.resolveParams(S.settings), changed = R.PARAMS.some(q => after[q.id] !== before[q.id]);
    if (changed) rerunAll();
    if (focusFid) S.focus = [focusFid];
    render();
    const main = msg || (changed ? t('par.applied', { label: t('par.' + p.id), v: parVal(p, v) }) : null);
    if (main || raised) snack([main, raised].filter(Boolean).join(' '));
  }
  function paramRow(c, p) {
    const o = S.settings.params, val = p.id in o ? o[p.id] : p.def, changed = val !== p.def, off = S.settings.off.has(c.id);
    const fid = parFid(p), uid = fid + '-u', did = fid + '-d', lbl = t('par.' + p.id);
    const min = p.id === 'L01.warn' ? Math.max(p.min, R.resolveParams(S.settings)['L01.note']) : p.min;
    // Übernehmen bei Enter sofort; bei change (Verlassen des Felds, Pfeile) erst nach dem Fokuswechsel, damit Tab nicht im Feld hängen bleibt
    const input = h('input', { type: 'number', id: fid, 'data-fid': fid, inputmode: 'numeric', min, max: p.max, step: p.step, value: String(val), disabled: off,
      'aria-describedby': uid + (changed ? ' ' + did : ''),
      onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); setParam(p, input.value, fid); } },
      onchange: () => { const v = input.value; setTimeout(() => setParam(p, v, null), 0); } });
    return h('div', { class: 'par' + (changed ? ' changed' : '') },
      h('label', { for: fid }, lbl),
      h('span', { class: 'par-in' }, input, h('span', { class: 'par-unit', id: uid }, t('par.unit.' + p.unit))),
      changed ? h('span', { class: 'par-state' }, h('span', { class: 'tag par-tag' }, t('par.changed')), h('span', { class: 'help', id: did }, t('par.def', { v: num(p.def) })),
        iconBtn('undo', t('par.reset', { label: c.id + ' ' + lbl }), () => setParam(p, String(p.def), fid), { kind: 'flat', fid: 'parrst-' + fid.slice(4), tip: t('tip.parReset', { v: parVal(p, p.def) }), disabled: off })) : null);
  }
  function critSection(key, icn, title, meta, body) {
    const open = S.critOpen.has(key), bid = 'ccb-' + key;
    return h('section', { class: 'card crit-cat cat-' + key + (open ? ' open' : ''), 'aria-labelledby': 'cc-' + key },
      h('h2', { class: 'crit-h' }, h('button', { type: 'button', class: 'crit-dis', id: 'cc-' + key, 'data-fid': 'cc-' + key, 'aria-expanded': String(open), 'aria-controls': bid,
        onclick: () => { if (S.critOpen.has(key)) S.critOpen.delete(key); else S.critOpen.add(key); render(); } },
        h('span', { class: 'ico', 'aria-hidden': 'true' }, icon(icn)), h('span', { class: 'crit-name' }, key === 'quality' || key === 'trans' ? h('span', { class: 'swatch ' + (key === 'quality' ? 'acc-ai' : 'acc-cmp'), 'aria-hidden': 'true' }) : null, title), meta ? h('span', { class: 'crit-sum' }, meta) : null, icon('expand_more', 'chev'))),
      h('div', { class: 'crit-body', id: bid, hidden: !open }, body));
  }
  /** Rückmeldung zu den eigenen Erlassen: Zahl der gültigen Zeilen, ungültige Zeilen mit Grund. */
  function actsCount() {
    if (!S.settings.actsText.trim()) return [t('crit.custom.acts.none')];
    const r = DP.erlasse.parseCustom(S.settings.actsText), out = [tn('crit.custom.acts.n', r.valid)];
    if (r.invalid.length) {
      const list = r.invalid.slice(0, 6).map(x => t('crit.custom.acts.line', { n: x.line, why: t('crit.custom.acts.why.' + x.why) })).join(', ') + (r.invalid.length > 6 ? ', …' : '');
      out.push(' ', h('span', { class: 'acts-bad' }, icon('warning_fill', 'sm'), tn('crit.custom.acts.bad', r.invalid.length, { list })));
    }
    return out;
  }
  function viewCriteria() {
    const page = h('div', { class: 'page' });
    const total = R.CATALOG.length, on = total - S.settings.off.size, chp = changedParams(), keys = R.CATS.concat('custom');
    app(page, h('header', { class: 'page-head' }, h('h1', null, t('crit.h')), h('p', { class: 'lead' }, t('crit.lead')), h('p', { class: 'help', id: 'critCount' }, t('crit.count', { on, all: total }))));
    app(page, profileBand());
    if (DP.offline) app(page, h('div', { class: 'notice plain', 'data-fid': 'crit-ai-off' }, icon('cloud_off'), h('span', null, t('crit.ai.off'))));
    const faN = {}; for (const e of faList()) faN[e.f.crit] = (faN[e.f.crit] || 0) + 1;
    const all = keys.every(k => S.critOpen.has(k)), none = !keys.some(k => S.critOpen.has(k));
    app(page, h('div', { class: 'crit-tools' },
      btn(t('crit.expandAll'), { kind: 'outlined sm', icon: 'unfold_more', fid: 'crit-open-all', tip: t('tip.openAll'), disabled: all, onclick: () => { S.critOpen = new Set(keys); S.focus = 'crit-close-all'; render(); } }),
      btn(t('crit.collapseAll'), { kind: 'outlined sm', icon: 'unfold_less', fid: 'crit-close-all', tip: t('tip.closeAll'), disabled: none, onclick: () => { S.critOpen = new Set(); S.focus = 'crit-open-all'; render(); } }),
      h('span', { class: 'grow' }),
      btn(t('par.resetAll'), { kind: 'text sm', icon: 'undo', fid: 'par-reset-all', tip: t('tip.parAll'), disabled: !chp.length, onclick: () => { S.settings.params = {}; rerunAll(); S.focus = 'crit-open-all'; render(); snack(t('par.resetAll.done')); } })));
    const secs = h('div', { class: 'crit-list' });
    for (const k of R.CATS) {
      const list = R.CATALOG.filter(x => x.cat === k), nOn = list.filter(x => !S.settings.off.has(x.id)).length;
      const changed = chp.some(p => R.BY_ID[p.crit].cat === k);
      const rows = list.map(c => {
        const only = [], ps = R.PARAMS.filter(p => p.crit === c.id);
        if (c.formats) only.push(c.formats.map(f => t('fmt.' + f)).join(', '));
        if (c.types) only.push(c.types.length === 1 ? t('type.' + c.types[0]) : null);
        if (c.langs) only.push(c.langs.map(l => cap(t('lang.' + l))).join(', '));
        return h('div', { class: 'crit' + (ps.length ? ' has-par' : '') },
          toggle('', !S.settings.off.has(c.id), (v) => { if (v) S.settings.off.delete(c.id); else S.settings.off.add(c.id); rerunAll(); render(); }, 'crit-' + c.id, { hide: true, aria: t('crit.on', { id: c.id, title: t('c.' + c.id + '.t') }), tip: t('tip.crit') }),
          h('div', { class: 'crit-t' }, t('c.' + c.id + '.t')),
          h('div', { class: 'crit-meta' }, h('span', { class: 'tag id' }, c.id), h('span', { class: 'tag sev-' + c.sev }, t('sev.' + c.sev)), c.ai ? h('span', { class: 'tag ai' }, h('span', { class: 'swatch acc-ai', 'aria-hidden': 'true' }), t('crit.tag.ai')) : null, c.cmp ? h('span', { class: 'tag cmp' }, h('span', { class: 'swatch acc-cmp', 'aria-hidden': 'true' }), t('crit.tag.cmp')) : null, only.filter(Boolean).map(o => h('span', { class: 'tag' }, t('crit.tag.only', { what: o }))),
            faN[c.id] ? h('span', { class: 'tag st-fa', 'data-fid': 'fan-crit-' + c.id }, icon('flag', 'sm'), tn('crit.fa', faN[c.id])) : null),
          h('div', { class: 'crit-d' }, critDesc(c.id)),
          ps.length ? h('div', { class: 'crit-params', role: 'group', 'aria-label': t('par.group', { id: c.id + ' ' + t('c.' + c.id + '.t') }) }, ps.map(p => paramRow(c, p))) : null);
      });
      const nFa = list.reduce((a, c) => a + (faN[c.id] || 0), 0);
      app(secs, critSection(k, CAT_ICON[k], t('cat.' + k), [t('crit.active', { a: nOn, b: list.length }), changed ? h('span', { class: 'tag par-tag' }, t('crit.changed')) : null, nFa ? h('span', { class: 'tag st-fa' }, icon('flag', 'sm'), tn('crit.fa', nFa)) : null], rows));
    }
    app(page, secs);
    app(secs, critSection('custom', 'edit', t('crit.custom.h'), null, [
      h('div', { class: 'field' }, h('label', { for: 'custAi' }, t('crit.custom.ai') + ' (Q07)'), h('textarea', { id: 'custAi', 'data-fid': 'custAi', placeholder: t('crit.custom.ai.ph'), oninput: (e) => { S.settings.custom = e.target.value; updateClear(); } }, S.settings.custom)),
      h('div', { class: 'field', style: { 'margin-top': 'var(--space-md)' } }, h('label', { for: 'custTerms' }, t('crit.custom.terms') + ' (T09)'), h('textarea', { id: 'custTerms', 'data-fid': 'custTerms', placeholder: t('crit.custom.terms.ph'), 'aria-describedby': 'termsHelp', oninput: (e) => { S.settings.termsText = e.target.value; updateClear(); }, onchange: () => { S.settings.terms = R.parseTerms(S.settings.termsText); rerunAll(); refreshChrome(); } }, S.settings.termsText), h('p', { class: 'help', id: 'termsHelp' }, t('crit.custom.terms.d'))),
      h('div', { class: 'field', style: { 'margin-top': 'var(--space-md)' } }, h('label', { for: 'custActs' }, t('crit.custom.acts') + ' (R04, X12)'),
        h('textarea', { id: 'custActs', 'data-fid': 'custActs', placeholder: t('crit.custom.acts.ph'), 'aria-describedby': 'actsHelp actsCount', spellcheck: 'false',
          oninput: (e) => { S.settings.actsText = e.target.value; const c = $('actsCount'); if (c) c.replaceChildren(...actsCount()); updateClear(); },
          onchange: () => { S.settings.acts = DP.erlasse.parseCustom(S.settings.actsText).acts; rerunAll(); refreshChrome(); } }, S.settings.actsText),
        h('p', { class: 'help', id: 'actsHelp' }, t('crit.custom.acts.d')),
        h('p', { class: 'help acts-count', id: 'actsCount', 'aria-live': 'polite' }, actsCount()))]));
    return page;
  }

  /* ---------- Ansicht: Anleitung ---------- */
  const GUIDE = ['steps', 'data', 'ai', 'check', 'cmp', 'exp', 'crit', 'lim', 'keys'];
  const range = (n) => Array.from({ length: n }, (_, i) => i + 1);
  function jumpTo(id) { const hd = $('gh-' + id); if (!hd) return; hd.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); hd.focus({ preventScroll: true }); }
  function viewHelp() {
    const page = h('div', { class: 'page guide' });
    app(page, h('header', { class: 'page-head' }, h('h1', null, t('g.h')), h('p', { class: 'lead' }, t('g.lead'))));
    const toc = h('nav', { class: 'g-toc', 'aria-labelledby': 'gToc' }, h('p', { class: 'g-eyebrow', id: 'gToc' }, t('g.toc')),
      h('ol', null, GUIDE.map((id, i) => h('li', null, h('a', { href: '#g-' + id, 'data-fid': 'gt-' + id, onclick: (e) => { e.preventDefault(); jumpTo(id); } }, h('span', { class: 'n', 'aria-hidden': 'true' }, String(i + 1).padStart(2, '0')), h('span', null, t(DP.offline && id === 'ai' ? 'g.ai.h.off' : 'g.' + id + '.h')))))));
    // Inhaltsverzeichnis (Toc) links, Abschnitte rechts
    const body = h('div', { class: 'g-body' });
    const goBtn = (route) => h('div', { class: 'g-go' }, btn(t('g.go.' + route), { kind: 'text sm', icon: 'arrow_forward', fid: 'gg-' + route, onclick: () => go(route) }));
    // Offline-Ausgabe: Abschnitte mit eigener Fassung (Schlüssel mit .off) zeigen diese
    // Vorrang: GitHub Pages (.off.web), Ausgabe ohne Versionsabfrage (.off.nc), dann die gewöhnliche Offline-Fassung (.off)
    const off = (k) => {
      if (!DP.offline) return k;
      const D = DP.i18n.DICT.de;
      if (WEB && (k + '.off.web') in D) return k + '.off.web';
      if (!DP.updateCheck && (k + '.off.nc') in D) return k + '.off.nc';
      return (k + '.off') in D ? k + '.off' : k;
    };
    const list = (id, n) => h('ul', { class: 'g-list' }, range(n).map(k => h('li', null, t(off('g.' + id + '.' + k)))));
    const head = (id, lead) => h('div', { class: 'g-side' }, h('h2', { id: 'gh-' + id, tabindex: '-1' }, t('g.' + id + '.h')), lead ? h('p', { class: 'g-lead' }, t('g.' + id + '.lead')) : null);
    const sec = (id, lead, ...body) => h('section', { class: 'g-sec', id: 'g-' + id, 'aria-labelledby': 'gh-' + id }, head(id, lead), h('div', { class: 'g-main' }, body));
    // In fünf Schritten
    const steps = [['docs'], ['check'], [null], ['compare'], ['export']];
    app(body, sec('steps', false, h('ol', { class: 'g-steps' }, steps.map(([route], k) => h('li', null,
      h('span', { class: 'g-num', 'aria-hidden': 'true' }, String(k + 1)),
      h('div', null, h('h3', null, t(off('g.steps.' + (k + 1) + '.t'))), h('p', null, t(off('g.steps.' + (k + 1) + '.d'))), route ? goBtn(route) : null))))));
    // Datenhaltung und KI: hervorgehoben, nebeneinander
    const key = (id, icn, n) => h('section', { class: 'card g-key' + (id === 'ai' && !DP.offline ? ' acc-ai' : ''), id: 'g-' + id, 'aria-labelledby': 'gh-' + id },
      h('span', { class: 'ico', 'aria-hidden': 'true' }, icon(icn)), h('h2', { id: 'gh-' + id, tabindex: '-1' }, t(off('g.' + id + '.h'))), h('p', { class: 'g-lead' }, t(off('g.' + id + '.lead'))), list(id, n));
    app(body, h('div', { class: 'g-keys' }, key('data', 'lock', DP.offline ? 8 : 7), DP.offline ? key('ai', 'cloud_off', 5) : key('ai', 'auto_awesome', 9)));
    app(body, sec('check', true,
      h('h3', null, t('g.check.vt')),
      h('dl', { class: 'g-defs' }, ['fail', 'warn', 'pass'].map(v => [h('dt', null, verdictChip(v)), h('dd', null, t('g.check.v.' + v))])),
      h('p', { class: 'g-p' }, t('g.check.sev')),
      h('h3', null, t('g.check.lt')), list('check', 5),
      h('h3', null, t('g.check.rt')), list('rc', 3), goBtn('check')));
    app(body, sec('cmp', true, list('cmp', DP.offline ? 5 : 6), goBtn('compare')));
    app(body, sec('exp', true,
      h('dl', { class: 'g-defs' }, [['exp.v.tracked.t', 'g.exp.tracked'], ['exp.v.clean.t', 'g.exp.clean']].map(([a, b]) => [h('dt', null, t(a)), h('dd', null, t(b))])),
      list('exp', 5), goBtn('export')));
    app(body, sec('crit', false, list('crit', 4), h('h3', null, t('g.prof.t')), list('prof', 4), goBtn('criteria')));
    app(body, sec('lim', false, list('lim', 6)));
    app(body, sec('keys', true, h('table', { class: 'g-keytab' },
      h('thead', null, h('tr', null, h('th', { scope: 'col' }, t('g.keys.col.k')), h('th', { scope: 'col' }, t('g.keys.col.a')))),
      h('tbody', null, range(6).map(k => h('tr', null, h('td', null, kbdNodes(t('g.keys.' + k + '.k'))), h('td', null, t('g.keys.' + k + '.a')))))),
      // Einzeltasten-Kürzel der Prüfung: gleiche Tabelle wie im Dialog «Tastenkürzel»
      h('h3', { id: 'gKbRv' }, t('g.keys.rv.h')), h('p', { class: 'g-p' }, t('g.keys.rv.p')), kbTable('g-kbtab')));
    app(page, h('div', { class: 'g-layout' }, toc, body));
    app(page, h('footer', { class: 'g-foot', id: 'gFoot' }, t('g.version', { v: DP.version || 'dev', d: isoDate(DP.buildDate) })));
    // Aktueller Abschnitt im Inhaltsverzeichnis (aria-current); der Beobachter endet, sobald die Ansicht ersetzt ist
    const seen = new Set(), obs = new IntersectionObserver((es) => {
      if (!toc.isConnected) { obs.disconnect(); return; }
      for (const e of es) { const id = e.target.id.slice(2); if (e.isIntersecting) seen.add(id); else seen.delete(id); }
      const cur = GUIDE.find(id => seen.has(id));
      for (const a of toc.querySelectorAll('a')) { if (a.dataset.fid === 'gt-' + cur) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); }
    }, { root: $('view'), rootMargin: '0px 0px -55% 0px' });
    for (const id of GUIDE) { const el = body.querySelector('#g-' + id); if (el) obs.observe(el); }
    return page;
  }

  /* ---------- Hinweis auf eine neue Version (nur Offline-Ausgabe) ----------
     Das Ergebnis der Versionsabfrage (src/update.js) steht in UPD; die Antwort ist fremd und wird nur als Text gezeigt. Der Link geht
     immer an die feste Adresse der neusten Ausgabe. Auf GitHub Pages (WEB) ist dieselbe Datei über https geöffnet: dort lädt man die
     Seite neu, statt herunterzuladen. Ohne Antwort und bei einem Stand älter als 90 Tage: ruhiger Hinweis, im Repository nachzusehen.
     «Ausblenden» gilt bis zum Neuladen (nichts wird gespeichert). */
  const AGE_DAYS = 90;
  let UPD = null, updHidden = false;
  /** Datum JJJJ-MM-TT in der Schreibweise der Oberfläche («18. November 2026»); sonst unverändert. */
  const isoDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '') ? DP.i18n.date(new Date(s + 'T12:00:00Z')) : (s || '–');
  function buildAgeDays() {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(DP.buildDate || ''); if (!m) return 0;
    return Math.floor((Date.now() - Date.UTC(+m[1], +m[2] - 1, +m[3])) / 86400000);
  }
  function updBand() {
    const band = $('updBand'); if (!band) return;
    const newer = UPD && UPD.state === 'newer', old = UPD && UPD.state !== 'newer' && UPD.state !== 'current' && buildAgeDays() > AGE_DAYS;
    if (!DP.offline || updHidden || !(newer || old)) { if (!band.hidden) { band.hidden = true; band.replaceChildren(); } return; }
    const close = h('button', { type: 'button', class: 'icon-btn upd-x', 'data-fid': 'upd-close', 'aria-label': t('upd.close'), 'data-tip': '', onclick: () => { updHidden = true; updBand(); $('view').focus({ preventScroll: true }); } }, icon('close'));
    let text, act;
    if (newer) {
      const info = UPD.info;
      text = [h('b', null, t('upd.new', { v: info.version })), ' ', h('span', { class: 'upd-date' }, t('upd.date', { d: isoDate(info.date) })), ' ', h('span', { class: 'upd-note', lang: S.lang }, info.note[S.lang] || info.note.de)];
      act = WEB ? h('button', { type: 'button', class: 'btn text sm', 'data-fid': 'upd-reload', onclick: () => location.reload() }, icon('refresh', 'sm'), t('upd.reload'))
        : h('a', { class: 'btn text sm', 'data-fid': 'upd-dl', href: RELEASE_URL, target: '_blank', rel: 'noopener noreferrer' }, icon('download', 'sm'), t('upd.dl'));
    } else {
      text = [h('span', null, t('upd.old', { d: isoDate(DP.buildDate) }))];
      act = h('a', { class: 'btn text sm', 'data-fid': 'upd-repo', href: RELEASE_URL, target: '_blank', rel: 'noopener noreferrer' }, icon('arrow_forward', 'sm'), t('upd.old.link'));
    }
    band.dataset.kind = newer ? 'newer' : 'old';
    band.setAttribute('aria-label', t('upd.region'));
    band.replaceChildren(h('span', { class: 'upd-ic', 'aria-hidden': 'true' }, icon('info', 'sm')), h('p', { class: 'upd-text' }, text), h('div', { class: 'upd-acts' }, act, close));
    band.hidden = false;
  }
  /** Versionsabfrage einmal je Start, nachdem die Seite bedienbar ist; ohne Modul (Ausgabe ohne Abfrage) nur der Altershinweis. */
  function startUpdateCheck() {
    if (!DP.offline) return;
    const done = (r) => { UPD = r; updBand(); };
    if (DP.updateCheck && DP.update && typeof DP.update.check === 'function') setTimeout(() => DP.update.check().then(done, () => done({ state: 'failed' })), 600);
    else done({ state: 'off' });
  }

  /* ---------- Rahmen ---------- */
  const NAV = ['docs', 'check', 'compare', 'export', 'criteria', 'help'];
  let menuOpen = false;
  /** Navigation unter 768 px: Offenlegung über die Menüschaltfläche (aria-expanded, Escape schliesst). */
  function setMenu(open, focusBtn) {
    menuOpen = open;
    $('topbar').classList.toggle('menu-open', open);
    const b = $('menuBtn'); b.setAttribute('aria-expanded', String(open)); b.replaceChildren(icon(open ? 'close' : 'menu'));
    if (open) { const nav = $('mainNav'); const f = nav.querySelector('[aria-current="page"]') || nav.querySelector('button'); if (f) f.focus(); }
    else if (focusBtn) b.focus();
  }
  function refreshChrome() {
    // Nur bei Änderung setzen: das Attribut löst sonst eine Stilberechnung des ganzen Dokuments aus
    if (document.documentElement.lang !== uiLang()) document.documentElement.lang = uiLang();
    $('skip').textContent = t('app.skip');
    $('brandSub').textContent = t('app.sub');
    $('brandBtn').setAttribute('aria-label', t('app.home')); $('brandBtn').dataset.tip = t('tip.home');
    const mark = $('offMark');
    if (mark && DP.offline) {
      // Kennzeichnung der Offline-Ausgabe: Version und Stand; die Kurzinfo sagt, welche Verbindung die Datei aufbaut, ein Klick führt zur Anleitung
      mark.hidden = false;
      mark.replaceChildren(h('span', { 'aria-hidden': 'true' }, t('off.mark') + ' ', h('span', { class: 'off-ver' }, DP.version || 'dev'), h('span', { class: 'off-date' }, ' · ' + isoDate(DP.buildDate))),
        h('span', { class: 'sr' }, t('off.mark.sr', { v: DP.version || 'dev', d: isoDate(DP.buildDate) })));
      mark.dataset.tip = t(DP.updateCheck ? 'tip.offMark' : 'tip.offMark.nc');
      if (!mark.onclick) mark.onclick = () => go('help', 'ai');
      const ws = $('webSave');
      if (ws && WEB) {
        document.documentElement.classList.add('is-web');
        // Auf GitHub Pages: eigene Kopie als Datei über die Seite der neusten Ausgabe (feste Adresse, nie aus einer Antwort)
        ws.hidden = false; ws.href = RELEASE_URL;
        ws.replaceChildren(icon('download', 'sm'), h('span', { class: 'lbl' }, t('web.save')));
        ws.setAttribute('aria-label', t('web.save')); ws.dataset.tip = t('tip.webSave');
      }
    }
    updBand();
    const chip = $('sessionChip'); chip.replaceChildren(icon('lock', 'sm'), h('span', { class: 'lbl' }, t('ses.chip'))); chip.setAttribute('aria-label', t('ses.chip')); chip.dataset.tip = t('tip.session');
    const seg = $('langSeg'); seg.setAttribute('aria-label', t('ui.lang'));
    seg.replaceChildren(...['de', 'fr', 'it'].map(l => h('button', { type: 'button', 'aria-pressed': String(S.lang === l), lang: l, 'data-tip': '', 'data-tip-label': cap(DP.i18n.DICT[l]['lang.' + l]), 'aria-label': l.toUpperCase() + ', ' + cap(DP.i18n.DICT[l]['lang.' + l]), 'data-fid': 'lang-' + l, onclick: () => setLang(l) }, l.toUpperCase())));
    const clr = $('clearBtn'); clr.replaceChildren(icon('delete_sweep')); clr.setAttribute('aria-label', t('ses.clear')); clr.dataset.tip = t('tip.clear'); clr.disabled = !canClear();
    const mb = $('menuBtn'); mb.setAttribute('aria-label', t('nav.menu')); mb.dataset.tip = ''; if (!mb.firstChild) mb.append(icon(menuOpen ? 'close' : 'menu'));
    const nav = $('mainNav'); nav.setAttribute('aria-label', t('nav.label'));
    const doc = docById(S.cur);
    const badge = { docs: S.docs.length ? [S.docs.length, 'neutral'] : null, check: null, compare: null, export: null, criteria: null, help: null };
    if (doc) { const c = countsOf(findingsOf(doc)); if (c.error + c.warn) badge.check = [c.error + c.warn, c.error ? 'err' : 'neutral']; const p = exportPlan(doc); if (doc.format === 'docx' && p.changes.length) badge.export = [p.changes.length, 'neutral']; }
    const cms = [S.cmp[S.ref + '>' + S.tgt]].concat(S.cmpMode === 'tri' && S.docs.length >= 3 ? [S.cmp[S.ref + '>' + S.tgt2]] : []).filter(c => c && cmpShown(c));
    const nCmp = cms.reduce((a, cm) => a + live(cm.findings.concat(extraOf(cm.id))).filter(f => f.sev !== 'info').length, 0); if (nCmp) badge.compare = [nCmp, 'err'];
    nav.replaceChildren(...NAV.map(r => h('button', { type: 'button', class: 'nav-link', 'aria-current': S.route === r ? 'page' : null, 'data-fid': 'nav-' + r, onclick: () => go(r) },
      h('span', { class: 'nav-label' }, t('nav.' + r)),
      badge[r] ? h('span', { class: 'badge ' + badge[r][1], 'aria-hidden': 'true' }, badge[r][0] > 99 ? '99+' : String(badge[r][0])) : null)));
  }
  const VIEWS = { docs: viewDocs, check: viewCheck, compare: viewCompare, export: viewExport, criteria: viewCriteria, help: viewHelp };
  /** Fokus setzen: das erste vorhandene, bedienbare Ziel der Liste (data-fid oder '#id'). Gibt es keines und war das Ziel
      ausdrücklich verlangt (strict), geht der Fokus auf ein stabiles Element: den Zähler der Vorschläge oder den Inhaltsbereich. */
  function applyFocus(list, strict) {
    const find = (x) => x.charAt(0) === '#' ? $(x.slice(1)) : document.querySelector('[data-fid="' + CSS.escape(x) + '"]');
    const ok = (el) => el && !el.disabled && el.getClientRects().length > 0;
    for (const x of list) { const el = x && find(x); if (ok(el)) { el.focus({ preventScroll: true }); return el; } }
    if (!strict) return null;
    const a = document.activeElement;
    if (a && a !== document.body && a.isConnected && ok(a)) return a;
    const st = $('rvCount') || $('view'); st.focus({ preventScroll: true }); return st;
  }
  function render() {
    hideTip();
    const main = $('view');
    const active = document.activeElement;
    const fid = active && active.getAttribute ? active.getAttribute('data-fid') : null;
    const tbOpened = S.tb && !$('dvTb');
    const want = S.focus; S.focus = null;
    const openDetails = Array.from(main.querySelectorAll('details[open] > summary')).map(s => s.getAttribute('data-fid'));
    RC = null;
    const page = VIEWS[S.route]();
    if (S.enter) { page.classList.add('enter'); Array.from(page.children).forEach((c, i) => c.style.setProperty('--i', Math.min(i, 8))); }
    else for (const el of page.querySelectorAll('.find, .doc')) el.style.animation = 'none';
    // Wechsel zwischen den Hauptzielen: kurzes Einblenden (110 ms), ohne Einfluss auf den Fokus
    if (S.fade && motionOk()) page.classList.add('fade-in');
    S.fade = false;
    for (const f of openDetails) { const s = page.querySelector('summary[data-fid="' + f + '"]'); if (s) s.parentNode.open = true; }
    main.replaceChildren(page);
    refreshChrome();
    if (want) applyFocus([].concat(want), true); else if (fid) applyFocus([fid], false);
    if (S.enter) main.scrollTop = 0;
    S.enter = false;
    layoutMargin();
    placeTb();
    if (S.reveal) { const rv = S.reveal; S.reveal = null; reveal(rv); }
    if (tbOpened && S.tb) placeTb(true);
    railDraw();
  }
  /** Teilweiser Neuaufbau nach einem Entscheid oder einer Auswahl in der Dokumentansicht: nur die betroffenen Absatzzeilen
      mit ihren Kartenstapeln, die Ergebniskarte, die Leiste und die Abzeichen. Sonst (andere Ansicht, Befund ohne Absatz) alles. */
  function update(paras) {
    const main = $('view'), doc = docById(S.cur), rows = main.querySelector('.dv-rows'), sum = $('sumCard'), bar = $('rvBar');
    const ps = Array.from(new Set(paras.filter(i => i !== undefined)));
    if (S.route !== 'check' || !doc || !sum || (S.view === 'doc' ? !rows : ps.length) || ps.some(i => i == null || !doc.paras[i])) { render(); return; }
    hideTip();
    const active = document.activeElement;
    const fid = active && active.getAttribute ? active.getAttribute('data-fid') : null;
    const tbOpened = S.tb && !$('dvTb');
    const want = S.focus; S.focus = null;
    RC = recheckOf(doc);
    const all = findingsOf(doc), shown = shownOf(all);
    const canCopy = doc.format !== 'docx' ? new Set(accParas(all)) : new Set();
    for (const i of ps) {
      const old = rows.querySelector(':scope > .dv-row[data-row="' + i + '"]'); if (!old) continue;
      old.replaceWith(buildRow(doc, i, shown.filter(f => f.para === i), canCopy));
    }
    const s2 = summaryCard(doc); s2.style.animation = 'none'; if (sum.querySelector('#metList') && s2.querySelector('#metList')) s2.querySelector('#metList').open = sum.querySelector('#metList').open;
    sum.replaceWith(s2);
    if (bar) { const b2 = reviewBar(doc, all); b2.style.animation = 'none'; bar.replaceWith(b2); }
    refreshChrome();
    if (want) applyFocus([].concat(want), true); else if (fid) applyFocus([fid], false);
    layoutMargin();
    placeTb();
    if (S.reveal) { const rv = S.reveal; S.reveal = null; reveal(rv); }
    if (tbOpened && S.tb) placeTb(true);
    railDraw();
  }
  /** Randspalte wie in Word: Jeder Kartenstapel beginnt auf der Höhe seines Absatzes. Reicht der Platz bis zum nächsten Stapel nicht,
      rückt der folgende Absatz so weit nach unten wie nötig; Absätze ohne Befunde nehmen überstehende Karten auf.
      Alle Masse werden einmal gelesen und dann gemeinsam geschrieben (kein Layout-Flattern). Unter 1056 px stehen die Karten unter dem Absatz. */
  function layoutMargin() { layoutRows(); linkDraw(); }
  function layoutRows() {
    const box = document.querySelector('.dv-rows'); if (!box) return;
    const rows = Array.from(box.children).filter(r => r.classList.contains('dv-row'));
    // Bestehende Abstände nicht erst zurücksetzen: sie werden aus den Massen herausgerechnet. So genügt ein Layoutdurchgang,
    // und geschrieben wird nur, was sich ändert (wichtig bei langen Dokumenten)
    const cur = rows.map(r => parseFloat(r.style.marginTop) || 0);
    if (matchMedia('(max-width: 1055px)').matches) { rows.forEach((r, k) => { if (cur[k]) r.style.marginTop = ''; }); if (box.style.minHeight) box.style.minHeight = ''; return; }
    if (!rows.length) return;
    const GAP = 10;
    let cum = 0;
    const m = rows.map((r, k) => { const st = r.querySelector('.dv-stack'); cum += cur[k]; return { r, top: r.offsetTop - cum, h: st ? st.offsetHeight : 0 }; });
    const lastR = rows[rows.length - 1], natural = lastR.offsetTop - cum + lastR.offsetHeight + (parseFloat(getComputedStyle(box).paddingBottom) || 0);
    let shift = 0, prevBottom = -Infinity, last = -1;
    const want = new Array(rows.length).fill(0);
    m.forEach((x, k) => {
      if (!x.h) return;
      const top = x.top + shift;
      const extra = Math.max(0, Math.ceil(prevBottom + GAP - top));
      // Der Abstand kommt direkt nach dem vorigen Absatz mit Befunden: Überschrift und Absatz bleiben beisammen
      if (extra) { want[Math.min(k, last + 1)] += extra; shift += extra; }
      prevBottom = top + extra + x.h; last = k;
    });
    rows.forEach((r, k) => { if (want[k] !== cur[k]) r.style.marginTop = want[k] ? want[k] + 'px' : ''; });
    const need = prevBottom + 24, mh = need > natural + shift ? need + 'px' : '';
    if (box.style.minHeight !== mh) box.style.minHeight = mh;
  }
  /** Werkzeugleiste unter die Änderung setzen, innerhalb der Absatzbreite. */
  function placeTb(scroll) {
    const tb = $('dvTb'); if (!tb) return;
    const c = tb.previousElementSibling, box = tb.offsetParent; if (!c || !box) return;
    const rs = c.getClientRects(), r = rs[rs.length - 1] || c.getBoundingClientRect(), b = box.getBoundingClientRect();
    const left = Math.max(8, Math.min(r.left - b.left, b.width - tb.offsetWidth - 8));
    tb.style.left = left + 'px'; tb.style.top = (r.bottom - b.top + 6) + 'px';
    if (scroll) tb.scrollIntoView({ block: 'nearest', behavior: 'auto' });
  }
  function reveal(rv) {
    const sel = '[data-id="' + CSS.escape(rv.id) + '"]';
    const main = $('view');
    let el = rv.what === 'chg' ? main.querySelector('.chg' + sel) : null;
    el = el || main.querySelector('.mc' + sel) || main.querySelector('.find' + sel);
    if (!el && S.view === 'list') { S.limit = 1e6; S.reveal = null; render(); el = main.querySelector('.find' + sel); }
    if (!el) return;
    const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ block: (rv.what === 'chg' && !rv.near) || S.view === 'list' ? 'center' : 'nearest', behavior: smooth ? 'smooth' : 'auto' });
  }
  /* ---------- Überarbeiten mit der Tastatur, Übersicht am Rand, Übergänge, Verbindungslinie ----------
     Alles hier ist Darstellung: Zustand und Entscheide laufen über select, decide, update und render wie mit der Maus.
     Bewegung nur ohne prefers-reduced-motion und nie bei Sammelentscheiden, Profilwechseln oder neuen Prüfläufen. */
  const motionOk = () => !matchMedia('(prefers-reduced-motion: reduce)').matches;
  /** Prüfergebnisse, deren Ring schon gezeigt wurde (Hochzählen nur einmal je Ergebnis). */
  const ringSeen = new WeakSet();
  /** Zahl, die einmal hochzählt: sichtbar über ::before (CSS-Zähler), im DOM steht der Endwert. Ab 1000 ohne Zählen (Tausendertrennung). */
  function countProps(n, play) {
    if (!play || !(n > 0) || n >= 1000) return null;
    return { class: 'cnt', style: { '--n': String(n), '--d': String(String(n).length) } };
  }
  /** Nach dem Hochzählen: Hilfsklasse und Variablen entfernen (danach genau wie ohne Bewegung). Chrome gleicht das style-Attribut
      verzögert ab: erst leeren und lesen, dann entfernen, sonst bleibt style="" stehen. */
  function countDone(root) { setTimeout(() => { for (const el of root.querySelectorAll('.cnt')) { el.removeAttribute('class'); el.style.cssText = ''; el.getAttribute('style'); el.removeAttribute('style'); } root.querySelectorAll('.ring.count').forEach(r => r.classList.remove('count')); }, 680); }
  /** Klasse und Variablen für die Dauer einer Animation; danach sind Klasse und style genau wie vorher. */
  function tmpAnim(el, cls, vars, ms, done) {
    const hadClass = el.hasAttribute('class'), hadStyle = el.hasAttribute('style');
    for (const k in vars || {}) el.style.setProperty(k, vars[k]);
    el.classList.add(cls);
    setTimeout(() => {
      el.classList.remove(cls); for (const k in vars || {}) el.style.removeProperty(k);
      if (!hadClass && !el.getAttribute('class')) el.removeAttribute('class');
      if (!hadStyle && !el.getAttribute('style')) el.removeAttribute('style');
      if (done) done();
    }, ms);
  }
  const SLOW = 240, FAST = 110;

  /* --- Rückgängig: Stapel der Entscheide dieser Sitzung (Einzelentscheide, Bearbeitungen, Sammelentscheide) --- */
  const undoStack = [];
  const snapOf = (f) => ({ a: !!f.accepted, d: !!f.dismissed, fa: !!f.fa, fp: f.faParams, repl: f.fix ? f.fix.repl : null, orig: f.fix ? f.fix.orig : undefined });
  const sameSt = (f, s) => !!f.accepted === s.a && !!f.dismissed === s.d && !!f.fa === s.fa && (f.fix ? f.fix.repl : null) === s.repl;
  function pushUndo(items) { if (!S.cur || !items.length) return; undoStack.push({ doc: S.cur, items: items.map(([f, b]) => [f, b, snapOf(f)]) }); if (undoStack.length > 200) undoStack.shift(); }
  /** Letzten Entscheid zurücknehmen. Einträge, die nicht mehr gelten (Befund neu geprüft, mit «Rückgängig» der Meldung schon zurückgenommen), überspringt sie. */
  function kbUndo(doc) {
    const have = new Set(findingsOf(doc));
    for (let k = undoStack.length - 1; k >= 0; k--) {
      const u = undoStack[k]; if (u.doc !== doc.id) continue;
      undoStack.splice(k, 1);
      if (!u.items.every(([f, , a]) => have.has(f) && sameSt(f, a))) continue;
      const one = u.items.length === 1, first = u.items.map(x => x[0]).sort(kbOrder(doc))[0];
      const touched = u.items.map(x => x[0].para).concat(paraOfId(S.sel), paraOfId(S.tb));
      if (one) animPrep(first);
      const from = stOf(first);
      for (const [f, b] of u.items) {
        f.accepted = b.a; f.dismissed = b.d; f.fa = b.fa; f.faParams = b.fp;
        if (f.fix) { f.fix.repl = b.repl; if (b.orig === undefined) delete f.fix.orig; else f.fix.orig = b.orig; }
      }
      if (one) animWant(first, from, stOf(first));
      if (!shownOf([first]).length) { S.sel = null; S.tb = null; S.focus = ['#rvCount']; if (one) update(touched); else render(); }
      else if (one) kbGoto(first, touched); else { S.tb = null; S.sel = first.id; S.focus = kbFocus(first); S.reveal = kbReveal(first); render(); }
      animRun();
      snack(t('rv.undone'));
      return;
    }
    snack(t('kb.noundo'));
  }

  /* --- Reihenfolge wie auf dem Bildschirm: Dokumentansicht nach Stelle, Liste nach Kategorie, Schweregrad und Stelle --- */
  function paraKeyFn(doc) {
    let first = null;
    return (f) => {
      if (f.para != null && doc.paras[f.para]) return f.para;
      if (f.slide && doc.format === 'pptx') {
        if (!first) { first = new Map(); doc.paras.forEach((p, i) => { if (p.loc.slide && !first.has(p.loc.slide)) first.set(p.loc.slide, i); }); }
        if (first.has(f.slide)) return first.get(f.slide) - 0.5;
      }
      return -1;
    };
  }
  function kbOrder(doc) {
    if (S.view === 'list') { const ci = new Map(R.CATS.map((k, i) => [k, i]));
      return (a, b) => (ci.get(a.cat) - ci.get(b.cat)) || SEV_ORDER[a.sev] - SEV_ORDER[b.sev] || (a.para == null ? -1 : a.para) - (b.para == null ? -1 : b.para) || (a.start || 0) - (b.start || 0); }
    const pk = paraKeyFn(doc);
    return (a, b) => pk(a) - pk(b) || posOf(a) - posOf(b) || SEV_ORDER[a.sev] - SEV_ORDER[b.sev];
  }
  const kbFocus = (f) => S.view === 'doc' ? ['chg-' + f.id, 'sel-' + f.id] : ['acc-' + f.id, 'dis-' + f.id, 'rst-' + f.id];
  const kbReveal = (f) => ({ id: f.id, what: S.view === 'doc' ? 'chg' : 'card', near: true });
  /** Befund wählen, ins Bild rollen und den Fokus dorthin setzen, ohne die Werkzeugleiste zu öffnen (Enter öffnet sie). */
  function kbGoto(f, touched) {
    touched = (touched || [paraOfId(S.sel), paraOfId(S.tb)]).concat(f.para);
    S.sel = f.id; S.tb = null; S.focus = kbFocus(f); S.reveal = kbReveal(f);
    let full = false;
    if (S.view === 'doc' && f.para != null && f.para >= S.paraLimit) { S.paraLimit = f.para + 100; full = true; }
    if (S.view === 'list') { const doc = docById(S.cur), k = shownOf(findingsOf(doc)).sort(kbOrder(doc)).indexOf(f); if (k >= S.limit) { S.limit = k + 50; full = true; } }
    if (full) render(); else update(touched);
    return true;
  }
  const openShown = (doc) => shownOf(findingsOf(doc)).filter(x => stOf(x) === 'open').sort(kbOrder(doc));
  function kbStep(doc, dir) {
    const order = kbOrder(doc), list = openShown(doc);
    if (!list.length) { snack(t('kb.none')); return; }
    const cur = findingsOf(doc).find(x => x.id === S.sel), k = cur ? list.indexOf(cur) : -1;
    let f;
    if (k >= 0) f = list[(k + dir + list.length) % list.length];
    else if (!cur) f = dir > 0 ? list[0] : list[list.length - 1];
    else f = dir > 0 ? (list.find(x => order(x, cur) > 0) || list[0]) : (list.slice().reverse().find(x => order(x, cur) < 0) || list[list.length - 1]);
    kbGoto(f);
  }
  function kbDecide(doc, c) {
    const f = findingsOf(doc).find(x => x.id === S.sel);
    if (!f || !shownOf([f]).length) { snack(t('kb.nosel')); return; }
    const st = stOf(f), docv = S.view === 'doc';
    if (c === 'e') {
      if (!f.fix || st === 'rejected') { snack(t('kb.noedit')); return; }
      const card = $('view').querySelector((docv ? '.mc' : '.find') + '[data-id="' + CSS.escape(f.id) + '"]');
      if (card) editFix(f, card, docv ? 'm-' : ''); else snack(t('kb.noedit'));
      return;
    }
    if (st !== 'open') { snack(t('kb.done')); return; }
    if ((c === 'a' || c === 'r') && !f.fix) { snack(t('kb.nofix')); return; }
    if (c === 'i' && f.fix) { snack(t('kb.hasfix')); return; }
    const to = c === 'a' ? 'accepted' : c === 'r' ? 'rejected' : 'ignored';
    const order = kbOrder(doc), rest = openShown(doc).filter(x => x !== f);
    const next = rest.find(x => order(x, f) > 0) || rest[0] || null;
    const back = docv ? 'chg-' + f.id : (f.fix ? 'rst-' : 'dis-') + f.id;
    decide(f, to, back, docv ? 'tb' : 'list', next);
  }
  function onKey(e) {
    if (e.defaultPrevented || e.ctrlKey || e.altKey || e.metaKey || e.isComposing) return;
    if (S.route !== 'check' || (S.view !== 'doc' && S.view !== 'list') || menuOpen || $('dlg').open || !S.keys) return;
    const el = e.target;
    if (el && el.closest && el.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), dialog')) return;
    const doc = docById(S.cur); if (!doc || !S.res[doc.id]) return;
    const k = e.key;
    if (k === '?') { e.preventDefault(); kbDialog(); return; }
    if (e.shiftKey || !k || k.length !== 1) return;
    const c = k.toLowerCase();
    if (!'jkariue'.includes(c)) return;
    e.preventDefault();
    if (e.repeat && c !== 'j' && c !== 'k') return;
    hideTip();
    if (c === 'j' || c === 'k') kbStep(doc, c === 'j' ? 1 : -1);
    else if (c === 'u') kbUndo(doc);
    else kbDecide(doc, c);
  }
  const kbdNodes = (s) => s.split(/(, | \+ | oder | ou | o )/).map(x => /^(, | \+ | oder | ou | o )$/.test(x) ? x : h('kbd', null, x));
  function kbTable(fid) {
    return h('table', { class: 'g-keytab kb-tab', 'data-fid': fid },
      h('thead', null, h('tr', null, h('th', { scope: 'col' }, t('g.keys.col.k')), h('th', { scope: 'col' }, t('g.keys.col.a')))),
      h('tbody', null, ['j', 'a', 'r', 'i', 'u', 'e', 'enter', 'q'].map(k => h('tr', null, h('td', null, kbdNodes(t('kb.' + k + '.k'))), h('td', null, t('kb.' + k + '.a'))))));
  }
  /** Übersicht der Tastenkürzel mit dem Schalter, der die Einzeltasten-Kürzel aus- und einschaltet (WCAG 2.1.4). */
  function kbDialog() {
    dialog((d, close) => {
      d.setAttribute('aria-labelledby', 'dlgTitle');
      app(d, h('div', { class: 'dlg-body kb-dlg' }, h('h2', { id: 'dlgTitle' }, t('kb.h')), h('p', { class: 'help' }, t('kb.lead')), kbTable('kb-tab'),
        h('label', { class: 'check kb-sw', for: 'kbOn' }, h('input', { type: 'checkbox', id: 'kbOn', 'data-fid': 'kb-on', checked: S.keys, 'aria-describedby': 'kbOnD', onchange: (e) => { S.keys = e.target.checked; } }), h('span', null, t('kb.on'))),
        h('p', { class: 'help', id: 'kbOnD' }, t('kb.on.d'))),
        h('div', { class: 'dlg-actions' }, h('button', { type: 'button', class: 'btn', 'data-fid': 'kb-close', onclick: close, 'data-autofocus': true }, t('btn.close'))));
    });
  }

  /* --- Übergänge im Text und auf den Karten nach einem Einzelentscheid --- */
  let anim = null;
  /** Vor dem Neuaufbau: Farben der Karte merken (danach blendet sie vom alten zum neuen Zustand über). */
  function animPrep(f) {
    anim = null;
    if (!motionOk() || S.route !== 'check' || (S.view !== 'doc' && S.view !== 'list')) return;
    const card = $('view').querySelector((S.view === 'doc' ? '.mc' : '.find') + '[data-id="' + CSS.escape(f.id) + '"]');
    let cs = null; if (card) { const c = getComputedStyle(card); cs = { bg: c.backgroundColor, sev: c.borderLeftColor }; }
    const chg = S.view === 'doc' ? $('view').querySelector('.chg[data-id="' + CSS.escape(f.id) + '"]') : null;
    anim = { id: f.id, card: cs, mkBg: chg && !f.fix ? getComputedStyle(chg).backgroundColor : null };
  }
  function animWant(f, from, to) { if (anim && anim.id === f.id) { anim.from = from; anim.to = to; } }
  function animRun() {
    const a = anim; anim = null;
    if (!a || !a.from || a.from === a.to || !motionOk()) return;
    const main = $('view'), q = '[data-id="' + CSS.escape(a.id) + '"]', doc = docById(S.cur);
    const f = doc && findingsOf(doc).find(x => x.id === a.id); if (!f) return;
    const card = main.querySelector((S.view === 'doc' ? '.mc' : '.find') + q);
    if (card && a.card) tmpAnim(card, 'st-anim', { '--from-bg': a.card.bg, '--from-sev': a.card.sev }, SLOW + 20);
    if (S.view !== 'doc' || f.para == null) return;
    const chg = main.querySelector('.chg' + q);
    if (chg) chgAnim(chg, f, doc, a.from, a.to);
    // Abgelehnt, ignoriert oder als Fehlalarm ausgeblendet: die Stelle ist wieder gewöhnlicher Text; der Übergang läuft auf dem Text selbst
    else if (a.to !== 'open') plainAnim(f, doc, a);
  }
  /** Textknoten, der die Stelle [s, e] eines Absatzes ganz enthält (Kinder der Absatzzeile: Text und Änderungen in Reihenfolge). */
  function textAt(pEl, doc, s, e) {
    const byId = new Map(findingsOf(doc).map(x => [x.id, x])); let pos = 0;
    for (const n of pEl.childNodes) {
      if (n.nodeType === 3) { if (s >= pos && e <= pos + n.data.length) return { node: n, off: pos }; pos += n.data.length; }
      else if (n.classList && n.classList.contains('chg')) { const x = byId.get(n.dataset.id); if (!x) return null; pos = x.fix ? x.fix.end : x.end; }
    }
    return null;
  }
  function plainAnim(f, doc, a) {
    const pEl = $('view').querySelector('.dv-row[data-row="' + f.para + '"] > .dv-p'); if (!pEl) return;
    const text = doc.paras[f.para].text, s0 = f.fix ? f.fix.start : f.start, e0 = f.fix ? f.fix.end : f.end;
    const hit = textAt(pEl, doc, s0, e0); if (!hit) return;
    const pieces = [];
    if (f.fix) {
      // Abgelehnt: das Original verliert die Streichung, die Einfügung klappt zu
      const old = text.slice(s0, e0), ops = f.fix.words ? DP.exporter.diffOps(old, f.fix.repl, s0) : [{ start: s0, end: e0, repl: f.fix.repl }];
      let pos = s0;
      for (const o of ops) {
        if (o.start > pos) pieces.push(document.createTextNode(text.slice(pos, o.start)));
        if (o.end > o.start) pieces.push(h('span', { class: 'a-set a-del' }, text.slice(o.start, o.end)));
        if (o.repl) pieces.push(h('span', { class: 'a-ghost a-ins', 'data-t': vis(o.repl), 'aria-hidden': 'true' }));
        pos = Math.max(pos, o.end);
      }
      if (pos < e0) pieces.push(document.createTextNode(text.slice(pos, e0)));
    } else if (a.mkBg) pieces.push(h('span', { class: 'a-bg', style: { '--from-bg': a.mkBg } }, text.slice(s0, e0)));
    if (!pieces.length) return;
    const n = hit.node, d = n.data, wrap = h('span', { class: 'a-run' }, pieces);
    const before = document.createTextNode(d.slice(0, s0 - hit.off)), after = document.createTextNode(d.slice(e0 - hit.off));
    n.replaceWith(before, wrap, after);
    for (const g of wrap.querySelectorAll('.a-ghost')) { const w = foldWidth(g); if (w == null) g.remove(); else g.style.setProperty('--w', w + 'px'); }
    // Danach steht wieder derselbe Textknoten wie ohne Übergang
    setTimeout(() => { if (wrap.isConnected) { before.remove(); after.remove(); wrap.replaceWith(n); layoutMargin(); } }, SLOW + 20);
  }
  /** Breite eines Stücks, das auf- oder zuklappt; null, wenn es dafür zu lang ist (mehrzeilig oder breiter als die halbe Zeile). */
  function foldWidth(el) {
    const p = el.closest('.dv-p'); if (!p) return null;
    el.classList.add('a-measure'); const w = el.getBoundingClientRect().width; el.classList.remove('a-measure'); if (!el.getAttribute('class')) el.removeAttribute('class');
    return w > 0 && w < p.clientWidth * 0.5 ? w : null;
  }
  function chgAnim(chg, f, doc, from, to) {
    const done = () => { layoutMargin(); };
    if (!f.fix) { tmpAnim(chg, to === 'ignored' ? 'a-mk-out' : 'a-mk-in', null, SLOW + 20); return; }
    const text = doc.paras[f.para] && doc.paras[f.para].text; if (text == null) return;
    const s0 = f.fix.start, e0 = f.fix.end, old = text.slice(s0, e0), repl = f.fix.repl;
    if (from === 'open' && (to === 'accepted' || to === 'rejected')) {
      // Stücke wie vorher (Streichung, Einfügung, Umfeld) in den sichtbaren Text setzen; Streichung bzw. Einfügung klappt zu (Geist ohne Textknoten),
      // das Bleibende verliert seine Auszeichnung. Danach steht wieder genau der ursprüngliche Inhalt.
      const vis1 = chg.querySelector(':scope > span:not([class])'); if (!vis1) return;
      const ops = f.fix.words ? DP.exporter.diffOps(old, repl, s0) : [{ start: s0, end: e0, repl }];
      const acc = to === 'accepted', pieces = []; let pos = s0, real = '';
      const ghost = (s, kind) => s ? h('span', { class: 'a-ghost a-' + kind, 'data-t': vis(s), 'aria-hidden': 'true' }) : null;
      const keep = (s, kind) => { if (!s) return null; real += s; return h('span', { class: 'a-set a-' + kind }, s); };
      for (const o of ops) {
        if (o.start > pos) { const c = text.slice(pos, o.start); real += c; pieces.push(document.createTextNode(c)); }
        const d = text.slice(o.start, o.end);
        pieces.push(acc ? ghost(d, 'del') : keep(d, 'del'), acc ? keep(o.repl, 'ins') : ghost(o.repl, 'ins'));
        pos = Math.max(pos, o.end);
      }
      if (pos < e0) { const c = text.slice(pos, e0); real += c; pieces.push(document.createTextNode(c)); }
      if (real !== (acc ? repl : old)) return;
      const saved = Array.from(vis1.childNodes), caret = vis1.querySelector('.caret');
      vis1.replaceChildren(...pieces.filter(Boolean), ...(caret ? [caret] : []));
      for (const g of vis1.querySelectorAll('.a-ghost')) { const w = foldWidth(g); if (w == null) g.remove(); else g.style.setProperty('--w', w + 'px'); }
      tmpAnim(chg, 'a-run', null, SLOW + 20, () => { if (chg.isConnected) { vis1.replaceChildren(...saved); done(); } });
      return;
    }
    if (to === 'open') {
      // Zurücksetzen: die zurückkehrende Streichung bzw. Einfügung klappt auf, das andere Stück erhält seine Auszeichnung zurück
      const grow = from === 'accepted' ? 'DEL' : 'INS';
      for (const el of chg.querySelectorAll(':scope > del, :scope > ins')) {
        if (el.tagName === grow) { const w = foldWidth(el); if (w != null) tmpAnim(el, 'a-grow', { '--w': w + 'px' }, SLOW + 20); }
        else tmpAnim(el, 'a-unset', null, SLOW + 20);
      }
      setTimeout(() => { if (chg.isConnected) done(); }, SLOW + 40);
    }
  }

  /* --- Übersicht der Befunde am rechten Rand (Dokumentansicht, ab 1056 px): eine Zeichenfläche, ein bedienbares Element --- */
  let RAIL = null, TOK = null;
  const railCum = new WeakMap();
  /** Gewicht je Absatz (etwa Zeilen) als laufende Summe: so liegt eine Marke ungefähr dort, wo der Befund im ganzen Dokument steht. */
  function railWeights(doc) {
    let c = railCum.get(doc.paras); if (c) return c;
    c = new Float64Array(doc.paras.length + 1);
    doc.paras.forEach((p, i) => { c[i + 1] = c[i] + 1 + Math.ceil(p.text.length / 90) + (p.kind === 'h' || p.kind === 'title' ? 1 : 0); });
    railCum.set(doc.paras, c); return c;
  }
  function railEl() {
    return h('div', { class: 'dv-rail', id: 'dvRail', role: 'slider', tabindex: '0', 'data-fid': 'rail', 'aria-label': t('rail.label'), 'aria-describedby': 'dvRailD', 'aria-orientation': 'vertical',
      'aria-valuemin': '1', 'aria-valuemax': '1', 'aria-valuenow': '1', hidden: true, onclick: railClick, onkeydown: railKey },
      h('canvas', { 'aria-hidden': 'true' }), h('span', { class: 'sr', id: 'dvRailD' }, t('rail.d')));
  }
  function railDraw() {
    const el = $('dvRail'), doc = docById(S.cur);
    if (!el || !doc || S.view !== 'doc') { RAIL = null; return; }
    const shown = shownOf(findingsOf(doc)).sort(kbOrder(doc));
    if (el.hidden !== !shown.length) el.hidden = !shown.length;
    if (!shown.length) { RAIL = null; return; }
    const cum = railWeights(doc), T = cum[cum.length - 1] || 1, pk = paraKeyFn(doc);
    const marks = shown.map(f => { const p = pk(f); let fr = 0;
      if (p >= 0) { const i = Math.floor(p); fr = (cum[i] + (p === i ? (cum[i + 1] - cum[i]) * Math.min(1, posOf(f) / Math.max(1, doc.paras[i].text.length)) : 0)) / T; }
      return { f, fr, sev: f.sev, done: stOf(f) !== 'open' }; });
    RAIL = { doc, list: shown, marks, cum, T };
    const k = shown.findIndex(f => f.id === S.sel), sel = shown[k];
    const set = (a, v) => { if (el.getAttribute(a) !== v) el.setAttribute(a, v); };
    set('aria-valuemax', String(shown.length)); set('aria-valuenow', String(k >= 0 ? k + 1 : 1));
    set('aria-valuetext', sel ? t('rail.vt', { i: num(k + 1), n: num(shown.length), sev: t('sev.' + sel.sev), title: t('c.' + sel.crit + '.t'), loc: locOf(sel, doc) }) : tn('rail.none', shown.length));
    railPlace(el); railPaint();
  }
  function railPlace(el) {
    const m = $('view'), r = m.getBoundingClientRect(), sb = m.offsetWidth - m.clientWidth;
    const top = Math.round(r.top + 8) + 'px', ht = Math.max(0, Math.round(r.height - 16)) + 'px', left = Math.round(r.right - sb - 22) + 'px';
    if (el.style.top !== top) el.style.top = top; if (el.style.height !== ht) el.style.height = ht; if (el.style.left !== left) el.style.left = left;
  }
  /** Sichtbarer Ausschnitt als Anteil am Dokument [von, bis]; null, wenn kein Absatz im Bild ist. */
  function railView() {
    const rows = document.querySelector('.dv-rows'); if (!rows || !RAIL) return null;
    const kids = rows.children, n = kids.length - (rows.lastElementChild && rows.lastElementChild.classList.contains('dv-link') ? 1 : 0); if (!n) return null;
    const mr = $('view').getBoundingClientRect(), bar = $('rvBar'), top = Math.max(mr.top, bar ? bar.getBoundingClientRect().bottom : mr.top), bot = mr.bottom;
    const at = (y) => { let lo = 0, hi = n - 1, ans = -1; while (lo <= hi) { const mid = (lo + hi) >> 1; if (kids[mid].getBoundingClientRect().bottom <= y) lo = mid + 1; else { ans = mid; hi = mid - 1; } } return ans; };
    const frOf = (k, y) => {
      let e = kids[k], j = k; while (e && !e.hasAttribute('data-row') && j < n - 1) e = kids[++j];
      if (!e || !e.hasAttribute('data-row')) return 1;
      const p = +e.getAttribute('data-row'), r = e.getBoundingClientRect(), w = Math.max(0, Math.min(1, (y - r.top) / Math.max(1, r.height)));
      return (RAIL.cum[p] + w * (RAIL.cum[p + 1] - RAIL.cum[p])) / RAIL.T;
    };
    if (kids[0].getBoundingClientRect().top > bot) return null;
    const a = at(top); if (a < 0) return null;
    const b = at(bot);
    return [frOf(a, top), b < 0 ? frOf(n - 1, kids[n - 1].getBoundingClientRect().bottom) : frOf(b, bot)];
  }
  function railPaint() {
    const el = $('dvRail'); if (!el || !RAIL || el.hidden) return;
    const cv = el.firstChild, w = el.clientWidth, H = el.clientHeight; if (!w || !H) return;
    const dpr = devicePixelRatio || 1, W2 = Math.round(w * dpr), H2 = Math.round(H * dpr);
    if (cv.width !== W2) cv.width = W2; if (cv.height !== H2) cv.height = H2;
    if (!TOK) { const cs = getComputedStyle(document.documentElement), v = (n) => cs.getPropertyValue(n).trim();
      TOK = { track: v('--surface-1'), error: v('--error'), warn: v('--warning'), warnEdge: v('--warning-text'), info: v('--ink-subtle'), frame: v('--border-strong'), ink: v('--ink') }; }
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, H);
    g.fillStyle = TOK.track; g.fillRect(0, 0, w, H);
    const pad = 4, span = H - 2 * pad - 3, yOf = (fr) => Math.round(pad + fr * span);
    // Dicht beieinander: eine Marke je 3 px, mit dem schwersten offenen Befund (sonst dem schwersten erledigten, blass)
    const bins = new Map();
    for (const m of RAIL.marks) { const b = Math.floor(yOf(m.fr) / 3); let x = bins.get(b); if (!x) bins.set(b, x = { y: b * 3, open: null, done: null, ms: [] });
      x.ms.push(m); const k = m.done ? 'done' : 'open'; if (!x[k] || SEV_ORDER[m.sev] < SEV_ORDER[x[k]]) x[k] = m.sev; }
    RAIL.bins = bins; RAIL.yOf = yOf;
    // Länge nach Schweregrad (Fehler ganze Breite, Warnung zwei Drittel, Hinweis ein Drittel), dazu der Farbton
    const len = { error: w, warn: Math.round(w * 2 / 3), info: Math.round(w / 3) };
    for (const x of bins.values()) {
      const sev = x.open || x.done; g.globalAlpha = x.open ? 1 : 0.3;
      g.fillStyle = TOK[sev]; g.fillRect(0, x.y, len[sev], 3);
      if (sev === 'warn') { g.strokeStyle = TOK.warnEdge; g.lineWidth = 1; g.strokeRect(0.5, x.y + 0.5, len[sev] - 1, 2); }
    }
    g.globalAlpha = 1;
    const fv = railView();
    if (fv) { const y0 = yOf(fv[0]), y1 = Math.max(y0 + 4, yOf(fv[1]) + 3); g.strokeStyle = TOK.frame; g.lineWidth = 1; g.strokeRect(0.5, y0 + 0.5, w - 1, y1 - y0 - 1); }
    const sm = RAIL.marks.find(m => m.f.id === S.sel);
    if (sm) { const y = Math.floor(yOf(sm.fr) / 3) * 3; g.strokeStyle = TOK.ink; g.lineWidth = 2; g.strokeRect(1, y - 2, w - 2, 7); }
  }
  function railClick(e) {
    if (!RAIL || !RAIL.bins) return;
    const el = e.currentTarget, y = e.clientY - el.getBoundingClientRect().top;
    let best = null, bd = 7;
    for (const x of RAIL.bins.values()) { const d = Math.abs(x.y + 1.5 - y); if (d < bd) { bd = d; best = x; } }
    if (best) { const m = best.ms.find(z => !z.done) || best.ms[0]; select(m.f, { reveal: 'chg', focus: ['chg-' + m.f.id, 'sel-' + m.f.id] }); return; }
    // Keine Marke in der Nähe: zum Absatz an dieser Stelle rollen
    const fr = Math.max(0, Math.min(1, (y - 4) / Math.max(1, el.clientHeight - 11))) * RAIL.T, cum = RAIL.cum;
    let lo = 0, hi = cum.length - 2; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (cum[mid] <= fr) lo = mid; else hi = mid - 1; }
    if (lo >= S.paraLimit) { S.paraLimit = lo + 100; render(); }
    const row = document.querySelector('.dv-rows > .dv-row[data-row="' + lo + '"]'), main = $('view'), bar = $('rvBar');
    if (row) main.scrollTo({ top: main.scrollTop + row.getBoundingClientRect().top - (bar ? bar.getBoundingClientRect().bottom : main.getBoundingClientRect().top) - 16, behavior: motionOk() ? 'smooth' : 'auto' });
  }
  function railKey(e) {
    if (!RAIL) return;
    const L = RAIL.list, k = L.findIndex(f => f.id === S.sel);
    if (e.key === 'Enter' && k >= 0) { e.preventDefault(); applyFocus(['chg-' + L[k].id, 'sel-' + L[k].id]); return; }
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1, PageDown: 10, PageUp: -10, Home: -1e9, End: 1e9 }[e.key];
    if (!step) return;
    e.preventDefault(); e.stopPropagation();
    // Pos1 und Ende springen immer an den Anfang bzw. das Ende; die übrigen Tasten ohne Auswahl zum ersten bzw. letzten Befund
    const i = Math.abs(step) >= 1e9 ? (step > 0 ? L.length - 1 : 0) : k < 0 ? (step > 0 ? 0 : L.length - 1) : Math.max(0, Math.min(L.length - 1, k + step));
    select(L[i], { reveal: 'chg', focus: '#dvRail' });
  }

  /* --- Verbindungslinie: gewählte Randkarte ↔ Textstelle, als Winkel durch Rand und Zwischenraum (deckt keinen Text und keine Bedienelemente) --- */
  function linkDraw() {
    const ln = $('dvLink'); if (!ln) return;
    const hide = () => { if (!ln.hidden) ln.hidden = true; };
    if (!S.sel || S.view !== 'doc' || matchMedia('(max-width: 1055px)').matches) return hide();
    const rows = ln.parentNode, q = '[data-id="' + CSS.escape(S.sel) + '"]';
    const chg = rows.querySelector('.chg' + q), card = rows.querySelector('.mc' + q);
    if (!chg || !card) return hide();
    const main = $('view'), mr = main.getBoundingClientRect(), bar = $('rvBar'), top = Math.max(mr.top, bar ? bar.getBoundingClientRect().bottom : mr.top);
    const cr = chg.getClientRects()[0], kr = card.getBoundingClientRect(); if (!cr) return hide();
    const yc = kr.top + 16;
    if (cr.top < top || cr.bottom > mr.bottom || yc < top || yc > mr.bottom) return hide();
    const p = chg.closest('.dv-p'), pr = p.getBoundingClientRect(), br = rows.getBoundingClientRect();
    const xm = Math.round(kr.left - br.left - 12), x0 = Math.min(xm - 8, Math.round(pr.right - br.left - (parseFloat(getComputedStyle(p).paddingRight) || 0) + 8));
    const y0 = Math.round(cr.top + cr.height / 2 - br.top), y1 = Math.round(yc - br.top), xc = Math.round(kr.left - br.left);
    const put = (el, l, tp, wd, ht) => { const s = el.style, v = [l + 'px', tp + 'px', wd + 'px', ht + 'px']; if (s.left !== v[0]) s.left = v[0]; if (s.top !== v[1]) s.top = v[1]; if (s.width !== v[2]) s.width = v[2]; if (s.height !== v[3]) s.height = v[3]; };
    put(ln.children[0], x0, y0, xm - x0, 1); put(ln.children[1], xm, Math.min(y0, y1), 1, Math.abs(y1 - y0) + 1); put(ln.children[2], xm, y1, xc - xm, 1);
    if (ln.hidden) ln.hidden = false;
  }
  let scrollRaf = 0;
  function onViewScroll() { if (scrollRaf) return; scrollRaf = requestAnimationFrame(() => { scrollRaf = 0; railPaint(); linkDraw(); }); }

  /** anchor: Abschnitt der Anleitung, zu dem die Ansicht springt. */
  function go(route, anchor) {
    if (menuOpen) setMenu(false); clearSnack(); S.route = route; S.tb = null; S.pin = null; S.enter = true; S.fade = true; S.filter = { sev: null, cat: null, hidden: S.filter.hidden, rc: null }; render();
    if (anchor && $('gh-' + anchor)) jumpTo(anchor); else $('view').focus({ preventScroll: true });
  }
  function setLang(l) { S.lang = l; DP.i18n.set(l); clearSnack(); render(); }
  function sessionDialog() {
    dialog((d, close) => {
      d.setAttribute('aria-labelledby', 'dlgTitle');
      app(d, h('div', { class: 'dlg-body' }, h('h2', { id: 'dlgTitle' }, t('ses.title')), h('ul', null, [['computer', 'ses.p1'], ['cloud_off', 'ses.p2'], ['fact_check', 'ses.p3'], DP.offline ? ['lock', okey('ses.p4.off')] : ['auto_awesome', 'ses.p4']].map(([ic, k]) => h('li', null, icon(ic), h('span', null, t(k)))))),
        h('div', { class: 'dlg-actions' }, h('button', { type: 'button', class: 'btn text', 'data-fid': 'ses-guide', onclick: () => { close(); go('help', 'data'); } }, icon('help', 'sm'), t('ses.guide')), canClear() ? h('button', { type: 'button', class: 'btn text', 'data-fid': 'ses-clear', onclick: () => { close(); confirmClear(); } }, t('ses.clear')) : null, h('button', { type: 'button', class: 'btn', onclick: close, 'data-autofocus': true }, t('btn.close'))));
    });
  }
  function confirmClear() {
    dialog((d, close) => {
      d.setAttribute('aria-labelledby', 'dlgTitle');
      app(d, h('div', { class: 'dlg-body' }, h('h2', { id: 'dlgTitle' }, t('ses.clear')), h('p', null, t('ses.clear.q'))),
        h('div', { class: 'dlg-actions' }, h('button', { type: 'button', class: 'btn text', onclick: close, 'data-autofocus': true }, t('btn.cancel')), h('button', { type: 'button', class: 'btn danger', onclick: () => { close(); clearSession(); } }, t('btn.confirm'))));
    });
  }

  /* ---------- Kurzinfos: ein Element (#tip), delegierte Ereignisse, Inhalt aus data-tip (Beschreibung) und data-tip-label ----------
     Erscheint beim Zeigen mit der Maus nach kurzer Verzögerung und sofort bei Tastaturfokus; verschwindet mit Escape, beim Verlassen und beim Fokuswechsel.
     Die Beschreibung hängt per aria-describedby am Bedienelement, der Name bleibt dessen eigener. Bei Schaltflächen ohne sichtbaren Text zeigt
     die Kurzinfo zusätzlich den Namen (nur sichtbar, aria-hidden). Auf Berührungsgeräten gibt es kein Zeigen: dort steht nichts Wesentliches nur in Kurzinfos. */
  let tipFor = null, tipVia = null, tipShowT = null, tipHideT = null, tabAt = 0;
  const tipTarget = (n) => { const el = n && n.closest ? n.closest('[data-tip]') : null; return el && !el.disabled && el.isConnected ? el : null; };
  function placeTip() {
    const tip = $('tip'), el = tipFor; if (!el || tip.hidden) return;
    const r = el.getBoundingClientRect(), M = 8, vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
    // Ausserhalb des Bildes (etwa während des Hineinrollens nach einem Fokuswechsel) nur unsichtbar, nicht geschlossen
    tip.style.visibility = r.bottom < 0 || r.top > vh ? 'hidden' : '';
    const w = tip.offsetWidth, ht = tip.offsetHeight;
    let top = r.bottom + 8; if (top + ht > vh - M && r.top - 8 - ht >= M) top = r.top - 8 - ht;
    top = Math.max(M, Math.min(top, vh - ht - M));
    const left = Math.max(M, Math.min(r.left + r.width / 2 - w / 2, vw - w - M));
    tip.style.left = Math.round(left) + 'px'; tip.style.top = Math.round(top) + 'px';
  }
  function showTip(el, via) {
    clearTimeout(tipShowT); clearTimeout(tipHideT);
    if (tipFor === el) { if (via === 'focus') tipVia = via; return; }
    hideTip();
    const desc = el.getAttribute('data-tip') || '';
    const label = el.getAttribute('data-tip-label') || (el.innerText.trim() ? '' : el.getAttribute('aria-label') || '');
    if (!desc && !label) return;
    const tip = $('tip');
    tip.replaceChildren(...[label ? h('span', { class: 'tip-l', 'aria-hidden': 'true' }, label) : null, desc ? h('span', { id: 'tipD' }, desc) : null].filter(Boolean));
    tip.classList.toggle('two', !!(label && desc));
    if (desc) { const db = el.getAttribute('aria-describedby'); el.setAttribute('data-tip-db', db || ''); el.setAttribute('aria-describedby', (db ? db + ' ' : '') + 'tipD'); }
    tipFor = el; tipVia = via; tip.hidden = false; placeTip();
  }
  function hideTip() {
    clearTimeout(tipShowT); clearTimeout(tipHideT);
    const el = tipFor, tip = $('tip'); tipFor = null; tipVia = null;
    if (tip && !tip.hidden) { tip.hidden = true; tip.replaceChildren(); }
    if (el && el.hasAttribute('data-tip-db')) { const db = el.getAttribute('data-tip-db'); if (db) el.setAttribute('aria-describedby', db); else el.removeAttribute('aria-describedby'); el.removeAttribute('data-tip-db'); }
  }
  function initTips() {
    const tip = $('tip');
    document.addEventListener('pointerover', (e) => {
      if (e.pointerType !== 'mouse') return;
      if (tip.contains(e.target)) { clearTimeout(tipHideT); return; }
      const el = tipTarget(e.target);
      if (el && el === tipFor) { clearTimeout(tipHideT); return; }
      clearTimeout(tipShowT);
      if (el) tipShowT = setTimeout(() => { if (el.isConnected && el.matches(':hover')) showTip(el, 'hover'); }, 500);
    });
    document.addEventListener('pointerout', (e) => {
      if (e.pointerType !== 'mouse') return;
      const to = e.relatedTarget, el = tipTarget(e.target) || (tip.contains(e.target) ? tipFor : null);
      if (!el || (to && (el.contains(to) || tip.contains(to)))) return;
      clearTimeout(tipShowT);
      // Kurz warten, damit der Zeiger auf die Kurzinfo wechseln kann (WCAG 1.4.13); bei Tastaturfokus bleibt sie stehen
      if (tipFor === el && tipVia === 'hover') tipHideT = setTimeout(hideTip, 150);
    });
    document.addEventListener('focusin', (e) => { const el = tipTarget(e.target); if (el && el === e.target && el.matches(':focus-visible') && Date.now() - tabAt < 400) showTip(el, 'focus'); else if (tipFor && tipFor !== el) hideTip(); });
    document.addEventListener('focusout', (e) => { if (tipFor && e.target === tipFor) hideTip(); });
    // Kurzinfo bei Fokus nur nach Tab (Tastaturnavigation), nie bei programmatisch zurückgesetztem Fokus, etwa nach einem Dialog
    document.addEventListener('keydown', (e) => { if (e.key === 'Tab') tabAt = Date.now(); }, true);
    document.addEventListener('pointerdown', () => { tabAt = 0; if (tipFor) hideTip(); }, true);
    // Escape schliesst zuerst nur die Kurzinfo: das Ereignis geht nicht weiter an Werkzeugleiste, Menü oder Dialog
    document.addEventListener('keydown', (e) => {
      if (!tipFor) return;
      if (e.key === 'Escape') { const shown = !$('tip').hidden; hideTip(); if (shown) { e.stopPropagation(); e.preventDefault(); } return; }
      if (e.key !== 'Tab' && e.key !== 'Shift' && tipFor.matches('select, input[type="number"]')) hideTip();
    }, true);
    document.addEventListener('scroll', () => placeTip(), true);
    window.addEventListener('resize', () => placeTip());
  }

  function init() {
    const nav = (navigator.language || 'de').slice(0, 2).toLowerCase();
    S.lang = ['de', 'fr', 'it'].includes(nav) ? nav : 'de'; DP.i18n.set(S.lang);
    $('sessionChip').addEventListener('click', sessionDialog);
    $('clearBtn').addEventListener('click', confirmClear);
    $('skip').addEventListener('click', () => $('view').focus());
    $('file').addEventListener('change', (e) => { const f = Array.from(e.target.files); e.target.value = ''; addFiles(f); });
    // Neue Fassung eines bestimmten Dokuments; Profildatei
    $('verFile').addEventListener('change', (e) => { const f = Array.from(e.target.files); e.target.value = ''; const v = verFor; verFor = null; if (f.length && v) addFiles(f.slice(0, 1), false, { versionOf: v.id, focus: v.focus }); });
    $('profFile').addEventListener('change', (e) => { const f = Array.from(e.target.files); e.target.value = ''; if (f.length) loadProfileFile(f[0], f.slice(1)); });
    $('dlg').addEventListener('click', (e) => { if (e.target === $('dlg')) $('dlg').close(); });
    $('menuBtn').addEventListener('click', () => setMenu(!menuOpen));
    initTips();
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menuOpen) { e.preventDefault(); setMenu(false, true); }
      else if (e.key === 'Escape' && S.tb && !$('dlg').open) { e.preventDefault(); closeTb(true); }
    });
    // Klick ausserhalb schliesst die Werkzeugleiste an der Textstelle
    document.addEventListener('click', (e) => { if (S.tb && e.target.isConnected && !e.target.closest('.dv-tb, .chg')) closeTb(false); });
    $('brandBtn').addEventListener('click', () => go('docs'));
    window.addEventListener('resize', () => { layoutMargin(); placeTb(false); railDraw(); });
    // Tastenkürzel der Prüfung; Übersicht am Rand und Verbindungslinie folgen dem Rollen
    document.addEventListener('keydown', onKey);
    $('view').addEventListener('scroll', onViewScroll, { passive: true });
    // Ganzes Fenster als Ablage: Zieht jemand eine Datei über die Seite «Dokumente», hebt sich die Ablagefläche hervor
    const dragFiles = (e) => e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
    const dropOver = (on) => { const d = $('drop'); if (d) d.classList.toggle('over', on); };
    window.addEventListener('dragenter', (e) => { if (S.route === 'docs' && dragFiles(e)) dropOver(true); });
    window.addEventListener('dragover', (e) => { if (S.route === 'docs' && dragFiles(e)) dropOver(true); });
    window.addEventListener('dragleave', (e) => { if (!e.relatedTarget) dropOver(false); });
    window.addEventListener('drop', () => dropOver(false), true);
    document.addEventListener('click', (e) => { if (menuOpen && !e.composedPath().includes($('topbar'))) setMenu(false); });
    $('topbar').addEventListener('focusout', (e) => { if (menuOpen && e.relatedTarget && !$('topbar').contains(e.relatedTarget)) setMenu(false); });
    // Dateien, die neben die Ablagefläche fallen, öffnet der Browser sonst als Seite
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => { e.preventDefault(); if (e.dataTransfer && e.dataTransfer.files.length && !e.target.closest('#drop')) { if (S.route !== 'docs') go('docs'); addFiles(e.dataTransfer.files); } });
    render();
    // Zurück-Cache des Browsers (bfcache): Wer die Seite verlässt und mit «Zurück» wiederkommt, findet keine Dokumente mehr vor.
    // Beim Verlassen wird geleert; kommt die Seite trotzdem aus dem Cache zurück, lädt sie neu.
    window.addEventListener('pagehide', (e) => { if (e.persisted) dropAll(); });
    window.addEventListener('pageshow', (e) => { if (e.persisted) location.reload(); });
    // Offline-Ausgabe: keine KI, Speichern immer über den Browser; die Schnittstelle zu Claude wird gar nicht erst abgefragt
    if (DP.offline) { S.aiAvail = false; S.dlAvail = true; startUpdateCheck(); return; }
    DP.ai.getSample().then(s => { S.aiAvail = !!s; if (!s) render(); });
    DP.ai.getDownloads().then(d => { if (globalThis.claude) { S.dlAvail = !!d; if (!d) render(); } });
  }
  DP.ui = { init, render, go, setLang, addFiles, reportBlocks, stOf, msgOf, recheckOf, feedbackEntries, loadProfileFile, annotItems,
    // Testhaken: Marken der Übersicht am Rand (Kennung, Höhe in px ab Oberkante) und Rückgängig-Stapel
    rail: () => RAIL && RAIL.yOf ? RAIL.marks.map(m => ({ id: m.f.id, y: Math.floor(RAIL.yOf(m.fr) / 3) * 3 + 1.5, done: m.done })) : null,
    undoDepth: () => undoStack.length,
    findings: (d) => findingsOf(d || docById(S.cur)),
    fixedText: (i, d) => { d = d || docById(S.cur); return fixedText(d, i, findingsOf(d)); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(globalThis.DP = globalThis.DP || {});
