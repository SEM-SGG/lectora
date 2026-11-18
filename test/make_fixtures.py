"""Erzeugt Testdokumente: saubere und fehlerhafte Fassungen in DE, FR, IT sowie PDF und PPTX."""
import copy, io, os, subprocess, sys
from docx import Document
from docx.enum.text import WD_COLOR_INDEX
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Pt, Cm
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), 'fixtures')
os.makedirs(OUT, exist_ok=True)
NB = ' '

# (Art, Text) — T Titel, H1/H2 Überschrift, P Absatz, L Listenpunkt. **fett** markiert einen eigenen Lauf.
DE = [
    ('T', 'Weisung über die Bearbeitung von Auskunftsgesuchen'),
    ('P', 'Staatssekretariat für Musterfragen SMF, Sektion Grundlagen'),
    ('P', 'Version 1.0 vom 12. November 2026'),
    ('H1', '1 Zweck'),
    ('P', 'Diese Weisung regelt, wie das Staatssekretariat für Musterfragen (SMF) Auskunftsgesuche von Privatpersonen und Behörden bearbeitet. Sie stellt sicher, dass alle Gesuche einheitlich, fristgerecht und nachvollziehbar beantwortet werden.'),
    ('H1', '2 Geltungsbereich'),
    ('P', 'Die Weisung gilt für alle Mitarbeitenden des SMF, die Auskunftsgesuche entgegennehmen oder beantworten. Sie gilt nicht für Medienanfragen. Diese bearbeitet der Informationsdienst des Eidgenössischen Justiz- und Polizeidepartements (EJPD).'),
    ('H1', '3 Rechtsgrundlagen'),
    ('P', 'Die Weisung stützt sich auf Art. 25 Abs. 2 Bst. a des Datenschutzgesetzes (DSG, SR 235.1) und auf Art. 6 des Öffentlichkeitsgesetzes (BGÖ, SR 152.3).'),
    ('H1', '4 Zuständigkeiten'),
    ('H2', '4.1 Eingang und Triage'),
    ('P', 'Die Kanzlei erfasst jedes Gesuch am Tag des Eingangs im Geschäftsverwaltungssystem. Sie leitet das Gesuch innert 2 Arbeitstagen an die zuständige Sektion weiter.'),
    ('H2', '4.2 Bearbeitung'),
    ('P', 'Die zuständige Sektion beantwortet das Gesuch **innert 30 Tagen**. Kann sie die Frist nicht einhalten, informiert sie die gesuchstellende Person vor Ablauf der Frist und nennt den neuen Termin.'),
    ('L', 'Die Sektion prüft die Identität der gesuchstellenden Person.'),
    ('L', 'Sie klärt, ob überwiegende Interessen Dritter einer Auskunft entgegenstehen.'),
    ('L', 'Sie dokumentiert den Entscheid im Geschäftsverwaltungssystem.'),
    ('H2', '4.3 Kosten'),
    ('P', 'Die Auskunft ist kostenlos. Verursacht ein Gesuch einen Aufwand von mehr als 8 Stunden, kann das SMF eine Gebühr von höchstens 300 Franken erheben. Im Jahr 2025 gingen 1250 Gesuche ein. Davon wurden 96 Prozent fristgerecht beantwortet.'),
    ('H1', '5 Auskunft und Kontakt'),
    ('P', 'Fragen zu dieser Weisung beantwortet die Sektion Grundlagen unter grundlagen@example.com. Weitere Informationen stehen unter https://www.example.com/de/auskunft zur Verfügung. Die Sprechstunde findet jeweils am Dienstag um 14.30 Uhr statt.'),
    ('H1', '6 Inkrafttreten'),
    ('P', 'Diese Weisung tritt am 1. Januar 2027 in Kraft. Sie ersetzt die Weisung vom 3. März 2019.'),
    ('P', 'Bern, 12. November 2026'),
    ('P', 'Staatssekretariat für Musterfragen SMF'),
    ('P', 'Dana Muster, Leiterin Sektion Grundlagen'),
]

FR = [
    ('T', 'Directive sur le traitement des demandes de renseignements'),
    ('P', 'Secrétariat d’État aux questions types SEQT, section Bases'),
    ('P', 'Version 1.0 du 12 novembre 2026'),
    ('H1', '1 But'),
    ('P', 'La présente directive règle la manière dont le Secrétariat d’État aux questions types (SEQT) traite les demandes de renseignements émanant de particuliers et d’autorités. Elle garantit que toutes les demandes reçoivent une réponse uniforme, donnée dans les délais et vérifiable.'),
    ('H1', '2 Champ d’application'),
    ('P', 'La directive s’applique à tous les collaborateurs et collaboratrices du SEQT qui reçoivent des demandes de renseignements ou y répondent. Elle ne s’applique pas aux demandes des médias. Celles-ci sont traitées par le service d’information du Département fédéral de justice et police (DFJP).'),
    ('H1', '3 Bases légales'),
    ('P', 'La directive se fonde sur l’art. 25, al. 2, let. a, de la loi sur la protection des données (LPD, RS 235.1) et sur l’art. 6 de la loi sur la transparence (LTrans, RS 152.3).'),
    ('H1', '4 Compétences'),
    ('H2', '4.1 Réception et tri'),
    ('P', 'La chancellerie enregistre chaque demande le jour de sa réception dans le système de gestion des affaires. Elle transmet la demande à la section compétente dans un délai de 2 jours ouvrables.'),
    ('H2', '4.2 Traitement'),
    ('P', 'La section compétente répond à la demande **dans un délai de 30 jours**. Si elle ne peut pas respecter ce délai, elle en informe la personne requérante avant son échéance et lui indique la nouvelle date.'),
    ('L', 'La section vérifie l’identité de la personne requérante.'),
    ('L', 'Elle détermine si des intérêts prépondérants de tiers s’opposent à la communication des renseignements.'),
    ('L', 'Elle documente la décision dans le système de gestion des affaires.'),
    ('H2', '4.3 Frais'),
    ('P', 'Les renseignements sont gratuits. Si une demande occasionne un travail de plus de 8 heures, le SEQT peut percevoir un émolument de 300 francs au maximum. En 2025, 1250 demandes ont été déposées. Parmi elles, 96' + NB + '% ont reçu une réponse dans les délais.'),
    ('H1', '5 Renseignements et contact'),
    ('P', 'La section Bases répond aux questions relatives à la présente directive à l’adresse grundlagen@example.com. De plus amples informations sont disponibles à l’adresse https://www.example.com/fr/renseignements. La permanence a lieu le mardi à 14 h 30.'),
    ('H1', '6 Entrée en vigueur'),
    ('P', 'La présente directive entre en vigueur le 1er janvier 2027. Elle remplace la directive du 3 mars 2019.'),
    ('P', 'Berne, le 12 novembre 2026'),
    ('P', 'Secrétariat d’État aux questions types SEQT'),
    ('P', 'Dana Muster, cheffe de la section Bases'),
]

