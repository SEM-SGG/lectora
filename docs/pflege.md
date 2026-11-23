# Lectora pflegen

Diese Anleitung richtet sich an die Fachperson, die Lectora betreut. Du erledigst alles im Browser auf GitHub, ohne Kommandozeile. Für Arbeiten am Code nutzt du einen kopierbaren Auftrag an einen KI-Agenten (zum Beispiel Claude Code im Web mit diesem Repository, also dem Projektordner auf GitHub); der Agent arbeitet nach [AGENTS.md](../AGENTS.md).

Was regelmässig anfällt:

| Was | Wie oft | Anleitung |
| --- | --- | --- |
| Pull Requests von Dependabot prüfen | etwa monatlich | [unten](#pull-requests-von-dependabot) |
| Pull Request für den Abgleich der Erlasstabelle prüfen | monatlich, wenn Fedlex etwas geändert hat | [erlasstabelle.md](erlasstabelle.md#automatisch-jeden-monat) und [unten](#zeitgesteuerter-lauf-übergabe-verspätung-start-von-hand) |
| Neue Version veröffentlichen | nach Bedarf | [release.md](release.md) |
| Artefakt auf claude.ai aktualisieren | nach jeder Version | [artefakt-erstellen.md](artefakt-erstellen.md) |
| Übergabe an eine Nachfolge | einmal | [unten](#zeitgesteuerter-lauf-übergabe-verspätung-start-von-hand), dazu [repo-einstellungen.md](repo-einstellungen.md) |

Knöpfe und Menüs von GitHub stehen in **Fettschrift**, mit dem englischen Wort, das auf dem Bildschirm steht.

## Pull Requests von Dependabot

Dependabot ist ein Dienst von GitHub. Er prüft jeden Monat, ob es neuere Versionen der verwendeten Software-Bausteine gibt, und schlägt jede Aktualisierung als eigenen Pull Request vor (einen Änderungsantrag im Repository). Du findest diese Anträge im Reiter **Pull requests**; als Autor steht dort «dependabot». Der Titel beginnt mit einem dieser Wörter:

- **«Aktionen:»** – ein Baustein für die automatischen Abläufe bei GitHub (Workflows in GitHub Actions), zum Beispiel `actions/checkout`.
- **«pip:»** – ein Werkzeug für die automatischen Tests in Python (Programmiersprache), zum Beispiel `playwright` oder `python-docx`.
- **«npm:»** – ein Paket aus Node.js (JavaScript-Umgebung). `axe-core` dient nur den Tests. JSZip (`jszip`), PDF.js (`pdfjs-dist`) und pdf-lib (`pdf-lib`) sind dagegen in Lectora eingebettet, ebenso die Schriften (`@fontsource/…`) und die Icons (`lucide-static`).

GitHub prüft jeden Pull Request automatisch mit denselben Tests wie jede andere Änderung. Öffne den Pull Request und sieh ganz unten auf der Seite nach: Dort stehen die beiden Prüfungen «Logik, Export, Hygiene» und «Oberfläche, Barrierefreiheit, Offline-Ausgabe». Warte, bis beide abgeschlossen sind (etwa eine halbe bis eine Stunde). Du siehst dann neben jeder Prüfung einen grünen Haken (bestanden) oder ein rotes Kreuz (gescheitert).

So entscheidest du:

| Fall | Was du tust |
| --- | --- |
| **Aktionen** oder **Werkzeuge für Tests** (`pip:`, `npm: … axe-core`), beide Prüfungen grün | Zusammenführen: Bitte eine zweite Person, den Pull Request freizugeben. Klicke danach auf **Merge pull request** und dann auf **Confirm merge**. Oben erscheint **Merged** in Violett. |
| **Eingebettete Bibliothek** (`jszip`, `pdfjs-dist`, `pdf-lib`), Prüfungen rot | Das ist Absicht: Lectora vergleicht jede eingebettete Bibliothek mit einer festen Prüfsumme (SHA-512) in `build.mjs`. Die Artefakt-Ausgabe lädt diese Bibliotheken zudem vom externen Server cdnjs und prüft dieselbe Summe (Integritätsprüfung). Gib den Auftrag unten an einen KI-Agenten. |
| **Ein anderer Pull Request von Dependabot mit roter Prüfung** (zum Beispiel Schriften, Icons, eine Aktion) | Gib denselben Auftrag an einen KI-Agenten. |
| **Hauptversion, die einen Umbau verlangt** (die erste Zahl der Version steigt, zum Beispiel `pdfjs-dist` 3 → 6), und niemand hat den Umbau beauftragt | Nicht zusammenführen. Schreibe unten im Kommentarfeld `@dependabot ignore this major version` und klicke **Comment**. Dependabot schliesst den Pull Request daraufhin selbst (oben erscheint **Closed**) und schlägt diese Hauptversion nicht mehr vor. Für `pdfjs-dist` steht diese Regel schon in `.github/dependabot.yml`. |

Im Zweifel führst du nichts zusammen und gibst den Auftrag an einen KI-Agenten. Ein Update, das liegen bleibt, schadet weniger als eines, das Lectora verändert, ohne dass jemand es geprüft hat.

**Auftrag an einen KI-Agenten** (ersetze `<Nummer>` durch die Nummer des Pull Request ohne `#`, zum Beispiel `12`):

```text
Im Repository SEM-SGG/lectora liegt der Pull Request #<Nummer> von Dependabot. Übernimm das Update nach AGENTS.md und
docs/entwicklung.md (Abschnitt «Bauen»): bei einer eingebetteten Bibliothek den neuen SHA-512-Wert und die Adresse auf
cdnjs in build.mjs eintragen, danach node tools/notices.mjs --write; dann alle Tests (npm test). Ändere sonst nichts.
Verlangt das Update einen Umbau, brich ab und sag mir, was der Umbau umfasst. Lege einen eigenen Pull Request gegen main
an, der #<Nummer> nennt, und sag mir, ob ich #<Nummer> danach schliessen soll.
```

So schliesst du den Vorgang ab, sobald der Agent seinen Pull Request angelegt hat:

1. Warte im Pull Request des Agenten, bis beide Prüfungen einen grünen Haken zeigen, und bitte eine zweite Person um Freigabe.
2. Klicke auf **Merge pull request** und dann auf **Confirm merge**. Oben erscheint **Merged** in Violett.
3. Öffne den ursprünglichen Pull Request von Dependabot und klicke unten auf **Close pull request**, falls er noch offen ist. Oben erscheint **Closed**.

Die Änderung wird erst mit der nächsten Veröffentlichung für alle verfügbar ([release.md](release.md)).

## Zeitgesteuerter Lauf: Übergabe, Verspätung, Start von Hand

Der Workflow «erlasse» startet von selbst am 3. jedes Monats (geplant um 04:23 Uhr UTC). Er gleicht die Erlasstabelle mit Fedlex ab und eröffnet bei Unterschieden einen Pull Request; wie du ihn prüfst, steht in [erlasstabelle.md](erlasstabelle.md#automatisch-jeden-monat). GitHub führt ihn auf das Konto der Person aus, die ihn zuletzt eingerichtet oder wieder eingeschaltet hat. Nur diese Person erhält die Fehlermail. Verlässt sie die Organisation, läuft der Workflow weiter, aber die Fehlermails gehen weiter an sie.

**Bei der Übergabe an eine Nachfolge** (am besten vor dem Austritt der bisherigen Person):

1. Die neue zuständige Person meldet sich mit ihrem eigenen Konto bei GitHub an. Sie braucht Schreibrecht auf das Repository.
2. Unter ihrem Profilbild → **Settings** → **Notifications** → **GitHub Actions** schaltet sie **Email** ein und wählt **Only notify for failed workflows**.
3. Im Repository öffnet sie **Actions** und wählt links den Workflow **erlasse**. Sie klickt rechts auf **…** → **Disable workflow** und gleich danach auf **Enable workflow**. Ab jetzt erhält sie die Fehlermails.

**Wenn der Lauf ausbleibt:** GitHub startet zeitgesteuerte Läufe oft mehrere Stunden zu spät, an manchen Tagen auch gar nicht. Warte bis zum nächsten Morgen. Fehlt der Lauf dann noch, starte ihn von Hand: **Actions** → Workflow **erlasse** wählen → rechts **Run workflow** → Branch `main` lassen → **Run workflow**.

**Was ein Lauf von Hand bewirkt:** Er tut dasselbe wie der zeitgesteuerte Lauf. Er eröffnet keine Issues. Einen zweiten Pull Request eröffnet er nicht: Der Workflow arbeitet immer auf dem Zweig `erlasse/abgleich`; ist der Pull Request eines früheren Laufs noch offen, ersetzt er dessen Inhalt und Beschreibung durch das neue Ergebnis. Was du in diesem Zweig von Hand geändert hast (Schritt 3 in [erlasstabelle.md](erlasstabelle.md#automatisch-jeden-monat)), geht dabei verloren. Starte ihn deshalb von Hand nur, wenn kein Pull Request «Erlasstabelle: Abgleich mit Fedlex» offen ist oder wenn du dessen Änderungen nicht brauchst. Findet der Lauf keine Unterschiede, tut er nichts; ein offener Pull Request bleibt dann, wie er ist. Startest du ihn zweimal kurz nacheinander, wartet der zweite Lauf, bis der erste fertig ist.

**Wenn GitHub den Workflow abgeschaltet hat:** Bei öffentlichen Repositories schaltet GitHub zeitgesteuerte Workflows nach 60 Tagen ohne Aktivität im Repository ab. Zeigt **Actions** einen entsprechenden Hinweis, wähle den Workflow und klicke **Enable workflow**. Wer das tut, erhält ab dann die Fehlermails.

## Produktdokumentation

Die Produktdokumentation (`docs/lectora-dokumentation.html`, im Web unter [sem-sgg.github.io/lectora/dokumentation.html](https://sem-sgg.github.io/lectora/dokumentation.html)) muss zum aktuellen Stand von Lectora passen. Wer eine Funktion, die Oberfläche oder einen Bedienweg ändert, führt sie auf Deutsch, Französisch und Italienisch nach; das verlangt [AGENTS.md](../AGENTS.md#produktdokumentation). Jeder Pull Request nennt in seiner Beschreibung, ob die Dokumentation nachgeführt ist.

Zwei automatische Prüfungen kontrollieren das. Scheitert eine davon (rotes Kreuz bei den Prüfungen → **Details**), nennt ihre Meldung Datei, Fundstelle und Behebung:

- `tools/release_check.py` (erster Schritt der Prüfungen und der Veröffentlichung): prüft die Versionsangaben in der Dokumentation. Erste und zweite Zahl müssen mit `package.json` übereinstimmen. Bei einer Korrekturversion (nur die letzte Zahl steigt) musst du die Dokumentation also nicht ändern; bei einer Neben- oder Hauptversion schon.
- `tools/doku_check.py` (läuft nach dem Bauen): prüft, ob die Zahl der Kriterien, die Zahl der Erlasse und die Dateigrössen zum aktuellen Stand passen.

Die Datei ist zu gross, um sie im Browser zu bearbeiten. Meldet eine der Prüfungen eine Abweichung, kopierst du die Meldung und gibst sie mit diesem Auftrag an einen KI-Agenten:

```text
Im Repository SEM-SGG/lectora meldet die Prüfung der Produktdokumentation: <Meldung hier einfügen>. Ziehe
docs/lectora-dokumentation.html nach AGENTS.md nach: Versionsangaben, Kennzahlen und betroffene Texte in Deutsch,
Französisch und Italienisch. Lege einen Pull Request gegen main an.
```
