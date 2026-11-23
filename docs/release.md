# Neue Version veröffentlichen

Diese Anleitung führt dich durch eine Veröffentlichung, ganz im Browser. Du brauchst weder git noch eine Kommandozeile.

## Überblick

Eine Veröffentlichung (englisch «Release») macht eine neue Version von Lectora für alle verfügbar:

- als Datei `Lectora.html` zum Herunterladen,
- als Webseite unter `https://sem-sgg.github.io/lectora/`,
- als Hinweis «Neue Version … verfügbar» in allen älteren Kopien, die jemand mit Internet öffnet.

Das meiste erledigt GitHub selbst. Es prüft die Version, baut die Datei, testet alles noch einmal und veröffentlicht erst dann. Das dauert jedes Mal etwa eine halbe bis eine ganze Stunde.

Du tust drei Dinge:

1. **Version vorbereiten:** In drei Dateien die neue Nummer und einen kurzen Text eintragen, alles in einem Pull Request.
2. **Pull Request zusammenführen,** sobald die Prüfungen grün sind.
3. **Veröffentlichung starten:** im Bereich «Actions» auf einen Knopf drücken und die Nummer eingeben.

Danach siehst du nach, ob alles angekommen ist. Zum Schluss aktualisierst du die Fassung mit KI auf claude.ai (das «Artefakt»).

**Voraussetzungen:**