IT = [
    ('T', 'Direttiva sul trattamento delle domande di informazioni'),
    ('P', 'Segreteria di Stato per le questioni tipo SEQT, Sezione Basi'),
    ('P', 'Versione 1.0 del 12 novembre 2026'),
    ('H1', '1 Scopo'),
    ('P', 'La presente direttiva disciplina il modo in cui la Segreteria di Stato per le questioni tipo (SEQT) tratta le domande di informazioni presentate da privati e autorità. Garantisce che tutte le domande ricevano una risposta uniforme, tempestiva e verificabile.'),
    ('H1', '2 Campo d’applicazione'),
    ('P', 'La direttiva si applica a tutti i collaboratori e le collaboratrici della SEQT che ricevono domande di informazioni o vi rispondono. Non si applica alle domande dei media. Queste sono trattate dal servizio d’informazione del Dipartimento federale di giustizia e polizia (DFGP).'),
    ('H1', '3 Basi legali'),
    ('P', 'La direttiva si fonda sull’art. 25 cpv. 2 lett. a della legge sulla protezione dei dati (LPD, RS 235.1) e sull’art. 6 della legge sulla trasparenza (LTras, RS 152.3).'),
    ('H1', '4 Competenze'),
    ('H2', '4.1 Ricezione e smistamento'),
    ('P', 'La cancelleria registra ogni domanda il giorno della ricezione nel sistema di gestione degli affari. Trasmette la domanda alla sezione competente entro 2 giorni lavorativi.'),
    ('H2', '4.2 Trattamento'),
    ('P', 'La sezione competente risponde alla domanda **entro 30 giorni**. Se non può rispettare il termine, ne informa la persona richiedente prima della scadenza e le comunica la nuova data.'),
    ('L', 'La sezione verifica l’identità della persona richiedente.'),
    ('L', 'Determina se interessi preponderanti di terzi si oppongono alla comunicazione delle informazioni.'),
    ('L', 'Documenta la decisione nel sistema di gestione degli affari.'),
    ('H2', '4.3 Costi'),
    ('P', 'Le informazioni sono gratuite. Se una domanda comporta un onere superiore a 8 ore, la SEQT può riscuotere un emolumento di 300 franchi al massimo. Nel 2025 sono state presentate 1250 domande. Il 96 per cento ha ricevuto risposta entro i termini.'),
    ('H1', '5 Informazioni e contatto'),
    ('P', 'La Sezione Basi risponde alle domande relative alla presente direttiva all’indirizzo grundlagen@example.com. Ulteriori informazioni sono disponibili all’indirizzo https://www.example.com/it/informazioni. Lo sportello è aperto il martedì alle 14.30.'),
    ('H1', '6 Entrata in vigore'),
    ('P', 'La presente direttiva entra in vigore il 1° gennaio 2027. Sostituisce la direttiva del 3 marzo 2019.'),
    ('P', 'Berna, 12 novembre 2026'),
    ('P', 'Segreteria di Stato per le questioni tipo SEQT'),
    ('P', 'Dana Muster, capo della Sezione Basi'),
]


