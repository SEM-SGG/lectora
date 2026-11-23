# Lectora pflegen

Diese Anleitung richtet sich an die Fachperson, die Lectora betreut. Alles geht im Browser auf GitHub, ohne Kommandozeile. Was sich nicht im Browser erledigen lässt, gibst du als kopierbaren Auftrag an einen Agenten (zum Beispiel Claude Code im Web mit diesem Repository); der Agent arbeitet nach [AGENTS.md](../AGENTS.md).

Was regelmässig anfällt:

| Was | Wie oft | Anleitung |
| --- | --- | --- |
| Pull Requests von Dependabot prüfen | etwa monatlich | [unten](#pull-requests-von-dependabot) |
| Pull Request des Abgleichs der Erlasstabelle prüfen | monatlich, wenn Fedlex etwas geändert hat | [erlasstabelle.md](erlasstabelle.md#automatisch-jeden-monat) und [unten](#zeitgesteuerter-lauf-übergabe-verspätung-start-von-hand) |
| Neue Version veröffentlichen | nach Bedarf | [release.md](release.md) |
| Artefakt auf claude.ai aktualisieren | nach jeder Version | [artefakt-erstellen.md](artefakt-erstellen.md) |
| Übergabe an eine Nachfolge | einmal | [unten](#zeitgesteuerter-lauf-übergabe-verspätung-start-von-hand), dazu [repo-einstellungen.md](repo-einstellungen.md) |

Knöpfe und Menüs von GitHub stehen in **Fettschrift**, mit dem englischen Wort, das auf dem Bildschirm steht.

## Pull Requests von Dependabot

Dependabot ist ein Dienst von GitHub. Er sieht jeden Monat nach, ob es neuere Versionen der Bausteine gibt, die Lectora verwendet, und schlägt jede als eigenen Pull Request vor. Du findest sie unter **Pull requests**; als Autor steht «dependabot». Der Titel beginnt mit einem dieser Wörter:

- **«Aktionen:»** – ein Baustein der Abläufe bei GitHub (GitHub Actions), zum Beispiel `actions/checkout`.
- **«pip:»** – ein Werkzeug für die Tests in Python, zum Beispiel `playwright` oder `python-docx`.
- **«npm:»** – ein Paket aus Node.js. `axe-core` dient nur den Tests. JSZip (`jszip`), PDF.js (`pdfjs-dist`) und pdf-lib (`pdf-lib`) sind dagegen in Lectora eingebettet, ebenso die Schriften (`@fontsource/…`) und die Icons (`lucide-static`).

GitHub prüft jeden dieser Pull Requests mit denselben Tests wie jede andere Änderung. Unten auf der Seite des Pull Request stehen die Prüfungen «Logik, Export, Hygiene» und «Oberfläche, Barrierefreiheit, Offline-Ausgabe» mit einem grünen Haken oder einem roten Kreuz. Warte, bis beide fertig sind (etwa eine halbe bis eine Stunde).

So entscheidest du:

| Fall | Was du tust |
| --- | --- |
| **Aktionen** oder **Werkzeuge für Tests** (`pip:`, `npm: … axe-core`), beide Prüfungen grün | Zusammenführen: Eine zweite Person gibt den Pull Request frei, dann **Merge pull request** → **Confirm merge**. |
| **Eingebettete Bibliothek** (`jszip`, `pdfjs-dist`, `pdf-lib`), Prüfungen rot | Das ist Absicht: Lectora prüft jede eingebettete Bibliothek gegen einen festen Prüfwert (SHA-512) in `build.mjs`, und die Artefakt-Ausgabe lädt sie mit Integritätsprüfung von cdnjs. Gib den Auftrag unten an einen Agenten. |
| **Ein anderer Pull Request von Dependabot mit roter Prüfung** (zum Beispiel Schriften, Icons, eine Aktion) | Gib denselben Auftrag an einen Agenten. |
| **Hauptversion, die einen Umbau verlangt** (die erste Zahl der Version steigt, zum Beispiel `pdfjs-dist` 3 → 6), und niemand hat den Umbau beauftragt | Schliessen. Schreibe als Kommentar `@dependabot ignore this major version` und klicke **Comment**: Dependabot schliesst den Pull Request selbst und schlägt diese Hauptversion nicht mehr vor. Für `pdfjs-dist` steht diese Regel schon in `.github/dependabot.yml`. |

Im Zweifel führst du nichts zusammen und gibst den Auftrag an einen Agenten. Ein Update, das liegen bleibt, schadet weniger als eines, das Lectora verändert, ohne dass jemand es geprüft hat.

**Auftrag an einen Agenten** (ersetze `<Nummer>` durch die Nummer des Pull Request, zum Beispiel `12`):

```text
Im Repository SEM-SGG/lectora liegt der Pull Request #<Nummer> von Dependabot. Übernimm das Update nach AGENTS.md und
docs/entwicklung.md (Abschnitt «Bauen»): bei einer eingebetteten Bibliothek den neuen SHA-512-Wert und die Adresse auf
cdnjs in build.mjs eintragen, danach node tools/notices.mjs --write; dann alle Tests (npm test). Ändere sonst nichts.
Verlangt das Update einen Umbau, brich ab und sag mir, was der Umbau umfasst. Lege einen eigenen Pull Request gegen main
an, der #<Nummer> nennt, und sag mir, ob ich #<Nummer> danach schliessen soll.
```

Ist der Pull Request des Agenten grün und von einer zweiten Person freigegeben, führst du ihn zusammen und schliesst den Pull Request von Dependabot (**Close pull request**). Die Änderung erscheint mit der nächsten Version ([release.md](release.md)).

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

Die Produktdokumentation (`docs/lectora-dokumentation.html`, im Web unter [sem-sgg.github.io/lectora/dokumentation.html](https://sem-sgg.github.io/lectora/dokumentation.html)) muss zum Stand von Lectora passen. Jede Änderung an Funktion, Oberfläche oder Bedienweg zieht sie in Deutsch, Französisch und Italienisch nach; das verlangt [AGENTS.md](../AGENTS.md#produktdokumentation). Jeder Pull Request sagt in seiner Beschreibung, ob die Dokumentation nachgeführt ist.

Zwei Prüfungen helfen dabei. Scheitert eine, nennt ihre Meldung Datei, Fundstelle und Behebung:

- `tools/release_check.py` (erster Schritt der Prüfungen und der Veröffentlichung): Die Dokumentation nennt die Version. Erste und zweite Zahl müssen der Version in `package.json` entsprechen. Für eine Korrekturversion (nur die letzte Zahl steigt) musst du die Dokumentation also nicht ändern; für eine Neben- oder Hauptversion schon.
- `tools/doku_check.py` (nach dem Bauen): Zahl der Kriterien und Erlasse und die Dateigrössen stimmen mit dem Stand überein.

Die Datei ist zu gross, um sie im Browser zu bearbeiten. Meldet eine der Prüfungen eine Abweichung, gibst du die Meldung mit diesem Auftrag an einen Agenten:

```text
Im Repository SEM-SGG/lectora meldet die Prüfung der Produktdokumentation: <Meldung hier einfügen>. Ziehe
docs/lectora-dokumentation.html nach AGENTS.md nach: Versionsangaben, Kennzahlen und betroffene Texte in Deutsch,
Französisch und Italienisch. Lege einen Pull Request gegen main an.
```