- Du hast ein Konto bei GitHub und Schreibrecht im Repository `SEM-SGG/lectora`.
- Eine Person mit der Rolle «Admin» hat die Einstellungen aus [repo-einstellungen.md](repo-einstellungen.md) einmal gesetzt. Wenn nicht, scheitert der letzte Teil der Veröffentlichung (siehe [Wenn etwas schiefgeht](#wenn-etwas-schiefgeht)).
- Für das Zusammenführen braucht es eine zweite Person, die den Pull Request freigibt.

Knöpfe, Reiter, Menüs und Felder von GitHub stehen in **Fettschrift**, mit dem englischen Wort, das auf dem Bildschirm steht. Bezeichnungen mit ¹ stehen nicht in der Hilfe von GitHub; auf dem Bildschirm können sie leicht anders lauten.

### Wörter, die hier vorkommen

| Wort | Bedeutung |
| --- | --- |
| Repository | Der Ordner bei GitHub mit allen Dateien von Lectora und ihrer ganzen Geschichte: `github.com/SEM-SGG/lectora`. |
| Commit | Eine gespeicherte Änderung an einer oder mehreren Dateien, mit einem kurzen Satz dazu. |
| Branch (Zweig) | Eine eigene Arbeitskopie des Repositorys. Was du dort änderst, wirkt nicht sofort für alle. |
| `main` | Der Hauptzweig. Nur was hier steht, wird veröffentlicht. |
| Pull Request | Ein Antrag, die Änderungen eines Zweigs in `main` zu übernehmen. GitHub prüft sie, eine zweite Person gibt sie frei. |
| Workflow, Actions | Ein Ablauf, den GitHub selbst ausführt. Alle Abläufe findest du im Bereich **Actions**. Jede Ausführung heisst Lauf. |
| Prüfungen | Automatische Tests, die GitHub bei jedem Pull Request ausführt (Workflow `checks`). |
| Tag | Ein fester Name für einen bestimmten Stand, zum Beispiel `v2.0.1`. Der Workflow setzt ihn selbst. |
| Release | Die Seite bei GitHub mit den Dateien einer Version zum Herunterladen. |
| GitHub Pages | Die Webseite von Lectora: `https://sem-sgg.github.io/lectora/`. |

## Versionsnummer wählen

Eine Versionsnummer hat drei Zahlen: **X.Y.Z**, zum Beispiel 2.0.1. Erhöhe genau eine davon:

- **Z** (Korrektur): Fehler behoben, Texte korrigiert, Erlasstabelle aktualisiert. Aus 2.0.0 wird 2.0.1.
- **Y** (Nebenversion): neue Kriterien, neue Funktionen, andere Startwerte der Standardprofile. Aus 2.0.1 wird 2.1.0.
- **X** (Hauptversion): Alte Prüfprofile oder Rückmeldedateien passen nicht mehr, oder Bedienung und Ergebnisse ändern sich grundlegend. Aus 2.1.0 wird 3.0.0.

Eine Nummer, für die schon ein Tag oder ein Release besteht, verwendest du nie noch einmal. Scheitert ein Lauf, bevor er den Tag gesetzt hat, ist die Nummer noch frei. Der Workflow sagt dir, wenn sie es nicht ist.

Die aktuelle Nummer findest du auf der Startseite des Repositorys in der rechten Spalte unter **Releases**¹.

## Schritt 1: Version vorbereiten

Die Versionsnummer steht in drei Dateien. Alle drei müssen dieselbe Nummer tragen:

| Datei | Was du änderst |
| --- | --- |
| `package.json` | eine Zeile: die Nummer |
| `version.json` | Nummer, Datum und ein kurzer Hinweis in drei Sprachen |
| `CHANGELOG.md` | ein neuer Abschnitt zuoberst: was neu ist |

Die Datei `package-lock.json` nennt die Nummer auch. **Lass sie unverändert.** Nichts hängt davon ab, und sie enthält viele ähnliche Zeilen, die du nicht ändern darfst.

Vergisst du eine Datei, merkt GitHub das im Pull Request und nennt die Datei (siehe Schritt 2).

Im Beispiel wird aus Version 2.0.0 die Version 2.0.1, veröffentlicht am 1. Dezember 2026. Setze deine eigene Nummer und dein Datum ein.

### 1a. package.json ändern und den Pull Request eröffnen

1. Öffne `https://github.com/SEM-SGG/lectora`.
2. Klicke in der Liste der Dateien auf `package.json`.
3. Klicke oben rechts über dem Dateiinhalt auf das Bleistift-Symbol. Der Inhalt wird bearbeitbar.
4. Ändere in Zeile 3 nur die Zahl:
   ```
     "version": "2.0.0",
   ```
   wird zu
   ```
     "version": "2.0.1",
   ```
   Lass die Anführungszeichen und das Komma am Ende stehen.
5. Klicke oben rechts auf den grünen Knopf **Commit changes...**. Ein Fenster öffnet sich.
6. Schreibe bei **Commit message**¹ «Version 2.0.1 vorbereiten».
7. Wähle **Create a new branch for this commit and start a pull request**¹. Gib als Name des Zweigs `version-2.0.1` ein.
   Steht im Fenster, dass du nicht direkt auf `main` speichern darfst, ist das richtig so.
8. Klicke **Propose changes**. Es erscheint die Seite **Open a pull request**¹.
9. Schreibe als Titel «Version 2.0.1». Schreibe in die Beschreibung in einem Satz, was sich für die Nutzerinnen und Nutzer ändert.
10. Klicke unten rechts auf **Create pull request**.

**So sieht es aus, wenn es geklappt hat:** Der Pull Request hat eine eigene Seite mit einer Nummer, zum Beispiel «#12». Unten auf der Seite laufen schon Prüfungen. Sie scheitern, bis alle drei Dateien geändert sind. Das ist in diesem Moment normal.

**Wenn es nicht klappt:** Fehlt im Fenster die Wahl eines neuen Zweigs, bist du schon auf einem anderen Zweig. Prüfe oben links das Menü **Branch**: Dort muss `main` stehen.

### 1b. version.json ändern, im selben Zweig

1. Klicke oben auf den Reiter **Code**¹.
2. Klicke oben links über der Dateiliste auf das Menü **Branch** (dort steht noch `main`). Wähle `version-2.0.1`.
3. Klicke auf `version.json` und dann auf das Bleistift-Symbol.
4. Ersetze den ganzen Inhalt. So sieht er für das Beispiel aus:
   ```json
   {
     "version": "2.0.1",
     "date": "2026-12-01",
     "note": {
       "de": "Korrektur: Die Prüfung von Fristen meldet weniger Fehlalarme.",
       "fr": "Correction : le contrôle des délais signale moins de fausses alertes.",
       "it": "Correzione: il controllo dei termini segnala meno falsi allarmi."
     }
   }
   ```
   - `version`: die neue Nummer.
   - `date`: der geplante Tag der Veröffentlichung, in der Form JJJJ-MM-TT. Er muss nicht genau stimmen, aber in `version.json` und `CHANGELOG.md` gleich sein.
   - `note`: der Hinweis, den ältere Kopien von Lectora anzeigen, auf Deutsch (`de`), Französisch (`fr`) und Italienisch (`it`).
5. Klicke **Commit changes...**. Wähle im Fenster **Commit directly to the `version-2.0.1` branch**¹. Klicke **Commit changes**.

**Regeln für den Hinweis.** Ältere Kopien von Lectora prüfen ihn streng. Verletzt ein Hinweis eine Regel, zeigen sie **gar keinen** Hinweis.

- Je Sprache ein kurzer Satz, höchstens 200 Zeichen, auf einer Zeile.
- Keine Adressen: nichts mit `://`, `www.` oder `@`, und kein Wort mit Punkt wie `beispiel.ch`. Auch ein Dateiname wie `Lectora.html` zählt als Adresse.
- Keine Zeichen `<` und `>`.
- Keine geraden Anführungszeichen `"` im Text. Verwende «…».
- Lass die Anführungszeichen um jeden Text, die Doppelpunkte und die Kommas am Zeilenende genau so stehen wie im Beispiel.

**Wenn es nicht klappt:** Fragt das Fenster nach einem neuen Zweig, bist du auf `main`. Klicke **Cancel**¹ und wähle zuerst den Zweig `version-2.0.1` (Punkt 2).

### 1c. CHANGELOG.md ergänzen, im selben Zweig

1. Prüfe im Menü **Branch**, dass `version-2.0.1` gewählt ist.
2. Klicke auf `CHANGELOG.md` und dann auf das Bleistift-Symbol.
3. Füge unter dem Einleitungssatz und über der Überschrift der bisherigen Version einen neuen Abschnitt ein:
   ```
   ## 2.0.1 – 2026-12-01

   ### Behoben

   - Die Prüfung von Fristen meldet weniger Fehlalarme.

   ## 2.0.0 – 2026-11-18
   ```
   Die letzte Zeile ist die Überschrift der bisherigen Version. Sie steht schon da; du fügst nur die Zeilen darüber ein.
4. Klicke **Commit changes...**, wähle **Commit directly to the `version-2.0.1` branch**¹ und klicke **Commit changes**.

**Regeln für den Abschnitt:**

- Die Überschrift hat genau die Form `## 2.0.1 – 2026-12-01`: zwei `#`, Nummer, Strich, Datum. Der Strich darf `–` oder `-` sein.
- Das Datum ist dasselbe wie in `version.json`.
- Darunter steht mindestens ein Satz. Dieser Text erscheint später auf der Seite des Release.
- Schreibe für die Nutzerinnen und Nutzer: was neu ist, was sich ändert, was behoben ist. Kein Text aus echten Dokumenten.

**So sieht es aus, wenn alles geklappt hat:** Öffne den Pull Request (Reiter **Pull requests**, dann «Version 2.0.1»). Im Reiter **Files changed**¹ stehen genau drei Dateien: `package.json`, `version.json` und `CHANGELOG.md`.

## Schritt 2: Prüfungen abwarten und zusammenführen

Nach jeder Änderung prüft GitHub den Pull Request von Neuem. Das dauert etwa eine halbe bis eine Stunde.

1. Öffne den Pull Request.
2. Sieh unten auf der Seite nach. Dort stehen die Prüfungen «Logik, Export, Hygiene» und «Oberfläche, Barrierefreiheit, Offline-Ausgabe».
3. Warte, bis beide einen grünen Haken haben.
4. Bitte eine zweite Person mit Schreibrecht, den Pull Request freizugeben. Sie öffnet ihn, prüft die drei Dateien und gibt ihn frei.
5. Klicke unten auf **Merge pull request** und dann auf **Confirm merge**.
6. Klicke danach auf **Delete branch**¹. Der Zweig wird nicht mehr gebraucht.

**So sieht es aus, wenn es geklappt hat:** Oben auf der Seite steht **Merged**¹ in Violett. Die Änderungen sind jetzt auf `main`. Veröffentlicht ist noch nichts.

**Wenn eine Prüfung scheitert (rotes Kreuz):** Klicke neben der Prüfung auf **Details**¹. Die Meldung steht oben auf der Seite des Laufs, meist im ersten Schritt «Versionsnummern stimmen überein». Die häufigsten Meldungen:

| Meldung (Beispiel) | Ursache und Abhilfe |
| --- | --- |
| «version.json nennt die Version 2.0.0, erwartet ist 2.0.1. Ändere dort die Zeile …» | Eine Datei ist vergessen. Ändere die genannte Datei im Zweig `version-2.0.1` (Schritt 1b oder 1c). |
| «package.json nennt noch die Version 2.0.0, version.json und CHANGELOG.md schon 2.0.1. Hast du package.json vergessen? …» | Wie oben, für `package.json` (Schritt 1a, aber mit **Commit directly to the `version-2.0.1` branch**¹). |
| «CHANGELOG.md: Der oberste Eintrag nennt die Version 2.0.0, erwartet ist 2.0.1. …» | Der neue Abschnitt fehlt oder steht nicht zuoberst. |
| «CHANGELOG.md: Die oberste Überschrift «…» hat nicht die Form «## 2.0.1 – JJJJ-MM-TT». …» | Die Überschrift ist falsch geschrieben. Korrigiere sie. |
| «CHANGELOG.md nennt das Datum …, version.json das Datum …» | Trage in beiden Dateien dasselbe Datum ein. |
| «version.json ist nach der Änderung kein gültiges JSON mehr (Zeile 4, Spalte 3). …» | JSON ist das Format dieser Datei; ein einziges falsches Zeichen macht sie unlesbar. Meist fehlt ein Komma am Zeilenende oder ein Anführungszeichen. Vergleiche Zeichen für Zeichen mit dem Beispiel in Schritt 1b. |
| «version.json: Der Hinweis auf Französisch enthält etwas, das wie eine Adresse aussieht …» | Entferne die Adresse oder den Dateinamen aus dem Hinweis. |
| «version.json: Der Hinweis auf Italienisch hat 230 Zeichen, erlaubt sind 200. …» | Kürze den Hinweis. |

Jede Korrektur machst du wie in Schritt 1b: Zweig `version-2.0.1` wählen, Datei bearbeiten, **Commit directly to the `version-2.0.1` branch**¹. Die Prüfungen starten danach von selbst neu.

**Wenn ein Test scheitert, der mit deinen Dateien nichts zu tun hat:** Manchmal scheitert ein Test zufällig, zum Beispiel an einem Zeitlimit in `a11y_test.py`. Klicke auf **Details**¹, dann oben rechts auf **Re-run jobs** und **Re-run failed jobs**. Scheitert er wieder, frag eine Entwicklerin oder einen Entwickler.

## Schritt 3: Veröffentlichung starten

1. Öffne das Repository und klicke oben auf **Actions**.
2. Klicke links in der Liste der Workflows auf **release**.
3. Klicke rechts über der Liste der Läufe auf **Run workflow**. Ein kleines Fenster öffnet sich.
4. Lass im Menü **Branch** den Zweig `main` stehen.
5. Gib im Feld «Version ohne «v», zum Beispiel 2.1.0 …» die neue Nummer ein: `2.0.1`. Ohne «v», ohne Leerzeichen.
6. Klicke auf den grünen Knopf **Run workflow**.

Nach einigen Sekunden erscheint oben in der Liste ein neuer Lauf. Lädt die Seite nicht von selbst neu, lade sie neu. Klicke auf den Lauf. Er hat drei Teile, die nacheinander laufen:

1. **Prüfen und bauen** (der längste Teil, etwa eine halbe bis eine Stunde),
2. **GitHub Release** (eine Minute),
3. **GitHub Pages** (wenige Minuten).

Du kannst die Seite schliessen. Der Lauf geht weiter.

**So sieht es aus, wenn es geklappt hat:** Alle drei Teile haben einen grünen Haken. Unter «GitHub Pages» steht die Adresse der Webseite.

Es läuft nie mehr als eine Veröffentlichung gleichzeitig. Startest du eine zweite, wartet sie, bis die erste fertig ist. Starte nicht noch eine dritte: GitHub lässt nur einen Lauf warten und bricht den älteren wartenden ab.

**Wenn es nicht klappt:** Der Lauf bricht ab und zeigt oben auf seiner Seite eine Meldung. Solange «Prüfen und bauen» nicht grün ist, ist nichts veröffentlicht.

| Meldung (Beispiel) | Ursache und Abhilfe |
| --- | --- |
| «Du hast den Workflow vom Zweig «version-2.0.1» gestartet. Veröffentlicht wird nur von main. …» | Im Menü **Branch** war nicht `main` gewählt. Starte neu mit `main`. |
| «Gib die Version ohne «v» ein, zum Beispiel 2.1.0 statt v2.1.0.» | Starte neu und lass das «v» weg. |
| «Die Version «2.1» hat nicht die Form X.Y.Z. …» | Gib drei Zahlen mit zwei Punkten ein. |
| «Du hast 2.0.2 eingegeben, aber package.json, version.json und CHANGELOG.md nennen alle 2.0.1. Hast du dich vertippt? …» | Starte neu mit der Nummer aus den Dateien. |
| «package.json nennt die Version 2.0.0, erwartet ist 2.0.1. …» (oder dieselbe Meldung für eine andere Datei) | Der Pull Request ist noch nicht zusammengeführt, oder eine Datei fehlt darin. Zurück zu Schritt 1 oder 2. |
| «Für die Version 2.0.1 besteht schon ein Release v2.0.1. Erhöhe die Version in einem Pull Request …» | Diese Nummer ist schon veröffentlicht. Nimm die nächste Nummer, zum Beispiel 2.0.2, und beginne bei Schritt 1. |
| «Der Tag v2.0.1 besteht schon und zeigt auf den Commit …, nicht auf den Stand von main …» | Die Nummer ist schon vergeben, für einen anderen Stand. Nimm die nächste Nummer und beginne bei Schritt 1. |
| «Der Tag v2.0.1 liess sich nicht anlegen: … Verhindert ein Ruleset für Tags v* das Anlegen, …» | Eine Einstellung fehlt. Bitte eine Person mit der Rolle «Admin», sie zu setzen ([repo-einstellungen.md](repo-einstellungen.md), «Ruleset für Tags»). Danach **Re-run jobs** → **Re-run failed jobs**. Die Tests laufen dabei nicht noch einmal. |
| Ein Test scheitert in «Prüfen und bauen». | War es ein zufälliger Fehler (zum Beispiel ein Zeitlimit), wähle oben rechts **Re-run jobs** → **Re-run failed jobs**. Sonst frag eine Entwicklerin oder einen Entwickler. |
| «GitHub Pages» scheitert, «GitHub Release» ist grün. | Meist ist GitHub Pages nicht eingeschaltet, oder die Umgebung `github-pages` lässt `main` nicht zu. Die Meldung endet dann oft mit «… is not allowed to deploy to github-pages due to environment protection rules». Bitte eine Person mit der Rolle «Admin», die Einstellung zu setzen ([repo-einstellungen.md](repo-einstellungen.md)). Danach holst du die Webseite mit dem Workflow `pages` nach: [GitHub Pages nachholen, wenn das Release schon besteht](#github-pages-nachholen-wenn-das-release-schon-besteht). |
| «GitHub Pages» scheitert mit «No artifacts named "github-pages-1" were found for this workflow run» (statt 1 steht die Nummer des Versuchs), «GitHub Release» ist grün. | Das Release ist veröffentlicht, nur die Webseite fehlt. Wähle oben rechts **Re-run jobs** → **Re-run failed jobs**. Scheitert auch das, hole die Webseite mit dem Workflow `pages` nach: [GitHub Pages nachholen, wenn das Release schon besteht](#github-pages-nachholen-wenn-das-release-schon-besteht). |

## Schritt 4: Ergebnis prüfen

1. **Release:** Öffne die Startseite des Repositorys. Klicke rechts unter **Releases**¹ auf «Lectora 2.0.1». Dort stehen drei Dateien: `Lectora.html`, `Lectora-2.0.1.html` und `SHA256SUMS.txt`. Darüber steht dein Text aus `CHANGELOG.md`.
2. **Datei:** Lade `Lectora.html` herunter und öffne sie mit einem Doppelklick. Oben steht «Offline-Ausgabe 2.0.1».
3. **Webseite:** Öffne nach einigen Minuten `https://sem-sgg.github.io/lectora/`. Oben steht dieselbe Nummer. Zeigt sie noch die alte, warte zehn Minuten und lade die Seite neu. Die Adresse `https://sem-sgg.github.io/lectora/version.json` zeigt die neue Nummer und deinen Hinweis.
4. **Hinweis in alten Kopien:** Öffne eine ältere `Lectora.html` auf einem Computer mit Internet. Oben erscheint «Neue Version 2.0.1 verfügbar.» mit deinem Hinweis und dem Knopf «Neue Version herunterladen».

Erscheint der Hinweis nicht, obwohl die Webseite die neue Nummer zeigt: Prüfe den Hinweis in `version.json` gegen die Regeln in Schritt 1b.

Wer die Prüfsumme kontrollieren will, lädt `Lectora.html` und `SHA256SUMS.txt` in denselben Ordner und vergleicht. Unter Windows in PowerShell: `Get-FileHash Lectora.html -Algorithm SHA256`, dann mit der Zeile in `SHA256SUMS.txt` vergleichen. Unter macOS: `shasum -a 256 --ignore-missing -c SHA256SUMS.txt`. Die Prüfsumme erkennt einen beschädigten Download.

## Schritt 5: Artefakt auf claude.ai aktualisieren

Die Artefakt-Ausgabe mit den KI-Funktionen aktualisiert sich nicht von selbst. Folge [artefakt-erstellen.md](artefakt-erstellen.md), Abschnitt «Eine neue Version veröffentlichen».

## Release in zehn Schritten

Für alle, die den Ablauf kennen:

- [ ] 1. Nummer wählen (X, Y oder Z um eins höher; nie zweimal dieselbe).
- [ ] 2. `package.json` bearbeiten, Nummer ändern, neuer Zweig `version-X.Y.Z`, **Create pull request**.
- [ ] 3. Im Zweig `version-X.Y.Z`: `version.json` (Nummer, Datum, Hinweis de/fr/it, ohne Adressen).
- [ ] 4. Im Zweig `version-X.Y.Z`: `CHANGELOG.md`, neuer Abschnitt zuoberst `## X.Y.Z – JJJJ-MM-TT`, gleiches Datum.
- [ ] 5. Im Pull Request: genau drei Dateien geändert; beide Prüfungen grün.
- [ ] 6. Freigabe durch eine zweite Person; **Merge pull request** → **Confirm merge**.
- [ ] 7. **Actions** → **release** → **Run workflow** → **Branch**: `main` → Version `X.Y.Z` → **Run workflow**.
- [ ] 8. Lauf: drei grüne Haken (Prüfen und bauen, GitHub Release, GitHub Pages).
- [ ] 9. Release mit drei Dateien; Webseite und `version.json` zeigen die neue Nummer; eine alte Kopie zeigt den Hinweis.
- [ ] 10. Artefakt auf claude.ai aktualisieren ([artefakt-erstellen.md](artefakt-erstellen.md)).

## Wenn etwas schiefgeht

### Einen Lauf wiederholen

Wähle auf der Seite des Laufs oben rechts **Re-run jobs** → **Re-run failed jobs**. Dann laufen nur die gescheiterten Teile noch einmal, mit denselben geprüften Dateien. Das geht bis 30 Tage nach dem Start.

- Ist «GitHub Release» schon grün, wiederholt GitHub nur «GitHub Pages». Scheitert auch die Wiederholung, hilft der Workflow `pages`: [GitHub Pages nachholen, wenn das Release schon besteht](#github-pages-nachholen-wenn-das-release-schon-besteht).
- Hat ein früherer Versuch den Tag oder das Release schon angelegt, macht der Lauf dort weiter. Er legt nichts doppelt an.

Nimm wenn möglich **Re-run failed jobs**, nicht **Re-run all jobs**. Bei **Re-run all jobs** baut und testet GitHub alles noch einmal. Das dauert wieder bis zu einer Stunde. Besteht das Release schon, muss die neu gebaute Datei genau gleich sein; sonst bricht der Lauf ab, ohne etwas zu ändern.

Meldet der Lauf «Das Release v2.0.1 besteht schon, aber als Entwurf oder mit anderen bzw. unvollständigen Dateien. …», ist ein früherer Versuch mitten im Hochladen abgebrochen. Öffne **Releases**¹ und die Version. Lösche das Release mit dem Papierkorb-Symbol¹ (den Tag nicht). Wähle dann beim Lauf **Re-run jobs** → **Re-run failed jobs**.

### GitHub Pages nachholen, wenn das Release schon besteht

**Woran du den Fall erkennst:** Im Lauf des Workflows `release` haben «Prüfen und bauen» und «GitHub Release» einen grünen Haken, «GitHub Pages» ein rotes Kreuz. Im Schritt mit `actions/deploy-pages` steht meist diese Meldung:

«No artifacts named "github-pages-1" were found for this workflow run» (statt 1 steht die Nummer des Versuchs). Sie kann erscheinen, obwohl der Schritt davor (`actions/upload-pages-artifact`) die Webseite hochgeladen hat. `actions/deploy-pages` sucht die Webseite in der Liste der Dateien des Laufs, und dort fehlt sie unmittelbar nach dem Hochladen manchmal noch. Das ist ein bekannter Fehler bei GitHub ([actions/deploy-pages#451](https://github.com/actions/deploy-pages/issues/451)). Der Workflow wartet deshalb 30 Sekunden, bevor er die Webseite bereitstellt. Das macht den Fehler seltener, schliesst ihn aber nicht aus.

**Zuerst wiederholen:** Wähle auf der Seite des Laufs oben rechts **Re-run jobs** → **Re-run failed jobs**. GitHub wiederholt nur «GitHub Pages». Jeder Versuch lädt die Webseite unter einem eigenen Namen hoch (`github-pages-2` beim zweiten Versuch); die Webseite eines früheren Versuchs stört deshalb nicht. Ist der Lauf danach grün, mach mit [Schritt 4](#schritt-4-ergebnis-prüfen) weiter. Scheitert auch die Wiederholung, hole die Webseite wie unten beschrieben mit dem Workflow `pages` nach.

**Was schon veröffentlicht ist:** der Tag `vX.Y.Z` und das Release mit `Lectora.html`, `Lectora-X.Y.Z.html` und `SHA256SUMS.txt`. Wer die Datei herunterlädt, bekommt die neue Version.

**Was noch fehlt:** Die Webseite `https://sem-sgg.github.io/lectora/` zeigt noch die alte Version, und `https://sem-sgg.github.io/lectora/version.json` nennt noch die alte Nummer. Ältere Kopien zeigen deshalb noch keinen Hinweis auf die neue Version.

**Was du nicht tust:** Starte keinen neuen Lauf des Workflows `release` (**Run workflow**), und nimm keine neue Nummer. Die Nummer ist vergeben, und der Workflow `release` lehnt sie ab, weil Tag und Release schon bestehen.

**Wenn die Wiederholung nicht hilft, holst du die Webseite so nach, im Browser:**

1. Öffne das Repository und klicke oben auf **Actions**.
2. Klicke links in der Liste der Workflows auf **pages**.
3. Klicke rechts über der Liste der Läufe auf **Run workflow**.
4. Lass im Menü **Branch** den Zweig `main` stehen.
5. Gib im Feld «Tag einer veröffentlichten Version, z. B. v2.0.0» den Tag der neuen Version ein, **mit** «v», zum Beispiel `v2.0.1`.
6. Klicke auf den grünen Knopf **Run workflow**.

**Oder als Befehl** mit der Kommandozeile von GitHub (`gh`, angemeldet mit Schreibrecht):

```sh
gh workflow run pages.yml --ref main -f tag=v2.0.1
```

Der Workflow `pages` nimmt `Lectora.html` aus dem Release des Tags, prüft die Prüfsumme aus `SHA256SUMS.txt` und legt die Datei mit der `version.json` dieses Tags auf die Webseite. Er tut das in einem eigenen, neuen Lauf mit nur einem hochgeladenen Exemplar der Webseite.

**So sieht es aus, wenn es geklappt hat:** Der Lauf «GitHub Pages auf eine bestehende Version» hat einen grünen Haken. Die Webseite `https://sem-sgg.github.io/lectora/` zeigt oben die neue Nummer, und `https://sem-sgg.github.io/lectora/version.json` nennt sie (warte bei Bedarf zehn Minuten und lade neu). Mach danach mit [Schritt 4](#schritt-4-ergebnis-prüfen) weiter.

### Zurückrollen: eine fehlerhafte Version zurücknehmen

1. **Sofort: Webseite und Hinweis zurück.**
   1. Klicke auf **Actions** und links auf **pages**.
   2. Klicke rechts auf **Run workflow**.
   3. Lass im Menü **Branch** den Zweig `main` stehen.
   4. Gib im Feld «Tag einer veröffentlichten Version, z. B. v2.0.0» den Tag der letzten guten Version ein, **mit** «v», zum Beispiel `v2.0.0`.
   5. Klicke auf den grünen Knopf **Run workflow**.

   Der Workflow nimmt `Lectora.html` aus dem Release dieser Version, prüft die Prüfsumme und legt sie mit ihrer `version.json` auf die Webseite. Danach zeigt die Webseite wieder die gute Version. Kopien, die älter sind als die fehlerhafte, zeigen keinen Hinweis mehr auf sie. Das geht jederzeit, solange das Release besteht.
2. **Release zurückziehen.** Öffne **Releases**¹ und die fehlerhafte Version. Klicke auf das Bleistift-Symbol (Bearbeiten). Setze das Häkchen bei **Set as a pre-release**¹ und speichere mit **Update release**¹. Der Link «neuste Version» zeigt danach wieder auf die vorherige Version. Lösche den Tag nicht.
3. **Korrektur veröffentlichen.** Wer die fehlerhafte Version schon hat, erfährt nur über eine höhere Nummer davon. Behebe den Fehler (oder lass den guten Stand wieder einsetzen) und veröffentliche eine neue Korrekturversion, zum Beispiel 2.0.2, mit einem Hinweis wie «Korrektur: Bitte diese Version verwenden.»

Setze `version.json` im Repository nie allein zurück. Sie muss immer dieselbe Nummer tragen wie `package.json`, sonst scheitern alle Prüfungen.

## Was der Workflow `release` genau tut

Für Interessierte und für die Fehlersuche. Die Datei ist `.github/workflows/release.yml`.

1. **Prüfen und bauen:**
   - Die Eingabe hat die Form X.Y.Z. Beim Start von Hand muss `main` gewählt sein.
   - Der Stand liegt auf `main`.
   - `tools/release_check.py` vergleicht die Nummer mit `package.json`, `version.json` und dem obersten Eintrag in `CHANGELOG.md` und prüft den Hinweis.
   - `tools/release_stand.py` prüft beim Start von Hand: Es gibt noch keinen Tag und kein Release mit dieser Nummer.
   - Erst dann baut er alle Ausgaben und führt alle Tests aus.
2. **GitHub Release:** Beim Start von Hand setzt er jetzt den Tag `vX.Y.Z` auf genau den geprüften Stand. Besteht der Tag inzwischen, bricht er ab, statt einen fremden Tag zu übernehmen. Dann legt er das Release an, mit `Lectora.html`, `Lectora-X.Y.Z.html`, `SHA256SUMS.txt` und dem Text aus `CHANGELOG.md`.
3. **GitHub Pages:** Er legt dieselbe geprüfte Datei als Webseite ab, zusammen mit der `version.json` dieser Version. **Erst jetzt** sehen die verteilten Kopien die neue Version.

Scheitert ein Test, entsteht weder Tag noch Release noch Webseite.

Die Ausgabe ohne Versionsabfrage wird gebaut und getestet, aber nicht veröffentlicht.

## Alternative: über die Kommandozeile

Für alle, die mit git arbeiten. Der Ablauf ist derselbe; statt des Knopfs startet ein Tag den Workflow.

1. Bereite die Version auf einem Zweig vor. `npm version` setzt die Nummer in `package.json` und `package-lock.json`:
   ```sh
   git switch -c version-2.1.0
   npm version 2.1.0 --no-git-tag-version
   ```
   Passe `version.json` und `CHANGELOG.md` an wie in Schritt 1 und prüfe:
   ```sh
   python3 tools/release_check.py --aktuell
   ```
   Die ganzen Tests (`npm test`, rund 20 Minuten, braucht LibreOffice, poppler-utils und qpdf) laufen im Pull Request ohnehin.
2. Öffne einen Pull Request und führe ihn zusammen, wenn `checks` grün ist.
3. Setze den Tag auf den zusammengeführten Stand und schiebe ihn:
   ```sh
   git switch main && git pull
   git tag -a v2.1.0 -m "Lectora 2.1.0"
   git push origin v2.1.0
   ```

Der Tag muss auf einem Commit von `main` liegen; sonst bricht der Workflow ab. Dieser Weg braucht zwei Einstellungen, die der Knopf nicht braucht: Die Umgebung `github-pages` muss Tags `v*` zulassen, und du musst Tags `v*` anlegen dürfen (Ruleset für Tags). Siehe [repo-einstellungen.md](repo-einstellungen.md).

Nimm für eine Version nur einen Weg. Läuft schon ein Lauf von Hand für dieselbe Nummer, bricht einer der beiden ab, ohne etwas zu veröffentlichen.

## Organisation und Repository

Benenne die Organisation `SEM-SGG` und das Repository `lectora` nie um und lösche sie nie; archiviere sie, wenn sie nicht mehr gepflegt werden. Verteilte Ausgaben fragen fest bei `sem-sgg.github.io/lectora` nach und verweisen fest auf `github.com/SEM-SGG/lectora/releases/latest`. Gründe und Vorgehen bei einem Umzug: [repo-einstellungen.md](repo-einstellungen.md#organisation-und-repository-nicht-umbenennen-nicht-löschen).
