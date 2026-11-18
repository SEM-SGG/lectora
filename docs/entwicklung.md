# Entwicklung

## Voraussetzungen

- Node.js 20 oder neuer (das Repository nennt 22 in `.nvmrc`)
- Python 3.11 oder neuer (getestet mit 3.13)
- Systempakete für die Tests:
  - LibreOffice (`soffice`): Rundlauf der Word- und PowerPoint-Exporte, Testdokumente als PDF
  - poppler-utils (`pdftoppm`): Bilder von PDF-Seiten in den Tests
  - qpdf: Strukturprüfung der PDF-Exporte

Unter Ubuntu oder Debian:

```sh
sudo apt-get install --no-install-recommends libreoffice-writer libreoffice-impress poppler-utils qpdf
```

Unter macOS mit Homebrew: `brew install --cask libreoffice` und `brew install poppler qpdf`.

## Einrichten

```sh
git clone https://github.com/SEM-SGG/lectora.git
cd lectora
npm ci
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
python -m playwright install chromium
```

`npm ci` installiert nur, was der Build braucht: Programmbibliotheken (JSZip, pdf.js, pdf-lib), Schriften, Icons und axe-core für die Tests. Die Datei `.npmrc` verhindert Installationsskripte und optionale Pakete.

## Bauen

```sh
npm run build              # alle drei Ausgaben
node build.mjs             # Artefakt-Ausgabe: dist/index.html (Bibliotheken von cdnjs mit Integritätsprüfung)
node build.mjs --local     # Testausgabe: dist-local/index.html und dist-local/vendor/ (Bibliotheken als Dateien)
node build.mjs --offline   # Offline-Ausgabe: dist-offline/Lectora-<Version>.html (eine Datei, alles eingebettet)
node build.mjs --offline --no-update-check   # Offline-Ausgabe ohne Versionsabfrage (wird nicht veröffentlicht)
```

Der Build liest die Bibliotheken aus `node_modules` und prüft jede Datei gegen einen festen SHA-512-Wert in `build.mjs`. Weicht eine Datei ab, bricht der Build ab. Dieselben Werte dienen der Artefakt-Ausgabe als Integritätsprüfung (SRI) für alle vier Dateien von cdnjs. Eine neue Version einer Bibliothek (zum Beispiel aus einem Pull Request von Dependabot) braucht den neuen Wert und die Adresse in `build.mjs`, danach `node tools/notices.mjs --write`.

Die Version kommt aus `package.json`. Der Stand ist das Datum des Builds; `SOURCE_DATE_EPOCH` setzt ihn fest.

## Testen

```sh
npm test                       # alles nacheinander (rund 20 Minuten), baut vorher
python3 test/run.py schnell    # ohne Browser, wenige Sekunden
python3 test/run.py --liste    # Gruppen und Dateien
python3 test/run.py ui_test.py # eine Datei
```

| Gruppe | Tests | braucht |
| --- | --- | --- |
| schnell | `i18n_test.mjs`, `ausbau_test.mjs`, `sprachkorpus_test.mjs` (Sprachkorpus X11, X12, R04: Präzision und Trefferquote gegen eine Basis, siehe `test/sprachkorpus/README.md`), `werkzeug_test.mjs`, `ki_test.mjs`, `profile_test.mjs`, `erlasse_test.py`, `statik_test.mjs` (Schnittstellen im gebauten Code), `release_test.py` (Workflows, Hinweistext), Hygiene der Dateien und Commits, `hygiene_test.py`, Lizenzhinweise, Versionen (`tools/release_check.py --aktuell`) | Node, Python, gebaute Ausgaben |
| logik | `engine_test.py`, `compare_test.py`, `corpus_test.py` | Browser |
| export | `export_test.py`, `annot_test.py` | Browser, LibreOffice, poppler-utils, qpdf |
| browser | `ui_test.py`, `feinschliff_test.py`, `ki_ui_test.py`, `sprachfassungen_ui_test.py`, `review_test.py` (unlesbare Dateien, Klassifizierung, Zustimmung, KI-Kennzeichnung in Exporten, Speicher und Zurück-Cache, PDF/A), `a11y_test.py`, `contrast_test.py` | Browser, LibreOffice (PDF/A) |
| offline | `offline_test.py` | Browser, qpdf |
| netz | `cdn_test.py` | Browser, Internet (cdnjs) |

Die Browser-Tests laufen nacheinander. `a11y_test.py` misst die Zeit eines Entscheids im grossen Dokument und scheitert, wenn andere Tests den Rechner gleichzeitig auslasten.

Jeder Test endet mit «FEHLER: keine», «0 Fehler» oder einer Zusammenfassung und gibt bei einem Fehler den Exit-Code 1 zurück. Protokolle stehen in `test/out/logs/`, Bildschirmfotos in `test/shots/`.

Umgebungsvariablen:

