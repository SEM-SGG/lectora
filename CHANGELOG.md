# Änderungen

Jede Version hat einen Eintrag. Die Überschrift hat die Form `## X.Y.Z – JJJJ-MM-TT`; der Workflow `release` übernimmt den obersten Eintrag als Text der Veröffentlichung.

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