# ---------- Realistischer, sauberer Satz in drei Sprachen (Fehlalarm-Test) ----------
K_DE = [
    ('T', 'Konzept «Digitaler Posteingang»'),
    ('P', 'Bundesamt für Beispiele BAB, Abteilung Betrieb'),
    ('P', 'Version 1.2 vom 5. Oktober 2026'),
    ('H1', '1 Ausgangslage'),
    ('P', 'Die Abteilung Betrieb des Bundesamts für Beispiele (BAB) verarbeitet heute rund 10 000 Sendungen pro Jahr von Hand, d. h. etwa 200 pro Woche. Die Verteilung dauert im Mittel zwei Arbeitstage (vgl. Ziff. 2.1). Im Jahr 2025 erreichten 12,5 Prozent der Sendungen die zuständige Stelle zu spät.'),
    ('P', 'Die Geschäftsleitung hat am 26. Juni 2024 die Strategie «Digitales Amt» verabschiedet. Sie verlangt, dass das Amt eingehende Post bis Ende 2028 elektronisch verarbeitet. Massgebend ist Art. 8 Abs. 1 Bst. a der Betriebsverordnung des BAB (BetrV-BAB).'),
    ('H1', '2 Ziele'),
    ('H2', '2.1 Kürzere Durchlaufzeit'),
    ('P', 'Der digitale Posteingang verkürzt die Verteilung auf höchstens einen Arbeitstag. Die Kanzlei scannt alle Sendungen bis 8.30 Uhr und weist sie der zuständigen Stelle zu.'),
    ('H2', '2.2 Nachvollziehbarkeit'),
    ('P', 'Jede Sendung erhält eine Geschäftsnummer. Die Mitarbeiterinnen und Mitarbeiter sehen jederzeit, wer eine Sendung bearbeitet. Personen, die die Post bisher verteilt haben, übernehmen die Qualitätskontrolle.'),
    ('H1', '3 Lösung'),
    ('P', 'Das BAB beschafft zwei Scanner und nutzt die bestehende Geschäftsverwaltung. Die Informatik (IT) richtet die Schnittstelle ein, z. B. für die automatische Erkennung von Absender und Betreff. Weitere Angaben enthält die Website www.example.com/posteingang.'),
    ('L', 'Scannen und Texterkennung'),
    ('L', 'Zuweisung an die zuständige Stelle'),
    ('L', 'Archivierung gemäss Anhang 1'),
    ('H1', '4 Ressourcen und Kosten'),
    ('P', 'Die einmaligen Kosten betragen 85 000 Franken, die jährlichen Betriebskosten 12 000 Franken. Das Projekt bindet 0,4 Vollzeitstellen während 6 Monaten.'),
    ('TAB', [['Position', 'Betrag'], ['Scanner', '40 000 Franken'], ['Schnittstelle', '45 000 Franken']]),
    ('H1', '5 Risiken'),
    ('P', 'Fällt ein Scanner aus, verteilt die Kanzlei die Post wie bisher von Hand. Vertrauliche Sendungen öffnet nur die Empfängerin oder der Empfänger.'),
    ('H1', '6 Termine und weiteres Vorgehen'),
    ('P', 'Der Pilotbetrieb beginnt am 1. Februar 2027 und dauert drei Monate. Die Geschäftsleitung entscheidet am 15. Mai 2027 über die definitive Einführung.'),
    ('H1', 'Anhang 1: Aufbewahrungsfristen'),
    ('P', 'Die Kanzlei bewahrt die Originale 90 Tage auf und vernichtet sie danach.'),
]
K_FR = [
    ('T', 'Concept « Courrier entrant numérique »'),
    ('P', 'Office fédéral des exemples OFEX, division Exploitation'),
    ('P', 'Version 1.2 du 5 octobre 2026'),
    ('H1', '1 Contexte'),
    ('P', 'La division Exploitation de l’Office fédéral des exemples (OFEX) traite aujourd’hui manuellement quelque 10 000 envois par an, c’est-à-dire environ 200 par semaine. La distribution prend en moyenne deux jours ouvrables (cf. ch. 2.1). En 2025, 12,5 % des envois sont parvenus trop tard au service compétent.'),
    ('P', 'La direction a adopté la stratégie « Office numérique » le 26 juin 2024. Celle-ci exige que l’office traite le courrier entrant par voie électronique d’ici à la fin de 2028. L’art. 8, al. 1, let. a, de l’ordonnance d’exploitation de l’OFEX (OExpl-OFEX) est déterminant.'),
    ('H1', '2 Objectifs'),
    ('H2', '2.1 Durée de traitement plus courte'),
    ('P', 'Le courrier entrant numérique réduit la distribution à un jour ouvrable au plus. La chancellerie numérise tous les envois avant 8 h 30 et les attribue au service compétent.'),
    ('H2', '2.2 Traçabilité'),
    ('P', 'Chaque envoi reçoit un numéro d’affaire. Les collaboratrices et collaborateurs voient à tout moment qui traite un envoi. Les personnes qui distribuaient le courrier jusqu’ici se chargent du contrôle de la qualité.'),
    ('H1', '3 Solution'),
    ('P', 'L’OFEX acquiert deux scanners et utilise le système de gestion des affaires existant. L’informatique (IT) met en place l’interface, par exemple pour la reconnaissance automatique de l’expéditeur et de l’objet. Le site www.example.com/posteingang fournit de plus amples informations.'),
    ('L', 'Numérisation et reconnaissance de texte'),
    ('L', 'Attribution au service compétent'),
    ('L', 'Archivage selon l’annexe 1'),
    ('H1', '4 Ressources et coûts'),
    ('P', 'Les coûts uniques s’élèvent à 85 000 francs et les coûts d’exploitation annuels à 12 000 francs. Le projet mobilise 0,4 équivalent plein temps pendant 6 mois.'),
    ('TAB', [['Poste', 'Montant'], ['Scanners', '40 000 francs'], ['Interface', '45 000 francs']]),
    ('H1', '5 Risques'),
    ('P', 'Si un scanner tombe en panne, la chancellerie distribue le courrier manuellement, comme jusqu’ici. Seul le ou la destinataire ouvre les envois confidentiels.'),
    ('H1', '6 Calendrier et suite des travaux'),
    ('P', 'L’exploitation pilote débute le 1er février 2027 et dure trois mois. La direction décide de l’introduction définitive le 15 mai 2027.'),
    ('H1', 'Annexe 1 : Délais de conservation'),
    ('P', 'La chancellerie conserve les originaux pendant 90 jours, puis les détruit.'),
]
K_IT = [
    ('T', 'Concetto «Posta in entrata digitale»'),
    ('P', 'Ufficio federale degli esempi UFES, Divisione Esercizio'),
    ('P', 'Versione 1.2 del 5 ottobre 2026'),
    ('H1', '1 Situazione iniziale'),
    ('P', 'La Divisione Esercizio dell’Ufficio federale degli esempi (UFES) tratta oggi manualmente circa 10 000 invii all’anno, ossia circa 200 alla settimana. La distribuzione richiede in media due giorni lavorativi (cfr. n. 2.1). Nel 2025 il 12,5 per cento degli invii è giunto in ritardo al servizio competente.'),
    ('P', 'La direzione ha adottato la strategia «Ufficio digitale» il 26 giugno 2024. Questa esige che l’ufficio tratti la posta in entrata per via elettronica entro la fine del 2028. È determinante l’art. 8 cpv. 1 lett. a dell’ordinanza d’esercizio dell’UFES (OEs-UFES).'),
    ('H1', '2 Obiettivi'),
    ('H2', '2.1 Tempi di trattamento più brevi'),
    ('P', 'La posta in entrata digitale riduce la distribuzione a un giorno lavorativo al massimo. La cancelleria scansiona tutti gli invii entro le ore 8.30 e li attribuisce al servizio competente.'),
    ('H2', '2.2 Tracciabilità'),
    ('P', 'Ogni invio riceve un numero d’affare. Le collaboratrici e i collaboratori vedono in ogni momento chi tratta un invio. Le persone che finora distribuivano la posta assumono il controllo della qualità.'),
    ('H1', '3 Soluzione'),
    ('P', 'L’UFES acquista due scanner e utilizza il sistema di gestione degli affari esistente. L’informatica (IT) predispone l’interfaccia, per esempio per il riconoscimento automatico del mittente e dell’oggetto. Il sito www.example.com/posteingang fornisce ulteriori informazioni.'),
    ('L', 'Scansione e riconoscimento del testo'),
    ('L', 'Attribuzione al servizio competente'),
    ('L', 'Archiviazione secondo l’allegato 1'),
    ('H1', '4 Risorse e costi'),
    ('P', 'I costi unici ammontano a 85 000 franchi, i costi d’esercizio annui a 12 000 franchi. Il progetto impegna 0,4 posti a tempo pieno per 6 mesi.'),
    ('TAB', [['Voce', 'Importo'], ['Scanner', '40 000 franchi'], ['Interfaccia', '45 000 franchi']]),
    ('H1', '5 Rischi'),
    ('P', 'Se uno scanner si guasta, la cancelleria distribuisce la posta manualmente come finora. Solo la destinataria o il destinatario apre gli invii confidenziali.'),
    ('H1', '6 Calendario e seguito dei lavori'),
    ('P', 'L’esercizio pilota inizia il 1° febbraio 2027 e dura tre mesi. La direzione decide in merito all’introduzione definitiva il 15 maggio 2027.'),
    ('H1', 'Allegato 1: Termini di conservazione'),
    ('P', 'La cancelleria conserva gli originali per 90 giorni e poi li distrugge.'),
]
import re as _re
def nbsp_num(rows):
    out = []
    for k, t in rows:
        if k == 'TAB': out.append((k, [[_re.sub(r'(?<=\d) (?=\d{3})', NB, c) for c in r] for r in t]))
        else: out.append((k, _re.sub(r'(?<=\d) (?=\d{3})', NB, t)))
    return out
