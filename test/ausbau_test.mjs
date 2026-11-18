// Logiktests ohne Browser: Modalverben (X11), Abkürzungen von Erlassen (R04, X12), Synopse dreier Fassungen (join3).
// Jede Prüfung hat Fälle, die melden müssen, und mindestens ebenso viele, die nicht melden dürfen. Aufruf: node test/ausbau_test.mjs
import fs from 'node:fs';
globalThis.DP = {};
for (const f of ['lang', 'erlasse', 'modal', 'rules', 'align']) (0, eval)(fs.readFileSync(new URL('../src/' + f + '.js', import.meta.url), 'utf8'));
let bad = 0, n = 0;
const fail = (m) => { console.log('FEHLER', m); bad++; };
const ALL = DP.rules.CATALOG.map(c => c.id);
const only = (...ids) => ({ off: new Set(ALL.filter(x => !ids.includes(x))), params: {} });
let uid = 0;
function doc(lang, texts, extra) {
  const paras = texts.map((t, i) => (typeof t === 'string' ? { text: t, kind: 'p' } : t)).map((p, i) => Object.assign({ i, level: 0, loc: {} }, p));
  return Object.assign({ id: 'd' + (++uid), lang, format: 'docx', type: 'bericht', name: 'x', paras, meta: { words: 100, classification: null, headerFooter: '' } }, extra);
}
const fmt = (f) => f.crit + ':' + f.sev + ':' + f.key.replace(/^f\.\w+\.?/, '') + (f.params && f.params.why ? '(' + f.params.why.slice(8) + ')' : '');