| Variable | Wirkung |
| --- | --- |
| `LECTORA_CHROME` | anderer Browser statt des Chromium aus Playwright (Pfad zur ausführbaren Datei) |
| `LECTORA_OHNE_NETZ=1` | `npm test` lässt die Gruppe «netz» aus |
| `LECTORA_OOXML_VALIDATOR` | Pfad zu einem externen Office-Validator (Python-Skript mit den Argumenten `DATEI --original ORIGINAL --author NAME`); wird zusätzlich zur eigenen Prüfung aufgerufen |
| `LECTORA_SOFFICE` | anderer Aufruf für LibreOffice statt `soffice` |
| `LECTORA_HYGIENE_SPERRLISTE` | Datei mit Begriffen, die nie im Repository stehen dürfen (liegt ausserhalb des Repositorys) |
| `HTTPS_PROXY` | Proxy für Tests, die cdnjs laden |

### Office-Exporte prüfen

`test/ooxml_check.py` prüft Word- und PowerPoint-Dateien: Paket, wohlgeformtes XML, Inhaltstypen, Beziehungen, eindeutige Kennungen, Änderungsverfolgung und Kommentare. Mit `--original` und `--author` prüft es zusätzlich den Rundlauf: Verwirft man die Änderungen dieser Person, entsteht wieder der Text des Originals. `export_test.py` beschädigt eine gültige Datei absichtlich auf acht Arten und verlangt, dass die Prüfung jede findet.

```sh
python3 test/ooxml_check.py test/out/weisung_de_flawed_korr.docx --original test/fixtures/weisung_de_flawed.docx --author Lectora
```

### Testdokumente

Alle Dokumente in `test/fixtures/` sind erfunden. `test/make_fixtures.py` erzeugt sie (python-docx, python-pptx, LibreOffice für die PDF-Fassungen). Echte Dokumente gehören nie in dieses Repository.

```sh
python3 test/make_fixtures.py
```

Ändert sich ein Testdokument, ändern sich oft auch die Erwartungen im Referenzkorpus (`test/corpus/`). Siehe [kriterium-ergaenzen.md](kriterium-ergaenzen.md).

### Hygiene

```sh
python3 tools/hygiene.py
```

```sh
python3 tools/hygiene.py --commits
```

Sucht in allen Dateien des Repositorys nach Pfaden einer Arbeitsumgebung (auch `/mnt/…`, `C:/Users/…`, UNC-Pfade), Links auf claude.ai-Sitzungen, -Chats und -Artefakte, internen Adressen (Hosts unter admin.ch ausser den öffentlichen, Intranet, SharePoint), E-Mail-Adressen ausserhalb von example.com (auch verschleiert), Zugangsdaten und echten Dokumenten. Office- und PDF-Dateien erkennt es am Inhalt, nicht an der Endung, und prüft ihre Metadaten (Autor, Firma, Vorlage, eigene Eigenschaften, Personen, Kommentarautoren, Bilder, XMP, Autoren von Anmerkungen). Mit `--commits` prüft es Autor, Committer und Nachricht jedes Commits. Läuft in GitHub Actions bei jedem Push; das Secret `LECTORA_HYGIENE_SPERRLISTE` ergänzt eine Liste von Namen (siehe [repo-einstellungen.md](repo-einstellungen.md)). `test/hygiene_test.py` prüft das Werkzeug selbst mit bekannten Umgehungsfällen.

## Aufbau

```
src/            Quellcode der Seite (ein Skript je Modul, Stile, HTML-Gerüst)
profile/        Standardprofile der Sektion (JSON), beim Build eingebettet
test/           Tests, Testläufer run.py, Office-Prüfung, Testdokumente (fixtures/), Referenzkorpus (corpus/)
tools/          Werkzeuge: Hygiene, Lizenzhinweise, Abgleich der Erlasstabelle, Release-Prüfung, Normalisierung
design/         Design-Tokens (Carbon), Akzentfarben, Quellen der Erlasstabelle
docs/           diese Dokumentation, Bilder
.github/        Workflows, Vorlagen für Issues und Pull Requests
build.mjs       Build der drei Ausgaben
version.json    Version und Hinweis für die Versionsabfrage der Offline-Ausgabe
```

Die Module und ihr Zusammenspiel beschreibt [architektur.md](architektur.md).

## Arbeitsregeln

- Nach jedem Schreiben einer Datei in `src/`: `python3 tools/norm.py`. Das Skript ersetzt unsichtbare Zeichen (geschützte Leerzeichen, Zeilentrenner) durch `\u`-Escapes. Manche Editoren und KI-Assistenten machen aus Escapes sonst unsichtbare Zeichen; ein Zeilentrenner in einem regulären Ausdruck bricht das ganze Skript.
- Jeder neue Text der Oberfläche kommt in `src/i18n.js` in allen drei Sprachen. `node test/i18n_test.mjs` muss «0 Fehler» melden.
- Neue Bedienelemente bekommen ein festes `data-fid`. Die Tests sprechen Elemente darüber an.
- Mehr Regeln: [AGENTS.md](../AGENTS.md).