def fr_typo(rows):
    f = lambda t: _re.sub(r' ([:;!?%])', NB + r'\1', t).replace('« ', '«' + NB).replace(' »', NB + '»')
    return [(k, [[f(c) for c in r] for r in t] if k == 'TAB' else f(t)) for k, t in rows]

def add_hyperlink(par, text, url):
    part = par.part
    rid = part.relate_to(url, 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink', is_external=True)
    hl = OxmlElement('w:hyperlink'); hl.set(qn('r:id'), rid)
    r = OxmlElement('w:r'); t = OxmlElement('w:t'); t.text = text; t.set(qn('xml:space'), 'preserve'); r.append(t); hl.append(r)
    par._p.append(hl)

def komplex(path):
    """Tabelle, Hyperlink, bestehende Änderung, Tabulator und Zeilenumbruch: Härtetest für den Korrekturmodus."""
    doc = Document()
    doc.core_properties.title = 'Notiz Härtetest'
    doc.add_paragraph('Notiz Härtetest', style='Title')
    doc.add_paragraph('Bundesamt für Beispiele, 12. November 2026')
    doc.add_paragraph('Ausgangslage', style='Heading 1')
    p = doc.add_paragraph('Weitere Informationen stehen unter ')
    add_hyperlink(p, 'http://www.example.com/de/auskunft', 'http://www.example.com/de/auskunft')
    p.add_run(' zur Verfügung, der „Leitfaden“ gilt.')
    p = doc.add_paragraph('Die Quote beträgt')
    r = p.add_run(); r.add_tab(); r.add_text('96% der Fälle,'); r.add_break(); r.add_text('gemessen im Jahr 2025  über alle Stellen.')
    p = doc.add_paragraph('Der Beschluss gilt ')
    ins = OxmlElement('w:ins'); ins.set(qn('w:id'), '901'); ins.set(qn('w:author'), 'Kai Beispiel'); ins.set(qn('w:date'), '2026-11-01T09:00:00Z')
    r = OxmlElement('w:r'); t = OxmlElement('w:t'); t.text = 'gemäß Antrag der Direktion'; t.set(qn('xml:space'), 'preserve'); r.append(t); ins.append(r); p._p.append(ins)
    p.add_run(' ab sofort.')
    tb = doc.add_table(rows=2, cols=2); tb.style = 'Table Grid'
    tb.cell(0, 0).text = 'Kennzahl'; tb.cell(0, 1).text = 'Wert'
    tb.cell(1, 0).text = 'Fristgerecht beantwortet („pünktlich“)'; tb.cell(1, 1).text = '96%'
    doc.add_paragraph('Beurteilung', style='Heading 1')
    doc.add_paragraph('Die Lage ist stabil.')
    doc.save(path)

def big(path, n=1800):
    doc = Document()
    doc.add_paragraph('Bericht Grossdokument', style='Title')
    doc.add_paragraph('Bundesamt für Beispiele, 12. November 2026')
    for i in range(n):
        if i % 12 == 0: doc.add_paragraph(f'{i // 12 + 1} Abschnitt zur Frage {i // 12 + 1}', style='Heading 1')
        doc.add_paragraph(f'Die zuständige Stelle beantwortet das Gesuch Nummer {i} innert 30 Tagen und informiert die gesuchstellende Person, wenn sie die Frist nicht einhalten kann. Der „Leitfaden“ gilt, die Quote beträgt {i % 100}%.')
    doc.save(path)


def sub(rows, old, new, count=1):
    hit = 0
    for i, (k, t) in enumerate(rows):
        if old in t:
            rows[i] = (k, t.replace(old, new, count)); hit += 1
    assert hit, 'nicht gefunden: ' + old
    return rows


def de_demo():
    """Deutsche Fassung mit formalen Mängeln, Struktur unverändert (für Demo und Sprachvergleich)."""
    r = copy.deepcopy(DE)
    sub(r, 'einheitlich, fristgerecht und nachvollziehbar beantwortet werden.', 'einheitlich, fristgerecht und nachvollziehbar beantwortet werden. Massgebend ist der „Leitfaden Auskunft“ der Kanzlei.')
    sub(r, 'Die Weisung gilt für alle Mitarbeitenden des SMF', 'Die Weisung gilt für alle Mitarbeiter*innen des SMF')
    sub(r, 'Sie leitet das Gesuch innert 2 Arbeitstagen', 'Sie sollte das Gesuch innert 2 Arbeitstagen')
    sub(r, 'an die zuständige Sektion weiter.', 'an die zuständige Sektion weiterleiten.')
    sub(r, 'Davon wurden 96 Prozent fristgerecht', 'Davon wurden 96% fristgerecht')
    sub(r, 'Die Auskunft ist kostenlos.', 'Die Auskunft ist grundsätzlich kostenlos. Massgebend ist die Gebührenverordnung, TODO Artikel ergänzen.')
    sub(r, 'Sie dokumentiert den Entscheid im Geschäftsverwaltungssystem.', 'Sie dokumentiert den Entscheid im Geschäftsverwaltungssystem und meldet ihn dem DSB.')
    sub(r, 'Kann sie die Frist nicht einhalten', 'Kann sie die Frist nicht nicht einhalten')
    sub(r, 'https://www.example.com/de/auskunft', 'http://www.example.com/de/auskunft')
    sub(r, 'Sie ersetzt die Weisung vom 3. März 2019.', 'Sie ersetzt die Weisung vom 03.03.2019 und gilt gemäß Beschluss der Direktion.')
    return r


def de_demo_v2():
    """Überarbeitete Fassung der Demo (Nachprüfung): «nicht nicht», TODO und http behoben; Abschnitt «Auskunft und Kontakt»
    nach vorn verschoben und alle Überschriften neu nummeriert; im Kostenabsatz eine Zahl geändert (96% und «grundsätzlich»
    bleiben); im Geltungsbereich ein neuer Platzhalter; der Absatz mit «Mitarbeiter*innen» stark umgeschrieben."""
    r = de_demo()
    sub(r, 'Kann sie die Frist nicht nicht einhalten', 'Kann sie die Frist nicht einhalten')
    sub(r, ' Massgebend ist die Gebührenverordnung, TODO Artikel ergänzen.', ' Massgebend ist die Gebührenverordnung.')
    sub(r, 'Im Jahr 2025 gingen 1250 Gesuche ein.', 'Im Jahr 2025 gingen 1300 Gesuche ein.')
    sub(r, 'http://www.example.com/de/auskunft', 'https://www.example.com/de/auskunft')
    i = [t for _, t in r].index('2 Geltungsbereich')
    r[i + 1] = ('P', 'Mitarbeiter*innen des SMF, die Gesuche entgegennehmen, wenden diese Weisung an; für Anfragen von Medienschaffenden ist hingegen der Informationsdienst zuständig. Massgebend ist das Merkblatt vom [Datum].')
    j = [t for _, t in r].index('5 Auskunft und Kontakt')
    sec = r[j:j + 2]; del r[j:j + 2]
    k = [t for _, t in r].index('3 Rechtsgrundlagen')
    r[k:k] = sec
    ren = {'5 Auskunft und Kontakt': '3 Auskunft und Kontakt', '3 Rechtsgrundlagen': '4 Rechtsgrundlagen', '4 Zuständigkeiten': '5 Zuständigkeiten', '4.1 Eingang und Triage': '5.1 Eingang und Triage', '4.2 Bearbeitung': '5.2 Bearbeitung', '4.3 Kosten': '5.3 Kosten'}
    r = [(kk, ren.get(t, t)) for kk, t in r]
    return r


def de_flawed():
    """Zusätzlich strukturelle Mängel."""
    r = de_demo()
    # Titel fehlt, Nummernlücke, Ebenensprung, leerer Abschnitt, Inkrafttreten fehlt
    r = [x for x in r if x[0] != 'T']
    r.insert(0, ('P', 'Weisung über die Bearbeitung von Auskunftsgesuchen'))
    sub(r, '3 Rechtsgrundlagen', '4 Rechtsgrundlagen')
    sub(r, '4 Zuständigkeiten', '5 Zuständigkeiten')
    r = [('H3', t) if t == '4.1 Eingang und Triage' else (k, t) for k, t in r]
    i = [t for _, t in r].index('6 Inkrafttreten')
    del r[i:i + 2]
    r.insert(i, ('H1', '6 Schlussbestimmungen'))
    r.insert(i + 1, ('H1', '7 Anhänge'))
    r.insert(i + 2, ('P', 'Einzelheiten regelt Kapitel 9. Die Fristen sind in Tabelle 3 und in Anhang 2 zusammengestellt, vgl. Art.5 Abs 2 lit. a der Verordnung. Im Vorjahr gingen 10.000 Seiten Akten ein, davon 2’500 elektronisch und 1 200 auf Papier.'))
    r.insert(i + 3, ('P', 'Das Verfahren ist so auszugestalten, dass die gesuchstellende Person, die ihr Gesuch schriftlich oder elektronisch eingereicht hat und deren Identität die zuständige Sektion zweifelsfrei festgestellt hat, innert der gesetzlichen Frist eine vollständige, verständliche und nachvollziehbare Antwort erhält, die alle verlangten Angaben umfasst und die Rechtsmittel nennt.'))
    r.insert(i + 4, ('P', 'The request is processed by the competent section within the deadline and the applicant is informed in writing about the decision.'))
    r.insert(i + 5, ('P', 'Der Schengen-Raum und der Schengenraum werden in dieser Weisung gleich behandelt.'))
    r.insert(i + 6, ('P', 'Zuständig ist die Sektion ,die das Gesuch erhalten hat ;  sie bestätigt den Eingang.'))
    return r


def fr_errors():
    r = copy.deepcopy(FR)
    sub(r, 'dans un délai de 30 jours', 'dans un délai de 20 jours')
    sub(r, 'entre en vigueur le 1er janvier 2027', 'entre en vigueur le 1er février 2027')
    r = [x for x in r if 'intérêts prépondérants' not in x[1]]
    sub(r, 'Les renseignements sont gratuits. Si une demande occasionne un travail de plus de 8 heures, le SEQT peut percevoir un émolument de 300 francs au maximum. En 2025, 1250 demandes ont été déposées. Parmi elles, 96' + NB + '% ont reçu une réponse dans les délais.',
        'Die Auskunft ist kostenlos. Verursacht ein Gesuch einen Aufwand von mehr als 8 Stunden, kann das SMF eine Gebühr von höchstens 300 Franken erheben. Im Jahr 2025 gingen 1250 Gesuche ein. Davon wurden 96 Prozent fristgerecht beantwortet.')
    sub(r, '(DFJP)', '(EJPD)')
    sub(r, 'l’art. 25, al. 2, let. a', 'l’art. 25, al. 3, let. a')
    sub(r, 'grundlagen@example.com', 'bases@example.com')
    sub(r, 'Elle ne s’applique pas aux demandes des médias.', 'Elle s’applique également aux demandes des médias.')
    sub(r, 'à 14 h 30', 'à 15 h 30')
    sub(r, 'vérifiable.', 'vérifiable. Le "guide" de la chancellerie fait foi: il est contraignant.')
    return r


def build(rows, path, lang='de', extras=False, title=None):
    doc = Document()
    st = doc.styles['Normal']; st.font.name = 'Arial'; st.font.size = Pt(11)
    for sec in doc.sections:
        sec.page_width, sec.page_height = Cm(21), Cm(29.7)
    doc.core_properties.title = title if title is not None else rows[0][1]
    doc.core_properties.author = 'Dana Muster'
    made = []
    for kind, text in rows:
        if kind == 'TAB':
            tb = doc.add_table(rows=len(text), cols=len(text[0])); tb.style = 'Table Grid'
            for i, row in enumerate(text):
                for j, c in enumerate(row): tb.cell(i, j).text = c
            continue
        if kind == 'T':
            p = doc.add_paragraph(style='Title')
        elif kind in ('H1', 'H2', 'H3'):
            p = doc.add_paragraph(style='Heading ' + kind[1])
        elif kind == 'L':
            p = doc.add_paragraph(style='List Bullet')
        else:
            p = doc.add_paragraph()
        parts = text.split('**')
        for j, part in enumerate(parts):
            if part:
                run = p.add_run(part); run.bold = True if j % 2 else None
        made.append(p)
    if extras:
        # Markierung, Kommentar, Änderung im Korrekturmodus, Bild ohne Alternativtext
        target = next(p for p in made if 'Gesuche' in p.text and p.style.name == 'Normal')
        target.runs[0].font.highlight_color = WD_COLOR_INDEX.YELLOW
        doc.add_comment(runs=target.runs[:1], text='Bitte Formulierung prüfen.', author='Kai Beispiel', initials='KB')
        ins = OxmlElement('w:ins'); ins.set(qn('w:id'), '900'); ins.set(qn('w:author'), 'Kai Beispiel'); ins.set(qn('w:date'), '2026-11-01T09:00:00Z')
        r = OxmlElement('w:r'); t = OxmlElement('w:t'); t.text = ' Dieser Satz ist noch nicht angenommen.'; t.set(qn('xml:space'), 'preserve'); r.append(t); ins.append(r)
        target._p.append(ins)
        buf = io.BytesIO(); Image.new('RGB', (240, 80), (60, 90, 200)).save(buf, 'PNG'); buf.seek(0)
        doc.add_picture(buf, width=Cm(6))
    doc.save(path)


def to_pdf(path):
    subprocess.run(['soffice', '--headless', '--convert-to', 'pdf', '--outdir', OUT, path], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def konzept(path):
    rows = [
        ('T', 'Konzept Einführung digitaler Posteingang'),
        ('P', 'Bundesamt für Beispiele, Abteilung Betrieb'),
        ('P', 'Version 0.9, Entwurf vom 5. Oktober 2026'),
        ('H1', '1 Ausgangslage'),
        ('P', 'Die Abteilung Betrieb verarbeitet heute rund 400 Briefe pro Woche von Hand. Die Verteilung dauert im Mittel zwei Tage.'),
        ('H1', '2 Ziele'),
        ('P', 'Der digitale Posteingang verkürzt die Verteilung auf einen Tag und macht jede Sendung nachvollziehbar.'),
        ('H1', '3 Lösung'),
        ('P', 'Die Kanzlei scannt alle Sendungen und weist sie im Geschäftsverwaltungssystem der zuständigen Stelle zu.'),
        ('H1', '4 Termine'),
        ('P', 'Der Pilotbetrieb beginnt am 1. Februar 2027 und dauert drei Monate.'),
    ]
    build(rows, path)


def notiz(path):
    rows = [
        ('T', 'Aktennotiz'),
        ('P', 'An: Alex Beispiel, Leiter Abteilung Betrieb'),
        ('P', 'Von: Dana Muster, Sektion Grundlagen, Bundesamt für Beispiele'),
        ('P', 'Datum: 12. November 2026'),
        ('P', 'Betreff: Besprechung zum digitalen Posteingang'),
        ('H1', 'Ausgangslage'),
        ('P', 'Am 10. November 2026 besprachen die Abteilung Betrieb und die Sektion Grundlagen den Stand des Projekts.'),
        ('H1', 'Beurteilung'),
        ('P', 'Der Pilotbetrieb ist gut vorbereitet. Offen ist die Schulung der Kanzlei.'),
        ('H1', 'Weiteres Vorgehen'),
        ('P', 'Die Sektion Grundlagen legt bis am 30. November 2026 einen Schulungsplan vor.'),
    ]
    build(rows, path)


def deck(path):
    from pptx import Presentation
    from pptx.util import Pt as PPt, Inches
    prs = Presentation()
    s = prs.slides.add_slide(prs.slide_layouts[0])
    s.shapes.title.text = 'Auskunftsgesuche im SMF'
    s.placeholders[1].text = 'Stand der Umsetzung, 12. November 2026'
    s = prs.slides.add_slide(prs.slide_layouts[1])
    s.shapes.title.text = 'Ausgangslage'
    tf = s.placeholders[1].text_frame
    tf.text = 'Im Jahr 2025 gingen 1250 Gesuche ein.'
    tf.add_paragraph().text = 'Davon wurden 96% fristgerecht beantwortet.'
    tf.add_paragraph().text = 'Die Mitarbeiter*innen der Kanzlei erfassen jedes Gesuch am Tag des Eingangs.'
    s = prs.slides.add_slide(prs.slide_layouts[5])  # nur Titel — Titel leer lassen
    s.shapes.title.text = ''
    box = s.shapes.add_textbox(Inches(1), Inches(1.5), Inches(8), Inches(4))
    long = ('Die zuständige Sektion beantwortet das Gesuch innert 30 Tagen und informiert die gesuchstellende Person, wenn sie die Frist nicht einhalten kann. ' * 5).strip()
    box.text_frame.text = long
    box.text_frame.word_wrap = True
    for p in box.text_frame.paragraphs:
        for r in p.runs:
            r.font.size = PPt(10)
    buf = io.BytesIO(); Image.new('RGB', (240, 80), (60, 90, 200)).save(buf, 'PNG'); buf.seek(0)
    s.shapes.add_picture(buf, Inches(1), Inches(5.6))
    s = prs.slides.add_slide(prs.slide_layouts[1])
    s.shapes.title.text = 'Nächste Schritte'
    s.placeholders[1].text_frame.text = 'Die Weisung tritt am 1. Januar 2027 in Kraft. TODO Termin bestätigen.'
    prs.save(path)


def deck_comments(path):
    """Präsentation mit vorhandenen klassischen Kommentaren (zwei Autoren), einer Gruppe und einer Tabelle: Lectora muss ergänzen, nicht ersetzen."""
    import zipfile, re as _re
    from pptx import Presentation
    from pptx.util import Inches, Pt as PPt
    prs = Presentation()
    s = prs.slides.add_slide(prs.slide_layouts[0])
    s.shapes.title.text = 'Auskunftsgesuche im SMF'
    s.placeholders[1].text = 'Stand der Umsetzung, 12. November 2026'
    s = prs.slides.add_slide(prs.slide_layouts[1])
    s.shapes.title.text = 'Ausgangslage'
    tf = s.placeholders[1].text_frame
    tf.text = 'Im Jahr 2025 gingen 1250 Gesuche ein.'
    tf.add_paragraph().text = 'Die Mitarbeiter*innen der Kanzlei erfassen jedes Gesuch am Tag des Eingangs.'
    s = prs.slides.add_slide(prs.slide_layouts[5])
    s.shapes.title.text = 'Zahlen und Gruppen'
    grp = s.shapes.add_group_shape()
    box = grp.shapes.add_textbox(Inches(5), Inches(4), Inches(4), Inches(1))
    box.text_frame.text = 'In der Gruppe: TODO Zahlen prüfen.'
    grp.shapes.add_textbox(Inches(5), Inches(5.2), Inches(3), Inches(0.6)).text_frame.text = 'Zweites Feld'
    tbl = s.shapes.add_table(2, 2, Inches(0.5), Inches(2), Inches(4), Inches(1.2)).table
    tbl.cell(0, 0).text = 'Jahr'; tbl.cell(0, 1).text = 'Gesuche'; tbl.cell(1, 0).text = '2025'; tbl.cell(1, 1).text = 'ca. 1250 (TODO)'
    buf = io.BytesIO(); prs.save(buf)
    src = zipfile.ZipFile(io.BytesIO(buf.getvalue()))
    out = zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED)
    P = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"'
    authors = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<p:cmAuthorLst ' + P + '><p:cmAuthor id="0" name="Kai Beispiel" initials="KB" lastIdx="2" clrIdx="0"/><p:cmAuthor id="1" name="Lectora" initials="LE" lastIdx="1" clrIdx="1"/></p:cmAuthorLst>'
    cms = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<p:cmLst ' + P + '>'
           '<p:cm authorId="0" dt="2026-11-01T09:00:00.000" idx="1"><p:pos x="10" y="10"/><p:text>Bitte die Zahl für 2025 bestätigen.</p:text></p:cm>'
           '<p:cm authorId="0" dt="2026-11-01T09:05:00.000" idx="2"><p:pos x="2000" y="900"/><p:text>Quelle ergänzen.</p:text></p:cm>'
           '<p:cm authorId="1" dt="2026-11-02T10:00:00.000" idx="1"><p:pos x="3000" y="1500"/><p:text>Früherer Kommentar von Lectora.</p:text></p:cm></p:cmLst>')
    for it in src.infolist():
        data = src.read(it.filename)
        if it.filename == '[Content_Types].xml':
            data = data.decode().replace('</Types>', '<Override PartName="/ppt/commentAuthors.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.commentAuthors+xml"/><Override PartName="/ppt/comments/comment1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.comments+xml"/></Types>').encode()
        elif it.filename == 'ppt/_rels/presentation.xml.rels':
            data = data.decode().replace('</Relationships>', '<Relationship Id="rId90" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/commentAuthors" Target="commentAuthors.xml"/></Relationships>').encode()
        elif it.filename == 'ppt/slides/_rels/slide2.xml.rels':
            data = data.decode().replace('</Relationships>', '<Relationship Id="rId90" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="../comments/comment1.xml"/></Relationships>').encode()
        out.writestr(it, data)
    out.writestr('ppt/commentAuthors.xml', authors)
    out.writestr('ppt/comments/comment1.xml', cms)
    out.close()


