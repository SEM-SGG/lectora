# Änderungen

Jede Version hat einen Eintrag. Die Überschrift hat die Form `## X.Y.Z – JJJJ-MM-TT`; der Workflow `release` übernimmt den obersten Eintrag als Text der Veröffentlichung.

## 2.2.0 – 2026-11-25

Lectora geht in die Erprobung (Dezember 2026 bis Januar 2027). Fehler und Änderungswünsche lassen sich direkt aus der Kopfzeile melden.

### Neu

- Kopfzeile: Das Etikett «BETA» (französisch «BÊTA») rechts neben dem Namen kennzeichnet die Erprobungsphase. Es ist nicht anklickbar; die Kurzinfo und Screenreader erklären es («Dieses Tool ist in Erprobung. Rückmeldungen sind willkommen.»). Ein einziger Schalter in `src/ui.js` blendet es nach der Erprobung aus (Ablauf in `docs/pflege.md`).
- Kopfzeile: Ein Käfersymbol rechts neben dem Etikett öffnet auf GitHub in einem neuen Tab die Auswahl der Vorlagen für Issues. Name und Kurzinfo: «Fehler melden oder Änderung vorschlagen»; die Kurzinfo erinnert daran, dass Meldungen öffentlich sind (kein Text aus Dokumenten, keine Personendaten). Das Symbol bleibt auch nach der Erprobung. «Fehler melden» in der Anleitung bleibt bestehen.
- Neue Vorlage für Issues «Wunsch oder Änderungsvorschlag» neben «Fehler» und «Regel meldet Fehlalarm».

### Geändert

- Kopfzeile: Weil Etikett und Symbol Platz brauchen, erscheint die Navigation unter 1056 px (bisher 840 px) als Menü, und der Untertitel «Dokumentenprüfung» steht erst ab 1312 px (bisher 1056 px) neben dem Namen.
- Etikett und Symbol erscheinen nicht im Druck. Die Exporte (Word, PDF, PowerPoint, Prüfbericht) sind nicht betroffen.
- Anleitung («Hilfe und Rückmeldung»), `README.md` und Produktdokumentation nennen das Symbol und die neue Vorlage.

## 2.1.0 – 2026-11-23

Lectora setzt die Datenregel der SGG um. Merkregel: Klassifizierte Dokumente prüft nur die gespeicherte Datei `Lectora.html`. Webseite und Artefakt: nur unklassifizierte Dokumente.

### Geändert

- Artefakt-Ausgabe auf claude.ai: Dokumente mit dem Vermerk INTERN, VERTRAULICH oder GEHEIM (und den Entsprechungen) lädt und prüft Lectora dort nicht mehr, wie auf der Webseite: Auch hier liefert eine fremde Infrastruktur den Programmcode aus (claude.ai, Bibliotheken von cdnjs). Eine Erklärung verweist auf die gespeicherte Datei `Lectora.html`. Das gilt für die Dateiauswahl, das Ablegen von Dateien, mehrere Dateien auf einmal und «Neue Fassung laden»; einen Weg, die Sperre zu übergehen, gibt es nicht.
- KI-Funktionen der Artefakt-Ausgabe (zweite Sicherung): Dokumente mit dem Vermerk INTERN (auch INTERNE, AD USO INTERNO, USO INTERNO, INTERNAL) sendet Lectora nie an Claude, wie bisher schon VERTRAULICH und GEHEIM. Die Bestätigung «Ich bestätige, dass ich dieses Dokument trotz Klassifizierungsvermerk senden darf» entfällt; es gibt keinen Weg, ein Dokument mit Vermerk trotzdem zu senden. Das gilt für jede KI-Funktion und für Vergleiche, an denen ein solches Dokument beteiligt ist.
- Der Dialog vor dem Senden an Claude nennt die Datenregel: keine besonders schützenswerten Personendaten und keine Falldaten zu Personen aus Verfahren, auch nicht in unklassifizierten Dokumenten.
- Webseite (GitHub Pages): Dokumente mit dem Vermerk INTERN prüft Lectora dort nicht mehr, wie VERTRAULICH und GEHEIM; die Rückfrage mit Häkchen entfällt. Eine Erklärung verweist auf die Datei `Lectora.html`. Die gespeicherte Datei prüft weiterhin jedes Dokument lokal.
- Die Erkennung des Vermerks sperrt im Zweifel eher zu viel. Neu erkannt werden auch «Klassifizierung INTERN» ohne Doppelpunkt und kurze Angaben in Grossbuchstaben, die mit dem Vermerk enden (zum Beispiel «SEM-INTERN», «NUR INTERN», «STRICTLY CONFIDENTIAL»). «Interne Weisung», «die interne Kommunikation» oder «NOTE INTERNE» lösen die Sperre weiterhin nicht aus. Die Erkennung bleibt eine Näherung.
- «Neue Version herunterladen» und «Als Datei speichern» laden die Datei `Lectora.html` der neusten Ausgabe direkt herunter, statt die englische Seite der Ausgabe zu öffnen. «Auf GitHub nachsehen» im Hinweis für ältere Kopien öffnet weiterhin die Seite der neusten Ausgabe.