/* ---------- 1. Modalausdrücke je Sprache ---------- */
const FIND = [
  ['de', 'Die Kanzlei muss das Gesuch weiterleiten.', ['obl']],
  ['de', 'Die Kanzlei muss das Gesuch nicht weiterleiten.', ['nob']],
  ['de', 'Die Kanzlei darf das Gesuch nicht weiterleiten.', ['pro']],
  ['de', 'Die Kanzlei darf, sofern nichts anderes vereinbart ist, die Daten nicht weitergeben.', ['pro']],
  ['de', 'Die Kanzlei muss die Daten, die nicht öffentlich sind, löschen.', ['obl']],
  ['de', 'Es ist sicherzustellen, dass die Daten nicht weitergegeben werden dürfen.', ['obl', 'pro']],
  ['de', 'Kann sie die Frist nicht einhalten, informiert sie die gesuchstellende Person.', ['nper']],
  ['de', 'Niemand darf zur Auskunft gezwungen werden.', ['pro']],
  ['de', 'Das Gesuch ist innert 30 Tagen zu beantworten.', ['obl']],
  ['de', 'Die Gesuchstellerin hat die Unterlagen einzureichen.', ['obl']],
  ['de', 'Die Sektion hat beschlossen, das Projekt abzuschliessen.', []],
  ['de', 'Das Formular ist bei der Kanzlei zu beziehen.', []],
  ['de', 'Der Bund soll die Kantone unterstützen.', ['rec~']],
  ['de', 'Sie sollte das Gesuch weiterleiten.', ['rec']],
  ['de', 'Es kann zu Verzögerungen kommen.', ['per?']],
  ['de', 'Dies dürfte zu Mehrkosten führen.', ['per?']],
  ['de', 'Die Kantone dürfen die Daten nur mit Zustimmung bearbeiten.', ['per?']],
  ['de', 'Die Behörde ist nicht verpflichtet, die Akten aufzubewahren.', ['nob']],
  ['de', 'Die Weitergabe ist nicht zulässig.', ['pro']],
  ['de', 'Die Sektion ist berechtigt, Auskunft zu erteilen.', ['per']],
  ['de', 'Die Kanzlei muss nicht öffentliche Daten löschen.', ['obl']],
  ['de', 'Sie muss das Formular einreichen, nicht aber die Beilagen.', ['obl']],
  ['de', 'Die Kanzlei muss X prüfen und darf Y nicht veröffentlichen.', ['obl', 'pro']],
  ['de', 'Die Muss-Kriterien und die Kann-Bestimmung stehen im Anhang.', []],
  ['de', 'Hätte die Sektion das Gesuch prüfen müssen?', ['obl?']],
  ['de', 'Die Sektion braucht keine Bewilligung einzuholen.', ['nob']],
  ['fr', 'La chancellerie doit transmettre la demande.', ['obl']],
  ['fr', 'La chancellerie ne doit pas transmettre la demande.', ['pro']],
  ['fr', 'La chancellerie ne doit pas nécessairement transmettre la demande.', ['nob']],
  ['fr', 'Si elle ne peut pas respecter ce délai, elle en informe la personne requérante.', ['nper']],
  ['fr', 'Il se peut que la procédure dure plus longtemps.', ['per?']],
  ['fr', 'Le requérant sera peut-être convoqué.', []],
  ['fr', 'Nul ne peut être contraint de fournir des renseignements.', ['nper']],
  ['fr', "L'office ne peut transmettre les données qu'avec l'accord de la personne.", ['per?']],
  ['fr', 'Il est interdit de communiquer les données.', ['pro']],
  ['fr', "L'office n'est pas tenu de répondre.", ['nob']],
  ['fr', "L'office est tenu de répondre dans les 30 jours.", ['obl']],
  ['fr', 'Il convient de traiter les demandes rapidement.', ['rec']],
  ['fr', 'Le service devrait transmettre la demande.', ['rec']],
  ['fr', 'Les cantons peuvent ne pas appliquer cette règle.', ['nob']],
  ["fr", "Ce que l'on doit retenir, c'est la date.", ['obl']],
  ['fr', "Elle n'est pas autorisée à communiquer les données.", ['pro']],
  ['fr', 'Il ne faut pas transmettre la demande.', ['pro']],
  ['fr', "Le requérant n'a pas à payer d'émolument.", ['nob']],
  ['fr', 'La demande ne doit en aucun cas être rejetée.', ['pro']],
  ['fr', 'Les cantons pourraient refuser.', ['per?']],
  ['it', 'La cancelleria deve trasmettere la domanda.', ['obl']],
  ['it', 'La cancelleria non deve trasmettere la domanda.', ['pro']],
  ['it', 'La cancelleria non deve necessariamente trasmettere la domanda.', ['nob']],
  ['it', 'Se non può rispettare il termine, ne informa la persona richiedente.', ['nper']],
  ['it', 'Può darsi che la procedura duri di più.', ['per?']],
  ['it', 'Nessuno può essere costretto a fornire informazioni.', ['nper']],
  ['it', "L'ufficio non può che trasmettere i dati.", ['per?']],
  ['it', 'È vietato comunicare i dati.', ['pro']],
  ['it', "L'ufficio non è tenuto a rispondere.", ['nob']],
  ['it', "L'ufficio è tenuto a rispondere entro 30 giorni.", ['obl']],
  ['it', 'La domanda va presentata entro 30 giorni.', ['obl']],
  ['it', 'La domanda non va divulgata.', ['pro']],
  ['it', 'Il progetto va avanti come previsto.', []],
  ['it', 'Il servizio dovrebbe trasmettere la domanda.', ['rec']],
  ['it', 'Non lo si deve trasmettere.', ['pro']],
  ['it', 'Non occorre presentare il modulo.', ['nob']],
  ['it', "L'ufficio non è autorizzato a comunicare i dati.", ['pro']],
  ['it', 'I Cantoni potrebbero rifiutare.', ['per?']],
  // Fälle aus der Probe mit dem AIG (Fedlex, drei Sprachen)
  ['de', 'Der Vollzug ist nicht möglich, wenn die Person weder ausreisen noch dorthin gebracht werden kann.', ['nper']],
  ['de', 'Wichtige persönliche Gründe können namentlich vorliegen, wenn die Person Opfer häuslicher Gewalt wurde.', ['per?']],
  ['de', 'Eine Beschwerde gegen die Verfügung ist innerhalb von fünf Arbeitstagen einzureichen.', ['obl?']],
  ['de', 'Werden offene Stellen besetzt, so ist keine Meldung der offenen Stellen erforderlich.', ['nob']],
  ['de', 'Ausländerinnen und Ausländer können zur Erbringung einer vorübergehenden, grenzüberschreitenden Dienstleistung nur zugelassen werden, wenn ihre Tätigkeit dem Interesse entspricht.', ['per?']],
  ['de', 'Das Informationssystem enthält Daten zu Personen, deren Wegweisung vollzogen werden soll.', ['rec?~']],
  ['fr', 'Si le renvoi ne peut être exécuté dans ce délai, la procédure orale a lieu.', ['nper']],
  ['fr', 'La décision peut faire l’objet d’un recours dans les cinq jours ouvrables.', ['per?']],
  ['fr', 'Les personnes admises à titre provisoire reçoivent une aide.', []],
  ['fr', "L'autorité prononce une interdiction d'entrée.", []],
  ['fr', 'Un étranger ne peut être admis à fournir des prestations que si cette activité sert les intérêts du pays.', ['per?']],
  ['it', 'L’esecuzione può non essere ragionevolmente esigibile.', ['nob']],
  ['it', 'Lo straniero dev’essere in possesso di un documento di legittimazione.', ['obl']],
  ['it', 'I posti di lavoro vacanti non devono essere annunciati al servizio di collocamento.', ['pro']],
  ['it', 'La trasmissione delle informazioni è necessaria per proteggere la salute pubblica.', []],
  ['it', 'Le persone sono ammesse provvisoriamente in Svizzera.', []],
  // Review: Verneinung und Personen (Sprachkorpus test/sprachkorpus prüft die Paare)
  ['de', 'Die Behörde darf die Daten nicht ohne Zustimmung weitergeben.', ['pro']],
  ['de', 'Die Behörde darf nicht alle Daten weitergeben.', ['pro?']],
  ['de', 'Nicht jede Person darf das Gebäude betreten.', ['per?']],
  ['de', 'Auf keinen Fall dürfen Daten weitergegeben werden.', ['pro']],
  ['de', 'In keinem Fall darf die Behörde die Daten weitergeben.', ['pro']],
  ['de', 'Keinesfalls darf die Behörde die Daten weitergeben.', ['pro']],
  ['de', 'Die Behörde muss nicht jedes Gesuch prüfen.', ['nob']],
  ['de', 'Dies ist zu begrüssen und zu unterstützen.', []],
  ['fr', 'Vous devez signer le formulaire.', ['obl']],
  ['fr', 'Nous pouvons informer le canton.', ['per']],
  ['fr', 'Vous ne pouvez pas travailler.', ['nper']],
  ['fr', 'Devez-vous joindre une copie ?', ['obl?']],
  ['fr', 'La demande doit-elle être motivée ?', ['obl?']],
  ['fr', 'L’autorité ne doit percevoir aucun émolument.', ['pro']],
  ['it', 'Nessun dato deve essere trasmesso.', ['pro']],
  ['it', 'Il nulla osta può essere revocato.', ['per']],
  ['it', 'Nemmeno i Cantoni possono riscuotere emolumenti.', ['nper']],
  ['it', 'Dovete allegare una copia.', ['obl']],
  ['it', 'Potete consultare gli atti.', ['per']]
];
for (const [lang, s, exp] of FIND) {
  n++;
  const got = DP.modal.find(s, lang).map(x => x.cls + (x.unc ? '?' : '') + (x.soft ? '~' : ''));
  if (JSON.stringify(got) !== JSON.stringify(exp)) fail('find ' + lang + ' «' + s + '»: ' + JSON.stringify(got) + ' statt ' + JSON.stringify(exp));
}