def pdf_variants():
    """PDF-Fassungen für den Export mit Anmerkungen: gedrehte Seiten, verschobener Seitenursprung, verschlüsselt, signiert."""
    from pypdf import PdfReader, PdfWriter, Transformation
    from pypdf.generic import ArrayObject, DictionaryObject, NameObject, NumberObject, ByteStringObject, TextStringObject
    src = os.path.join(OUT, 'weisung_de_flawed.pdf')
    def variant(name, rot, dx, dy):
        r = PdfReader(src); w = PdfWriter()
        for pg in r.pages:
            if dx or dy:
                pg.add_transformation(Transformation().translate(dx, dy))
                box = [float(v) for v in pg.mediabox]
                pg.mediabox.lower_left = (box[0] + dx, box[1] + dy); pg.mediabox.upper_right = (box[2] + dx, box[3] + dy)
                pg.cropbox.lower_left = (box[0] + dx, box[1] + dy); pg.cropbox.upper_right = (box[2] + dx, box[3] + dy)
            if rot: pg.rotate(rot)
            w.add_page(pg)
        w.write(os.path.join(OUT, name))
    variant('weisung_de_flawed_rot90.pdf', 90, 0, 0)
    variant('weisung_de_flawed_versatz_rot270.pdf', 270, 150, 250)
    # Verschlüsselt (leeres Benutzerkennwort: lesbar, aber geschützt)
    r = PdfReader(os.path.join(OUT, 'weisung_de_clean.pdf')); w = PdfWriter()
    for pg in r.pages: w.add_page(pg)
    w.encrypt(user_password='', owner_password='lectora-owner', algorithm='AES-128')
    w.write(os.path.join(OUT, 'weisung_de_verschluesselt.pdf'))
    # Signaturfeld mit Wert (Signaturwörterbuch mit /ByteRange); die Signatur selbst ist ein Platzhalter
    r = PdfReader(os.path.join(OUT, 'weisung_de_clean.pdf')); w = PdfWriter()
    for pg in r.pages: w.add_page(pg)
    sig = DictionaryObject({NameObject('/Type'): NameObject('/Sig'), NameObject('/Filter'): NameObject('/Adobe.PPKLite'), NameObject('/SubFilter'): NameObject('/adbe.pkcs7.detached'),
                            NameObject('/ByteRange'): ArrayObject([NumberObject(0), NumberObject(0), NumberObject(0), NumberObject(0)]), NameObject('/Contents'): ByteStringObject(b'\x00' * 64), NameObject('/Name'): TextStringObject('Kai Beispiel')})
    field = DictionaryObject({NameObject('/FT'): NameObject('/Sig'), NameObject('/T'): TextStringObject('Signatur1'), NameObject('/V'): w._add_object(sig),
                              NameObject('/Type'): NameObject('/Annot'), NameObject('/Subtype'): NameObject('/Widget'), NameObject('/Rect'): ArrayObject([NumberObject(0)] * 4), NameObject('/F'): NumberObject(132), NameObject('/P'): w.pages[0].indirect_reference})
    fref = w._add_object(field)
    w.pages[0][NameObject('/Annots')] = ArrayObject([fref])
    w._root_object[NameObject('/AcroForm')] = w._add_object(DictionaryObject({NameObject('/Fields'): ArrayObject([fref]), NameObject('/SigFlags'): NumberObject(3)}))
    w.write(os.path.join(OUT, 'weisung_de_signiert.pdf'))


