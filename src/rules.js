/* Kriterienkatalog und lokale Regelprüfung. Befunde tragen Schlüssel statt Text, damit die Oberfläche sie in jeder Sprache darstellt. */
(function (DP) {
  'use strict';
  const L = DP.lang;

  /** Kategorien in Anzeigereihenfolge. */
  const CATS = ['formal', 'struct', 'lang', 'typo', 'refs', 'tech', 'quality', 'trans'];

  /** Katalog: id, Kategorie, Standard-Schweregrad, Einschränkungen. ai = braucht KI, cmp = nur im Sprachvergleich. */
  const CATALOG = [
    { id: 'F01', cat: 'formal', sev: 'error' },
    { id: 'F02', cat: 'formal', sev: 'warn', types: ['weisung', 'konzept', 'aktennotiz', 'bericht'] },
    { id: 'F03', cat: 'formal', sev: 'warn', types: ['weisung', 'konzept', 'aktennotiz', 'bericht'] },
    { id: 'F04', cat: 'formal', sev: 'error', types: ['weisung', 'konzept', 'aktennotiz', 'bericht'] },
    { id: 'F05', cat: 'formal', sev: 'info', types: ['weisung', 'konzept'] },
    { id: 'F06', cat: 'formal', sev: 'info' },
    { id: 'S01', cat: 'struct', sev: 'warn', formats: ['docx', 'pdf'] },
    { id: 'S02', cat: 'struct', sev: 'warn', formats: ['docx', 'pdf'] },
    { id: 'S03', cat: 'struct', sev: 'warn', formats: ['docx', 'pdf'] },
    { id: 'S04', cat: 'struct', sev: 'info', formats: ['docx', 'pdf'] },
    { id: 'S05', cat: 'struct', sev: 'info', formats: ['docx', 'pdf'] },
    { id: 'S06', cat: 'struct', sev: 'info', formats: ['docx', 'pdf'] },
    { id: 'S07', cat: 'struct', sev: 'warn', formats: ['docx'] },
    { id: 'S08', cat: 'struct', sev: 'warn', formats: ['pptx'] },
    { id: 'S09', cat: 'struct', sev: 'info', formats: ['pptx'] },
    { id: 'L01', cat: 'lang', sev: 'info' },
    { id: 'L02', cat: 'lang', sev: 'warn' },
    { id: 'L03', cat: 'lang', sev: 'error' },
    { id: 'L04', cat: 'lang', sev: 'warn' },
    { id: 'L05', cat: 'lang', sev: 'warn' },
    { id: 'L06', cat: 'lang', sev: 'info', types: ['weisung'] },
    { id: 'T01', cat: 'typo', sev: 'warn', langs: ['de'] },
    { id: 'T02', cat: 'typo', sev: 'info' },
    { id: 'T03', cat: 'typo', sev: 'info' },
    { id: 'T04', cat: 'typo', sev: 'info' },
    { id: 'T05', cat: 'typo', sev: 'info' },
    { id: 'T06', cat: 'typo', sev: 'info', langs: ['de', 'fr'] },
    { id: 'T07', cat: 'typo', sev: 'info' },
    { id: 'T08', cat: 'typo', sev: 'info' },
    { id: 'T09', cat: 'typo', sev: 'warn', custom: true },
    { id: 'T10', cat: 'typo', sev: 'info' },
    { id: 'R01', cat: 'refs', sev: 'warn', formats: ['docx', 'pdf'] },
    { id: 'R02', cat: 'refs', sev: 'info' },
    { id: 'R03', cat: 'refs', sev: 'warn', formats: ['docx', 'pdf'] },
    { id: 'R04', cat: 'refs', sev: 'error', langs: ['de', 'fr', 'it'] },
    { id: 'D01', cat: 'tech', sev: 'error', formats: ['docx'] },
    { id: 'D02', cat: 'tech', sev: 'warn', formats: ['docx', 'pptx'] },
    { id: 'D03', cat: 'tech', sev: 'warn', formats: ['docx'] },
    { id: 'D04', cat: 'tech', sev: 'warn', formats: ['docx', 'pptx'] },
    { id: 'D05', cat: 'tech', sev: 'info' },
    { id: 'D06', cat: 'tech', sev: 'warn', formats: ['pdf'] },
    { id: 'D07', cat: 'tech', sev: 'error', formats: ['pdf'] },
    { id: 'D08', cat: 'tech', sev: 'info', formats: ['pptx'] },
    { id: 'Q01', cat: 'quality', sev: 'warn', ai: true },
    { id: 'Q02', cat: 'quality', sev: 'error', ai: true },
    { id: 'Q03', cat: 'quality', sev: 'warn', ai: true },
    { id: 'Q04', cat: 'quality', sev: 'warn', ai: true },
    { id: 'Q05', cat: 'quality', sev: 'info', ai: true },
    { id: 'Q06', cat: 'quality', sev: 'warn', ai: true },
    { id: 'Q07', cat: 'quality', sev: 'warn', ai: true, custom: true },
    // Lücken der Pflichtenmatrix (DP.duties): lokal aus den geprüften Zeilen einer Matrix berechnet, erst nach einem Lauf
    { id: 'Q08', cat: 'quality', sev: 'warn', ai: true, duty: true },
    { id: 'Q09', cat: 'quality', sev: 'info', ai: true, duty: true, types: ['weisung'] },
    { id: 'Q10', cat: 'quality', sev: 'warn', ai: true, duty: true },
    { id: 'X01', cat: 'trans', sev: 'error', cmp: true },
    { id: 'X02', cat: 'trans', sev: 'error', cmp: true },
    { id: 'X03', cat: 'trans', sev: 'error', cmp: true },
    { id: 'X04', cat: 'trans', sev: 'error', cmp: true },
    { id: 'X05', cat: 'trans', sev: 'warn', cmp: true },
    { id: 'X06', cat: 'trans', sev: 'warn', cmp: true },
    { id: 'X07', cat: 'trans', sev: 'error', cmp: true },
    { id: 'X08', cat: 'trans', sev: 'info', cmp: true },
    { id: 'X11', cat: 'trans', sev: 'error', cmp: true },
    { id: 'X12', cat: 'trans', sev: 'error', cmp: true },
    { id: 'X09', cat: 'trans', sev: 'error', cmp: true, ai: true },
    { id: 'X10', cat: 'trans', sev: 'info', cmp: true, ai: true },
    // Abgleich der Pflichtenmatrizen zweier Fassungen (DP.duties.synopsis) und von Hand festgehaltene Abweichung der Rückübersetzung
    { id: 'X13', cat: 'trans', sev: 'error', cmp: true, ai: true, duty: true },
    { id: 'X14', cat: 'trans', sev: 'error', cmp: true, ai: true, duty: true },
    { id: 'X15', cat: 'trans', sev: 'error', cmp: true, ai: true, duty: true },
    { id: 'X16', cat: 'trans', sev: 'warn', cmp: true, ai: true, duty: true },
    { id: 'X17', cat: 'trans', sev: 'warn', cmp: true, ai: true, manual: true }
  ];
  const BY_ID = {}; for (const c of CATALOG) BY_ID[c.id] = c;

  /** Einstellbare Prüfparameter: Schwellen der lokalen Prüfungen. id = Kriterium.Schlüssel; der Schlüssel ist zugleich der Platzhalter
      in Beschreibung und Befundtext. Die Oberfläche überschreibt Werte je Sitzung über settings.params (nur Abweichungen). */
  const PARAMS = [
    { id: 'L01.note', crit: 'L01', key: 'note', def: 32, min: 10, max: 120, step: 1, unit: 'words' },
    { id: 'L01.warn', crit: 'L01', key: 'warn', def: 45, min: 10, max: 200, step: 1, unit: 'words' },
    { id: 'S04.minWords', crit: 'S04', key: 'minWords', def: 1500, min: 200, max: 50000, step: 50, unit: 'words' },
    { id: 'S05.minWords', crit: 'S05', key: 'minWords', def: 2500, min: 200, max: 100000, step: 50, unit: 'words' },
    { id: 'S05.minHeads', crit: 'S05', key: 'minHeads', def: 8, min: 2, max: 100, step: 1, unit: 'heads' },
    { id: 'S06.maxWords', crit: 'S06', key: 'maxWords', def: 150, min: 20, max: 2000, step: 5, unit: 'words' },
    { id: 'S09.maxWords', crit: 'S09', key: 'maxWords', def: 90, min: 10, max: 1000, step: 5, unit: 'words' },
    { id: 'D08.minPt', crit: 'D08', key: 'minPt', def: 14, min: 6, max: 60, step: 1, unit: 'pt' },
    { id: 'X08.short', crit: 'X08', key: 'short', def: 62, min: 10, max: 99, step: 1, unit: 'pct' },
    { id: 'X08.long', crit: 'X08', key: 'long', def: 160, min: 101, max: 500, step: 1, unit: 'pct' }
  ];
  const PARAM_BY_ID = {}; for (const p of PARAMS) PARAM_BY_ID[p.id] = p;
  /** Wert prüfen: leer oder ungültig ergibt den Standardwert, sonst auf die Schrittweite runden und in die Grenzen setzen. */
  function clampParam(p, v) {
    if (typeof p === 'string') p = PARAM_BY_ID[p];
    if (v == null || (typeof v === 'string' && !v.trim())) return p.def;
    const n = typeof v === 'number' ? v : Number(String(v).trim().replace(/[\s\u00a0\u202f’']/g, '').replace(',', '.'));
    if (!Number.isFinite(n)) return p.def;
    const r = p.min + Math.round((n - p.min) / p.step) * p.step;
    return Math.min(p.max, Math.max(p.min, r));
  }
  /** Wirksame Werte aller Parameter. Die Warnschwelle der Satzlänge liegt nie unter der Hinweisschwelle. */
  function resolveParams(settings) {
    const o = (settings && settings.params) || {}, P = {};
    for (const p of PARAMS) P[p.id] = clampParam(p, o[p.id]);
    if (P['L01.warn'] < P['L01.note']) P['L01.warn'] = P['L01.note'];
    return P;
  }
  /** Platzhalterwerte eines Kriteriums ({note}, {warn} …), als Zahlen. */
  function paramValues(crit, settings) {
    const P = resolveParams(settings), out = {};
    for (const p of PARAMS) if (p.crit === crit) out[p.key] = P[p.id];
    return out;
  }

  function applies(c, doc) {
    if (c.formats && !c.formats.includes(doc.format)) return false;
    if (c.types && !c.types.includes(doc.type)) return false;
    if (c.langs && !c.langs.includes(doc.lang)) return false;
    return true;
  }

  /** Pflichtinhalte je Dokumenttyp. Muster decken DE, FR und IT ab. text = auch im Fliesstext suchen. */
  const SECTIONS = {
    weisung: [
      { key: 'zweck', re: /\b(?:zweck|gegenstand|ziel|ausgangslage|but|objet|objectif|contexte|scopo|oggetto|obiettiv[oi]|contesto)/i },
      { key: 'geltung', re: /\b(?:geltungsbereich|anwendungsbereich|adressat|champ d['’]application|destinataires?|campo d['’]applicazione|destinatari)/i, text: true },
      { key: 'grundlagen', re: /\b(?:rechtsgrundlage|rechtliche grundlagen|grundlagen|gestützt auf|bases? légales?|en vertu d|vu l[’'a]|bas[ei] legal[ei]|in virtù d|visto l)/i, text: true },
      { key: 'zustaendig', re: /\b(?:zuständigkeit|verantwortlichkeit|verantwortung|aufgaben|compétences?|responsabilités?|tâches|competenz[ae]|responsabilità|compiti)/i },
      { key: 'inkraft', re: /\b(?:inkrafttreten|inkraftsetzung|tritt\b.{0,40}\bin kraft|treten\b.{0,40}\bin kraft|gültigkeit|gilt ab|entrée en vigueur|entrent? en vigueur|validité|entrata in vigore|entra(?:no)? in vigore|validità)/i, text: true }
    ],
    konzept: [
      { key: 'ausgangslage', re: /\b(?:ausgangslage|einleitung|hintergrund|kontext|contexte|introduction|situation initiale|situazione iniziale|introduzione|contesto)/i },
      { key: 'ziele', re: /\b(?:ziele?\b|zielsetzung|zweck|objectifs?|buts?\b|obiettiv[oi]|scop[oi])/i },
      { key: 'loesung', re: /\b(?:lösung|vorgehen|umsetzung|massnahmen|variante|konzeption|soll-zustand|solution|démarche|mise en œuvre|mesures|soluzion[ei]|procedura|attuazione|misure)/i },
      { key: 'ressourcen', re: /\b(?:ressourcen|kosten|finanz|aufwand|budget|ressources|coûts|financ|risorse|costi)/i },
      { key: 'risiken', re: /\b(?:risik|risque|risch)/i },
      { key: 'termine', re: /\b(?:termin|zeitplan|meilenstein|weiteres vorgehen|planung|nächste schritte|calendrier|échéanc|jalons|suite des travaux|planification|prochaines étapes|calendario|scadenz|tappe|seguito dei lavori|pianificazione|prossimi passi)/i }
    ],
    aktennotiz: [
      { key: 'adressat', re: /(?:^|\b)(?:an\s*:|empfänger|verteiler|kopie an|z\.\s?hd\.|geht an|à\s*:|destinataires?|copie à|distribution|a\s*:|destinatari|copia a|distribuzione)/i, text: true, head: 14 },
      { key: 'sachverhalt', re: /\b(?:sachverhalt|ausgangslage|anlass|hintergrund|faits|contexte|situation|fatti|contesto|situazione)/i },
      { key: 'beurteilung', re: /\b(?:beurteilung|würdigung|einschätzung|analyse|erwägungen|fazit|ergebnis|appréciation|évaluation|conclusions?|valutazione|analisi|conclusion[ei])/i },
      { key: 'vorgehen', re: /\b(?:weiteres vorgehen|nächste schritte|antrag|empfehlung|massnahmen|beschluss|suite|prochaines étapes|proposition|recommandations?|mesures|décision|seguito|prossimi passi|proposta|raccomandazion[ei]|misure|decisione)/i }
    ],
    bericht: [
      { key: 'einleitung', re: /\b(?:ausgangslage|einleitung|hintergrund|auftrag|zweck|contexte|introduction|mandat|situation initiale|introduzione|contesto|mandato|situazione iniziale)/i },
      { key: 'schluss', re: /\b(?:fazit|schlussfolgerung|empfehlung|zusammenfassung|ausblick|weiteres vorgehen|conclusions?|recommandations?|résumé|synthèse|perspectives|conclusion[ei]|raccomandazion[ei]|riassunto|sintesi|prospettive)/i }
    ]
  };

  const SUMMARY_RE = /\b(?:zusammenfassung|management summary|das wichtigste in kürze|kurzfassung|übersicht|résumé|synthèse|l['’]essentiel en bref|condensé|riassunto|sintesi|l['’]essenziale in breve|compendio|summary)\b/i;
  const TOC_RE = /^(?:inhaltsverzeichnis|inhalt|table des matières|sommaire|indice|sommario)$/i;
  const ORG_RE = /\b(?:staatssekretariat|bundesamt|bundeskanzlei|departement|direktion|direktionsbereich|abteilung|sektion|stabsbereich|fachbereich|generalsekretariat|secrétariat d['’]état|office fédéral|chancellerie|département|direction|domaine de direction|division|section|état-major|secrétariat général|segreteria di stato|ufficio federale|cancelleria|dipartimento|direzione|ambito direzionale|divisione|sezione|stato maggiore|segreteria generale)\b/i;
  const AUTHOR_RE = /\b(?:verfasser(?:in)?|autor(?:in)?|erstellt (?:von|durch)|sachbearbeit|kontaktperson|auteure?|rédigé par|établi par|personne de contact|autore|autrice|redatto da|elaborato da|persona di contatto)\b/i;
  const VERSION_RE = /\b(?:version|stand|status|fassung vom|entwurf|état|projet|versione|stato|bozza)\b\s*:?\s*(?:v?\d|vom|du|del|au|al|:|\p{L})/iu;

  const PLACEHOLDER = [
    /\b(?:TODO|TBD|TBC|XXX+)\b/g,
    /\?{3,}/g,
    /\blorem ipsum\b/gi,
    /Fehler! (?:Verweisquelle|Textmarke)[^.]*\./g,
    /Erreur\s?! (?:Source du renvoi|Signet)[^.]*\./g,
    /Errore\. (?:L['’]origine riferimento|Il segnalibro)[^.]*\./g,
    /Error! (?:Reference source|Bookmark) not[^.]*\./g,
    /\[(?:Datum|Name|Titel|Ort|Betrag|Text|Date|Nom|Titre|Lieu|Montant|Texte|Data|Nome|Titolo|Luogo|Importo|Testo|\.\.\.|…|xx?)\]/gi,
    /<(?:Datum|Name|Titel|Ort|Text|Date|Nom|Titre|Lieu|Texte|Data|Nome|Titolo|Luogo|Testo)>/gi,
    /\b(?:TT\.MM\.JJJJ|dd\.mm\.yyyy|JJ\.MM\.AAAA|GG\.MM\.AAAA|xx\.xx\.(?:20)?xx)\b/gi,
    /\b(?:Platzhalter|Blindtext)\b/g
  ];

  const VAGUE = {
    de: /\b(?:sollten?|nach Möglichkeit|grundsätzlich|in der Regel|gegebenenfalls|möglichst|unter Umständen|soweit möglich|eventuell)\b/g,
    fr: /\b(?:devrai(?:en)?t|dans la mesure du possible|en principe|le cas échéant|si possible|en règle générale|éventuellement|autant que possible)\b/gi,
    it: /\b(?:dovrebbe(?:ro)?|per quanto possibile|in linea di principio|di norma|se del caso|se possibile|di regola|eventualmente|nel limite del possibile)\b/gi
  };

  const GENDER = {
    de: [/\b\p{L}{3,}[*:_](?:innen|in)\b/gu, /\b\p{Lu}\p{Ll}{2,}(?:Innen|In)\b(?!-)/gu, /\b(?:jede|eine|keine|diese)[*:_]r\b/giu],
    fr: [/\b\p{L}{2,}[·•][\p{L}·•]+/gu, /\b\p{L}{3,}\.e\.s\b/gu, /\b(?:iel|iels|celleux|toustes)\b/gi],
    it: [/\b\p{L}{3,}\*(?!\p{L})/gu, /\b\p{L}{2,}[əɜ]\b/gu]
  };

  for (const t in SECTIONS) for (const x of SECTIONS[t]) x.re = L.U(x.re);
  for (const l in VAGUE) VAGUE[l] = L.U(VAGUE[l]);
  for (const l in GENDER) GENDER[l] = GENDER[l].map(L.U);
  const SUMMARY_U = L.U(SUMMARY_RE), ORG_U = L.U(ORG_RE), AUTHOR_U = L.U(AUTHOR_RE), VERSION_U = L.U(VERSION_RE);

  const NUMWORD_HEAD = /^(\d+(?:\.\d+)*)\.?(?:\s|\u00a0)/;

  function mk(crit, extra) {
    const c = BY_ID[crit];
    return Object.assign({ crit, cat: c.cat, sev: c.sev, source: 'rule', key: 'f.' + crit, params: {} }, extra);
  }

  /** Führt alle lokalen Prüfungen aus. settings: {off:Set, terms:[{from,to}], acts:[eigene Erlasse aus DP.erlasse.parseCustom]} */
  function runRules(doc, settings) {
    settings = settings || {};
    const off = settings.off || new Set();
    const P = resolveParams(settings);
    const F = [];
    const lang = doc.lang;
    const paras = doc.paras;
    const body = paras.filter(p => p.kind !== 'fn');
    const heads = paras.filter(p => p.kind === 'h');
    const run = (id) => { const c = BY_ID[id]; return !off.has(id) && applies(c, doc); };
    const checked = CATALOG.filter(c => !c.ai && !c.cmp && !off.has(c.id) && applies(c, doc) && !(c.custom && !(settings.terms && settings.terms.length))).map(c => c.id);
    const headText = (doc.meta.headerFooter || '') + '\n' + body.slice(0, 14).map(p => p.text).join('\n');
    const fullText = body.map(p => p.text).join('\n');

    /* ----- Formales ----- */
    if (run('F01')) {
      const hasTitle = paras.some(p => p.kind === 'title') || (doc.format !== 'pptx' && heads.length && heads[0].i <= 3 && heads[0].level === 1 && heads.filter(h => h.level === 1).length === 1);
      if (!hasTitle) F.push(mk('F01'));
    }
    if (run('F02')) {
      const dates = L.findDates(headText).filter(d => d.form !== 'monthyear' || true);
      const tail = body.slice(-6).map(p => p.text).join('\n');
      if (!dates.length && !L.findDates(tail).length) F.push(mk('F02'));
    }
    if (run('F03')) {
      if (!ORG_U.test(headText) && !AUTHOR_U.test(headText) && !ORG_U.test(body.slice(-6).map(p => p.text).join('\n'))) F.push(mk('F03'));
    }
    if (run('F04')) {
      const spec = SECTIONS[doc.type] || [];
      const hText = heads.map(h => h.text).join('\n');
      // Beschriftungen wie "Betreff:" am Absatzanfang zählen als Abschnittsmarke
      const labels = body.filter(p => p.kind !== 'h').map(p => { const m = /^[\p{L} .\-’']{2,40}:/u.exec(p.text); return m ? m[0] : ''; }).join('\n');
      const short = body.filter(p => p.kind !== 'h' && p.text.length < 60 && !/[.;,]$/.test(p.text.trim())).map(p => p.text).join('\n');
      for (const s of spec) {
        const scope = s.head ? body.slice(0, s.head).map(p => p.text).join('\n') : s.text ? fullText : hText + '\n' + labels + '\n' + short;
        if (!s.re.test(scope)) F.push(mk('F04', { key: 'f.F04', params: { sec: 'sec.' + doc.type + '.' + s.key }, sev: s.key === 'inkraft' || s.key === 'geltung' || s.key === 'adressat' ? 'error' : 'warn' }));
      }
    }
    if (run('F05')) { if (!VERSION_U.test(headText) && !VERSION_U.test(body.slice(-6).map(p => p.text).join('\n'))) F.push(mk('F05')); }
    if (run('F06')) { const c = doc.meta.classification; if (c) F.push(mk('F06', { params: { label: c.label }, sev: c.level >= 2 ? 'warn' : 'info' })); }

    /* ----- Aufbau ----- */
    if (run('S01')) {
      let prev = 0;
      for (const h of heads) { if (prev && h.level > prev + 1) F.push(mk('S01', { para: h.i, params: { from: prev, to: h.level } })); prev = h.level; }
    }
    const numHeads = heads.map(h => { const m = NUMWORD_HEAD.exec(h.text); return m ? { h, num: m[1], parts: m[1].split('.').map(Number) } : null; }).filter(Boolean);
    if (run('S02') && numHeads.length >= 2) {
      const last = {};
      for (const nh of numHeads) {
        const parent = nh.parts.slice(0, -1).join('.');
        const n = nh.parts[nh.parts.length - 1];
        const prev = last[parent];
        if (prev == null) { if (n > 1 && !(parent === '' && n === 0)) F.push(mk('S02', { para: nh.h.i, params: { num: nh.num, exp: (parent ? parent + '.' : '') + '1' } })); }
        else if (n !== prev + 1) F.push(mk('S02', { para: nh.h.i, params: { num: nh.num, exp: (parent ? parent + '.' : '') + (prev + 1) } }));
        last[parent] = n;
        for (const k of Object.keys(last)) if (k !== parent && (k === nh.num || k.startsWith(nh.num + '.'))) delete last[k];
      }
      // Gemischt: manche Überschriften nummeriert, andere gleicher Ebene nicht
      const lvl1 = heads.filter(h => h.level === (numHeads[0].h.level));
      const un = lvl1.filter(h => !NUMWORD_HEAD.test(h.text) && !h.autoNum && !SUMMARY_U.test(h.text) && !TOC_RE.test(h.text.trim()) && !/^(?:anhang|anhänge|annexe|allegat)/i.test(h.text));
      if (un.length && un.length < lvl1.length) for (const h of un.slice(0, 3)) F.push(mk('S02', { key: 'f.S02.mixed', para: h.i, sev: 'info' }));
    }
    if (run('S03')) {
      for (let k = 0; k < paras.length; k++) {
        const p = paras[k]; if (p.kind !== 'h') continue;
        let j = k + 1; while (j < paras.length && paras[j].kind === 'fn') j++;
        const nx = paras[j];
        if (!nx || (nx.kind === 'h' && nx.level <= p.level)) F.push(mk('S03', { para: p.i }));
      }
    }
    if (run('S04') && doc.meta.words > P['S04.minWords'] && !heads.some(h => SUMMARY_U.test(h.text)) && !body.slice(0, 12).some(p => SUMMARY_U.test(p.text) && p.text.length < 60)) F.push(mk('S04', { params: { words: doc.meta.words } }));
    if (run('S05') && doc.meta.words > P['S05.minWords'] && heads.length >= P['S05.minHeads'] && !doc.meta.hasToc && !paras.some(p => TOC_RE.test(p.text.trim()))) F.push(mk('S05', { params: { heads: heads.length } }));
    if (run('S06')) for (const p of body) if (p.kind === 'p') { const w = L.wordCount(p.text); if (w > P['S06.maxWords']) F.push(mk('S06', { para: p.i, params: { words: w } })); }
    if (run('S07') && doc.meta.words > 300 && doc.meta.headingStyles === 0) F.push(mk('S07'));
    if (run('S08')) for (const n of doc.meta.slidesNoTitle || []) F.push(mk('S08', { params: { slide: n }, slide: n }));
    if (run('S09')) (doc.meta.slideWords || []).forEach((w, k) => { if (w > P['S09.maxWords']) F.push(mk('S09', { params: { slide: k + 1, words: w }, slide: k + 1 })); });

    /* ----- Sprache ----- */
    const textParas = body.filter(p => p.kind !== 'cell' || L.wordCount(p.text) > 6);
    if (run('L01')) {
      for (const p of textParas) {
        if (p.kind === 'h' || p.kind === 'title') continue;
        for (const s of L.sentences(p.text)) {
          const w = L.wordCount(s.text);
          if (w > P['L01.note']) F.push(mk('L01', { para: p.i, start: s.start, end: s.end, params: { words: w }, sev: w > P['L01.warn'] ? 'warn' : 'info' }));
        }
      }
    }
    if (run('L02')) {
      const OKDUP = /^(?:nous|vous|sie|die|der|das|bien|très|si|ci|là|so|lei|loro|tra|ha)$/i;
      const re = /(?<![\p{L}\d])([\p{L}]{2,})[ \u00a0]+\1(?![\p{L}\d])/giu;
      for (const p of body) { let m; re.lastIndex = 0; while ((m = re.exec(p.text))) { if (OKDUP.test(m[1])) continue; F.push(mk('L02', { para: p.i, start: m.index, end: m.index + m[0].length, fix: { start: m.index, end: m.index + m[0].length, repl: m[1] } })); } }
    }
    if (run('L03')) {
      for (const p of body) for (const re of PLACEHOLDER) { let m; re.lastIndex = 0; while ((m = re.exec(p.text))) F.push(mk('L03', { para: p.i, start: m.index, end: m.index + m[0].length })); }
    }
    if (run('L04')) {
      for (const p of body) {
        if (p.kind === 'title' || p.kind === 'h') continue;
        const d = L.detect(p.text);
        if (d.n >= 8 && d.lang && d.lang !== lang && d.conf > 0.18 && d.score > 0.25) F.push(mk('L04', { para: p.i, params: { found: 'lang.' + d.lang, exp: 'lang.' + lang } }));
      }
    }
    if (run('L05') && GENDER[lang]) {
      for (const p of body) for (const re of GENDER[lang]) { let m; re.lastIndex = 0; while ((m = re.exec(p.text))) { if (L.findUrls(p.text).some(u => m.index >= u.start && m.index < u.end)) continue; F.push(mk('L05', { para: p.i, start: m.index, end: m.index + m[0].length })); } }
    }
    if (run('L06') && VAGUE[lang]) {
      for (const p of body) { if (p.kind === 'h' || p.kind === 'title') continue; const re = VAGUE[lang]; let m; re.lastIndex = 0; while ((m = re.exec(p.text))) F.push(mk('L06', { para: p.i, start: m.index, end: m.index + m[0].length, params: { word: m[0] } })); }
    }

    /* ----- Schreibweisen ----- */
    if (run('T01')) for (const p of paras) { const re = /ß/g; let m; while ((m = re.exec(p.text))) { const ws = p.text.lastIndexOf(' ', m.index) + 1; let we = p.text.slice(m.index).search(/[\s.,;:!?)»"]/); we = we < 0 ? p.text.length : m.index + we; F.push(mk('T01', { para: p.i, start: ws, end: we, fix: { start: m.index, end: m.index + 1, repl: 'ss' } })); } }
    if (run('T02')) {
      const open = lang === 'fr' ? '«\u00a0' : '«', close = lang === 'fr' ? '\u00a0»' : '»';
      for (const p of paras) {
        const res = [/„([^“”"„]{1,300})[“”"]/g, /“([^“”"]{1,300})”/g, /"([^"\n]{1,300})"/g];
        const seen = [];
        for (const re of res) { let m; while ((m = re.exec(p.text))) { const s = m.index, e = s + m[0].length; if (seen.some(r => s < r[1] && e > r[0])) continue; if (/^\s|\s$/.test(m[1]) && re === res[2]) continue; seen.push([s, e]); F.push(mk('T02', { para: p.i, start: s, end: e, fix: { start: s, end: e, repl: open + m[1].trim() + close } })); } }
        if (lang === 'fr' && doc.format !== 'pdf') {
          let m; const r1 = /«(?![\u00a0\u202f]) ?/g; while ((m = r1.exec(p.text))) F.push(mk('T02', { key: 'f.T02.nbsp', para: p.i, start: m.index, end: Math.min(p.text.length, m.index + m[0].length + 12), fix: { start: m.index, end: m.index + m[0].length, repl: '«\u00a0' } }));
          const r2 = /(?<![\u00a0\u202f]) ?»/g; while ((m = r2.exec(p.text))) { F.push(mk('T02', { key: 'f.T02.nbsp', para: p.i, start: Math.max(0, m.index - 12), end: m.index + m[0].length, fix: { start: m.index, end: m.index + m[0].length, repl: '\u00a0»' } })); }
        } else if (lang !== 'fr') {
          let m; const r1 = /«[ \u00a0\u202f]+|[ \u00a0\u202f]+»/g; while ((m = r1.exec(p.text))) F.push(mk('T02', { key: 'f.T02.space', para: p.i, start: Math.max(0, m.index - 8), end: Math.min(p.text.length, m.index + m[0].length + 8), fix: { start: m.index, end: m.index + m[0].length, repl: m[0].trim() } }));
        }
      }
    }
    if (run('T03')) {
      for (const p of paras) {
        if (doc.format === 'pdf') continue; // Abstände in PDF sind Extraktionsartefakte
        const urls = L.findUrls(p.text);
        const inUrl = (i) => urls.some(u => i >= u.start && i < u.end);
        let m;
        const r1 = /(?<=\S) {2,}(?=\S)/g; while ((m = r1.exec(p.text))) F.push(mk('T03', { key: 'f.T03.double', para: p.i, start: Math.max(0, m.index - 10), end: Math.min(p.text.length, m.index + m[0].length + 10), fix: { start: m.index, end: m.index + m[0].length, repl: ' ' } }));
        const r2 = lang === 'fr' ? /(?<=[\p{L}\d»)]) +(?=[,.](?:\s|\p{L}|$))/gu : /(?<=[\p{L}\d»)]) +(?=[,;](?:\s|\p{L}|$)|[.:!?](?:\s|$))/gu;
        while ((m = r2.exec(p.text))) {
          // «Sektion ,die»: Leerzeichen nicht nur streichen, sondern hinter das Satzzeichen setzen (sonst entstünde «Sektion,die»)
          const e = m.index + m[0].length, glued = /\p{L}/u.test(p.text.charAt(e + 1));
          F.push(mk('T03', { key: 'f.T03.before', para: p.i, start: Math.max(0, m.index - 10), end: Math.min(p.text.length, e + 2), fix: glued ? { start: m.index, end: e + 1, repl: p.text.charAt(e) + ' ' } : { start: m.index, end: e, repl: '' } }));
        }
        const r3 = /(?<=\p{L})[,;](?=\p{L}{2})/gu; while ((m = r3.exec(p.text))) { if (inUrl(m.index)) continue; F.push(mk('T03', { key: 'f.T03.after', para: p.i, start: Math.max(0, m.index - 10), end: Math.min(p.text.length, m.index + 11), fix: { start: m.index + 1, end: m.index + 1, repl: ' ' } })); }
        if (lang === 'fr') {
          const r4 = /(?<=[\p{L}\d»)])( ?)([;:!?])(?=\s|$)/gu;
          while ((m = r4.exec(p.text))) { if (inUrl(m.index) || /\d$/.test(p.text.slice(0, m.index)) && m[2] === ':' && /^\d/.test(p.text.slice(m.index + m[0].length))) continue; F.push(mk('T03', { key: 'f.T03.frnbsp', para: p.i, start: Math.max(0, m.index - 12), end: m.index + m[0].length, fix: { start: m.index, end: m.index + m[1].length, repl: '\u00a0' } })); }
        }
      }
    }
    const allDates = [];
    for (const p of body) for (const d of L.findDates(p.text)) allDates.push({ p, d });
    if (run('T04')) {
      const prose = allDates.filter(x => x.p.kind !== 'cell');
      const long = prose.filter(x => x.d.form === 'long').length;
      const numeric = prose.filter(x => x.d.form === 'dot' || x.d.form === 'iso');
      for (const x of prose.filter(x => x.d.form === 'slash')) F.push(mk('T04', { key: 'f.T04.slash', para: x.p.i, start: x.d.start, end: x.d.end, sev: 'warn' }));
      if (long && numeric.length) for (const x of numeric.slice(0, 6)) F.push(mk('T04', { para: x.p.i, start: x.d.start, end: x.d.end, params: { long, num: numeric.length } }));
    }
    if (run('T05')) {
      const styles = { space: [], apos: [], dot: [] };
      for (const p of body) {
        const skip = L.findDates(p.text).map(d => [d.start, d.end]).concat(L.findUrls(p.text).map(u => [u.start, u.end]));
        for (const n of L.findNumbers(p.text, skip)) {
          if (!n.style) continue;
          if (n.style === 'space' && /^(?:\d{4}) \d{3}$/.test(n.raw)) continue; // "2026 300" ist meist Jahr plus Zahl
          if (n.style === 'dot' && NUMWORD_HEAD.test(p.text) && n.start === 0) continue;
          if (n.style === 'space' && /(?:\+41|0041|\b0\d\d)[ \u00a0]?$/.test(p.text.slice(Math.max(0, n.start - 6), n.start))) continue;
          styles[n.style].push({ p, n });
        }
      }
      for (const x of styles.dot) F.push(mk('T05', { key: 'f.T05.dot', para: x.p.i, start: x.n.start, end: x.n.end, sev: 'warn', fix: { start: x.n.start, end: x.n.end, repl: x.n.raw.replace(/\./g, '\u00a0') } }));
      if (styles.space.length && styles.apos.length) {
        const minor = styles.space.length >= styles.apos.length ? styles.apos : styles.space;
        const toSpace = minor === styles.apos;
        for (const x of minor.slice(0, 8)) F.push(mk('T05', { para: x.p.i, start: x.n.start, end: x.n.end, params: { a: styles.space.length, b: styles.apos.length }, fix: { start: x.n.start, end: x.n.end, repl: toSpace ? x.n.raw.replace(/['’]/g, '\u00a0') : x.n.raw.replace(/[ \u00a0\u202f](?=\d{3})/g, '’') } }));
      }
    }
    if (run('T06')) for (const p of body) { const re = /(\d)%/g; let m; while ((m = re.exec(p.text))) F.push(mk('T06', { para: p.i, start: Math.max(0, m.index - 4), end: m.index + 2, fix: { start: m.index + 1, end: m.index + 1, repl: '\u00a0' } })); }
    if (run('T07')) {
      const occ = {};
      const re = /(?<![\p{L}\d\-])\p{Lu}{2,8}(?![\p{L}\d])/gu;
      for (const p of body) {
        if (p.kind === 'title') continue;
        const letters = p.text.replace(/[^\p{L}]/gu, '');
        if (letters.length > 3 && letters === letters.toUpperCase()) continue; // Versalzeile
        let m; re.lastIndex = 0;
        while ((m = re.exec(p.text))) { const a = m[0]; if (L.KNOWN_ACR.has(a)) continue; (occ[a] = occ[a] || []).push({ p, start: m.index }); }
      }
      let count = 0;
      for (const a of Object.keys(occ)) {
        const e = L.esc(a);
        const intro = new RegExp('\\(' + e + '[);,\\s]|[«„“"]' + e + '[»“”"]|' + e + '[\\s\\u00a0]*\\(|(?:nachfolgend|nachstehend|kurz|im Folgenden|ci-après|ci-dessous|abrégé|di seguito|in seguito|qui di seguito)[:\\s\\u00a0«„“"]*' + e + '|' + e + '[\\s\\u00a0]*[:=–]\\s');
        if (intro.test(fullText)) continue;
        if (count++ >= 12) break;
        const o = occ[a][0];
        F.push(mk('T07', { para: o.p.i, start: o.start, end: o.start + a.length, params: { acr: a, n: occ[a].length } }));
      }
    }
    if (run('T08')) {
      for (const p of body) {
        let m;
        const r1 = /\b(Art|Abs|Bst|Ziff|al|let|ch|cpv|lett)\.(?=\d)/g; while ((m = r1.exec(p.text))) F.push(mk('T08', { key: 'f.T08.space', para: p.i, start: m.index, end: Math.min(p.text.length, m.index + m[0].length + 4), fix: { start: m.index + m[0].length, end: m.index + m[0].length, repl: '\u00a0' } }));
        if (lang === 'de') {
          const r2 = /\b(Abs|Bst|Ziff)(?= \d| [a-z]\b)/g; while ((m = r2.exec(p.text))) F.push(mk('T08', { key: 'f.T08.dot', para: p.i, start: m.index, end: Math.min(p.text.length, m.index + m[0].length + 3), fix: { start: m.index + m[0].length, end: m.index + m[0].length, repl: '.' } }));
          const r3 = /\blit\.(?=[ \u00a0][a-z]\b)/g; while ((m = r3.exec(p.text))) F.push(mk('T08', { key: 'f.T08.lit', para: p.i, start: m.index, end: m.index + m[0].length + 2, fix: { start: m.index, end: m.index + 4, repl: 'Bst.' } }));
        }
      }
    }
    if (run('T09') && settings.terms && settings.terms.length) {
      for (const t of settings.terms) {
        const re = new RegExp('(?<![\\p{L}\\d])' + L.esc(t.from) + '(?![\\p{L}\\d])', 'giu');
        for (const p of paras) { let m; while ((m = re.exec(p.text))) F.push(mk('T09', { para: p.i, start: m.index, end: m.index + m[0].length, params: { from: m[0], to: t.to || '' }, key: t.to ? 'f.T09' : 'f.T09.avoid', fix: t.to ? { start: m.index, end: m.index + m[0].length, repl: t.to } : undefined })); }
      }
    }
    if (run('T10')) {
      const groups = {};
      const re = /\p{L}+(?:-\p{L}+)+|\p{L}{6,}/gu;
      for (const p of body) { let m; re.lastIndex = 0; while ((m = re.exec(p.text))) { const low = m[0].toLowerCase(); const key = low.replace(/-/g, ''); if (key.length < 6) continue; const g = groups[key] = groups[key] || {}; (g[low] = g[low] || []).push({ p, start: m.index, raw: m[0] }); } }
      let count = 0;
      for (const key of Object.keys(groups)) {
        const forms = Object.keys(groups[key]); if (forms.length < 2) continue;
        if (count++ >= 8) break;
        forms.sort((a, b) => groups[key][b].length - groups[key][a].length);
        const minor = groups[key][forms[forms.length - 1]][0];
        F.push(mk('T10', { para: minor.p.i, start: minor.start, end: minor.start + minor.raw.length, params: { forms: forms.map(f => groups[key][f][0].raw + ' (' + groups[key][f].length + '×)').join(', ') } }));
      }
    }

    /* ----- Verweise ----- */
    if (run('R01')) {
      const nums = new Set(numHeads.map(n => n.num));
      const annex = new Set();
      const ANX = /^(?:anhang|annexe|allegato|beilage|appendice)[ \u00a0]+(\d+|[A-Z])\b/i;
      for (const p of paras) { const m = ANX.exec(p.text.trim()); if (m && (p.kind === 'h' || p.kind === 'title' || p.text.length < 120)) annex.add(m[1].toUpperCase()); }
      for (const p of body) {
        if (p.kind === 'h' || p.kind === 'title') continue;
        let m;
        if (nums.size >= 2) {
          const r = /\b(?:Kapitel|Kap\.|Abschnitt|Ziffer|Ziff\.|chapitre|chap\.|section|chiffre|ch\.|capitolo|cap\.|sezione|numero|n\.)[ \u00a0](\d+(?:\.\d+)*)\b/gi;
          while ((m = r.exec(p.text))) {
            const before = p.text.slice(Math.max(0, m.index - 28), m.index);
            if (/\b(?:Art|Abs|Bst|al|let|cpv|lett|art)\.?[ \u00a0]*[\d\p{L}]*[ \u00a0,]*$/iu.test(before) || /\b(?:SR|RS)\b/.test(before)) continue;
            const after = p.text.slice(m.index + m[0].length, m.index + m[0].length + 40);
            if (/^[ \u00a0,]*(?:der|des|du|de la|del|della|dei|delle)?[ \u00a0]*(?:\p{Lu}[\p{L}]{1,8}\b(?![ \u00a0]\p{Ll})|Verordnung|Gesetz|ordonnance|loi|ordinanza|legge|Anhang|annexe|allegato)/u.test(after) && !/^[ \u00a0]*[.,;)]/.test(after)) continue;
            if (!nums.has(m[1]) && !Array.from(nums).some(n => n.startsWith(m[1] + '.'))) F.push(mk('R01', { para: p.i, start: m.index, end: m.index + m[0].length, params: { ref: m[0] } }));
          }
        }
        const r2 = /\b(?:Anhang|Anhangs|annexe|allegato)[ \u00a0](\d+|[A-Z])\b/g;
        while ((m = r2.exec(p.text))) {
          const after = p.text.slice(m.index + m[0].length, m.index + m[0].length + 30);
          if (/^[ \u00a0]+(?:der|des|zur|zum|du|de la|de l['’]|à la|del|della|dell['’]|al|alla)\b/i.test(after)) continue; // Anhang eines anderen Erlasses
          if (ANX.test(p.text.trim()) && m.index < 3) continue;
          if (!annex.has(m[1].toUpperCase())) F.push(mk('R01', { key: 'f.R01.annex', para: p.i, start: m.index, end: m.index + m[0].length, params: { ref: m[0] } }));
        }
      }
    }
    if (run('R02')) {
      for (const p of paras) {
        let m;
        const r = /\bhttp:\/\/[^\s<>«»"“”)\]]+/g; while ((m = r.exec(p.text))) F.push(mk('R02', { para: p.i, start: m.index, end: m.index + m[0].length, fix: { start: m.index, end: m.index + 7, repl: 'https://' } }));
        const r2 = /\bhttps?(?::\/(?!\/)|\/\/|:\/\/\s)\S*/g; while ((m = r2.exec(p.text))) F.push(mk('R02', { key: 'f.R02.bad', para: p.i, start: m.index, end: m.index + m[0].length, sev: 'warn' }));
      }
    }
    if (run('R03')) {
      const CAP = /^(Abbildung|Abb\.|Tabelle|Tab\.|Grafik|Figure|Fig\.|Tableau|Graphique|Figura|Tabella|Grafico)[ \u00a0](\d+)\s*[:.–\-]/i;
      const kindOf = (w) => /^(?:tab)/i.test(w) ? 'T' : 'A';
      const caps = new Set();
      for (const p of paras) { const m = CAP.exec(p.text.trim()); if (m) caps.add(kindOf(m[1]) + m[2]); }
      const r = /\b(Abbildung|Abb\.|Tabelle|Tab\.|Grafik|Figure|Fig\.|Tableau|Graphique|Figura|Tabella|Grafico)[ \u00a0](\d+)\b/g;
      for (const p of body) {
        if (CAP.test(p.text.trim())) continue;
        let m; while ((m = r.exec(p.text))) if (!caps.has(kindOf(m[1]) + m[2])) F.push(mk('R03', { para: p.i, start: m.index, end: m.index + m[0].length, params: { ref: m[0] } }));
      }
    }

    if (run('R04') && DP.erlasse) {
      // a) Kürzel und SR-Nummer gehören zu verschiedenen Erlassen (Fehler); b) Kürzel einer anderen Sprachfassung im Fliesstext (Warnung)
      const E = DP.erlasse, idx = E.index(settings.acts);
      for (const p of paras) {
        // In Überschriften und Titeln: falsche Sprachfassung nur als Hinweis (ein Titel kann eine fremde Fassung benennen)
        const head = p.kind === 'h' || p.kind === 'title';
        for (const x of E.check(p.text, lang, idx)) {
          if (x.kind === 'old') F.push(mk('R04', { key: 'f.R04.old', sev: 'info', para: p.i, start: x.start, end: x.end,
            params: { tok: x.tok, year: x.until.slice(0, 4), sr: x.act.sr, dst: x.dst } }));
          else if (x.kind === 'pair') F.push(mk('R04', { key: x.srAct ? 'f.R04.pair' : 'f.R04.pair.unk', para: p.i, start: x.start, end: x.end, fix: x.fix || undefined,
            params: { tok: x.tok, tsr: x.tokSr, sr: x.sr, sname: x.srAct ? E.nameOf(x.srAct, lang) : '' } }));
          else F.push(mk('R04', { key: x.dst ? 'f.R04.lang' : 'f.R04.lang.none', sev: head ? 'info' : 'warn', para: p.i, start: x.start, end: x.end, fix: x.fix || undefined,
            params: { tok: x.tok, sr: x.act.sr, from: 'lang.' + x.from, here: 'lang.' + lang, dst: x.dst || '', title: x.act.short[lang] || '' } }));
        }
      }
    }

    /* ----- Dokumenttechnik ----- */
    const M = doc.meta;
    if (run('D01') && M.tracked && (M.tracked.ins + M.tracked.del) > 0) F.push(mk('D01', { params: { n: M.tracked.ins + M.tracked.del } }));
    if (run('D02') && M.comments > 0) F.push(mk('D02', { params: { n: M.comments } }));
    if (run('D03') && M.highlights > 0) F.push(mk('D03', { params: { n: M.highlights } }));
    if (run('D04') && M.imagesNoAlt > 0) F.push(mk('D04', { params: { n: M.imagesNoAlt, total: M.images } }));
    if (run('D05') && !(M.title || '').trim()) F.push(mk('D05'));
    if (run('D06') && M.tagged === false && !M.noText) F.push(mk('D06'));
    if (run('D07') && M.noText) F.push(mk('D07'));
    if (run('D08')) {
      // Kleinste Schrift je Folie (slideMinFont); ältere Metadaten kennen nur die Folien unter 14 Punkt
      const small = M.slideMinFont ? M.slideMinFont.map((size, k) => ({ slide: k + 1, size })).filter(s => s.size != null && s.size < P['D08.minPt']) : (M.smallFont || []).filter(s => s.size < P['D08.minPt']);
      for (const s of small) F.push(mk('D08', { params: { slide: s.slide, size: s.size }, slide: s.slide }));
    }

    let k = 0;
    for (const f of F) {
      f.id = doc.id + '-r' + (++k); f.docId = doc.id;
      if (f.para != null && f.start != null) f.quote = paras[f.para].text.slice(f.start, f.end);
      f.accepted = false;
    }
    return { findings: F, checked };
  }

  function parseTerms(text) {
    const out = [];
    for (const line of (text || '').split('\n')) {
      const t = line.trim(); if (!t) continue;
      const m = /^(.+?)\s*(?:=>|->|→)\s*(.*)$/.exec(t);
      if (m) out.push({ from: m[1].trim(), to: m[2].trim() }); else out.push({ from: t, to: '' });
    }
    return out.filter(t => t.from.length >= 2);
  }

  DP.rules = { CATS, CATALOG, BY_ID, PARAMS, PARAM_BY_ID, clampParam, resolveParams, paramValues, applies, runRules, parseTerms, SECTIONS };
})(globalThis.DP = globalThis.DP || {});