### Neu

- Warnung vor Verlust: Hat jemand Vorschläge angenommen oder abgelehnt, Befunde ausgeblendet oder als Fehlalarm markiert und das Dokument seither nicht exportiert, fragt der Browser vor dem Schliessen, Neuladen oder Verlassen der Seite nach. Ohne Entscheide oder nach dem Export erscheint keine Warnung. Verwirft der Browser einen Tab im Hintergrund (Edge: schlafende Tabs), warnt er nicht; die Anleitung rät deshalb, vor Pausen zu exportieren. In der Artefakt-Ausgabe auf claude.ai erscheint die Warnung nicht in jedem Fall.
- Anleitung: neue Abschnitte «Datenregel» und «Hilfe und Rückmeldung» mit Links zur Produktdokumentation und zu «Fehler melden» und mit der Funktionsadresse der Sektion für Rückmeldungen ohne GitHub-Konto. Die Rückmeldung zu den Regeln nennt dieselbe Adresse.
- Die Produktdokumentation erscheint mit jeder Veröffentlichung auf GitHub Pages unter der festen Adresse `dokumentation.html`; die Startseite der Webseite verlinkt sie.

### Repository

- `README.md`, `docs/datenschutz.md` und `AGENTS.md` enthalten die Datenregel der SGG; die bisher offene Frage, welche Dokumente an Claude gehen dürfen, ist damit entschieden.
- Routineprüfung der Produktdokumentation: `tools/release_check.py` prüft ihre Version (bei Neben- und Hauptversionen muss sie nachgeführt sein), `tools/doku_check.py` ihre Kennzahlen (Kriterien, Erlasse, Dateigrössen). Jeder Pull Request sagt, ob die Produktdokumentation nachgeführt ist.
- Neue Anleitung `docs/pflege.md` für die Pflege im Browser: Pull Requests von Dependabot, zeitgesteuerter Lauf «erlasse» (Übergabe, Verspätung, Start von Hand). Dependabot schlägt keine Hauptversionen von PDF.js mehr vor, solange der Umbau auf ES-Module nicht beauftragt ist.
- Hygieneprüfung: Die Funktionsadresse der Sektion ist als einzige Adresse unter einer Domain des Bundes zugelassen.

## 2.0.1 – 2026-11-23

Lectora als Webseite auf GitHub Pages ist für unklassifizierte Dokumente gedacht. Dokumente mit Klassifizierungsvermerk prüft man mit der gespeicherten Datei `Lectora.html`.

### Geändert

- Webseite: Erkennt Lectora beim Laden eines Dokuments den Vermerk VERTRAULICH oder GEHEIM (auch CONFIDENTIEL, SECRET, CONFIDENZIALE, SEGRETO, CONFIDENTIAL), lädt es das Dokument nicht und prüft es nicht. Eine Erklärung verweist auf die Datei `Lectora.html`. Das gilt für die Dateiauswahl, das Ablegen von Dateien und «Neue Fassung laden». Den Vermerk liest Lectora dafür im Browser aus der Datei; nichts geht an einen Server.
- Webseite: Bei INTERN (auch INTERNE, INTERNO, AD USO INTERNO, USO INTERNO, INTERNAL) empfiehlt ein Warndialog die Datei `Lectora.html`. Lectora prüft das Dokument erst nach einer Bestätigung mit Häkchen; «Abbrechen», Escape und Schliessen verwerfen es.
- Webseite: Die Startseite zeigt dauerhaft einen Hinweis, wofür die Webseite gedacht ist, mit «Als Datei speichern» (Seite der neusten Ausgabe).
- Die geöffnete Datei `Lectora.html` und die Artefakt-Ausgabe auf claude.ai sind nicht betroffen: Sie prüfen weiterhin alle Dokumente lokal, auch mit dem Vermerk INTERN, VERTRAULICH oder GEHEIM. Für die KI-Funktionen der Artefakt-Ausgabe gelten die bisherigen Regeln.
- Die Erkennung ist eine Näherung. Lectora sucht den Vermerk nach Muster in Kopf- und Fusszeilen, in Folienfüssen, an den Seitenrändern jeder PDF-Seite und am Anfang des Dokuments. Einen Vermerk an anderer Stelle, in einem Bild oder in abweichender Schreibweise erkennt es nicht; ein solches Dokument lädt die Webseite ohne Rückfrage.
- Anleitung in Lectora, `README.md` und `docs/datenschutz.md` erklären den Grund: GitHub liefert den Programmcode der Webseite bei jedem Aufruf neu aus, eine gespeicherte Datei ändert sich dagegen nicht unbemerkt.

## 2.0.0 – 2026-11-18

Erste Ausgabe aus dem öffentlichen Repository. Sie fasst die bisherige Entwicklung zusammen.

### Prüfen

