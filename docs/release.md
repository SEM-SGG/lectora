# Neue Version veröffentlichen

Eine Version entsteht aus einem Tag `vX.Y.Z` auf einem Commit von `main`. Der Workflow `release` prüft, baut, testet und veröffentlicht. Vor dem ersten Release müssen die Einstellungen in [repo-einstellungen.md](repo-einstellungen.md) gesetzt sein (vor allem: Pages aus GitHub Actions, Umgebung `github-pages` lässt Tags `v*` zu).

## Versionsnummer wählen

- **X** (Hauptversion): Ein Prüfprofil oder eine Rückmeldedatei der alten Version passt nicht mehr, oder Bedienung und Ergebnisse ändern sich grundlegend.
- **Y** (Nebenversion): neue Kriterien, neue Funktionen, geänderte Startwerte der Standardprofile.
- **Z** (Korrektur): Fehler behoben, Texte korrigiert, Erlasstabelle aktualisiert.

Verwende eine Versionsnummer nie zweimal.

## Schritte

1. Arbeite auf einem Zweig, zum Beispiel `release/2.1.0`.
2. Setze die Version in `package.json` und im Lockfile:
   ```sh
   npm version 2.1.0 --no-git-tag-version
   ```
3. Passe `version.json` an: `version`, `date` (Tag der Veröffentlichung, JJJJ-MM-TT) und `note` in de, fr, it. Der Hinweis erscheint bei allen, die eine ältere Offline-Ausgabe öffnen. Halte ihn kurz: höchstens 200 Zeichen, ohne `<` und `>`, **ohne Adressen** (nichts mit `://`, `www.`, einem Hostnamen wie `beispiel.ch` oder `@`). Enthält ein Hinweis so etwas, verwirft jede Offline-Ausgabe die ganze Datei und zeigt nichts.
4. Schreibe den Eintrag zuoberst in `CHANGELOG.md`, mit der Überschrift `## 2.1.0 – JJJJ-MM-TT` (dasselbe Datum wie in `version.json`). Schreibe für die Nutzerinnen und Nutzer: was neu ist, was sich ändert, was behoben ist.
5. Prüfe:
   ```sh
   python3 tools/release_check.py --aktuell
   ```
   Die ganzen Tests (`npm test`, rund 20 Minuten, braucht LibreOffice, poppler-utils und qpdf) laufen im Pull Request ohnehin; lokal sind sie freiwillig.
6. Öffne einen Pull Request, lass die Prüfungen (`checks`) durchlaufen und führe ihn zusammen. Das Zusammenführen allein veröffentlicht nichts: Die Offline-Ausgaben lesen die Versionsdatei auf GitHub Pages, nicht im Repository.
7. Setze den Tag auf den zusammengeführten Stand und schiebe ihn:
   ```sh
   git switch main && git pull
   git tag -a v2.1.0 -m "Lectora 2.1.0"
   git push origin v2.1.0
   ```
   Der Tag muss auf einem Commit von `main` liegen; sonst bricht der Workflow ab. Mit dem Ruleset für Tags dürfen nur die Verantwortlichen Tags `v*` anlegen.

## Was der Workflow `release` tut

1. **Prüfen und bauen:** Der Tag zeigt auf einen Commit von `main` (sonst Abbruch). `tools/release_check.py` vergleicht Tag, `package.json`, `version.json` und den obersten Eintrag in `CHANGELOG.md` und prüft den Hinweis. Stimmt etwas nicht, bricht der Workflow ab, bevor etwas veröffentlicht ist. Dann baut er alle Ausgaben (Stand = Datum des letzten Commits) und führt alle Tests aus.
2. **GitHub Release:** Er legt das Release `vX.Y.Z` an, mit
   - `Lectora.html` (fester Name, für Links auf die neuste Ausgabe),
   - `Lectora-X.Y.Z.html` (dieselbe Datei mit Versionsnummer),
   - `SHA256SUMS.txt` (Prüfsummen beider Dateien),
   - dem Eintrag aus `CHANGELOG.md` als Text.
