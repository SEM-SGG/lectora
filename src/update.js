/* Versionsabfrage der Offline-Ausgabe: die einzige Verbindung, die Lectora von sich aus aufbaut.
   Beim Start (nachdem die Seite bedienbar ist) liest die Offline-Ausgabe einmal die Datei version.json auf GitHub Pages. Der Workflow
   release legt sie dort erst ab, wenn die Tests bestanden sind und das Release besteht (docs/release.md).
   Die Anfrage trägt keine Dokumentdaten und keine Kennung: keine Abfrageparameter, keine eigenen Kopfzeilen, keine Cookies
   (credentials: 'omit'), kein Referrer, kein Zwischenspeicher. GitHub sieht wie bei jedem Webzugriff die IP-Adresse.
   Die Sicherheitsrichtlinie (CSP) der Offline-Ausgabe erlaubt genau diese Adresse (build.mjs, connect-src).
   Alles, was zurückkommt, ist fremd: strenge Form, Längen, Versionsmuster; angezeigt wird es nur als Text (ui.js, textContent).
   Der Link zum Herunterladen steht fest im Code (ui.js, RELEASE_URL) und stammt nie aus der Antwort.
   Fehlt dieses Modul (node build.mjs --offline --no-update-check), gibt es keine Abfrage: build.mjs lässt die Datei dann weg. */
(function (DP) {
  'use strict';
  const VERSION_URL = 'https://sem-sgg.github.io/lectora/version.json';
  const TIMEOUT_MS = 8000, MAX_BYTES = 4096, NOTE_MAX = 200, MAX_KEYS = 8;
  // Nur X.Y.Z mit Ziffern, ohne führende Nullen und ohne Zusatz (kein -beta, kein +build)
  const VER = /^(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,3})$/;
  const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
  const LANGS = ['de', 'fr', 'it'];

  const plain = (o) => o !== null && typeof o === 'object' && !Array.isArray(o) && Object.getPrototypeOf(o) === Object.prototype;
  function parseVer(s) { const m = typeof s === 'string' && VER.exec(s); return m ? [+m[1], +m[2], +m[3]] : null; }
  /** Semantischer Vergleich: < 0, wenn a älter ist als b; 0 bei Gleichheit; > 0, wenn a neuer ist. Ungültig: null. */
  function cmp(a, b) {
    const x = parseVer(a), y = parseVer(b); if (!x || !y) return null;
    for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
    return 0;
  }
  function validDate(s) {
    const m = typeof s === 'string' && DATE.exec(s); if (!m) return false;
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
  }
  // Ein Hinweistext: kurz, eine Zeile, keine Steuerzeichen, keine spitzen Klammern (kein Markup, auch nicht als Text) und nichts,
  // das wie eine Adresse aussieht (://, www., ein Hostname wie beispiel.ch): Der Hinweis soll nie zu einem anderen Download verleiten.
  // Der Link zum Herunterladen steht fest im Code (ui.js, RELEASE_URL).
  const URLISH = /:\/\/|\bwww\.|(?:^|[^\p{L}\d])[\p{L}\d-]+(?:\.[\p{L}\d-]+)*\.(?:[a-z]{2,24})(?![\p{L}\d])|@/iu;
  const okNote = (s) => typeof s === 'string' && s.trim().length > 0 && s.length <= NOTE_MAX && !/[\u0000-\u001f\u007f-\u009f\u2028\u2029<>]/.test(s) && !URLISH.test(s);

  /** Prüft das gelesene Objekt. Ergebnis: eingefrorene Kopie {version, date, note: {de, fr, it}} oder null. */
  function validate(o) {
    if (!plain(o) || Object.keys(o).length > MAX_KEYS) return null;
    if (!parseVer(o.version) || !validDate(o.date) || !plain(o.note)) return null;
    if (!LANGS.every(l => okNote(o.note[l]))) return null;
    return Object.freeze({ version: o.version, date: o.date, note: Object.freeze({ de: o.note.de.trim(), fr: o.note.fr.trim(), it: o.note.it.trim() }) });
  }

  /** Text der Antwort lesen, höchstens MAX_BYTES; mehr: Abbruch (null). */
  async function readCapped(res) {
    const len = res.headers.get('content-length');
    if (len != null && !(Number(len) <= MAX_BYTES)) return null;
    if (!res.body || !res.body.getReader) { const t = await res.text(); return t.length <= MAX_BYTES ? t : null; }
    const rd = res.body.getReader(), parts = []; let n = 0;
    for (;;) {
      const { done, value } = await rd.read();
      if (done) break;
      n += value.byteLength;
      if (n > MAX_BYTES) { try { await rd.cancel(); } catch (e) { /* egal */ } return null; }
      parts.push(value);
    }
    const all = new Uint8Array(n); let o = 0; for (const p of parts) { all.set(p, o); o += p.byteLength; }
    return new TextDecoder('utf-8', { fatal: true }).decode(all);
  }

  let started = null;
  /** Fragt einmal ab (weitere Aufrufe liefern dasselbe Ergebnis). Ergebnis, nie eine Ausnahme:
      {state: 'newer', info} | {state: 'current', info} | {state: 'failed'} */
  function check() {
    if (started) return started;
    started = (async () => {
      const ctl = typeof AbortController === 'function' ? new AbortController() : null;
      const tm = setTimeout(() => { if (ctl) ctl.abort(); }, TIMEOUT_MS);
      try {
        const res = await fetch(VERSION_URL, { method: 'GET', mode: 'cors', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', redirect: 'error', signal: ctl ? ctl.signal : undefined });
        if (!res.ok) return { state: 'failed' };
        const text = await readCapped(res);
        if (text == null || !/^\s*\{/.test(text)) return { state: 'failed' };
        let o; try { o = JSON.parse(text); } catch (e) { return { state: 'failed' }; }
        const info = validate(o);
        if (!info) return { state: 'failed' };
        const c = cmp(info.version, DP.version);
        if (c == null) return { state: 'failed' };
        return { state: c > 0 ? 'newer' : 'current', info };
      } catch (e) { return { state: 'failed' }; }
      finally { clearTimeout(tm); }
    })();
    return started;
  }

  DP.update = { VERSION_URL, TIMEOUT_MS, MAX_BYTES, NOTE_MAX, parseVer, cmp, validate, check };
})(globalThis.DP = globalThis.DP || {});