def klassif():
    """Klassifizierungsvermerke an den Orten, die Lectora prüft (Kopfzeile, Fusszeile, Folienfuss, Seitenrand im PDF), je Stufe,
    dazu ein Dokument ohne Vermerk, das die Wörter «intern» und «Interne» im Text trägt (darf keinen Vermerk ergeben)."""
    import zipfile, re as _re
    def with_hf(rows, path, header=None, footer=None, lang='de'):
        build(rows, path, lang=lang)
        d = Document(path)
        sec = d.sections[0]
        if header: sec.header.paragraphs[0].text = header
        if footer: sec.footer.paragraphs[0].text = footer
        d.save(path)
    with_hf(DE, os.path.join(OUT, 'klassif_intern_kopf.docx'), header='INTERN')
    with_hf(de_flawed(), os.path.join(OUT, 'klassif_vertraulich_fuss.docx'), footer='SMF | Vertraulich | Weisung Auskunftsgesuche')
    with_hf(FR, os.path.join(OUT, 'klassif_secret_kopf_fr.docx'), header='Classification : SECRET', lang='fr')
    rows = [r if i != 4 else ('P', 'Die interne Kommunikation läuft über die Kanzlei. Interne Weisungen gelten für alle Mitarbeitenden.') for i, r in enumerate(DE)]
    build(rows, os.path.join(OUT, 'klassif_keine.docx'))
    to_pdf(os.path.join(OUT, 'klassif_vertraulich_fuss.docx'))
    # PowerPoint: Vermerk nur im Fussfeld jeder Folie
    src = os.path.join(OUT, 'klassif_folie_tmp.pptx'); deck(src)
    zin = zipfile.ZipFile(src); out = os.path.join(OUT, 'klassif_confidenziale_folie.pptx'); zout = zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED)
    ftr = ('<p:sp><p:nvSpPr><p:cNvPr id="90" name="Footer Placeholder"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="ftr" sz="quarter" idx="11"/></p:nvPr></p:nvSpPr>'
           '<p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="it-CH"/><a:t>CONFIDENZIALE</a:t></a:r></a:p></p:txBody></p:sp></p:spTree>')
    for n in zin.namelist():
        d = zin.read(n)
        if _re.match(r'ppt/slides/slide\d+\.xml$', n): d = d.decode('utf-8').replace('</p:spTree>', ftr, 1).encode('utf-8')
        zout.writestr(zin.getinfo(n), d)
    zout.close(); zin.close(); os.remove(src)