/* ---------- 2. X11 im Abschnittsvergleich ---------- */
function cmpOne(la, ta, lb, tb, settings) {
  const a = doc(la, ['Titel', ta]), b = doc(lb, ['Titel', tb]);
  a.paras[0].kind = b.paras[0].kind = 'title';
  return DP.align.compare(a, b, settings).findings;
}
const X11 = [
  // [Referenzsprache, Referenz, Zielsprache, Ziel, erwartete Befunde]
  // DE–FR
  ['de', 'Die Kanzlei muss das Gesuch innert 30 Tagen beantworten.', 'fr', 'La chancellerie peut répondre à la demande dans un délai de 30 jours.', ['X11:error:(obl_per)']],
  ['de', 'Die Kanzlei muss die Unterlagen nicht einreichen.', 'fr', 'La chancellerie ne doit pas transmettre les documents.', ['X11:error:(nob_pro)']],
  ['de', 'Die Sektion darf die Daten nicht weitergeben.', 'fr', 'La section peut communiquer les données.', ['X11:error:(per_pro)']],
  ['de', 'Die Sektion muss den Entscheid begründen.', 'fr', 'La section devrait motiver la décision.', ['X11:warn:(obl_rec)']],
  ['de', 'Die Sektion darf die Daten nicht weitergeben.', 'fr', 'La section ne devrait pas communiquer les données.', ['X11:warn:(pro_rec)']],
  ['de', 'Die Kanzlei kann eine Gebühr erheben.', 'fr', 'La chancellerie doit percevoir un émolument.', ['X11:error:(obl_per)']],
  ['de', 'Sie sollte das Gesuch innert 2 Arbeitstagen an die zuständige Sektion weiterleiten.', 'fr', 'Elle transmet la demande à la section compétente dans un délai de 2 jours ouvrables.', ['X11:info:absent']],
  ['de', 'Der Bund soll die Kantone bei der Umsetzung unterstützen.', 'fr', 'La Confédération doit soutenir les cantons dans la mise en œuvre.', ['X11:info:(obl_rec)']],
  ['de', 'Die Kanzlei muss das Gesuch weiterleiten.', 'fr', 'La chancellerie doit transmettre la demande.', []],
  ['de', 'Die Sektion darf die Daten nicht weitergeben.', 'fr', 'La section ne peut pas communiquer les données.', []],
  ['de', 'Die Kanzlei muss die Unterlagen nicht einreichen.', 'fr', "La chancellerie n'est pas tenue de transmettre les documents.", []],
  ['de', 'Kann sie die Frist nicht einhalten, informiert sie die gesuchstellende Person.', 'fr', 'Si elle ne peut pas respecter ce délai, elle en informe la personne requérante.', []],
  ['de', 'Es kann bei der Bearbeitung zu Verzögerungen kommen.', 'fr', 'Des retards peuvent survenir lors du traitement.', []],
  ['de', 'Die Kantone dürfen die Daten nur mit Zustimmung bearbeiten.', 'fr', "Les cantons ne peuvent traiter les données qu'avec le consentement.", []],
  ['de', 'Das Gesuch ist innert 30 Tagen zu beantworten.', 'fr', 'La demande doit recevoir une réponse dans les 30 jours.', []],
  ['de', 'Die Kanzlei muss X prüfen und Y melden.', 'fr', 'La chancellerie doit vérifier X et doit annoncer Y.', []],
  ['de', 'Die Weisung gilt für alle Mitarbeitenden.', 'fr', 'La directive s’applique à tous les collaborateurs.', []],
  ['de', 'Das SMF kann eine Gebühr von höchstens 300 Franken erheben.', 'fr', 'Le SEQT perçoit un émolument de 300 francs au maximum.', []],
  // DE–IT
  ['de', 'Die Kanzlei muss das Gesuch innert 30 Tagen beantworten.', 'it', 'La cancelleria può rispondere alla domanda entro 30 giorni.', ['X11:error:(obl_per)']],
  ['de', 'Die Kanzlei muss die Unterlagen nicht einreichen.', 'it', 'La cancelleria non deve trasmettere i documenti.', ['X11:error:(nob_pro)']],
  ['de', 'Die Sektion darf die Daten nicht weitergeben.', 'it', 'La sezione può comunicare i dati.', ['X11:error:(per_pro)']],
  ['de', 'Die Sektion muss den Entscheid begründen.', 'it', 'La sezione dovrebbe motivare la decisione.', ['X11:warn:(obl_rec)']],
  ['de', 'Die Kanzlei kann eine Gebühr erheben.', 'it', 'La cancelleria deve riscuotere un emolumento.', ['X11:error:(obl_per)']],
  ['de', 'Die Sektion ist berechtigt, Auskunft zu erteilen.', 'it', 'La sezione è tenuta a fornire informazioni.', ['X11:error:(obl_per)']],
  ['de', 'Sie sollte das Gesuch innert 2 Arbeitstagen an die zuständige Sektion weiterleiten.', 'it', 'Trasmette la domanda alla sezione competente entro 2 giorni lavorativi.', ['X11:info:absent']],
  ['de', 'Die Kanzlei muss das Gesuch weiterleiten.', 'it', 'La cancelleria deve trasmettere la domanda.', []],
  ['de', 'Die Sektion darf die Daten nicht weitergeben.', 'it', 'La sezione non può comunicare i dati.', []],
  ['de', 'Die Kanzlei muss die Unterlagen nicht einreichen.', 'it', 'La cancelleria non è tenuta a trasmettere i documenti.', []],
  ['de', 'Kann sie die Frist nicht einhalten, informiert sie die gesuchstellende Person.', 'it', 'Se non può rispettare il termine, ne informa la persona richiedente.', []],
  ['de', 'Das Gesuch ist innert 30 Tagen zu prüfen.', 'it', 'La domanda va esaminata entro 30 giorni.', []],
  ['de', 'Es kann bei der Bearbeitung zu Verzögerungen kommen.', 'it', 'Possono verificarsi ritardi durante il trattamento.', []],
  ['de', 'Die Sektion darf die Daten nur mit Zustimmung bearbeiten.', 'it', 'La sezione può trattare i dati solo con il consenso.', []],
  ['de', 'Die Weisung gilt für alle Mitarbeitenden.', 'it', 'La direttiva si applica a tutti i collaboratori.', []],
  // FR–IT
  ['fr', 'La chancellerie doit répondre dans un délai de 30 jours.', 'it', 'La cancelleria può rispondere entro 30 giorni.', ['X11:error:(obl_per)']],
  ['fr', 'La section ne doit pas communiquer les données.', 'it', 'La sezione può comunicare i dati.', ['X11:error:(per_pro)']],
  ['fr', "L'office n'est pas tenu de répondre.", 'it', "L'ufficio non deve rispondere.", ['X11:error:(nob_pro)']],
  ['fr', 'La section doit motiver la décision.', 'it', 'La sezione dovrebbe motivare la decisione.', ['X11:warn:(obl_rec)']],
  ['fr', 'Il est interdit de communiquer les données.', 'it', 'È consentito comunicare i dati.', ['X11:error:(per_pro)']],
  ["fr", "L'office est tenu de répondre dans les 30 jours.", 'it', "L'ufficio può rispondere entro 30 giorni.", ['X11:error:(obl_per)']],
  ['fr', 'Les cantons peuvent percevoir un émolument.', 'it', 'I Cantoni devono riscuotere un emolumento.', ['X11:error:(obl_per)']],
  ['fr', 'La chancellerie doit transmettre la demande.', 'it', 'La cancelleria deve trasmettere la domanda.', []],
  ['fr', 'Si elle ne peut pas respecter ce délai, elle en informe la personne.', 'it', 'Se non può rispettare il termine, ne informa la persona.', []],
  ["fr", "L'office n'est pas tenu de répondre.", 'it', "L'ufficio non è tenuto a rispondere.", []],
  ['fr', 'Il convient de traiter les demandes rapidement.', 'it', 'Si raccomanda di trattare le domande rapidamente.', []],
  ['fr', 'Il est interdit de communiquer les données.', 'it', 'È vietato comunicare i dati.', []],
  ['fr', 'Il se peut que la procédure dure plus longtemps.', 'it', 'Può darsi che la procedura duri di più.', []],
  ['fr', 'Il faut présenter le formulaire.', 'it', 'Occorre presentare il modulo.', []],
  ['fr', 'Les cantons peuvent ne pas appliquer cette règle.', 'it', 'I Cantoni non devono necessariamente applicare questa regola.', []],
  ['fr', 'La directive s’applique à tous les collaborateurs.', 'it', 'La direttiva si applica a tutti i collaboratori.', []],
  // Probe mit dem AIG: Rechtsmittelformeln gleichwertig; «non devono essere annunciati» als mehrdeutiges Verbot nur Warnung
  ['de', 'Eine Beschwerde gegen die Verfügung ist innerhalb von fünf Arbeitstagen einzureichen.', 'fr', 'La décision peut faire l’objet d’un recours dans les cinq jours ouvrables.', []],
  ['fr', 'Si les postes vacants sont pourvus par des personnes inscrites, il n’est pas nécessaire de communiquer les postes vacants.', 'it', 'I posti vacanti occupati da persone registrate non devono essere annunciati al servizio pubblico di collocamento.', ['X11:warn:(nob_pro)']],
  ['de', 'Der Vollzug ist nicht möglich, wenn die Person weder ausreisen noch dorthin gebracht werden kann.', 'fr', 'L’exécution n’est pas possible lorsque l’étranger ne peut pas quitter la Suisse ni être renvoyé.', []],
  ['de', 'Bei der Erteilung von Bewilligungen können zusätzlich die Qualifikation und das Alter eine Integration erwarten lassen.', 'fr', 'En cas d’octroi d’une autorisation, la qualification et l’âge doivent en outre laisser supposer une intégration.', ['X11:error:(obl_per)']]
];
let pos = 0, neg = 0;
for (const [la, ta, lb, tb, exp] of X11) {
  n++; if (exp.length) pos++; else neg++;
  const got = cmpOne(la, ta, lb, tb, only('X11')).map(fmt).map(s => s.replace(/:X11/, ''));
  if (JSON.stringify(got) !== JSON.stringify(exp)) fail('X11 ' + la + '→' + lb + ' «' + ta + '» / «' + tb + '»: ' + JSON.stringify(got) + ' statt ' + JSON.stringify(exp));
}
console.log('X11:', pos, 'Fälle mit Befund,', neg, 'ohne');
// Befund nennt beide Ausdrücke und markiert sie in beiden Spalten
{
  const f = cmpOne('de', 'Die Kanzlei muss das Gesuch innert 30 Tagen beantworten.', 'fr', 'La chancellerie peut répondre à la demande dans un délai de 30 jours.', only('X11'))[0];
  n++; if (!(f && f.params.ref === 'muss' && f.params.tgt === 'peut' && f.quote === 'peut' && f.refMark && f.refMark.para === 1 && f.refMark.end - f.refMark.start === 4 && f.params.rc === 'mod.obl' && f.params.tc === 'mod.per')) fail('X11 Befundinhalt: ' + JSON.stringify(f));
}

