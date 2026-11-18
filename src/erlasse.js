/* Bundeserlasse: SR-Nummer, amtliche Abkürzung und Kurztitel auf Deutsch, Französisch und Italienisch. Nur Fakten (Nummern,
   Abkürzungen, Titel), geprüft gegen Fedlex (Bundeskanzlei, fedlex.data.admin.ch, Stand 18.11.2026, nur geltende Erlasse);
   Quelle je Eintrag in design/erlasse-quellen.csv. null = in dieser Sprache gibt es keine amtliche Abkürzung (nie erfunden).
   Eintrag: [SR, Abk. de, fr, it, Kurztitel de, fr, it, ELI]. Der Kurztitel ist der amtliche Kurztitel oder, wo es keinen gibt,
   der Titel ohne Datum. Kein DOM, keine Netzwerkaufrufe. */
(function (DP) {
  'use strict';
  const L = DP.lang;
  const RAW = [
    ["0.101", "EMRK", "CEDH", "CEDU", "Konvention zum Schutze der Menschenrechte und Grundfreiheiten", "Convention de sauvegarde des droits de l'homme et des libertés fondamentales", "Convenzione per la salvaguardia dei diritti dell'uomo e delle libertà fondamentali", "cc/1974/2151_2151_2151"],
    ["0.142.112.681", "FZA", "ALCP", "ALC", "Abkommen zwischen der Schweizerischen Eidgenossenschaft einerseits und der Europäischen Gemeinschaft und ihren Mitgliedstaaten andererseits über die Freizügigkeit (mit Anhängen, Prot. und Schlussakte)", "Accord entre la Confédération suisse d'une part, et la Communauté européenne et ses États membres, d'autre part, sur la libre circulation des personnes (avec annexes, prot. et acte final)", "Accordo tra la Confederazione Svizzera, da una parte, e la Comunità europea ed i suoi Stati membri, dall'altra, sulla libera circolazione delle persone (con allegati, protocolli e atto finale)", "cc/2002/243"],
    ["0.142.392.68", "DAA", "AAD", "AAD", "Abkommen zwischen der Schweizerischen Eidgenossenschaft und der Europäischen Gemeinschaft über die Kriterien und Verfahren zur Bestimmung des zuständigen Staates für die Prüfung eines in einem Mitgliedstaat oder in der Schweiz gestellten Asylantrags (mit Schlussakte)", "Accord entre la Confédération suisse et la Communauté européenne relatif aux critères et aux mécanismes permettant de déterminer l'État responsable de l'examen d'une demande d'asile introduite dans un État membre ou en Suisse (avec acte final)", "Accordo tra la Confederazione Svizzera e la Comunità europea relativo ai criteri e ai meccanismi che permettono di determinare lo Stato competente per l'esame di una domanda di asilo introdotta in uno degli Stati membri o in Svizzera (con atto finale)", "cc/2008/115"],
    ["0.362.31", null, null, null, "Abkommen zwischen der Schweizerischen Eidgenossenschaft, der Europäischen Union und der Europäischen Gemeinschaft über die Assoziierung dieses Staates bei der Umsetzung, Anwendung und Entwicklung des Schengen-Besitzstands (mit Anhängen und Schlussakte)", "Accord entre la Confédération suisse, l'Union européenne et la Communauté européenne sur l'association de la Confédération suisse à la mise en œuvre, à l'application et au développement de l'acquis de Schengen (avec annexes et acte final)", "Accordo tra la Confederazione Svizzera, l'Unione europea e la Comunità europea, riguardante l'associazione della Svizzera all'attuazione, all'applicazione e allo sviluppo dell'acquis di Schengen (con all., atto finale)", "cc/2008/113"],
    ["101", "BV", "Cst.", "Cost.", "Bundesverfassung der Schweizerischen Eidgenossenschaft", "Constitution fédérale de la Confédération suisse", "Costituzione federale della Confederazione Svizzera", "cc/1999/404"],
    ["120", "BWIS", "LMSI", "LMSI", "Bundesgesetz über Massnahmen zur Wahrung der inneren Sicherheit", "Loi fédérale instituant des mesures visant au maintien de la sûreté intérieure", "Legge federale sulle misure per la salvaguardia della sicurezza interna", "cc/1998/1546_1546_1546"],
    ["121", "NDG", "LRens", "LAIn", "Nachrichtendienstgesetz", "Loi fédérale sur le renseignement", "Legge federale sulle attività informative", "cc/2017/494"],
    ["128", "ISG", "LSI", "LSIn", "Informationssicherheitsgesetz", "Loi sur la sécurité de l’information", "Legge federale sulla sicurezza delle informazioni", "cc/2022/232"],
    ["141.0", "BüG", "LN", "LCit", "Bürgerrechtsgesetz", "Loi sur la nationalité suisse", "Legge sulla cittadinanza", "cc/2016/404"],
    ["141.01", "BüV", "OLN", "OCit", "Bürgerrechtsverordnung", "Ordonnance sur la nationalité", "Ordinanza sulla cittadinanza", "cc/2016/405"],
    ["142.20", "AIG", "LEI", "LStrI", "Ausländer- und Integrationsgesetz", "Loi fédérale sur les étrangers et l'intégration", "Legge federale sugli stranieri e la loro integrazione", "cc/2007/758"],
    ["142.31", "AsylG", "LAsi", "LAsi", "Asylgesetz", "Loi sur l'asile", "Legge sull'asilo", "cc/1999/358"],
    ["142.51", "BGIAA", "LDEA", "LSISA", "Bundesgesetz über das Informationssystem für den Ausländer- und den Asylbereich", "Loi fédérale sur le système d'information commun aux domaines des étrangers et de l'asile", "Legge federale sul sistema d'informazione per il settore degli stranieri e dell'asilo", "cc/2006/301"],
    ["142.201", "VZAE", "OASA", "OASA", "Verordnung über Zulassung, Aufenthalt und Erwerbstätigkeit", "Ordonnance relative à l'admission, au séjour et à l'exercice d'une activité lucrative", "Ordinanza sull'ammissione, il soggiorno e l'attività lucrativa", "cc/2007/759"],
    ["142.204", "VEV", "OEV", "OEV", "Verordnung über die Einreise und die Visumerteilung", "Ordonnance sur l'entrée et l'octroi de visas", "Ordinanza concernente l'entrata e il rilascio del visto", "cc/2018/493"],
    ["142.205", "VIntA", "OIE", "OIntS", "Verordnung über die Integration von Ausländerinnen und Ausländern", "Ordonnance sur l'intégration des étrangers", "Ordinanza sull'integrazione degli stranieri", "cc/2018/511"],
    ["142.209", "GebV-AIG", "Oem-LEI", "OEmol-LStrI", "Gebührenverordnung AIG", "Tarif des émoluments LEI", "Ordinanza sugli emolumenti LStrI", "cc/2007/763"],
    ["142.281", "VVWAL", "OERE", "OEAE", "Verordnung über den Vollzug der Weg- und Ausweisung sowie der Landesverweisung von ausländischen Personen", "Ordonnance sur l'exécution du renvoi et de l'expulsion d'étrangers", "Ordinanza concernente l'esecuzione dell'allontanamento e dell'espulsione di stranieri", "cc/1999/357"],
    ["142.311", "AsylV 1", "OA 1", "OAsi 1", "Asylverordnung 1", "Ordonnance 1 sur l'asile", "Ordinanza 1 sull'asilo", "cc/1999/359"],
    ["142.312", "AsylV 2", "OA 2", "OAsi 2", "Asylverordnung 2", "Ordonnance 2 sur l'asile", "Ordinanza 2 sull'asilo", "cc/1999/360"],
    ["142.314", "AsylV 3", "OA 3", "OAsi 3", "Asylverordnung 3", "Ordonnance 3 sur l'asile", "Ordinanza 3 sull'asilo", "cc/1999/361"],
    ["142.512", "VISV", "OVIS", "OVIS", "Visa-Informationssystem-Verordnung", "Ordonnance VIS", "Ordinanza VIS", "cc/2014/2"],
    ["142.513", null, null, null, "ZEMIS-Verordnung", "Ordonnance SYMIC", "Ordinanza SIMIC", "cc/2006/303"],
    ["143.1", "AwG", "LDI", "LDI", "Ausweisgesetz", "Loi sur les documents d'identité", "Legge sui documenti d'identità", "cc/2002/441"],
    ["143.11", "VAwG", "OLDI", "ODI", "Ausweisverordnung", "Ordonnance sur les documents d'identité", "Ordinanza sui documenti d'identità", "cc/2002/468"],
    ["152.1", "BGA", "LAr", "LAr", "Archivierungsgesetz", "Loi fédérale sur l'archivage", "Legge sull'archiviazione", "cc/1999/354"],
    ["152.3", "BGÖ", "LTrans", "LTras", "Öffentlichkeitsgesetz", "Loi sur la transparence", "Legge sulla trasparenza", "cc/2006/355"],
    ["152.31", "VBGÖ", "OTrans", "OTras", "Öffentlichkeitsverordnung", "Ordonnance sur la transparence", "Ordinanza sulla trasparenza", "cc/2006/356"],
    ["170.32", "VG", "LRCF", "LResp", "Verantwortlichkeitsgesetz", "Loi sur la responsabilité", "Legge sulla responsabilità", "cc/1958/1413_1483_1489"],
    ["170.512", "PublG", "LPubl", "LPubb", "Publikationsgesetz", "Loi sur les publications officielles", "Legge sulle pubblicazioni ufficiali", "cc/2004/745"],
    ["171.10", "ParlG", "LParl", "LParl", "Parlamentsgesetz", "Loi sur le Parlement", "Legge sul Parlamento", "cc/2003/510"],
    ["172.010", "RVOG", "LOGA", "LOGA", "Regierungs- und Verwaltungsorganisationsgesetz", "Loi sur l'organisation du gouvernement et de l'administration", "Legge sull'organizzazione del Governo e dell'Amministrazione", "cc/1997/2022_2022_2022"],
    ["172.010.1", "RVOV", "OLOGA", "OLOGA", "Regierungs- und Verwaltungsorganisationsverordnung", "Ordonnance sur l'organisation du gouvernement et de l'administration", "Ordinanza sull'organizzazione del Governo e dell'Amministrazione", "cc/1999/170"],
    ["172.021", "VwVG", "PA", "PA", "Verwaltungsverfahrensgesetz", "Loi fédérale sur la procédure administrative", "Legge federale sulla procedura amministrativa", "cc/1969/737_757_755"],
    ["172.056.1", "BöB", "LMP", "LAPub", "Bundesgesetz über das öffentliche Beschaffungswesen", "Loi fédérale sur les marchés publics", "Legge federale sugli appalti pubblici", "cc/2020/126"],
    ["172.056.11", "VöB", "OMP", "OAPub", "Verordnung über das öffentliche Beschaffungswesen", "Ordonnance sur les marchés publics", "Ordinanza sugli appalti pubblici", "cc/2020/127"],
    ["172.061", "VlG", "LCo", "LCo", "Vernehmlassungsgesetz", "Loi sur la consultation", "Legge sulla consultazione", "cc/2005/542"],
    ["172.220.1", "BPG", "LPers", "LPers", "Bundespersonalgesetz", "Loi sur le personnel de la Confédération", "Legge sul personale federale", "cc/2001/123"],
    ["172.220.111.3", "BPV", "OPers", "OPers", "Bundespersonalverordnung", "Ordonnance sur le personnel de la Confédération", "Ordinanza sul personale federale", "cc/2001/319"],
    ["173.32", "VGG", "LTAF", "LTAF", "Verwaltungsgerichtsgesetz", "Loi sur le Tribunal administratif fédéral", "Legge sul Tribunale amministrativo federale", "cc/2006/352"],
    ["173.110", "BGG", "LTF", "LTF", "Bundesgerichtsgesetz", "Loi sur le Tribunal fédéral", "Legge sul Tribunale federale", "cc/2006/218"],
    ["210", "ZGB", "CC", "CC", "Schweizerisches Zivilgesetzbuch", "Code civil suisse", "Codice civile svizzero", "cc/24/233_245_233"],
    ["220", "OR", "CO", "CO", "Bundesgesetz betreffend die Ergänzung des Schweizerischen Zivilgesetzbuches (Fünfter Teil: Obligationenrecht)", "Loi fédérale complétant le Code civil suisse (Livre cinquième: Droit des obligations)", "Legge federale di complemento del Codice civile svizzero (Libro quinto: Diritto delle obbligazioni)", "cc/27/317_321_377"],
    ["235.1", "DSG", "LPD", "LPD", "Datenschutzgesetz", "Loi fédérale sur la protection des données", "Legge federale sulla protezione dei dati", "cc/2022/491"],
    ["235.11", "DSV", "OPDo", "OPDa", "Datenschutzverordnung", "Ordonnance sur la protection des données", "Ordinanza sulla protezione dei dati", "cc/2022/568"],
    ["272", "ZPO", "CPC", "CPC", "Zivilprozessordnung", "Code de procédure civile", "Codice di procedura civile", "cc/2010/262"],
    ["281.1", "SchKG", "LP", "LEF", "Bundesgesetz über Schuldbetreibung und Konkurs", "Loi fédérale sur la poursuite pour dettes et la faillite", "Legge federale sulla esecuzione e sul fallimento", "cc/11/529_488_529"],
    ["311.0", "StGB", "CP", "CP", "Schweizerisches Strafgesetzbuch", "Code pénal suisse", "Codice penale svizzero", "cc/54/757_781_799"],
    ["312.0", "StPO", "CPP", "CPP", "Strafprozessordnung", "Code de procédure pénale", "Codice di procedura penale", "cc/2010/267"],
    ["313.0", "VStrR", "DPA", "DPA", "Bundesgesetz über das Verwaltungsstrafrecht", "Loi fédérale sur le droit pénal administratif", "Legge federale sul diritto penale amministrativo", "cc/1974/1857_1857_1857"],
    ["362.0", null, null, null, "N-SIS-Verordnung", "Ordonnance N-SIS", "Ordinanza N-SIS", "cc/2013/179"],
    ["364", "ZAG", "LUsC", "LCoe", "Zwangsanwendungsgesetz", "Loi sur l'usage de la contrainte", "Legge sulla coercizione", "cc/2008/759"],
    ["441.1", "SpG", "LLC", "LLing", "Sprachengesetz", "Loi sur les langues", "Legge sulle lingue", "cc/2009/821"],
    ["441.11", "SpV", "OLang", "OLing", "Sprachenverordnung", "Ordonnance sur les langues", "Ordinanza sulle lingue", "cc/2010/355"],
    ["611.0", "FHG", "LFC", "LFC", "Finanzhaushaltgesetz", "Loi sur les finances", "Legge federale sulle finanze della Confederazione", "cc/2006/227"],
    ["611.01", "FHV", "OFC", "OFC", "Finanzhaushaltverordnung", "Ordonnance sur les finances de la Confédération", "Ordinanza sulle finanze della Confederazione", "cc/2006/228"],
    ["616.1", "SuG", "LSu", "LSu", "Subventionsgesetz", "Loi sur les subventions", "Legge sui sussidi", "cc/1991/857_857_857"],
    ["641.20", "MWSTG", "LTVA", "LIVA", "Mehrwertsteuergesetz", "Loi sur la TVA", "Legge sull'IVA", "cc/2009/615"],
    ["830.1", "ATSG", "LPGA", "LPGA", "Bundesgesetz über den Allgemeinen Teil des Sozialversicherungsrechts", "Loi fédérale sur la partie générale du droit des assurances sociales", "Legge federale sulla parte generale del diritto delle assicurazioni sociali", "cc/2002/510"],
    ["831.10", "AHVG", "LAVS", "LAVS", "Bundesgesetz über die Alters- und Hinterlassenenversicherung", "Loi fédérale sur l'assurance-vieillesse et survivants", "Legge federale sull'assicurazione per la vecchiaia e per i superstiti", "cc/63/837_843_843"],
    ["831.20", "IVG", "LAI", "LAI", "Bundesgesetz über die Invalidenversicherung", "Loi fédérale sur l'assurance-invalidité", "Legge federale sull’assicurazione per l’invalidità", "cc/1959/827_857_845"]
  ];
  const LANGS = ['de', 'fr', 'it'];
  /** Abgelöste Abkürzungen: [Kürzel, Sprache, SR-Nummer des heutigen Erlasses, gültig bis]. Nur Fälle, bei denen der heutige Erlass
      dieselbe SR-Nummer trägt: Ausländergesetz (AuG, LEtr, LStr) bis 31.12.2018, heute AIG, LEI, LStrI; Bundesgesetz über Aufenthalt
      und Niederlassung der Ausländer (ANAG, LSEE, LDDS) bis 31.12.2007. R04 meldet sie als Hinweis ohne Korrekturvorschlag: Ein Text
      darf das frühere Recht ausdrücklich meinen. */
  const FORMER = [['AuG', 'de', '142.20', '2018-12-31'], ['LEtr', 'fr', '142.20', '2018-12-31'], ['LStr', 'it', '142.20', '2018-12-31'],
    ['ANAG', 'de', '142.20', '2007-12-31'], ['LSEE', 'fr', '142.20', '2007-12-31'], ['LDDS', 'it', '142.20', '2007-12-31']];
  const FORMER_RE = new RegExp('(?<![\\p{L}\\d\\-/])(' + FORMER.map(f => f[0]).join('|') + ')(?![\\p{L}\\d\\-])', 'gu');
  const mkAct = (e, own) => ({ sr: e[0], abbr: { de: e[1], fr: e[2], it: e[3] }, short: { de: e[4], fr: e[5], it: e[6] }, eli: e[7] || null, own: !!own });
  const TABLE = RAW.map(e => mkAct(e));

  /** Kürzel, die auch gewöhnliche Wörter oder andere Abkürzungen sind: gelten nur mit Zusammenhang (Artikel, SR-Nummer, Titel davor). */
  const AMBIG = new Set(['OR', 'CO', 'CC', 'CP', 'PA', 'LP', 'VG', 'BV', 'LEI', 'DPA', 'LAI', 'LN', 'LAr', 'LCo', 'SpG', 'OFC', 'LFC', 'ALC', 'BGA', 'LDI', 'CPC', 'CPP', 'LSI', 'LSu']);
  /** Auch in der eigenen Sprache mehrdeutig: «VG» (Verwaltungsgericht), «CP 1234» (case postale), «LP», «DPA» (Nachrichtenagentur). */
  const HARD = new Set(['VG', 'CP', 'LP', 'DPA']);

  /** Eigene Erlasse: eine Zeile «SR-Nummer; DE; FR; IT». Trennzeichen ; | oder Tabulator; leere Felder und «-» = keine Abkürzung.
      Zeilen mit # am Anfang sind Kommentare. Liefert {acts, valid, invalid: [{line, text, why}]}; why: fields | sr | abbr. */
  const SR_RE = /^(?:SR|RS)?\s*(0\.\d+(?:\.\d+)*|\d{1,3}(?:\.\d+)*)$/i;
  const AB_RE = /^[\p{L}][\p{L}\d.\-]*(?:[ \u00a0]\d{1,2})?$/u;
  function parseCustom(text) {
    const acts = [], invalid = [];
    (text || '').split('\n').forEach((line, k) => {
      const t = line.trim(); if (!t || t.startsWith('#')) return;
      const parts = t.split(/\s*(?:;|\||\t)\s*/);
      if (parts.length < 2 || parts.length > 4) { invalid.push({ line: k + 1, text: t, why: 'fields' }); return; }
      const m = SR_RE.exec(parts[0].trim());
      if (!m) { invalid.push({ line: k + 1, text: t, why: 'sr' }); return; }
      const ab = [1, 2, 3].map(i => { const v = (parts[i] || '').trim(); return !v || /^[-–—]$/.test(v) ? null : v; });
      if (!ab.some(Boolean) || ab.some(v => v && (v.length > 24 || !AB_RE.test(v)))) { invalid.push({ line: k + 1, text: t, why: 'abbr' }); return; }
      acts.push(mkAct([m[1], ab[0], ab[1], ab[2], ab[0] || ab[1] || ab[2], ab[1] || ab[0] || ab[2], ab[2] || ab[1] || ab[0], null], true));
    });
    return { acts, valid: acts.length, invalid };
  }

  /* ---------- Verzeichnis: Tabelle plus eigene Erlasse (eigene ersetzen Einträge mit derselben SR-Nummer) ---------- */
  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[’']/g, ' ').replace(/[^\p{L}\d]+/gu, ' ').trim();
  const GENERIC = /^(?:bundesgesetz|verordnung|loi federale|loi|ordonnance|legge federale|legge|ordinanza|code|codice|accord|accordo|abkommen|convention|convenzione|konvention)(?:\s+(?:uber die|uber den|uber das|uber|betreffend die|zur|zum|sur la|sur le|sur les|sur l|sur|relative a l|relative au|relative a la|relative aux|relative a|concernant|concernente l|concernente il|concernente la|concernente|instituant des|sulla|sul|sui|sugli|sulle|sull|su la|di complemento del|completant le|entre|tra|de|du|des|di|del|della))?\s+/;
  const NATIONAL = /\s+(?:suisse|svizzero|svizzera|federale|federal)$|^(?:schweizerisches|schweizerische)\s+/;
  /** Kerne des Titels zum Wiedererkennen im Text: «Datenschutzgesetz» → «datenschutzgeset» (auch im Genitiv), «Loi sur la
      transparence» → «transparence», «Code civil suisse» → «code civil». Nur Kerne ab sechs Zeichen. */
  function cores(act) {
    const out = {};
    for (const l of LANGS) {
      const s = act.short[l]; if (!s || (act.own && !act.merged)) { out[l] = []; continue; }
      const n = norm(s), v = new Set();
      for (const x of [n, n.replace(GENERIC, '')]) { v.add(x); v.add(x.replace(NATIONAL, '')); }
      out[l] = Array.from(v).map(c => (/^\p{L}+$/u.test(c) && l === 'de' && c.length > 9 ? c.slice(0, -1) : c)).filter(c => c.length >= 6 && !/^(?:bundesgesetz|verordnung|loi federale|ordonnance|legge federale|ordinanza)$/.test(c));
    }
    return out;
  }
  let cache = { key: null, idx: null };
  function index(custom) {
    const key = custom && custom.length ? JSON.stringify(custom.map(a => [a.sr, a.abbr])) : '';
    if (cache.idx && cache.key === key) return cache.idx;
    const bySr = new Map();
    for (const a of TABLE) bySr.set(a.sr, a);
    // Eigene Einträge ersetzen die Abkürzungen; die amtlichen Titel eines bekannten Erlasses bleiben für die Titelerkennung
    for (const a of custom || []) { const t = bySr.get(a.sr); bySr.set(a.sr, t ? Object.assign({}, t, { abbr: a.abbr, own: true, merged: true }) : a); }
    const acts = Array.from(bySr.values());
    const byTok = new Map();
    for (const a of acts) { a.core = cores(a); for (const l of LANGS) { const t = a.abbr[l]; if (!t) continue; let e = byTok.get(t); if (!e) byTok.set(t, e = []); if (!e.some(x => x.act === a)) e.push({ act: a, langs: [] }); e.find(x => x.act === a).langs.push(l); } }
    const toks = Array.from(byTok.keys()).sort((a, b) => b.length - a.length).map(t => L.esc(t).replace(/ /g, '[ \\u00a0]'));
    // Eine angehängte Fussnotenziffer («LAsi40») gehört nicht zum Kürzel
    const tokRe = toks.length ? new RegExp('(?<![\\p{L}\\d\\-/])(' + toks.join('|') + ')(?:(?![\\p{L}\\d\\-])|(?<=\\p{L})(?=\\d{1,3}(?!\\d)(?![.,]\\d)(?!\\p{L})))', 'gu') : null;
    cache = { key, idx: { acts, bySr, byTok, tokRe } };
    return cache.idx;
  }
  const canon = (t) => t.replace(/\u00a0/g, ' ');

  /* ---------- Zusammenhang für mehrdeutige Kürzel ---------- */
  const ART_BEFORE = /(?:(?<![\p{L}])(?:Art|art|Artikel|article|articles|articolo|articoli)\.?[\s\u00a0]*\d+[a-z]?(?:bis|ter|quater)?)(?:[\s\u00a0,]+(?:(?:Abs|al|cpv|Bst|let|lett|lit|Ziff|ch|n|Satz|par|Nr)\.?[\s\u00a0]*[\da-z]+(?:bis|ter|quater)?\.?|und|et|e|bis|à|a|\d+[a-z]?))*[\s\u00a0,]*(?:des|der|du|de\s+la|de\s+l['’]|de|del|della|dell['’])?[\s\u00a0]*$/u;
  const SR_AFTER = /^[\s\u00a0]*[,;]?[\s\u00a0]*\(?(?:SR|RS)[\s\u00a0]*\d/;
  const TITLE_BEFORE = /(?:gesetz\p{L}*|verordnung\p{L}*|gesetzbuch\p{L}*|recht\p{L}*|ordnung\p{L}*|verfassung|loi|ordonnance|code|legge|ordinanza|codice|constitution|costituzione|convention|convenzione|konvention|abkommen|accord|accordo)(?:[^()]{0,90})\([\s\u00a0]*$/iu;
  /** Gilt das Kürzel an dieser Stelle sicher als Erlass? Eindeutige Kürzel immer, mehrdeutige nur mit Zusammenhang. */
  function strongCtx(text, s, e) {
    const before = text.slice(Math.max(0, s - 60), s), after = text.slice(e, e + 24);
    if (ART_BEFORE.test(before) || SR_AFTER.test(after)) return true;
    if (TITLE_BEFORE.test(before) && /^[\s\u00a0]*[,;)]/.test(after)) return true;
    return false;
  }
  /** Titel eines Erlasses im Satz (zur Entscheidung, welche Seite einer falschen Paarung stimmt). */
  function titleIn(act, text, lang) {
    const n = ' ' + norm(text) + ' ';
    const ls = lang && act.core[lang] && act.core[lang].length ? [lang] : LANGS;
    return ls.some(l => act.core[l].some(c => n.includes(' ' + c) || n.includes(c + ' ')));
  }

  /** Erlasszitate eines Texts in der Sprache lang: Kürzel (mit Sicherheit) und SR-Nummern. Ein mehrdeutiges Kürzel gilt als sicher
      mit Zusammenhang (Artikel, SR-Nummer, Titel davor) oder, wenn es in der Sprache des Texts gültig ist und nicht zu HARD gehört. */
  function scan(text, idx, lang) {
    const cites = [], srs = [];
    if (!text || !idx.tokRe) return { cites, srs };
    idx.tokRe.lastIndex = 0; let m;
    while ((m = idx.tokRe.exec(text))) {
      const tok = canon(m[1]), ent = idx.byTok.get(tok); if (!ent) continue;
      const s = m.index, e = s + m[1].length;
      const own = ent.length === 1 && ent[0].langs.includes(lang) && !HARD.has(tok) && !/^[\s\u00a0]*\d/.test(text.slice(e, e + 3));
      const sure = ent.length === 1 && (!AMBIG.has(tok) || own || strongCtx(text, s, e));
      cites.push({ tok, ent, act: ent.length === 1 ? ent[0].act : null, langs: ent.length === 1 ? ent[0].langs : [], start: s, end: e, sure });
    }
    const sr = /(?<![\p{L}\d])(?:SR|RS)[\s\u00a0]*(0\.\d+(?:\.\d+)*|\d{1,3}(?:\.\d+)*)/gu;
    while ((m = sr.exec(text))) srs.push({ sr: m[1], act: idx.bySr.get(m[1]) || null, start: m.index, end: m.index + m[0].length, raw: m[0], numStart: m.index + m[0].length - m[1].length });
    return { cites, srs };
  }
  /** Ist das Kürzel in dieser Sprache für einen Erlass gültig? */
  const validIn = (idx, tok, lang) => (idx.byTok.get(tok) || []).some(x => x.langs.includes(lang));
  const nameOf = (act, lang) => act.abbr[lang] || act.short[lang] || act.abbr.de || act.sr;

  const LANG_MARK = /(?:franz|frz|französisch|ital|italienisch|dt|deutsch|fr|it|allemand|italien|français|tedesco|francese|italiano|en\s+français|en\s+italien|en\s+allemand|in\s+francese|in\s+tedesco|in\s+italiano)\.?[\s\u00a0:]*[«"„“]?[\s\u00a0]*$/iu;
  /** Prüfung eines Absatzes (Regel R04). a) Kürzel und SR-Nummer gehören zu verschiedenen Erlassen; b) Kürzel einer anderen
      Sprachfassung im Fliesstext. Liefert [{kind: 'pair'|'lang', start, end, ...}]. */
  function check(text, lang, idx, opts) {
    opts = opts || {};
    const out = []; if (!['de', 'fr', 'it'].includes(lang)) return out;
    const { cites, srs } = scan(text, idx, lang);
    const used = new Set();
    for (const r of srs) {
      // Kürzel direkt vor der Nummer («DSG, SR 235.1») oder direkt danach in Klammern («SR 142.20 (AIG)»)
      let c = cites.filter(x => x.end <= r.start && /^[\s\u00a0]*[,;]?[\s\u00a0]*\(?[\s\u00a0]*$/.test(text.slice(x.end, r.start)) && r.start - x.end <= 6).pop();
      if (!c) c = cites.find(x => x.start >= r.end && /^[\s\u00a0]*\([\s\u00a0]*$/.test(text.slice(r.end, x.start)) && /^[\s\u00a0]*\)/.test(text.slice(x.end)));
      if (!c || !c.act) continue;
      if (c.act.sr === r.sr) continue;
      // Zusammenhang durch die Nummer gegeben: auch ein mehrdeutiges Kürzel gilt hier als Erlass
      const sent = (L.sentences(text).find(s => r.start >= s.start && r.start < s.end) || { start: 0, end: text.length });
      const st = text.slice(sent.start, sent.end);
      const tokOk = titleIn(c.act, st, lang), srOk = r.act ? titleIn(r.act, st, lang) : false;
      let fix = null;
      if (tokOk && !srOk) fix = { start: r.numStart, end: r.end, repl: c.act.sr };
      else if (srOk && !tokOk && r.act && r.act.abbr[lang]) fix = { start: c.start, end: c.end, repl: r.act.abbr[lang] };
      // Markierung: Kürzel und Nummer; steht eine geöffnete Klammer darin, gehört die schliessende dazu («AIG (SR 142.201)»)
      const ms = Math.min(c.start, r.start); let me = Math.max(c.end, r.end);
      const seg = text.slice(ms, me), close = /^[\s\u00a0]*\)/.exec(text.slice(me));
      if (close && (seg.match(/\(/g) || []).length > (seg.match(/\)/g) || []).length) me += close[0].length;
      out.push({ kind: 'pair', start: ms, end: me, tok: c.tok, tokSr: c.act.sr, sr: r.sr, srAct: r.act, fix, act: c.act });
      used.add(c);
    }
    if (opts.running !== false) {
      const multi = new Map();
      for (const c of cites) if (c.act) { const s = multi.get(c.act) || new Set(); for (const l of c.langs) s.add(l); multi.set(c.act, s); }
      for (const c of cites) {
        if (used.has(c) || !c.sure || !c.act || validIn(idx, c.tok, lang)) continue;
        // Aufzählung der Sprachfassungen («AIG, LEI, LStrI») oder ausdrücklich fremdsprachig («franz. LEI»): kein Befund
        if (multi.get(c.act).size > 1 && cites.some(x => x.act === c.act && x !== c && validIn(idx, x.tok, lang))) continue;
        if (LANG_MARK.test(text.slice(Math.max(0, c.start - 24), c.start))) continue;
        if (/[«"„“][\s\u00a0]*$/.test(text.slice(Math.max(0, c.start - 2), c.start)) && /^[\s\u00a0]*[»"“”]/.test(text.slice(c.end, c.end + 2))) continue;
        const dst = c.act.abbr[lang];
        out.push({ kind: 'lang', start: c.start, end: c.end, tok: c.tok, from: c.langs[0], act: c.act, dst, fix: dst ? { start: c.start, end: c.end, repl: dst } : null });
      }
    }
    // Abgelöste Abkürzungen; nicht, wenn der Absatz den heutigen Erlass ebenfalls nennt (Vergleich alt und neu, Geschichte)
    FORMER_RE.lastIndex = 0; let m;
    while ((m = FORMER_RE.exec(text))) {
      const f = FORMER.find(x => x[0] === m[1]), act = idx.bySr.get(f[2]); if (!act) continue;
      if (cites.some(c => c.act === act) || scan(text, idx, lang).srs.some(x => x.act === act)) continue;
      out.push({ kind: 'old', start: m.index, end: m.index + m[1].length, tok: m[1], from: f[1], until: f[3], act, dst: act.abbr[lang] || act.abbr.de, fix: null });
    }
    return out;
  }

  DP.erlasse = { TABLE, AMBIG, FORMER, parseCustom, index, scan, check, validIn, nameOf, titleIn, LANGS };
})(globalThis.DP = globalThis.DP || {});