if __name__ == '__main__' and '--klassif' in sys.argv:
    klassif()
    sys.exit(0)

if __name__ == '__main__' and '--export' in sys.argv:
    # Nur die Dateien für den Export mit Kommentaren (PDF, PowerPoint); die übrigen Testdokumente bleiben unverändert
    deck_comments(os.path.join(OUT, 'praesentation_kommentare.pptx'))
    pdf_variants()
    to_pdf(os.path.join(OUT, 'weisung_fr_errors.docx'))
    sys.exit(0)

if __name__ == '__main__':
    p = lambda n: os.path.join(OUT, n)
    build(DE, p('weisung_de_clean.docx'))
    build(de_demo(), p('weisung_de_demo.docx'))
    build(de_flawed(), p('weisung_de_flawed.docx'), extras=True, title='')
    build(de_demo_v2(), p('weisung_de_demo_v2.docx'))
    build(FR, p('weisung_fr_clean.docx'))
    build(fr_errors(), p('weisung_fr_errors.docx'))
    build(IT, p('weisung_it_clean.docx'))
    konzept(p('konzept_de.docx'))
    notiz(p('aktennotiz_de.docx'))
    deck(p('praesentation_de.pptx'))
    build(nbsp_num(K_DE), p('konzept_real_de.docx'))
    build(fr_typo(nbsp_num(K_FR)), p('konzept_real_fr.docx'))
    build(nbsp_num(K_IT), p('konzept_real_it.docx'))
    komplex(p('komplex_de.docx'))
    big(p('gross_de.docx'))
    to_pdf(p('konzept_real_fr.docx'))
    to_pdf(p('weisung_de_clean.docx'))
    to_pdf(p('weisung_de_flawed.docx'))
    deck_comments(p('praesentation_kommentare.pptx'))
    pdf_variants()
    to_pdf(p('weisung_fr_errors.docx'))
    klassif()
    print('\n'.join(sorted(os.listdir(OUT))))