/* ---------- 3. R04 im einzelnen Dokument ---------- */
function rule(lang, text, settings) {
  const d = doc(lang, [text]);
  return DP.rules.runRules(d, Object.assign(only('R04'), settings || {})).findings.map(f => f.key.replace('f.R04.', '') + ':' + f.sev + (f.fix ? '→' + f.fix.repl : ''));
}
const custom = DP.erlasse.parseCustom('SR 999.1; ABC; DEF; GHI\n# Kommentar\n999.2; ; XYZ;\nfalsch\n12a; A; B; C\n998; ; ;');
n++; if (custom.valid !== 2 || custom.invalid.length !== 3 || custom.invalid.map(x => x.why).join() !== 'fields,sr,abbr') fail('parseCustom: ' + JSON.stringify(custom));
const R04 = [
  ['de', 'Die Weisung stützt sich auf Art. 6 des Öffentlichkeitsgesetzes (BGÖ, SR 235.1).', ['pair:error→152.3']],
  ['de', 'Die Weisung stützt sich auf Art. 6 (DSG, SR 152.3).', ['pair:error']],
  ['de', 'Massgebend ist Art. 5 des Datenschutzgesetzes (BGÖ, SR 235.1).', ['pair:error→DSG']],
  ['de', 'Massgebend ist Art. 5 LEI.', ['lang:warn→AIG']],
  ['fr', "Selon l'art. 34 AIG, l'autorisation est octroyée.", ['lang:warn→LEI']],
  ['it', "Secondo l'art. 5 LEI la domanda è respinta.", ['lang:warn→LStrI']],
  ['fr', 'La directive se fonde sur la loi (LStrI; RS 142.20).', ['lang:warn→LEI']],
  ['de', 'Die Bewilligung richtet sich nach (AIG, SR 142.31).', ['pair:error']],
  ['de', 'Die Zulassung richtet sich nach der OASA.', ['lang:warn→VZAE']],
  ['de', 'Gilt auch für den Erlass (DEF, SR 999.1).', ['lang:warn→ABC'], { acts: custom.acts }],
  ['de', 'Daten aus ZEMIS werden nach Art. 3 LDEA bearbeitet.', ['lang:warn→BGIAA']],
  ['it', 'Lei deve presentare la domanda entro dieci giorni.', []],
  ['it', 'CHE COSA DEVE FARE LEI QUANDO RICEVE LA DECISIONE', []],
  ['de', 'Die Kopie geht CC an die Sektion Recht.', []],
  ['fr', "Conformément à l'art. 41 CO, il répond du dommage.", []],
  ['de', 'Nach Art. 41 OR haftet, wer einem andern widerrechtlich Schaden zufügt.', []],
  ['de', 'Die Weisung stützt sich auf das Datenschutzgesetz (DSG, SR 235.1).', []],
  ['de', 'Massgebend ist das AIG (franz. LEI, ital. LStrI).', []],
  ['de', 'Die Abkürzungen lauten AIG, LEI und LStrI.', []],
  ['it', "La domanda è retta dalla LAsi.", []],
  ['fr', 'Écrire à la Case postale, CP 1234, 3003 Berne.', []],
  ['fr', 'Le sigle italien est « LStrI ».', []],
  ['de', 'Die Kantone ändern die BV ihrer Gemeinden nicht.', []],
  ['fr', 'Le PA est un document interne.', []],
  ['de', 'Das Formular trägt den Vermerk LP.', []]
];
pos = 0; neg = 0;
for (const [lang, text, exp, st] of R04) {
  n++; if (exp.length) pos++; else neg++;
  const got = rule(lang, text, st);
  if (JSON.stringify(got) !== JSON.stringify(exp)) fail('R04 ' + lang + ' «' + text + '»: ' + JSON.stringify(got) + ' statt ' + JSON.stringify(exp));
}
// Titel und Überschriften sind kein Fliesstext: falsche Sprache dort nicht melden, falsche Paarung schon
{
  n++; const d = doc('de', [{ text: 'Erläuterungen zur LEI', kind: 'h' }, { text: 'Anhang (DSG, SR 152.3)', kind: 'h' }]);
  const got = DP.rules.runRules(d, only('R04')).findings.map(f => f.key);
  if (JSON.stringify(got) !== JSON.stringify(['f.R04.pair'])) fail('R04 Überschrift: ' + JSON.stringify(got));
}
console.log('R04:', pos, 'Fälle mit Befund,', neg, 'ohne');