3. **GitHub Pages:** Er stellt dieselbe Datei als `index.html` und die `version.json` des Tags unter `https://sem-sgg.github.io/lectora/` bereit. **Erst jetzt** sehen die verteilten Offline-Ausgaben die neue Version: Der Hinweis erscheint nie vor dem Release.

Scheitert ein Test, entsteht weder Release noch Seite, und keine Offline-Ausgabe erfährt etwas. War es ein zufälliger Fehler (zum Beispiel ein Zeitlimit im Test `a11y_test.py`), starte den Lauf neu (Actions → Lauf → «Re-run failed jobs»). Sonst behebe den Fehler, setze die Version im nächsten Pull Request um eins höher (der alte Tag bleibt stehen, unveröffentlicht) und beginne bei Schritt 1.

Die Ausgabe ohne Versionsabfrage wird gebaut und getestet, aber nicht veröffentlicht. Die Artefakt-Ausgabe aktualisierst du von Hand (siehe [artefakt-erstellen.md](artefakt-erstellen.md)).

## Ergebnis prüfen

- Actions → `release`: alle drei Aufträge grün.
- Releases → `vX.Y.Z`: drei Dateien, Text aus dem Changelog.
- Prüfsumme: Lade `Lectora.html` und `SHA256SUMS.txt` herunter und prüfe:
  ```sh
  sha256sum --ignore-missing -c SHA256SUMS.txt     # Linux
  shasum -a 256 --ignore-missing -c SHA256SUMS.txt # macOS
  ```
  Unter Windows: `Get-FileHash Lectora.html -Algorithm SHA256` und mit der Zeile in `SHA256SUMS.txt` vergleichen. Die Prüfsumme erkennt einen beschädigten Download; sie stammt aus demselben Workflow wie die Datei.
- Öffne `Lectora.html`: Oben links steht «Offline-Ausgabe X.Y.Z». Die Anleitung zeigt am Schluss dieselbe Version.
- Öffne `https://sem-sgg.github.io/lectora/` (nach einigen Minuten, wegen Zwischenspeichern): dieselbe Version. `https://sem-sgg.github.io/lectora/version.json` zeigt die neue Nummer.
- Öffne eine ältere Offline-Ausgabe mit Internet: Der Hinweis «Neue Version X.Y.Z verfügbar» erscheint.

## Zurückrollen

Ist eine veröffentlichte Version fehlerhaft:

1. **Sofort: Seite und Versionsdatei zurück.** Actions → `pages` → «Run workflow» → Tag der letzten guten Version eingeben (zum Beispiel `v2.0.0`). Der Workflow nimmt `Lectora.html` aus dem Release dieses Tags (mit Prüfung der Prüfsumme) und dessen `version.json`. Danach zeigt die Webseite wieder die gute Version, und Offline-Ausgaben, die älter sind als die fehlerhafte, sehen keinen Hinweis mehr auf diese. Das geht jederzeit, auch Monate später, solange das Release besteht.
2. **Release zurückziehen:** Releases → fehlerhafte Version → Bearbeiten → «Set as a pre-release» (oder löschen). `releases/latest` zeigt dann wieder auf die vorherige Version. Den Tag lässt du stehen.
3. **Korrekturversion veröffentlichen (Z + 1).** Wer die fehlerhafte Version schon hat, erfährt nur durch eine neuere Nummer davon. Behebe den Fehler – oder setze auf einem Zweig den Stand der guten Version wieder ein – und veröffentliche wie oben eine neue Korrekturversion mit einem Hinweis wie «Korrektur: Bitte diese Version verwenden.»

`version.json` im Repository zurückzusetzen hilft nicht und bricht den Build: Sie muss immer dieselbe Version tragen wie `package.json`.

## Organisation und Repository

Benenne die Organisation `SEM-SGG` und das Repository `lectora` nie um und lösche sie nie; archiviere sie, wenn sie nicht mehr gepflegt werden. Verteilte Ausgaben fragen fest bei `sem-sgg.github.io/lectora` nach und verweisen fest auf `github.com/SEM-SGG/lectora/releases/latest`. Gründe und Vorgehen bei einem Umzug: [repo-einstellungen.md](repo-einstellungen.md#organisation-und-repository-nicht-umbenennen-nicht-löschen).
