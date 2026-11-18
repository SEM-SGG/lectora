/* Dateiformate für die eigene Festplatte: Prüfprofil (nur Einstellungen) und Rückmeldung zu den Regeln (Fehlalarme).
   Lectora speichert nichts selbst; beide Dateien entstehen nur auf ausdrücklichen Klick und gehen über den Download des Browsers
   bzw. von Claude auf die Festplatte der Person. Ein Profil enthält nie Dokumentinhalte, Dateinamen oder Befunde. */
(function (DP) {
  'use strict';
  const R = DP.rules;
  const FORMAT = 'lectora-profil', SCHEMA = 1;
  const FB_FORMAT = 'lectora-rueckmeldung', FB_SCHEMA = 1;
  /** Höchstlängen der Textfelder (Zeichen) und der Datei (Bytes). Längere Texte werden gekürzt und im Dialog genannt. */
  const LIMITS = { name: 80, custom: 4000, terms: 20000, acts: 20000, author: 60, version: 20 };
  const MAX_BYTES = 512 * 1024;
  const version = () => (typeof DP.version === 'string' && DP.version) || 'dev';

  /** Steuerzeichen entfernen (ausser Zeilenumbruch und Tabulator), Zeilenenden vereinheitlichen. */
  const clean = (s) => String(s).replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');

  /** Einstellungen, die eine Prüfung prägen, aus dem Zustand der Oberfläche: kanonisch (sortiert, nur abweichende Parameter),
      damit derselbe Stand dieselbe Zeichenkette ergibt (Erkennung «geändert»). */
  function capture(S) {
    const params = {}, o = S.settings.params || {};
    for (const p of R.PARAMS) if (p.id in o && o[p.id] !== p.def) params[p.id] = o[p.id];
    return { off: Array.from(S.settings.off).sort(), params, custom: S.settings.custom || '', terms: S.settings.termsText || '', acts: S.settings.actsText || '',
      author: S.author == null ? 'Lectora' : S.author, comments: S.expComments !== false };
  }
  const sig = (S) => JSON.stringify(capture(S));
  /** Ausgangswerte (für den Vergleich «Standard»). */
  const DEFAULT_SETTINGS = { off: [], params: {}, custom: '', terms: '', acts: '', author: 'Lectora', comments: true };
  const defaultSig = () => JSON.stringify(DEFAULT_SETTINGS);

  function build(S, name, now) {
    return { format: FORMAT, schema: SCHEMA, name: clean(name || '').trim().slice(0, LIMITS.name), created: (now || new Date()).toISOString(), lectora: version(), settings: capture(S) };
  }

  /** Erkennt am Text, ob eine Datei ein Lectora-Profil sein will (für die Ablagefläche). */
  function looksLikeProfile(text) { return /^\s*\{/.test(text) && /"format"\s*:\s*"lectora-profil"/.test(text.slice(0, 4000)); }

  /** Liest ein Profil streng und zugleich nachsichtig. Ergebnis: {ok:false, err} oder {ok:true, profile, report}.
      err: 'size' (zu gross), 'json' (kein JSON), 'format' (kein Lectora-Profil), 'shape' (Einstellungen fehlen).
      report: ignorierte Kriterien und Parameter, angepasste Werte, gekürzte oder unbrauchbare Felder, neuere Schemaversion. */
  function parse(text) {
    if (typeof text !== 'string') return { ok: false, err: 'json' };
    if (text.length > MAX_BYTES) return { ok: false, err: 'size' };
    let o; try { o = JSON.parse(text.replace(/^\ufeff/, '')); } catch (e) { return { ok: false, err: 'json' }; }
    if (!o || typeof o !== 'object' || Array.isArray(o) || o.format !== FORMAT) return { ok: false, err: 'format' };
    if (!Number.isInteger(o.schema) || o.schema < 1) return { ok: false, err: 'format' };
    const s = o.settings;
    if (!s || typeof s !== 'object' || Array.isArray(s)) return { ok: false, err: 'shape' };
    const report = { unknownCrit: [], unknownParam: [], clamped: [], cut: [], badField: [], newer: o.schema > SCHEMA };
    const str = (v, field, lim) => {
      if (v == null) return null;
      if (typeof v !== 'string') { report.badField.push(field); return null; }
      const c = clean(v); if (c.length > lim) { report.cut.push(field); return c.slice(0, lim); }
      return c;
    };
    // Ausgeschaltete Kriterien: nur bekannte Kennungen
    const off = [];
    if (s.off != null && !Array.isArray(s.off)) report.badField.push('off');
    for (const id of Array.isArray(s.off) ? s.off : []) {
      if (typeof id === 'string' && R.BY_ID[id]) { if (!off.includes(id)) off.push(id); }
      else report.unknownCrit.push(String(id).slice(0, 12));
    }
    // Parameter: nur bekannte, Werte über clampParam (Grenzen, Schrittweite); Standardwerte entfallen
    const params = {};
    if (s.params != null && (typeof s.params !== 'object' || Array.isArray(s.params))) report.badField.push('params');
    else for (const k of Object.keys(s.params || {})) {
      const p = R.PARAM_BY_ID[k], v = s.params[k];
      if (!p) { report.unknownParam.push(k.slice(0, 24)); continue; }
      if (typeof v !== 'number' && typeof v !== 'string') { report.clamped.push(k); continue; }
      const c = R.clampParam(p, v), n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
      if (c !== n) report.clamped.push(k);
      if (c !== p.def) params[k] = c;
    }
    // Die Warnschwelle der Satzlänge liegt nie unter der Hinweisschwelle
    const note = 'L01.note' in params ? params['L01.note'] : R.PARAM_BY_ID['L01.note'].def, warn = 'L01.warn' in params ? params['L01.warn'] : R.PARAM_BY_ID['L01.warn'].def;
    if (warn < note) { params['L01.warn'] = note; if (!report.clamped.includes('L01.warn')) report.clamped.push('L01.warn'); }
    for (const k of Object.keys(params)) if (params[k] === R.PARAM_BY_ID[k].def) delete params[k];
    const author = str(s.author, 'author', LIMITS.author);
    let comments = true;
    if (s.comments != null) { if (typeof s.comments === 'boolean') comments = s.comments; else report.badField.push('comments'); }
    const sorted = {}; for (const k of Object.keys(params).sort()) sorted[k] = params[k];
    const settings = { off: off.sort(), params: sorted, custom: str(s.custom, 'custom', LIMITS.custom) || '', terms: str(s.terms, 'terms', LIMITS.terms) || '',
      acts: str(s.acts, 'acts', LIMITS.acts) || '', author: author == null ? 'Lectora' : author, comments };
    const name = (str(o.name, 'name', LIMITS.name) || '').replace(/\s+/g, ' ').trim();
    const d = typeof o.created === 'string' ? new Date(o.created) : null;
    const created = d && !isNaN(d) ? d.toISOString() : null;
    const lectora = typeof o.lectora === 'string' ? clean(o.lectora).slice(0, LIMITS.version) : '';
    return { ok: true, profile: { name, created, lectora, schema: o.schema, settings }, report };
  }

  /** Einstellungen eines gelesenen Profils in den Zustand übernehmen (ohne neue Prüfung; die ruft die Oberfläche). */
  function apply(S, settings) {
    S.settings.off = new Set(settings.off);
    S.settings.params = Object.assign({}, settings.params);
    S.settings.custom = settings.custom;
    S.settings.termsText = settings.terms; S.settings.terms = R.parseTerms(settings.terms);
    S.settings.actsText = settings.acts; S.settings.acts = DP.erlasse ? DP.erlasse.parseCustom(settings.acts).acts : [];
    S.author = settings.author; S.expComments = settings.comments;
  }

  /** Dateiname aus dem Profilnamen: nur Buchstaben, Ziffern, Punkt, Binde- und Unterstrich. */
  const fileName = (name, prefix) => (prefix || 'Lectora-Profil') + '_' + ((name || '').normalize('NFC').replace(/[^\p{L}\p{N}._-]+/gu, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'Profil') + '.json';

  /** Rückmeldung zu den Regeln: entries sind schon zusammengestellt (siehe ui.js feedbackEntries); hier nur der Rahmen. */
  function feedback(entries, excerpts, now) {
    return { format: FB_FORMAT, schema: FB_SCHEMA, lectora: version(), created: (now || new Date()).toISOString().slice(0, 10), excerpts: !!excerpts, entries };
  }

  DP.profile = { FORMAT, SCHEMA, FB_FORMAT, FB_SCHEMA, LIMITS, MAX_BYTES, capture, sig, defaultSig, DEFAULT_SETTINGS, build, parse, apply, looksLikeProfile, fileName, feedback, version };
})(globalThis.DP = globalThis.DP || {});
