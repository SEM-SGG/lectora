/* Modalität im Amtstext: Pflicht, Verbot, Erlaubnis oder Möglichkeit, Empfehlung, fehlende Pflicht. Deutsch, Französisch, Italienisch.
   find(text, lang) liefert die Modalausdrücke eines Absatzes mit Klasse und Stelle. Mehrdeutige Fälle (epistemisch, Konjunktiv II,
   einschränkend mit «nur», Fragen, Verneinung unklar) tragen unc: true. Sie ergeben keinen Befund, verhindern aber Meldungen über
   einen «fehlenden» Ausdruck. Kein DOM, keine Netzwerkaufrufe.
   Klassen: obl Pflicht, pro Verbot, per Erlaubnis oder Möglichkeit, nper verneinte Möglichkeit («kann nicht», «ne peut pas»: Verbot
   oder Unvermögen), rec Empfehlung oder Ziel (soft: «soll», «sollen»), nob fehlende Pflicht («muss nicht», «n'est pas tenu de»). */
(function (DP) {
  'use strict';
  const L = DP.lang;
  const LW = '(?<![\\p{L}\\d\\-])', RW = '(?![\\p{L}\\d\\-])';
  const re = (src, fl) => new RegExp(src, (fl || '') + 'gu');
  const test = (r, s) => { r.lastIndex = 0; return r.test(s); };

  /** Teilsätze: Satzgrenzen aus L.sentences (kennt Abkürzungen wie «Art.»), darin Grenzen an Komma, Semikolon, Doppelpunkt, Klammern, Gedankenstrich. */
  function clauses(text) {
    const out = [];
    for (const s of L.sentences(text)) {
      const r = /[,;:()\[\]]|\s[–—]\s/g; let m, pos = s.start;
      const body = text.slice(0, s.end);
      r.lastIndex = s.start;
      while ((m = r.exec(body))) { if (m.index > pos) out.push({ start: pos, end: m.index, sent: s }); pos = m.index + m[0].length; }
      if (s.end > pos) out.push({ start: pos, end: s.end, sent: s });
    }
    return out;
  }
  const clauseAt = (cl, i) => cl.findIndex(c => i >= c.start && i < c.end);
  /** Neue Fundstelle aufnehmen: Eine Stelle, die bestehende ganz umfasst, ersetzt sie; sonst gewinnt die frühere. */
  function addItem(items, it) {
    const ov = items.filter(x => it.start < x.end && it.end > x.start);
    if (ov.some(x => !(x.start >= it.start && x.end <= it.end) || (x.end - x.start) === (it.end - it.start))) return false;
    for (const x of ov) items.splice(items.indexOf(x), 1);
    items.push(it); return true;
  }
  /** Gemeinsame Abschwächungen: Frage, Einschränkung, epistemische Wörter. */
  function hedges(cs, sent, cls, restrRe, episRe) {
    if (/\?\s*[»"”]?\s*$/.test(sent)) return true;
    if (restrRe.test(cs)) return true;
    if ((cls === 'per' || cls === 'nper') && episRe.test(cs)) return true;
    return false;
  }

  /* ---------- Deutsch ---------- */
  const DE_NEG = re(LW + '(?:nicht|kein|keine|keinen|keinem|keiner|keines|nie|niemals|keinesfalls|keineswegs|keinerlei|weder)' + RW);
  const DE_NEGSUBJ = re(LW + '(?:[Kk]ein|[Kk]eine|[Kk]einer|[Kk]eines|[Kk]einem|[Kk]einen|[Kk]einesfalls|[Kk]eineswegs|[Nn]iemand|[Nn]ichts|[Nn]ie|[Nn]iemals)' + RW);
  // Verneinung eines Quantors («nicht alle», «nicht jede»): Umfang der Verneinung unklar
  const DE_NEGQ = /(?<![\p{L}])[Nn]icht\s+(?:alle|allen|aller|alles|jede|jeder|jedes|jeden|jedem|sämtliche|sämtlichen|beide|beiden)(?![\p{L}])/u;
  // Nebensatzeinleitungen (ohne Artikel): Verneinungen darin betreffen den Hauptsatz nicht
  const DE_SUB = /^\s*(?:dass|ob|wenn|sofern|soweit|falls|weil|da|nachdem|bevor|bis|während|damit|indem|obwohl|wobei|womit|wodurch|wofür|wonach|worauf|um|ohne|statt|anstatt|als|wie|wer|was|wo|welche|welcher|welches|welchem|welchen|deren|dessen|und|oder|aber|sondern|jedoch|doch|denn|sowie|nicht|insbesondere|namentlich|etwa|so|also)(?![\p{L}\d])/iu;
  const DE_REL = /^\s*(?:der|die|das|dem|den)\s[\s\S]*(?<![\p{L}])(?:ist|sind|war|waren|hat|haben|hatten|wird|werden|wurde|wurden|kann|können|muss|müssen|darf|dürfen|soll|sollen|\p{Ll}+(?:t|te|ten|et))\s*$/u;
  const DE_REMEDY = /(?<![\p{L}])(?:Beschwerde|Einsprache|Rekurs|Rechtsmittel|Wiedererwägung|angefochten|anfechtbar|Revision)(?![\p{L}])/u;
  const DE_INF_END = /(?:\p{Ll}{2,}(?:en|ern|eln)|werden|worden|sein)\s*[.!?…»"”]*\s*$/u;
  const DE_VERBS = [
    // [Formen, Klasse, Klasse verneint, unsicher]
    ['muss|müssen|musst|müsst', 'obl', 'nob'],
    ['müsste|müssten|musste|mussten', 'obl', 'nob', true],
    ['darf|dürfen|darfst|dürft', 'per', 'pro'],
    ['dürfte|dürften|durfte|durften', 'per', 'pro', true],
    ['kann|können|kannst|könnt', 'per', 'nper'],
    ['könnte|könnten|konnte|konnten', 'per', 'nper', true],
    ['soll|sollen|sollst|sollt', 'rec', 'rec'],
    ['sollte|sollten', 'rec', 'rec']
  ];
  const DE_PH = [
    // verneinte und längere Formen zuerst
    [LW + '(?:ist|sind)\\s+nicht\\s+(?:zulässig|gestattet|erlaubt)' + RW, 'pro', 'unc', 'neg'],
    [LW + '(?:ist|sind|bleibt|bleiben|wird|werden)(?:\\s+\\p{Ll}+){0,2}?\\s+(?:verpflichtet|gehalten)' + RW, 'obl', 'nob'],
    [LW + '(?:hat|haben)\\s+die\\s+Pflicht' + RW, 'obl', 'nob'],
    [LW + 'obliegt' + RW, 'obl', 'nob'],
    [LW + '(?:zwingend|obligatorisch)' + RW, 'obl', 'nob'],
    [LW + '(?:ist|sind)(?:\\s+\\p{Ll}+){0,2}?\\s+(?:untersagt|verboten|unzulässig)' + RW, 'pro', 'unc'],
    [LW + '(?:untersagt|verboten|unzulässig)' + RW, 'pro', 'unc'],
    [LW + '(?:ist|sind|bleibt|bleiben)(?:\\s+\\p{Ll}+){0,2}?\\s+(?:berechtigt|befugt|ermächtigt)' + RW, 'per', 'nper'],
    [LW + '(?:hat|haben)\\s+das\\s+Recht' + RW, 'per', 'nper'],
    [LW + '(?:steht|stehen)\\s+(?:es\\s+)?(?:\\p{L}+\\s+){0,4}?frei' + RW, 'per', 'nper'],
    [LW + '(?:ist|sind)\\s+(?:zulässig|gestattet|erlaubt)' + RW, 'per', 'pro'],
    [LW + '(?:empfiehlt\\s+sich|wird\\s+empfohlen|werden\\s+empfohlen|ist\\s+empfohlen|ist\\s+anzustreben|sind\\s+anzustreben|empfiehlt|empfehlen)' + RW, 'rec', 'rec'],
    [LW + '(?:braucht|brauchen)' + RW, 'none', 'nob'],
    [LW + '(?:ist|sind)\\s+(?:nicht|kein\\p{Ll}*)(?:\\s+\\p{L}+){0,8}?\\s+(?:erforderlich|notwendig|nötig)' + RW, 'nob', 'nob', 'neg'],
    [LW + '(?:kein\\p{Ll}*)(?:\\s+\\p{L}+){0,8}?\\s+(?:erforderlich|notwendig|nötig)' + RW, 'nob', 'nob', 'neg'],
    [LW + 'es\\s+ist\\s+(?:erforderlich|notwendig|unerlässlich),?\\s+(?:dass|zu)' + RW, 'obl', 'nob']
  ];
  // Verben und Wörter, mit denen «ist/hat … zu + Infinitiv» keine Pflicht ausdrückt
  const DE_ZU_SKIP = /^(?:erwarten|befürchten|vermuten|hoffen|bedauern|begrüssen|sehen|erkennen|finden|lesen|entnehmen|haben|erreichen|kaufen|beziehen|verstehen|sagen|bemerken|erwähnen|verzeichnen|beobachten|tun|offen|eigen|eben|verschieden|gelegen|selten|trocken|anzunehmen|auszugehen|festzustellen|festzuhalten|hervorzuheben|anzumerken|ersehen|erfahren|bekommen|kriegen|machen|rechnen)$/u;
  const DE_ZU_PREFIX = /^(?:ab|an|auf|aus|bei|ein|mit|nach|vor|weg|zurück|weiter|fest|her|hin|dar|frei|statt|teil|vorbei|zusammen|um|durch|über|unter|wieder|bereit|bekannt|fern|los|hinzu|heran|herbei|voran|vorweg|zu|sicher|klar|fertig|hoch|gut|offen|hervor|heraus|herein|hinein|hinaus|entgegen|gegenüber|nieder|wahr|zurecht|kund|stand|gleich|richtig|fort|nahe|kennen|stil|still|vorher)zu\p{Ll}{2,}en$/u;
  const DE_ZU_BLOCK = /(?<![\p{L}])(?:Möglichkeit|Gelegenheit|Absicht|Zeit|Mühe|Lage|Ziel|Zweck|Anspruch|Befugnis|Recht|bereit|imstande|gewillt|fähig|leicht|schwer|schwierig|einfach|kaum|möglich|beschlossen|entschieden|versucht|vergessen|begonnen|vorgesehen|geplant|angefangen|aufgehört|gedacht|gewagt|geschafft|ge\p{Ll}+t)(?![\p{L}])/u;
  function deScan(s) {
    s = s.replace(/(?<![\p{L}])(nicht)(\s+\1)+(?![\p{L}])/gu, '$1')
      .replace(/(?<![\p{L}])nicht\s+(?:nur|zuletzt|selten|unerheblich|unwesentlich|wenige|zwingend\s+nur)(?![\p{L}])/gu, ' ')
      .replace(/(?<![\p{L}])nicht\s+(?!(?:ohne|alle|allen|aller|alles|jede|jeder|jedes|jeden|jedem|sämtliche|sämtlichen|beide|beiden|mehr|einfach|eine|einen|einem|einer|eines|diese|dieser|dieses|diesen|diesem|jene|jener|jenes|jenen|jenem|seine|seinen|seinem|seiner|ihre|ihren|ihrem|ihrer|deren|dessen|unsere|unseren|andere|anderen|solche|solchen|gleiche|gleichen|ganze|ganzen|blosse|blossen|nur|erst|gerne|ohne)(?![\p{L}]))\p{Ll}+(?:e|en|er|es|em)\s+\p{Lu}/gu, ' ');
    return test(DE_NEG, s);
  }
  /** Verneint? Verbletzt (Nebensatz): vom Teilsatzbeginn bzw. vorigen Modalausdruck bis zum Ausdruck. Sonst nach dem Ausdruck
      bis zum nächsten Modalausdruck; fehlt im eigenen Teilsatz das Vollverb, auch in den folgenden Teilsätzen desselben Satzes,
      ohne eingeschobene Neben- und Relativsätze. Verneinte Subjekte («Niemand darf …») stehen vor dem Ausdruck. */
  function deNegated(text, cl, idx, it, starts, ends) {
    const c = cl[idx];
    const nx = starts.find(x => x >= it.end), limit = nx == null ? Infinity : nx;
    const own = text.slice(it.end, Math.min(c.end, limit));
    const first = !(idx > 0 && cl[idx - 1].sent === c.sent);
    // Verbletzt nur im Nebensatz; «Die Kanzlei darf, sofern …, die Daten nicht weitergeben» ist ein unterbrochener Hauptsatz
    if (!own.replace(/[\s.!?…»"”]/g, '') && (!first || DE_SUB.test(text.slice(c.start, c.end)))) {
      const pv = ends.filter(x => x <= it.start && x > c.start).pop();
      return deScan(text.slice(pv == null ? c.start : pv, it.start));
    }
    if (test(DE_NEGSUBJ, text.slice(c.start, it.start))) return true;
    let win = own;
    if (!DE_INF_END.test(own.trim()) && limit >= c.end) {
      for (let k = idx + 1; k < cl.length && cl[k].sent === c.sent && cl[k].start < limit; k++) {
        const s = text.slice(cl[k].start, Math.min(cl[k].end, limit));
        if (DE_SUB.test(s) || DE_REL.test(s)) continue;
        win += ' ' + s;
        if (DE_INF_END.test(s.trim())) break;
      }
    }
    return deScan(win);
  }
  function findDe(text) {
    const items = [];
    for (const [pat, pos, neg, unc] of DE_VERBS) {
      const forms = pat + '|' + pat.split('|').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('|');
      const r = re(LW + '(' + forms + ')' + RW); let m;
      while ((m = r.exec(text))) {
        const w = m[1];
        // gross geschrieben nur am Satz- oder Teilsatzanfang («Kann sie die Frist nicht einhalten, …»); sonst Substantiv («das Soll»)
        if (w[0] !== w[0].toLowerCase()) { const before = text.slice(0, m.index); if (before.trim() && !/[.!?:;(«"„]\s*$/.test(before)) continue; }
        addItem(items, { start: m.index, end: m.index + w.length, raw: w, pos, neg, unc: !!unc, soft: /^soll(?:en|st|t)?$/i.test(w) });
      }
    }
    for (const [src, pos, neg, fixed] of DE_PH) {
      const r = re(src, 'i'); let m;
      while ((m = r.exec(text))) addItem(items, { start: m.index, end: m.index + m[0].length, raw: m[0], pos, neg, phrase: true, fixed: fixed || '' });
    }
    // «ist … zu prüfen», «hat … einzureichen», verbletzt «… zu prüfen ist»
    const cl = clauses(text);
    for (const c of cl) {
      const s = text.slice(c.start, c.end);
      const inf = re('(?:' + LW + 'zu\\s+(\\p{Ll}{3,}(?:en|ern|eln))|' + LW + '(\\p{Ll}{2,}zu\\p{Ll}{2,}en))' + RW); let m;
      while ((m = inf.exec(s))) {
        const verb = m[1] || m[2];
        if (DE_ZU_SKIP.test(verb) || (m[2] && !DE_ZU_PREFIX.test(m[2]))) continue;
        const before = s.slice(0, m.index), aft = s.slice(m.index + m[0].length);
        let a = null; const mb = /(?<![\p{L}])(ist|sind|hat|haben|bleibt|bleiben)(?![\p{L}])/u.exec(before);
        if (mb) a = { i: mb.index, n: mb[0].length };
        else { const ma = /^\s*(ist|sind|hat|haben)\s*[.!?…]*\s*$/u.exec(aft); if (ma) a = { i: m.index + m[0].length + ma[0].indexOf(ma[1]), n: ma[1].length }; }
        if (!a) continue;
        const mid = a.i < m.index ? s.slice(a.i + a.n, m.index) : before;
        if (DE_ZU_BLOCK.test(mid) || /^\s*(?:als|wie)\s/u.test(aft)) continue;
        // «ist zu begrüssen und zu unterstützen»: das erste Glied bestimmt die Lesart
        if ((mid.match(/(?<![\p{L}])zu\s+\p{Ll}+/gu) || []).some(z => DE_ZU_SKIP.test(z.replace(/^zu\s+/, '')))) continue;
        const st = c.start + Math.min(a.i, m.index), en = c.start + Math.max(a.i + a.n, m.index + m[0].length);
        if (items.some(x => x.start < en && x.end > st)) continue;
        if (/^(?:hat|haben)$/.test(s.substr(a.i, a.n)) && /(?<![\p{L}])vor(?![\p{L}])/u.test(mid)) continue;
        addItem(items, { start: st, end: en, raw: text.slice(st, en), pos: 'obl', neg: 'pro', zuinf: true });
      }
    }
    items.sort((a, b) => a.start - b.start);
    const starts = items.map(x => x.start), ends = items.map(x => x.end), out = [];
    for (const it of items) {
      const idx = clauseAt(cl, it.start); if (idx < 0) continue;
      const c = cl[idx], cs = text.slice(c.start, c.end), sent = text.slice(c.sent.start, c.sent.end);
      let cls, unc = !!it.unc;
      if (it.fixed === 'neg') cls = it.pos;
      else if (it.zuinf) { const neg = deScan(cs); cls = neg ? 'pro' : 'obl'; if (neg) unc = true; }
      else cls = (it.phrase && deScan(it.raw)) || deNegated(text, cl, idx, it, starts, ends) ? it.neg : it.pos;
      if (cls === 'none') continue;
      { const nx = starts.find(x => x > it.end), tail = text.slice(it.end, Math.min(c.sent.end, nx == null ? Infinity : nx));
        if (/(?<![\p{L}])(?:nur|lediglich|ausschliesslich|einzig)(?![\p{L}])/u.test(tail.split(/[;:]/)[0])) unc = true; }
      if (cls === 'unc') { cls = it.pos; unc = true; }
      // «Nicht jede Person darf …», «darf nicht alle Daten …»: Teilverneinung, Lesart unsicher
      if (DE_NEGQ.test(cs) && cls !== 'nob') unc = true;
      if (/(?<![\p{L}])(?:hätte|hätten|wäre|wären|würde|würden)(?![\p{L}])/u.test(cs)) unc = true;
      if (/(?<![\p{L}])es(?![\p{L}])/iu.test(cs) && (cls === 'per' || cls === 'nper') && /(?<![\p{L}])(?:kommen|vorkommen|geben|sein|passieren|geschehen|auftreten|dauern)(?![\p{L}])/u.test(cs)) unc = true;
      if (hedges(cs, sent, cls, /(?<![\p{L}])(?:nur|lediglich|ausschliesslich|einzig|erst)(?![\p{L}])/u, /(?<![\p{L}])(?:möglicherweise|vielleicht|eventuell|wohl|allenfalls|unter\s+Umständen|voraussichtlich)(?![\p{L}])/u)) unc = true;
      // «können … vorliegen» und ähnliche: Möglichkeit eines Sachverhalts, keine Erlaubnis
      if ((cls === 'per' || cls === 'nper') && /(?<![\p{L}])(?:vorliegen|bestehen|sein|eintreten|entstehen|auftreten|vorkommen|zutreffen|betragen|dauern|ergeben|resultieren|gelten)(?![\p{L}])/u.test(cs)) unc = true;
      // Fristen und Formeln der Rechtsmittel stehen je Sprache verschieden («kann angefochten werden», «ist einzureichen»)
      if (DE_REMEDY.test(cs)) unc = true;
      // «soll» im Nebensatz gibt oft eine Absicht oder Behauptung wieder («dass … missachtet werden soll»)
      if (it.soft && /(?<![\p{L}])werden(?![\p{L}])/u.test(cs)) unc = true;
      if (it.soft && DE_SUB.test(cs.replace(/^\s*(?:[a-z]|\d+)(?:bis|ter|quater)?\.\s+/, ''))) unc = true;
      out.push({ cls, raw: it.raw, start: it.start, end: it.end, unc, soft: cls === 'rec' && !!it.soft });
    }
    return out;
  }

  /* ---------- Französisch ---------- */
  const FR_CLIT = "(?:(?:le|la|les|l['’]|lui|leur|y|en|se|s['’]|me|m['’]|te|t['’]|nous|vous)\\s*){0,3}";
  const FR_NE = re("(?:" + LW + "ne\\s+|" + LW + "n['’]\\s*)" + FR_CLIT + "$", 'i');
  const FR_PAS = /^\s*(?:\p{L}+\s+)?(?:pas|plus|jamais|point|aucunement|nullement|guère|ni)(?![\p{L}])/iu;
  // «ne doit percevoir aucun émolument», «ne peut rien exiger»: Verneinung durch das Objekt
  const FR_NEGOBJ = /^(?:\s*,?\s*[\p{L}’'\-]+){0,4}?\s+(?:aucun|aucune|rien)(?![\p{L}])/iu;
  const FR_PAS2 = /^\s*,?\s*(?:en\s+aucun\s+cas|sous\s+aucun\s+prétexte|en\s+aucune\s+façon)(?![\p{L}])/iu;
  const FR_NOTNEC = /^\s*(?:\p{L}+\s+)?pas\s+(?:nécessairement|forcément|obligatoirement|impérativement|toujours)(?![\p{L}])/iu;
  const FR_NEGSUBJ = /(?<![\p{L}])(?:nul|nulle|personne|aucun|aucune|rien)(?![\p{L}])/iu;
  function frNeg(text, c, st, en) {
    const before = text.slice(Math.max(c.start, st - 40), st).replace(/\s+$/, ' '), after = text.slice(en, Math.min(c.sent.end, en + 60));
    if (!test(FR_NE, before)) return '';
    if (FR_NOTNEC.test(after)) return 'notnec';
    if (FR_PAS.test(after) || FR_PAS2.test(after)) return 'neg';
    if (FR_NEGOBJ.test(after.split(/[;:,.]/)[0])) return 'neg';
    const rest = text.slice(en, Math.min(c.sent.end, en + 160)).split(/[;.]/)[0];
    if (/(?<![\p{L}])qu(?:e|['’])/iu.test(rest)) return 'restr';
    if (FR_NEGSUBJ.test(text.slice(c.start, st))) return 'neg';
    // «ne peut être exécuté»: bei pouvoir darf «pas» in der gehobenen Sprache fehlen
    if (/^(?:peut|peuvent|pourra|pourront|pouvait|pouvaient|puisse|puissent|pourrait|pourraient)$/i.test(text.slice(st, en))) return 'neg';
    return 'unc';
  }
  const FR_V = [
    // [Formen, Klasse, verneint, «ne … pas nécessairement», unsicher, starke Empfehlung]
    // dritte Person, dazu «vous», «nous», «je», «tu» (Merkblätter und Formulare)
    ['doit|doivent|devra|devront|doive|doives|dois|devons|devez|devrai|devras|devrons|devrez|doivent|devions|deviez', 'obl', 'pro', 'nob'],
    ['devait|devaient|dut|durent|devais', 'obl', 'pro', 'nob', true],
    ['devrait|devraient|devrais|devrions|devriez', 'rec', 'rec', 'rec'],
    ['peut|peuvent|pourra|pourront|peux|pouvons|pouvez|pourrai|pourras|pourrons|pourrez', 'per', 'nper', 'nob'],
    ['puisse|puissent|pourrait|pourraient|pouvait|pouvaient|puisses|puissions|puissiez|pourrais|pourrions|pourriez|pouvais|pouvions|pouviez', 'per', 'nper', 'nob', true]
  ];
  const FR_PH = [
    // verneinte und längere Formen zuerst
    [LW + "il\\s+ne\\s+(?:faut|faudra)\\s+pas" + RW, 'pro', '', '', 'neg'],
    [LW + "(?:il\\s+)?n['’]est\\s+pas\\s+(?:nécessaire|indispensable|obligatoire|requis|requise)" + RW, 'nob', '', '', 'neg'],
    [LW + "ne\\s+sont\\s+pas\\s+(?:nécessaires|indispensables|obligatoires|requis|requises)" + RW, 'nob', '', '', 'neg'],
    [LW + "(?:n['’]est|ne\\s+sont|ne\\s+sera|ne\\s+seront)\\s+pas\\s+(?:\\p{L}+\\s+)?(?:tenu|tenue|tenus|tenues|obligé|obligée|obligés|obligées)" + RW, 'nob', '', '', 'neg'],
    [LW + "(?:n['’]a|n['’]ont|n['’]aura|n['’]auront)\\s+pas\\s+(?:à|besoin\\s+de|besoin\\s+d['’])", 'nob', '', '', 'neg'],
    [LW + "(?:n['’]est|ne\\s+sont|ne\\s+sera|ne\\s+seront)\\s+pas\\s+(?:autorisé|autorisée|autorisés|autorisées|permis|permise|permises|admis|admise|admises)" + RW, 'pro', '', '', 'neg'],
    [LW + "il\\s+n['’]est\\s+pas\\s+permis" + RW, 'pro', '', '', 'neg'],
    [LW + 'il\\s+(?:faut|faudra|faudrait)' + RW, 'obl', 'pro', 'nob'],
    [LW + "(?:est|sont|sera|seront|restent|reste)\\s+(?:\\p{L}+\\s+)?(?:tenu|tenue|tenus|tenues)\\s+(?:de|d['’])", 'obl', 'nob', 'nob'],
    [LW + "(?:est|sont|sera|seront)\\s+(?:\\p{L}+\\s+)?(?:obligé|obligée|obligés|obligées)\\s+(?:de|d['’])", 'obl', 'nob', 'nob'],
    [LW + "(?:a|ont|aura|auront)\\s+l['’]obligation\\s+(?:de|d['’])", 'obl', 'nob', 'nob'],
    [LW + "(?:a|ont)\\s+le\\s+devoir\\s+(?:de|d['’])", 'obl', 'nob', 'nob'],
    [LW + 'incombe(?:nt)?\\s+(?:à|aux|au)' + RW, 'obl', 'nob', 'nob'],
    [LW + '(?:impérativement|obligatoirement)' + RW, 'obl', 'nob', 'nob'],
    [LW + '(?:est|sont|sera|seront)\\s+obligatoires?' + RW, 'obl', 'nob', 'nob'],
    [LW + "il\\s+est\\s+(?:nécessaire|indispensable|impératif|obligatoire)\\s+(?:de|d['’]|que|qu['’])", 'obl', 'nob', 'nob'],
    [LW + "(?:il\\s+est|est|sont|sera|seront)\\s+(?:\\p{L}+\\s+)?(?:interdit|interdite|interdits|interdites|prohibé|prohibée|prohibés|prohibées|défendu)" + RW, 'pro', 'unc', 'unc'],
    [LW + "(?:a|ont|aura|auront)\\s+l['’]interdiction\\s+(?:de|d['’])", 'pro', 'unc', 'unc'],
    [LW + "(?:est|sont|sera|seront)\\s+(?:\\p{L}+\\s+)?(?:autorisé|autorisée|autorisés|autorisées|habilité|habilitée|habilités|habilitées)\\s+(?:à|au|aux)" + RW, 'per', 'nper', 'nper'],
    [LW + "(?:a|ont|aura|auront)\\s+(?:le\\s+droit|la\\s+faculté)\\s+(?:de|d['’])", 'per', 'nper', 'nper'],
    [LW + "(?:est|sont)\\s+(?:libres?|en\\s+droit)\\s+(?:de|d['’])", 'per', 'nper', 'nper'],
    [LW + "il\\s+est\\s+permis\\s+(?:de|d['’])", 'per', 'nper', 'nper'],
    [LW + "il\\s+convient\\s+(?:de|d['’]|que|qu['’])", 'rec', 'rec', 'rec'],
    [LW + "(?:il\\s+est|est|sont)\\s+(?:\\p{L}+\\s+)?(?:recommandé|recommandée|recommandés|recommandées|conseillé|souhaitable)" + RW, 'rec', 'rec', 'rec'],
    [LW + "il\\s+serait\\s+(?:souhaitable|opportun|judicieux)" + RW, 'rec', 'rec', 'rec'],
    [LW + "recommande(?:nt)?\\s+(?:de|d['’]|aux|au|à)" + RW, 'rec', 'rec', 'rec']
  ];
  function findFr(text) {
    const items = [];
    for (const [src, pos, neg, nn, fixed] of FR_PH) {
      const r = re(src, 'i'); let m;
      while ((m = r.exec(text))) addItem(items, { start: m.index, end: m.index + m[0].length, raw: m[0], pos, neg, nn, phrase: true, fixed: fixed || '' });
    }
    for (const [pat, pos, neg, nn, unc] of FR_V) {
      // Bindestrich erlaubt: «doit-il», «devez-vous» (Frage); «peut-être» fällt unten weg
      const r = re(LW + '(' + pat + ')(?![\\p{L}\\d])', 'i'); let m;
      while ((m = r.exec(text))) {
        const w = m[1].toLowerCase(), st = m.index, en = m.index + m[1].length;
        // «peut-être» ist kein Modalverb; «il se peut que» ist epistemisch; «doit-il», «devez-vous», «peut-on»: Frage
        if (/^-être(?![\p{L}])/iu.test(text.slice(en))) continue;
        const ask = /^-(?:t-)?(?:il|elle|ils|elles|on|vous|nous|je|tu)(?![\p{L}])/iu.test(text.slice(en));
        if (/^-/.test(text.slice(en)) && !ask) continue;
        const epis = w === 'peut' && /(?<![\p{L}])se\s+$/iu.test(text.slice(Math.max(0, st - 6), st));
        addItem(items, { start: st, end: en, raw: m[1], pos, neg, nn, unc: !!unc || epis || ask });
      }
    }
    items.sort((a, b) => a.start - b.start);
    const cl = clauses(text), out = [];
    for (const it of items) {
      const idx = clauseAt(cl, it.start); if (idx < 0) continue;
      const c = cl[idx], cs = text.slice(c.start, c.end), sent = text.slice(c.sent.start, c.sent.end);
      let cls = it.pos, unc = !!it.unc;
      if (it.fixed !== 'neg') {
        const n = frNeg(text, c, it.start, it.end);
        if (n === 'neg') cls = it.neg; else if (n === 'notnec') cls = it.nn; else if (n === 'restr' || n === 'unc') unc = true;
        // «peut ne pas» = darf darauf verzichten
        if (!n && it.pos === 'per' && /^\s*ne\s+pas(?![\p{L}])/iu.test(text.slice(it.end, it.end + 12))) cls = 'nob';
      }
      if (cls === 'unc') { cls = it.pos; unc = true; }
      if (hedges(cs, sent, cls, /(?<![\p{L}])(?:seul|seule|seuls|seules|uniquement|exclusivement|seulement)(?![\p{L}])/iu, /(?<![\p{L}])(?:éventuellement|probablement|peut-être|le\s+cas\s+échéant|vraisemblablement)(?![\p{L}])/iu)) unc = true;
      if ((cls === 'per' || cls === 'nper') && /^\s*(?:\p{L}+\s+)?(?:se\s+produire|survenir|arriver|exister|résulter|durer|entraîner|conduire|avoir\s+lieu|s['’]agir|varier|atteindre)(?![\p{L}])/iu.test(text.slice(it.end, it.end + 40))) unc = true;
      if (/(?<![\p{L}])(?:recours|opposition|réclamation|attaquée?s?|attaquables?|révision)(?![\p{L}])/iu.test(cs)) unc = true;
      out.push({ cls, raw: it.raw, start: it.start, end: it.end, unc, soft: false });
    }
    return out;
  }

  /* ---------- Italienisch ---------- */
  const IT_CLIT = '(?:(?:lo|la|li|le|gli|ne|si|ci|vi|mi|ti|glielo|gliela|glieli|gliele|gliene|se|ce|ve|me|te)\\s+){0,2}';
  const IT_NON = re(LW + 'non\\s+' + IT_CLIT + '$', 'i');
  const IT_NEGSUBJ = /(?<![\p{L}])(?:nessuno|nessuna|nessun|niente|nulla|nemmeno|neanche|neppure)(?![\p{L}])/iu;
  function itNeg(text, c, st, en) {
    const before = text.slice(Math.max(c.start, st - 30), st).replace(/\s+$/, ' '), after = text.slice(en, Math.min(c.end, en + 50));
    if (test(IT_NON, before)) {
      if (/^\s*(?:\p{L}+\s+)?(?:necessariamente|forzatamente|obbligatoriamente)(?![\p{L}])/iu.test(after)) return 'notnec';
      if (/^\s*(?:\p{L}+\s+){0,2}che(?![\p{L}])/iu.test(after)) return 'restr';
      return 'neg';
    }
    // «nulla osta» (Zustimmung) und «nessun’» vor Vokal
    if (IT_NEGSUBJ.test(text.slice(c.start, st).replace(/(?<![\p{L}])nulla\s+osta(?![\p{L}])/giu, ' ').replace(/(?<![\p{L}])nessun['’]/giu, 'nessun '))) return 'neg';
    return '';
  }
  const IT_V = [
    // dritte Person (auch «Lei»), dazu «voi», «noi», «tu»
    ['deve|devono|dovrà|dovranno|debba|debbano|deva|devano|dev[\'’]|devi|dobbiamo|dovete|dovrai|dovremo|dovrete|dobbiate', 'obl', 'pro', 'nob'],
    ['doveva|dovevano|dovette|dovettero|dovevate', 'obl', 'pro', 'nob', true],
    ['dovrebbe|dovrebbero|dovresti|dovremmo|dovreste', 'rec', 'rec', 'rec'],
    ['può|possono|potrà|potranno|puoi|possiamo|potete|potrai|potremo|potrete', 'per', 'nper', 'nob'],
    ['possa|possano|potrebbe|potrebbero|poteva|potevano|possiate|potresti|potremmo|potreste|potevate', 'per', 'nper', 'nob', true]
  ];
  const PART = '\\p{Ll}+(?:at|ut|it)[oaie]';
  const IT_PH = [
    // verneinte und längere Formen zuerst
    [LW + "non\\s+(?:è|sono|sarà|saranno)\\s+(?:\\p{L}+\\s+)?(?:tenut|obbligat)[oaie]" + RW, 'nob', '', '', 'neg'],
    [LW + "non\\s+(?:è|sono)\\s+necessari[oaie]?" + RW, 'nob', '', '', 'neg'],
    [LW + "non\\s+occorre" + RW, 'nob', '', '', 'neg'],
    [LW + "non\\s+(?:è|sono|sarà|saranno)\\s+(?:consentit|ammess|permess|autorizzat)[oaie]" + RW, 'pro', '', '', 'neg'],
    [LW + "non\\s+(?:va|vanno)\\s+(?:\\p{Ll}+\\s+)?" + PART + RW, 'pro', '', '', 'neg'],
    [LW + "(?:è|sono|sarà|saranno|resta|restano)\\s+(?:\\p{L}+\\s+)?tenut[oaie]\\s+(?:a|ad)" + RW, 'obl', 'nob', 'nob'],
    [LW + "(?:è|sono|sarà|saranno)\\s+(?:\\p{L}+\\s+)?obbligat[oaie]\\s+(?:a|ad)" + RW, 'obl', 'nob', 'nob'],
    [LW + "(?:ha|hanno|avrà|avranno)\\s+(?:l['’]obbligo|il\\s+dovere)\\s+di" + RW, 'obl', 'nob', 'nob'],
    [LW + '(?:obbligatoriamente|tassativamente)' + RW, 'obl', 'nob', 'nob'],
    [LW + '(?:è|sono)\\s+obbligatori[oaie]?' + RW, 'obl', 'nob', 'nob'],
    [LW + '(?:occorre|occorrono|bisogna)' + RW, 'obl', 'nob', 'nob'],
    [LW + "è\\s+necessario\\s+(?:che|\\p{Ll}+(?:are|ere|ire|arsi|ersi|irsi))" + RW, 'obl', 'nob', 'nob'],
    [LW + 'incomb(?:e|ono)\\s+(?:a|al|alla|ai|alle|agli)' + RW, 'obl', 'nob', 'nob'],
    [LW + '(?:va|vanno)\\s+(?:\\p{Ll}+\\s+)?' + PART + RW, 'obl', 'pro', 'nob'],
    [LW + "(?:è|sono)\\s+(?:\\p{L}+\\s+)?(?:vietat|proibit|interdett)[oaie]" + RW, 'pro', 'unc', 'unc'],
    [LW + "(?:è\\s+fatto|vige\\s+il)\\s+divieto\\s+di" + RW, 'pro', 'unc', 'unc'],
    [LW + "(?:è|sono|sarà|saranno)\\s+(?:\\p{L}+\\s+)?(?:autorizzat|legittimat|abilitat)[oaie]\\s+(?:a|ad)" + RW, 'per', 'nper', 'nper'],
    [LW + "(?:ha|hanno|avrà|avranno)\\s+(?:la\\s+)?facoltà\\s+di" + RW, 'per', 'nper', 'nper'],
    [LW + "(?:ha|hanno|avrà|avranno)\\s+il\\s+diritto\\s+di" + RW, 'per', 'nper', 'nper'],
    [LW + "(?:è|sono)\\s+liber[oaie]\\s+di" + RW, 'per', 'nper', 'nper'],
    [LW + "(?:è|sono)\\s+(?:consentit|permess)[oaie]" + RW, 'per', 'pro', 'pro'],
    [LW + "(?:si\\s+raccomanda|si\\s+consiglia|(?:è|sono)\\s+(?:raccomandat|consigliat)[oaie]|(?:è|sarebbe)\\s+(?:opportuno|auspicabile|consigliabile)|conviene)" + RW, 'rec', 'rec', 'rec'],
    [LW + "raccomanda(?:no)?\\s+(?:di|ai|al|alla|alle|agli)" + RW, 'rec', 'rec', 'rec'],
    [LW + "(?:è|sarà)\\s+possibile" + RW, 'per', 'nper', 'nper', 'unc']
  ];
  function findIt(text) {
    const items = [];
    for (const [src, pos, neg, nn, fixed] of IT_PH) {
      const r = re(src, 'i'); let m;
      while ((m = r.exec(text))) {
        const st = m.index, en = m.index + m[0].length;
        if (/(?:^|\s)(?:va|vanno)\s/i.test(m[0]) && /^(?:non\s+)?(?:va|vanno)\s+(?:bene|male|avanti|oltre|via)/i.test(m[0])) continue;
        addItem(items, { start: st, end: en, raw: m[0], pos, neg, nn, phrase: true, fixed: fixed || '' });
      }
    }
    for (const [pat, pos, neg, nn, unc] of IT_V) {
      // «dev’essere»: elidierte Form endet am Apostroph
      const r = re(LW + '(' + pat + ')(?:' + RW + "|(?<=['’]))", 'i'); let m;
      while ((m = r.exec(text))) {
        const st = m.index, en = m.index + m[1].length;
        const epis = /^può$/i.test(m[1]) && /^\s*darsi/i.test(text.slice(en));
        addItem(items, { start: st, end: en, raw: m[1], pos, neg, nn, unc: !!unc || epis });
      }
    }
    items.sort((a, b) => a.start - b.start);
    const cl = clauses(text), out = [];
    for (const it of items) {
      const idx = clauseAt(cl, it.start); if (idx < 0) continue;
      const c = cl[idx], cs = text.slice(c.start, c.end), sent = text.slice(c.sent.start, c.sent.end);
      let cls = it.pos, unc = !!it.unc;
      if (it.fixed === 'unc') unc = true;
      else if (it.fixed !== 'neg') {
        const n = itNeg(text, c, it.start, it.end);
        if (n === 'neg') cls = it.neg; else if (n === 'notnec') cls = it.nn; else if (n === 'restr') unc = true;
        if (!n && it.pos === 'per' && /^\s*non(?![\p{L}])/iu.test(text.slice(it.end, it.end + 6))) cls = 'nob';
      }
      if (cls === 'unc') { cls = it.pos; unc = true; }
      if (/occorre/i.test(it.raw) && /(?<![\p{L}])se\s+occorre(?![\p{L}])/iu.test(cs)) unc = true;
      if (hedges(cs, sent, cls, /(?<![\p{L}])(?:solo|soltanto|unicamente|esclusivamente|solamente)(?![\p{L}])/iu, /(?<![\p{L}])(?:forse|eventualmente|probabilmente|se\s+del\s+caso|presumibilmente)(?![\p{L}])/iu)) unc = true;
      if ((cls === 'per' || cls === 'nper') && /^\s*(?:\p{L}+\s+)?(?:verificarsi|esistere|sussistere|derivare|durare|avvenire|essere\s+(?:un|una|uno|il|la|lo|i|le|gli|grave|necessari))(?![\p{L}])/iu.test(text.slice(it.end, it.end + 40))) unc = true;
      if (/(?<![\p{L}])(?:ricorso|opposizione|reclamo|impugnat[oaie]|impugnabil[ei]|revisione)(?![\p{L}])/iu.test(cs)) unc = true;
      // «non devono essere annunciati» steht in Erlassen auch für «müssen nicht»: als Verbot nur Warnung
      const amb = cls === 'pro' && /^dev/i.test(it.raw) && /^\s*essere\s+\p{Ll}+(?:at|ut|it)[oaie](?![\p{L}])/iu.test(text.slice(it.end, it.end + 40));
      out.push({ cls, raw: it.raw, start: it.start, end: it.end, unc, soft: false, amb });
    }
    return out;
  }

  function find(text, lang) {
    if (!text || text.length < 6) return [];
    if (lang === 'de') return findDe(text);
    if (lang === 'fr') return findFr(text);
    if (lang === 'it') return findIt(text);
    return [];
  }

  /** Gruppe für den Abgleich: Verbot und verneinte Möglichkeit gelten als gleichwertig («darf nicht» = «ne peut pas» = «non può»). */
  const GROUP = { obl: 'obl', pro: 'pro', nper: 'pro', per: 'per', rec: 'rec', nob: 'nob' };
  /** Schweregrad je Paar verschiedener Klassen (alphabetisch sortiert). Paare, die hier fehlen, ergeben keinen Befund. */
  const PAIR_SEV = {
    'obl|per': 'error', 'obl|pro': 'error', 'nob|obl': 'error', 'per|pro': 'error', 'nob|pro': 'error', 'nob|nper': 'error',
    'nper|obl': 'warn', 'obl|rec': 'warn', 'pro|rec': 'warn', 'nper|per': 'warn',
    'nob|per': 'info', 'nob|rec': 'info', 'per|rec': 'info', 'nper|rec': 'info'
  };
  const RANK = { error: 0, warn: 1, info: 2 };
  const pairKey = (a, b) => [a, b].sort().join('|');
  /** Abgleich zweier Ausdruckslisten A (Referenz) und B (Zielfassung): gleiche Gruppen heben sich auf (in Textreihenfolge);
      übrige werden zu Paaren mit dem schwersten Gegensatz zusammengestellt. Unsichere Ausdrücke zählen nicht. */
  function diff(A, B, opt) {
    const ra = A.filter(x => !x.unc), rb = B.filter(x => !x.unc);
    // Satzweise, wenn beide Seiten gleich viele Sätze haben (si = Satznummer); sonst nach Lage im Abschnitt (rel)
    const bySent = !!(opt && opt.sentA && opt.sentA === opt.sentB);
    const dist = (x, y) => (bySent ? (x.si === y.si ? 0 : 10) : 0) + (x.rel != null && y.rel != null ? Math.abs(x.rel - y.rel) : 0);
    // Gleiche Gruppen heben sich auf, jeweils mit dem nächstgelegenen Ausdruck der anderen Seite
    for (const x of ra.slice()) {
      let k = -1, d = Infinity;
      rb.forEach((y, j) => { if (GROUP[y.cls] === GROUP[x.cls] && dist(x, y) < d) { d = dist(x, y); k = j; } });
      if (k >= 0) { rb.splice(k, 1); ra.splice(ra.indexOf(x), 1); }
    }
    const pairs = [];
    // In langen Abschnitten nur Ausdrücke an ähnlicher Stelle paaren (Übersetzungen folgen der Satzfolge)
    const near = (x, y) => bySent ? x.si === y.si : (x.rel == null || y.rel == null || Math.abs(x.rel - y.rel) <= 0.3);
    for (const x of ra.slice()) {
      let best = -1, br = 9;
      rb.forEach((y, k) => { const s = PAIR_SEV[pairKey(x.cls, y.cls)]; if (s && RANK[s] < br && near(x, y)) { br = RANK[s]; best = k; } });
      if (best < 0) continue;
      const y = rb[best], key = pairKey(x.cls, y.cls);
      let sev = PAIR_SEV[key];
      // «soll» gegenüber «muss»/«doit»: in Erlassen oft gleichwertig gebraucht, daher nur Hinweis
      if (key === 'obl|rec' && (x.cls === 'rec' ? x : y).soft) sev = 'info';
      // «soll» gegenüber einem Verbot: entgegengesetzte Richtung, nicht nur andere Stärke
      if (key === 'pro|rec' && (x.cls === 'rec' ? x : y).soft) sev = 'error';
      if ((key === 'nob|pro' || key === 'nob|nper') && (x.amb || y.amb)) sev = 'warn';
      pairs.push({ a: x, b: y, sev, key: key.replace('|', '_') });
      rb.splice(best, 1); ra.splice(ra.indexOf(x), 1);
    }
    return { pairs, onlyA: ra, onlyB: rb, anyA: A.length > 0, anyB: B.length > 0 };
  }

  DP.modal = { find, diff, GROUP, PAIR_SEV, clauses };
})(globalThis.DP = globalThis.DP || {});
