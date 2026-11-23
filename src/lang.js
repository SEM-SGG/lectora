/* Sprachhilfen: Erkennung, Tokenisierung, sprachabhängige Muster. Kein DOM. */
(function (DP) {
  'use strict';

  const STOP = {
    de: 'der die das und ist nicht mit für von den dem des ein eine einer eines auf sich auch werden wird sind wurde bei nach oder als dass zu zur zum im über durch sowie diese dieser dieses kann können muss müssen gemäss gilt wenn aus an es er sie wir hat haben sein ihre seiner vor bis unter gegen ohne'.split(' '),
    fr: 'le la les des du de et est pas avec pour par un une dans sur qui que au aux ce cette ces sont être ont été ne se en ou comme selon peut doit doivent leur leurs il elle nous vous ils elles son sa ses à plus ainsi lorsque si entre sans sous vers chez dont où tous toutes chaque cet avant après aussi très mais donc car afin lors depuis pendant contre notre votre y on d l qu n s c j est-ce toute tout fait faire été avoir peuvent'.split(' '),
    it: 'il lo la gli le del della dei delle degli di e è non con per da un una uno nel nella nei nelle sul sulla che al alla ai alle questo questa questi queste sono essere ha hanno si in o come secondo può deve devono loro suo sua suoi sue più anche se tra fra senza sotto verso presso cui dove a i ed ad tutti tutte ogni dal dalla dai dalle dagli degli agli allo dello nello sullo sui sulle viene vengono quale quali prima dopo anche ma quindi perché affinché durante contro nostro vostro ci vi ne li d l dell all nell sull stato stata stati state avere fare fatto possono'.split(' '),
    en: 'the and is are not with for of to in on by this that these those be been has have was were will shall must may can which from as at or an it its their our we you they but if into than then when where who'.split(' ')
  };
  const STOPSET = {};
  for (const l in STOP) STOPSET[l] = new Set(STOP[l]);

  function words(text) {
    return (text.toLowerCase().match(/[\p{L}][\p{L}'’\-]*/gu) || []);
  }

  /** Liefert {lang, conf, n} — conf = Anteil Stoppwörter der besten Sprache minus zweitbeste. */
  function detect(text) {
    const w = words(text);
    if (w.length < 4) return { lang: null, conf: 0, n: w.length };
    const sc = { de: 0, fr: 0, it: 0, en: 0 };
    for (const x of w) {
      // Elisionen aufbrechen: l'office, dell'ufficio
      const parts = x.split(/['’]/);
      for (const p of parts) for (const l in sc) if (STOPSET[l].has(p)) sc[l]++;
    }
    if (/[äöü]/i.test(text)) sc.de += 1.5;
    if (/[àâçéèêëîïôùûœ]/i.test(text)) { sc.fr += 0.6; }
    if (/[àèéìòù]\b/i.test(text)) { sc.it += 0.4; }
    const ord = Object.keys(sc).sort((a, b) => sc[b] - sc[a]);
    const best = ord[0], second = ord[1];
    if (sc[best] === 0) return { lang: null, conf: 0, n: w.length };
    return { lang: best, conf: (sc[best] - sc[second]) / w.length, n: w.length, score: sc[best] / w.length };
  }

  function wordCount(text) { return words(text).length; }

  /** Sätze mit Offsets. Abkürzungen und Ordnungszahlen beenden keinen Satz. */
  const ABBR = /(?:(?<![\p{L}\d])(?:Art|Abs|Bst|Ziff|Nr|Kap|vgl|Vgl|Bzw|Ca|Inkl|Evtl|Ggf|bzw|usw|etc|inkl|exkl|ca|z|B|d|h|u|a|s|S|Fr|Dr|Prof|al|let|ch|cf|p|ex|no|n°|art|cpv|lett|pag|ecc|sig|sigg|dott|n|ev|evtl|ggf|resp|sog|max|min|Tel|tél|tel|St|ff|f|M|Mme|MM|av|env|éd|vol|chap|par|cfr|es|seg|segg|i|e|v|o)\.)$/u;
  function sentences(text) {
    const out = [];
    let start = 0;
    const re = /[.!?…]+[»"”’)\]]*(?=\s+[«"„“(\[]?[\p{Lu}\d]|\s*$)/gu;
    let m;
    while ((m = re.exec(text))) {
      const end = m.index + m[0].length;
      const before = text.slice(Math.max(0, m.index - 12), m.index + 1);
      if (m[0][0] === '.' && (ABBR.test(before) || /\d\.$/.test(before) && /^\s+\p{Ll}/u.test(text.slice(end)))) continue;
      // Ordnungszahl vor Monatsname oder Kleinbuchstabe: "12. November" ist kein Satzende
      if (m[0][0] === '.' && /\d\.$/.test(before) && /^\s+(?:\p{Lu}\p{Ll}+\s+\d{4}|Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)/u.test(text.slice(end))) continue;
      const s = text.slice(start, end);
      if (s.trim()) out.push({ text: s.trim(), start: start + (s.length - s.trimStart().length), end });
      start = end;
    }
    const rest = text.slice(start);
    if (rest.trim()) out.push({ text: rest.trim(), start: start + (rest.length - rest.trimStart().length), end: text.length });
    return out;
  }

  const MONTHS = {
    de: ['januar', 'februar', 'märz', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'dezember'],
    fr: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
    it: ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'],
    en: ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
  };
  const ALLMONTHS = [].concat(MONTHS.de, MONTHS.fr, MONTHS.it, MONTHS.en);
  const MONTH_RE = Array.from(new Set(ALLMONTHS)).sort((a, b) => b.length - a.length).join('|');
  function monthIndex(name) {
    const n = name.toLowerCase();
    for (const l in MONTHS) { const i = MONTHS[l].indexOf(n); if (i >= 0) return i + 1; }
    return 0;
  }
  const pad = (n) => String(n).padStart(2, '0');

  /** Findet Datumsangaben. Liefert [{iso, form, start, end, raw}] — form: long|dot|slash|iso|monthyear. */
  function findDates(text) {
    const out = [];
    const taken = [];
    const push = (o) => { if (!taken.some(t => o.start < t[1] && o.end > t[0])) { taken.push([o.start, o.end]); out.push(o); } };
    let m;
    const reLong = new RegExp('\\b(\\d{1,2})(?:\\.|er|°|º)?[\\s\\u00a0]+(' + MONTH_RE + ')[\\s\\u00a0]+(\\d{4})\\b', 'giu');
    while ((m = reLong.exec(text))) push({ iso: m[3] + '-' + pad(monthIndex(m[2])) + '-' + pad(+m[1]), form: 'long', start: m.index, end: m.index + m[0].length, raw: m[0] });
    const reEn = new RegExp('\\b(' + MONTHS.en.join('|') + ')\\s+(\\d{1,2}),?\\s+(\\d{4})\\b', 'gi');
    while ((m = reEn.exec(text))) push({ iso: m[3] + '-' + pad(monthIndex(m[1])) + '-' + pad(+m[2]), form: 'long', start: m.index, end: m.index + m[0].length, raw: m[0] });
    const reIso = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
    while ((m = reIso.exec(text))) push({ iso: m[0], form: 'iso', start: m.index, end: m.index + m[0].length, raw: m[0] });
    const reDot = /(?<![\d.])(\d{1,2})\.[\s\u00a0]?(\d{1,2})\.[\s\u00a0]?(\d{4}|\d{2})(?![\d.]|\s?\d)/g;
    while ((m = reDot.exec(text))) {
      const d = +m[1], mo = +m[2]; if (d < 1 || d > 31 || mo < 1 || mo > 12) continue;
      const y = m[3].length === 2 ? '20' + m[3] : m[3];
      push({ iso: y + '-' + pad(mo) + '-' + pad(d), form: 'dot', start: m.index, end: m.index + m[0].length, raw: m[0] });
    }
    const reSlash = /(?<![\d/])(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})(?![\d/])/g;
    while ((m = reSlash.exec(text))) {
      const d = +m[1], mo = +m[2]; if (d < 1 || d > 31 || mo < 1 || mo > 12) continue;
      const y = m[3].length === 2 ? '20' + m[3] : m[3];
      push({ iso: y + '-' + pad(mo) + '-' + pad(d), form: 'slash', start: m.index, end: m.index + m[0].length, raw: m[0] });
    }
    const reMY = new RegExp('(?<!\\d[.\\s\\u00a0]{1,3})\\b(' + MONTH_RE + ')[\\s\\u00a0]+(\\d{4})\\b', 'giu');
    while ((m = reMY.exec(text))) push({ iso: m[2] + '-' + pad(monthIndex(m[1])), form: 'monthyear', start: m.index, end: m.index + m[0].length, raw: m[0] });
    return out.sort((a, b) => a.start - b.start);
  }

  /** Zahlen im Text, normalisiert. Überspringt Bereiche in skip [[s,e],...]. */
  function findNumbers(text, skip) {
    const out = [];
    const re = /(?<![\p{L}\d])\d+(?:[ \u00a0\u202f'’.]\d{3})*(?:[.,]\d+)?(?=(?:er|re|e|ème|eme|°|º|ª)?(?![\p{L}\d]))/gu;
    let m;
    while ((m = re.exec(text))) {
      const s = m.index, e = s + m[0].length;
      if (skip && skip.some(r => s < r[1] && e > r[0])) continue;
      let raw = m[0];
      let style = null;
      if (/\d[\s\u00a0\u202f]\d{3}/.test(raw)) style = 'space';
      else if (/\d['’]\d{3}/.test(raw)) style = 'apos';
      else if (/^\d{1,3}(\.\d{3})+$/.test(raw)) style = 'dot';
      let norm = raw;
      if (style === 'dot') norm = raw.replace(/\./g, '');
      else {
        norm = raw.replace(/[\s\u00a0\u202f'’]/g, '');
        norm = norm.replace(',', '.');
      }
      // führende Nullen und nachgestellte Dezimalnullen vereinheitlichen
      if (/^\d+\.\d+$/.test(norm)) norm = String(parseFloat(norm));
      else norm = norm.replace(/^0+(?=\d)/, '');
      out.push({ raw, norm, style, start: s, end: e });
    }
    return out;
  }

  /** Rechtsverweise, sprachneutral normalisiert: "art5|abs2|bsta". */
  const REF_PARTS = [
    ['art', /\b(?:Art(?:ikel|icle|icolo|\.)?|art\.)[\s\u00a0]*(\d+[a-z]?(?:bis|ter|quater)?)/giu],
    ['abs', /\b(?:Abs(?:atz|\.)?|al(?:inéa|\.)|cpv\.|capoverso)[\s\u00a0]*(\d+(?:bis|ter)?)/giu],
    ['bst', /\b(?:Bst\.|Buchstabe|lit\.|let(?:tre|\.)|lett(?:era|\.))[\s\u00a0]*([a-z])\b/giu],
    ['ziff', /\b(?:Ziff(?:er|\.)|ch(?:iffre|\.)|n(?:umero|\.))[\s\u00a0]*(\d+(?:\.\d+)*)/giu]
  ];
  function findLegalRefs(text) {
    const out = [];
    for (const [k, re] of REF_PARTS) {
      re.lastIndex = 0; let m;
      while ((m = re.exec(text))) out.push({ key: k + m[1].toLowerCase(), start: m.index, end: m.index + m[0].length, raw: m[0] });
    }
    // SR-/RS-Nummern
    const sr = /\b(?:SR|RS)[\s\u00a0]+(\d{3}(?:\.\d+)*)/g; let m;
    while ((m = sr.exec(text))) out.push({ key: 'sr' + m[1], start: m.index, end: m.index + m[0].length, raw: m[0] });
    return out.sort((a, b) => a.start - b.start);
  }

  const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>«»"“”)\]]+[^\s<>«»"“”)\].,;:!?]/gi;
  const MAIL_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
  function findUrls(text) {
    const out = []; let m;
    URL_RE.lastIndex = 0; while ((m = URL_RE.exec(text))) out.push({ raw: m[0], start: m.index, end: m.index + m[0].length, kind: 'url' });
    MAIL_RE.lastIndex = 0; while ((m = MAIL_RE.exec(text))) out.push({ raw: m[0], start: m.index, end: m.index + m[0].length, kind: 'mail' });
    return out;
  }

  /** Amtliche Abkürzungen: [de, fr, it]. Nur eindeutige Kürzel. */
  const GLOSSARY = [
    ['EDA', 'DFAE', 'DFAE'], ['EDI', 'DFI', 'DFI'], ['EJPD', 'DFJP', 'DFGP'], ['VBS', 'DDPS', 'DDPS'],
    ['EFD', 'DFF', 'DFF'], ['WBF', 'DEFR', 'DEFR'], ['UVEK', 'DETEC', 'DATEC'], ['BAZG', 'OFDF', 'UDSC'],
    ['BAG', 'OFSP', 'UFSP'], ['BFS', 'OFS', 'UST'], ['BIT', 'OFIT', 'UFIT'], ['BBL', 'OFCL', 'UFCL'],
    ['EDÖB', 'PFPDT', 'IFPDT'], ['AIG', 'LEI', 'LStrI'], ['AsylG', 'LAsi', 'LAsi'], ['DSG', 'LPD', 'LPD'],
    ['VwVG', 'PA', 'PA'], ['BGÖ', 'LTrans', 'LTras'], ['RVOG', 'LOGA', 'LOGA'], ['RVOV', 'OLOGA', 'OLOGA'],
    ['BPG', 'LPers', 'LPers'], ['BBl', 'FF', 'FF'], ['EU', 'UE', 'UE'], ['EFTA', 'AELE', 'AELS'],
    ['EWR', 'EEE', 'SEE'], ['UNO', 'ONU', 'ONU'], ['KMU', 'PME', 'PMI'], ['MWST', 'TVA', 'IVA'],
    ['AHV', 'AVS', 'AVS'], ['SGK', 'CFS', 'CFS'], ['ZGB', 'CC', 'CC'], ['StGB', 'CP', 'CP'],
    ['BJ', 'OFJ', 'UFG'], ['BK', 'ChF', 'CaF'], ['GS-EJPD', 'SG-DFJP', 'SG-DFGP'], ['BV', 'Cst.', 'Cost.']
  ];
  const LIDX = { de: 0, fr: 1, it: 2 };

  /** Kürzel, die in Bundestexten ohne Einführung verständlich sind. */
  const KNOWN_ACR = new Set(('EU UE UNO ONU USA CH PDF IT KI IA AG SA GmbH CHF EUR USD SR RS AS RO RU FF BBl EFTA AELE AELS EWR EEE SEE KMU PME PMI MWST TVA IVA AHV AVS IV AI '
    + 'SEM EJPD DFJP DFGP EDA DFAE EDI DFI VBS DDPS EFD DFF WBF DEFR UVEK DETEC DATEC BK BAZG OFDF UDSC BJ OFJ UFG BAG OFSP UFSP BFS OFS UST BIT OFIT UFIT BBL OFCL UFCL '
    + 'OK NB PS URL HTML XML FAQ ID TV CD DVD SMS GPS ISO DIN UTC MEZ HR RH NGO ONG NATO OTAN OECD OCDE OCSE WHO OMS UNHCR CEO COVID II III IV VI VII VIII IX XI XII XIII XIV XV XX XXI '
    + 'INTERN VERTRAULICH GEHEIM INTERNE CONFIDENTIEL SECRET INTERNO CONFIDENZIALE SEGRETO TODO TBD XXX').split(' '));

  /* Klassifizierungsvermerke nach der Informationssicherheitsverordnung (ISV) in drei Sprachen, dazu englische Formen.
     Erkannt wird ein Vermerk als ganze Zeile oder als eigener Teil einer Zeile (getrennt durch | · • / ; , – — oder Tabulator),
     gross oder klein geschrieben, wahlweise mit «Klassifizierung:» (auch ohne Doppelpunkt) davor und einem kurzen Zusatz nach einem
     Trennzeichen («VERTRAULICH – nur für …»). Dazu ein kurzer Teil ganz in Grossbuchstaben (höchstens drei Wörter), der mit einem
     Vermerk endet («SEM-INTERN», «NUR INTERN», «STRICTLY CONFIDENTIAL»): Im Zweifel sperrt die Erkennung lieber zu viel als zu wenig.
     Ausgenommen sind dort «INTERNE» und «INTERNO», die als Beiwort häufig sind («NOTE INTERNE»); als eigener Teil zählen sie.
     «Interne Weisung» oder «die interne Kommunikation» sind keine Vermerke. */
  const CLASSIF = [
    { level: 3, label: 'GEHEIM', re: /^(?:geheim|secret|segreto)$/i },
    { level: 2, label: 'VERTRAULICH', re: /^(?:vertraulich|confidentiel(?:le)?|confidenziale|confidential)$/i },
    { level: 1, label: 'INTERN', re: /^(?:intern|interne|interno|ad uso interno|uso interno|internal)$/i }
  ];
  const CL_PREFIX = /^(?:klassifi(?:zierung|kation)(?:svermerk|sstufe)?|classification|classificazione|livello di classificazione)(?:\s*[:：]\s*|\s+)/i;
  /** Letztes Wort eines kurzen Teils ganz in Grossbuchstaben (höchstens drei Wörter, getrennt an Leerzeichen und Bindestrichen). */
  const CAPS_END = /^(?:intern|internal|vertraulich|geheim|confidentiel(?:le)?|confidenziale|confidential|secret|segreto)$/i;
  function capsEnd(t) {
    if (t !== t.toUpperCase() || t === t.toLowerCase()) return null;
    const w = t.split(/[\s\u2010\u2011-]+/).filter(Boolean);
    return w.length >= 2 && w.length <= 3 && CAPS_END.test(w[w.length - 1]) ? w[w.length - 1] : null;
  }
  /** Sucht in Zeilen (Liste oder Text mit Zeilenumbrüchen) den höchsten Vermerk. Ergebnis: {level, label} oder null; label ist
      der Vermerk, wie er im Dokument steht, in Grossbuchstaben. */
  function findClassification(input) {
    const lines = Array.isArray(input) ? input : String(input || '').split('\n');
    let best = null;
    for (const raw of lines) {
      const line = String(raw || '').replace(/[\u00a0\u202f]/g, ' ').trim();
      if (!line || line.length > 160) continue;
      for (const seg of line.split(/\s*(?:[|·•\/;,\t]|\s[–—-]\s)\s*/)) {
        const t = seg.replace(CL_PREFIX, '').replace(/^[\s«»"“”„'’()\[\]*_.:-]+|[\s«»"“”„'’()\[\]*_.:!-]+$/g, '');
        if (!t) continue;
        const end = capsEnd(t);
        for (const c of CLASSIF) if ((c.re.test(t) || (end && c.re.test(end))) && (!best || c.level > best.level)) best = { level: c.level, label: t.toUpperCase() };
      }
    }
    return best;
  }

  /** Wandelt \b in eine Wortgrenze um, die auch Umlaute und Akzente kennt. */
  const WB = '(?:(?<![\\p{L}\\d_])(?=[\\p{L}\\d_])|(?<=[\\p{L}\\d_])(?![\\p{L}\\d_]))';
  function U(re) { return new RegExp(re.source.replace(/\\b/g, WB), re.flags.includes('u') ? re.flags : re.flags + 'u'); }

  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  DP.lang = { STOPSET, words, wordCount, detect, sentences, findDates, findNumbers, findLegalRefs, findUrls, findClassification, GLOSSARY, LIDX, KNOWN_ACR, MONTHS, esc, U };
})(globalThis.DP = globalThis.DP || {});