- Über 50 lokale Kriterien in sechs Gruppen: formale Vollständigkeit, Aufbau, Sprache, Schreibweisen und Typografie, Verweise, Dokumenttechnik und Barrierefreiheit. Die Regeln laufen im Browser, ohne Datenübertragung.
- Dokumentansicht mit Randspalte: Vorschläge annehmen oder ablehnen wie in Word, Übersicht der Befunde am Rand, Übergänge bei Entscheiden, Tastenkürzel mit Übersicht (abschaltbar).
- Listenansicht mit Filtern nach Schweregrad und Kategorie.
- Nachprüfung einer neuen Fassung: erledigte, gebliebene und neue Befunde; Entscheide und Notizen gehen mit.
- «Fehlalarm melden» je Befund und Rückmeldung zu den Regeln als Datei (Textstellen nur auf ausdrücklichen Wunsch).
- Modalverben (Pflicht, Verbot, Erlaubnis, Empfehlung) in drei Sprachen, auch in der Anrede («vous», «voi») und in Fragen; Abkürzungen von Bundeserlassen gegen eine Tabelle von 61 Erlassen nach Fedlex, mit Hinweis auf abgelöste Abkürzungen (AuG, LEtr, LStr). Ein Sprachkorpus aus Satzpaaren misst Präzision und Trefferquote dieser Prüfungen.

### Sprachfassungen

- Vergleich zweier Fassungen Absatz für Absatz mit lokalen Prüfungen (fehlende Absätze, Zahlen, Daten, Verweise, Modalverben, Erlasse).
- Synopse dreier Fassungen (Deutsch, Französisch, Italienisch).
- Hinweis statt Befunden, wenn zwei Dokumente einander offensichtlich nicht entsprechen.

### Export

- Word mit Änderungsverfolgung oder als bereinigte Fassung; Layout und Formatierung des Originals bleiben erhalten.
- Prüfbericht als Word-Dokument.
- PDF und PowerPoint mit Kommentaren: eine Kopie, in der jeder Befund als Anmerkung bzw. Kommentar steht.

### KI-Funktionen (nur Artefakt-Ausgabe auf claude.ai)

- KI-Prüfung der inhaltlichen Qualität, Bedeutungsvergleich, Formulierungsvorschlag je Befund, Rückübersetzung im Sprachvergleich, Pflichtenmatrix mit Abgleich der Fassungen.
- Jede Funktion startet nur auf ausdrücklichen Klick und zeigt vorher, was an Claude geht, auch eigene Kriterien und die Obergrenze langer Dokumente.
- Dokumente mit dem Vermerk VERTRAULICH oder GEHEIM (und den Entsprechungen) gehen nie an Claude; bei INTERN fragt Lectora eigens nach. Die Erkennung prüft Kopf- und Fusszeilen, Folienfüsse und die Ränder jeder PDF-Seite.
- Jeder Vorschlag von Claude besteht eine Prüfung der Tatsachen und der Bedeutung (Zahlen mit Einheiten, Daten, Fristen und ihre Richtung, Verneinungen, Verbindlichkeit) oder bleibt ein Hinweis. «Alle annehmen» übergeht Vorschläge von Claude.
- Exporte kennzeichnen Befunde von Claude; angenommene Formulierungen von Claude erscheinen in Word unter einem eigenen Autor «<Name> (KI-Vorschlag)» mit einem Kommentar zur Herkunft.

### Einstellungen

- Kriterienkatalog mit Prüfparametern (zum Beispiel Satz- und Absatzlänge), Begriffsliste, eigene Erlasse und eigene KI-Kriterien.
- Prüfprofil als Datei: speichern, laden, mit Rückfrage vor dem Übernehmen.
- Drei Standardprofile der Sektion: «SGG Weisung», «SGG Konzept», «SGG Aktennotiz» (Startwerte).

### Ausgaben

- Offline-Ausgabe als eine HTML-Datei: läuft ohne Installation, ohne Konto und ohne Internet.
- Beim Start fragt die Offline-Ausgabe auf GitHub Pages die neuste Versionsnummer ab und zeigt bei einer neueren Version «Neue Version herunterladen». Keine Dokumentdaten; eine Ausgabe ohne diese Abfrage lässt sich bauen.
- Unlesbare oder leere Dateien prüft Lectora nicht, statt sie als bestanden anzuzeigen. Wer die Seite verlässt und mit «Zurück» wiederkommt, findet keine Dokumente mehr vor.
- Lectora als Webseite auf GitHub Pages, immer in der neusten Version, mit «Als Datei speichern».

### Oberfläche

- Deutsch, Französisch und Italienisch.
- Design System «Carbon» mit IBM Plex; geprüft nach WCAG 2.1 AA (axe-core, Kontraste) bei 1440, 1056, 840 und 375 Pixel Breite.

### Repository

- Tests laufen überall: Browser aus Playwright, eigene Prüfung der Office-Exporte mit Rundlauf durch LibreOffice, python-docx und python-pptx.
- GitHub Actions: Prüfungen bei jedem Push, Veröffentlichung bei einem Versions-Tag auf `main`, Zurückrollen der Webseite von Hand, monatlicher Abgleich der Erlasstabelle mit Fedlex; Aktionen per Commit festgelegt, Dependabot.
- Hygiene der Dateien und Commits; Einstellungen des Repositorys in `docs/repo-einstellungen.md`.