/* ---------- 4. X12 im Abschnittsvergleich ---------- */
const X12 = [
  ['de', 'Die Bewilligung richtet sich nach Art. 5 AIG.', 'fr', "L'autorisation est régie par l'art. 5 LAsi.", ['X12:error:'], null],
  ['de', 'Die Bewilligung richtet sich nach Art. 5 AIG.', 'fr', "L'autorisation est régie par l'art. 5 LStrI.", [], null],
  ['de', 'Die Bewilligung richtet sich nach Art. 5 AIG.', 'fr', "L'autorisation est régie par l'art. 5 LStrI.", ['X12:warn:lang'], ['X12']],
  ['de', 'Die Behörde prüft das Gesuch nach dem AIG innert zehn Tagen.', 'fr', "L'autorité examine la demande dans un délai de dix jours.", ['X12:info:missing'], null],
  ['de', 'Die Behörde prüft das Gesuch innert zehn Tagen.', 'fr', "L'autorité examine la demande selon la LEI dans un délai de dix jours.", ['X12:info:added'], null],
  ['de', 'Die Haftung richtet sich nach Art. 41 OR.', 'fr', "La responsabilité est régie par l'art. 41 CC.", ['X12:error:'], null],
  ['it', "L'autorizzazione è retta dall'art. 5 LStrI.", 'de', 'Die Bewilligung richtet sich nach Art. 5 AsylG.', ['X12:error:'], null],
  ['fr', "L'autorisation est régie par l'art. 5 LEI.", 'it', "L'autorizzazione è retta dall'art. 5 LAsi.", ['X12:error:'], null],
  ['de', 'Die Weisung stützt sich auf Art. 25 des Datenschutzgesetzes (DSG, SR 235.1).', 'fr', "La directive se fonde sur l'art. 25 de la loi sur la protection des données (LPD, RS 235.1).", [], null],
  ['de', 'Die Haftung richtet sich nach Art. 41 OR.', 'fr', "La responsabilité est régie par l'art. 41 CO.", [], null],
  ['de', 'Die Kopie geht an die Sektion Recht.', 'fr', 'La copie va à la section du droit (CC).', [], null],
  ['de', 'Die Behörde prüft das Gesuch nach dem AIG innert zehn Tagen.', 'fr', "L'autorité examine la demande selon la loi sur les étrangers et l'intégration.", [], null],
  ['de', 'Massgebend ist SR 142.20.', 'fr', 'Le RS 142.31 est déterminant.', [], null],
  ['de', 'Die Bewilligung richtet sich nach Art. 5 AIG.', 'it', "L'autorizzazione è retta dall'art. 5 LStrI.", [], null],
  ['fr', 'La demande est régie par la LAsi.', 'it', 'La domanda è retta dalla LAsi.', [], null],
  ['de', 'Die Behörde prüft das Gesuch innert zehn Tagen.', 'fr', "L'autorité examine la demande dans un délai de dix jours.", [], null]
];
pos = 0; neg = 0;
for (const [la, ta, lb, tb, exp, ids] of X12) {
  n++; if (exp.length) pos++; else neg++;
  const got = cmpOne(la, ta, lb, tb, ids ? only(...ids) : only('X12', 'R04', 'X04')).filter(f => f.crit === 'X12').map(fmt);
  if (JSON.stringify(got) !== JSON.stringify(exp)) fail('X12 ' + la + '→' + lb + ' «' + ta + '» / «' + tb + '»: ' + JSON.stringify(got) + ' statt ' + JSON.stringify(exp));
}
console.log('X12:', pos, 'Fälle mit Befund,', neg, 'ohne');
// X06 überlässt Erlasse R04 und X12
{
  n++; const fs = cmpOne('de', 'Die Bewilligung richtet sich nach dem AIG.', 'fr', "L'autorisation est régie par l'AIG.", only('X06', 'X12', 'R04'));
  if (fs.some(f => f.crit === 'X06')) fail('X06 meldet Erlass trotz X12/R04');
  const fs2 = cmpOne('de', 'Die Anfrage geht an das EJPD.', 'fr', "La demande est adressée à l'EJPD.", only('X06', 'X12', 'R04'));
  if (!fs2.some(f => f.crit === 'X06')) fail('X06 meldet Departement nicht mehr');
}

/* ---------- 5. Synopse dreier Fassungen ---------- */
const R = (rows) => ({ rows: rows.map(([a, b], row) => ({ row, a, b })) });
const show = (rows) => rows.map(r => (r.extra ? 'x' + r.extra + ':' : '') + r.a.join('+') + '|' + r.b1.join('+') + '|' + r.b2.join('+')).join(' ; ');
const J = [
  ['fehlt in Fassung 1', R([[[0], [0]], [[1], [1]], [[2], []], [[3], [2]]]), R([[[0], [0]], [[1], [1]], [[2], [2]], [[3], [3]]]), '0|0|0 ; 1|1|1 ; 2||2 ; 3|2|3'],
  ['zusammengefasst in Fassung 1', R([[[0, 1], [0]], [[2], [1]]]), R([[[0], [0]], [[1], [1]], [[2], [2]]]), '0+1|0|0+1 ; 2|1|2'],
  ['zusätzlich in Fassung 2', R([[[0], [0]], [[1], [1]]]), R([[[0], [0]], [[], [1]], [[1], [2]]]), '0|0|0 ; x2:||1 ; 1|1|2'],
  ['aufgeteilt in Fassung 1', R([[[0], [0, 1]], [[1], [2]]]), R([[[0], [0]], [[1], [1]]]), '0|0+1|0 ; 1|2|1'],
  ['verschieden zusammengefasst', R([[[0, 1], [0]], [[2], [1]]]), R([[[0], [0]], [[1, 2], [1]]]), '0+1+2|0+1|0+1'],
  ['zusätzlich am Anfang beider', R([[[], [0]], [[0], [1]]]), R([[[], [0]], [[0], [1]]]), 'x1:|0| ; x2:||0 ; 0|1|1']
];
for (const [name, c1, c2, exp] of J) { n++; const got = show(DP.align.join3(c1, c2)); if (got !== exp) fail('join3 ' + name + ': ' + got + ' statt ' + exp); }
// echte Vergleiche: Zeilen decken jede Referenz und jede Zielzeile genau einmal ab
{
  const A = doc('de', ['Erster Absatz mit 12 Wörtern und einer Zahl.', 'Zweiter Absatz.', 'Dritter Absatz mit Inhalt 2027.']);
  const B = doc('fr', ['Premier paragraphe avec 12 mots et un nombre.', 'Troisième paragraphe avec contenu 2027.']);
  const C = doc('it', ['Primo capoverso con 12 parole e un numero.', 'Secondo capoverso.', 'Capoverso aggiunto.', 'Terzo capoverso con contenuto 2027.']);
  const c1 = DP.align.compare(A, B, only()), c2 = DP.align.compare(A, C, only());
  const rows = DP.align.join3(c1, c2); n++;
  const flat = (k) => rows.flatMap(r => r[k]).sort((x, y) => x - y).join();
  if (flat('a') !== '0,1,2' || flat('b1') !== '0,1' || flat('b2') !== '0,1,2,3') fail('join3 Abdeckung: ' + show(rows));
}

console.log(n, 'Fälle;', bad, 'Fehler');
process.exit(bad ? 1 : 0);
