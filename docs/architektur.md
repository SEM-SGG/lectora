# Architektur

Lectora ist eine einzige HTML-Seite ohne Server. Alles läuft im Browser: Dateien lesen, prüfen, vergleichen, exportieren. Der Build (`build.mjs`) setzt die Seite aus den Modulen in `src/` zusammen.

## Module

Die Skripte stehen in dieser Reihenfolge in der Seite. Jedes Modul hängt sich an das globale Objekt `DP` (für «Dokumentenprüfung»).

| Datei | Objekt | Aufgabe |
| --- | --- | --- |
| `lang.js` | `DP.lang` | Spracherkennung, Wörter und Sätze, sprachabhängige Muster. `L.U()` baut Unicode-taugliche Muster (JavaScripts `\b` kennt keine Akzente). |
| `erlasse.js` | `DP.erlasse` | Tabelle der Bundeserlasse (SR-Nummer, Abkürzungen, Kurztitel in drei Sprachen), eigene Erlasse |
| `modal.js` | `DP.modal` | Modalverben: Pflicht, Verbot, Erlaubnis, Empfehlung in drei Sprachen |
| `i18n.js` | `DP.i18n` | alle Texte der Oberfläche in de, fr, it; `t()` und `tn()` (Einzahl/Mehrzahl) |
| `parse.js` | `DP.parse` | Leser für Word (JSZip), PowerPoint (JSZip) und PDF (pdf.js) |
| `rules.js` | `DP.rules` | Kriterienkatalog `CATALOG`, Parameter `PARAMS`, lokale Prüfung `runRules(doc, settings)` |
| `align.js` | `DP.align` | Sprachvergleich: Absätze und Sätze zweier Fassungen zuordnen, lokale Vergleichsprüfungen (X01–X08, X11, X12) |
| `recheck.js` | `DP.recheck` | Nachprüfung einer neuen Fassung: Absätze und Befunde zuordnen |
| `profile.js` | `DP.profile` | Dateiformate Prüfprofil und Rückmeldung: bauen, streng und nachsichtig lesen |
| `docx-export.js` | `DP.exporter` | Word mit Änderungsverfolgung oder bereinigt, Prüfbericht als Word |
| `annot-export.js` | `DP.annot` | PDF (pdf-lib) und PowerPoint mit Kommentaren |
| `ai.js` | `DP.ai` | KI-Prüfung, Bedeutungsvergleich, Formulierungsvorschläge, Rückübersetzung; einziger Zugang zu Claude |
| `duties.js` | `DP.duties` | Pflichtenmatrix: Claude zieht die Pflichten aus dem Text, alles Weitere lokal |
| `update.js` | `DP.update` | Versionsabfrage, nur in der Offline-Ausgabe (fehlt mit `--no-update-check`) |
| `ui.js` | `DP.ui` | Oberfläche: Zustand, Darstellung, Ansichten, Dialoge, Speichern |

Dazu kommen `styles.css` (alle Stile, Design-Tokens in `:root`) und `index.template.html` (Gerüst mit Platzhaltern für Stile, Daten und Skripte).

## Zustand

Der ganze Zustand steht in einem Objekt `S` (`DP.state`) in `ui.js`, nur im Arbeitsspeicher:

- Dokumente (`docs`), Ergebnisse je Dokument (`res`), Vergleiche (`cmp`), vorherige Fassungen (`versions`)
- Einstellungen (`settings`: ausgeschaltete Kriterien, Parameter, Begriffsliste, eigene Erlasse, eigene KI-Kriterien)
- Ansicht (Seite, Filter, gewählter Befund) und Ergebnisse der KI-Funktionen

Es gibt keinen Speicher im Browser (kein localStorage, kein sessionStorage, keine IndexedDB, keine Cookies). «Sitzung leeren» setzt alles zurück. Wer Einstellungen behalten will, speichert ein Prüfprofil als Datei.

`render()` baut die aktuelle Ansicht neu auf. `h()` erzeugt Elemente, `t()` holt Texte. Bedienelemente tragen ein `data-fid`, über das Tests und die Fokusführung sie finden.

## Ausgaben

`build.mjs` baut aus derselben Quelle drei Ausgaben. `DP.offline` unterscheidet sie zur Laufzeit.

| | Artefakt (`node build.mjs`) | Test (`--local`) | Offline (`--offline`) |
| --- | --- | --- | --- |
| Datei | `dist/index.html` | `dist-local/index.html` + `vendor/` | `dist-offline/Lectora-<Version>.html` |
| Bibliotheken | von cdnjs, alle vier Dateien mit Integritätsprüfung (SRI) | als Dateien daneben | eingebettet |
| pdf.js liest PDF | im Hauptthread (Worker-Datei als `<script>` mit SRI, `globalThis.pdfjsWorker`) | im Hauptthread | in einem Worker aus einer `blob:`-Adresse |
| `DP.offline` | `false` | `false` | `true` |
| KI-Funktionen | ja, wenn Claude die Schnittstelle bereitstellt | nur mit simuliertem `window.claude` (Tests) | nein, Schnittstelle wird nicht abgefragt |
| Speichern | Downloads von Claude (`downloads.save`), sonst Kopierdialog | wie Artefakt | Download des Browsers (blob:-Link) |
| Versionsabfrage | nein | nein | ja (ausser mit `--no-update-check`) |
| Sicherheitsrichtlinie (CSP) | keine eigene (die Plattform setzt ihre) | keine | als `<meta>` in der Datei |

Alle Ausgaben beginnen mit einem Kommentar, der die Lizenzhinweise der eingebetteten Komponenten enthält (aus `tools/notices.mjs`).

### Sicherheitsrichtlinie der Offline-Ausgabe

```
default-src 'none';
script-src 'sha256-…' (je eingebettetes Skript);
style-src 'sha256-…' (der Stilblock);
img-src data:;
font-src data:;
worker-src blob:;
connect-src https://sem-sgg.github.io/lectora/version.json;
base-uri 'none';
form-action 'none'
```

- Skripte und Stile laufen nur, wenn ihr Hash stimmt. Kein `eval`, keine Ereignisattribute.
- `connect-src` erlaubt genau eine Datei: `version.json` auf GitHub Pages. Jede andere Adresse, auch eine andere Datei derselben Seite, ist gesperrt. Die Ausgabe ohne Versionsabfrage hat `connect-src 'none'`. GitHub Pages beantwortet die Anfrage mit `Access-Control-Allow-Origin: *`, auch für die Herkunft `null` einer geöffneten Datei (geprüft mit curl gegen eine bestehende Seite unter github.io); die Anfrage ist einfach (GET ohne eigene Kopfzeilen) und braucht keine Vorabfrage.
- pdf.js liest PDF in einem Worker. Die Seite startet ihn aus eingebettetem Text über eine `blob:`-Adresse.
- Eine Grenze von CSP: Der Abfrageteil einer Adresse (`?…`) zählt beim Vergleich nicht. Lectora hängt nie einen an; der Test prüft das.

Auf GitHub Pages gilt dieselbe Richtlinie (dieselbe Datei). GitHub setzt keine eigene CSP. Downloads über `blob:` und der Worker funktionieren auch über https; `offline_test.py` prüft das mit einem lokalen Webserver.

### Klassifizierte Dokumente auf GitHub Pages

Die Offline-Ausgabe läuft als geöffnete Datei (`file://`) und als Webseite auf GitHub Pages. `ui.js` unterscheidet die beiden mit `WEB = DP.offline && /^https?:$/.test(location.protocol)` (das gilt für jeden `http(s)`-Server; die Hinweistexte gehen von der veröffentlichten Adresse auf GitHub Pages aus). Nur wenn `WEB` gilt:

- Die Startseite sagt, dass die Webseite für unklassifizierte Dokumente gedacht ist, und verweist auf «Als Datei speichern» (Seite der neusten Ausgabe, feste Adresse `RELEASE_URL`).
- `readFiles` liest den Vermerk direkt nach `DP.parse.parseFile` aus `doc.meta.classification` (ermittelt von `DP.lang.findClassification`, derselben Erkennung wie für die Sperre der KI-Funktionen). Das geschieht vor der Rückfrage nach einer neuen Fassung und vor der Prüfung; Beispieldokumente sind ausgenommen. VERTRAULICH und GEHEIM (Stufe 2 und 3): kein Laden, keine Prüfung, eine Erklärung verweist auf die Datei `Lectora.html`. INTERN (Stufe 1): ein Warndialog mit Kontrollkästchen; ohne Bestätigung lädt Lectora das Dokument nicht.

Unter `file://` und in der Artefakt-Ausgabe (`DP.offline` ist `false`) greift diese Prüfung nicht. Gründe und Grenzen der Erkennung: [datenschutz.md](datenschutz.md#github-pages).

### Versionsabfrage

`src/update.js`, nur in der Offline-Ausgabe:

0. Der Workflow `release` legt `version.json` (aus dem Repository, vom veröffentlichten Commit) zusammen mit der Webseite auf GitHub Pages ab, und zwar erst nach den Tests und nach dem Anlegen des Release. Vorher sieht keine verteilte Ausgabe die neue Version.
1. 600 Millisekunden nach dem Start, wenn die Seite bedienbar ist: eine Anfrage an `https://sem-sgg.github.io/lectora/version.json` (`GET`, ohne Abfrageteil, ohne Cookies, ohne Referrer, ohne eigene Kopfzeilen, ohne Zwischenspeicher, Weiterleitungen verboten), höchstens 8 Sekunden. Was GitHub dabei erfährt, steht in [datenschutz.md](datenschutz.md).
2. Antwort höchstens 4 KiB, JSON-Objekt mit höchstens 8 Feldern; `version` im Muster X.Y.Z, `date` als gültiges Datum, `note` mit Texten in de, fr, it (je höchstens 200 Zeichen, ohne `<`, `>`, Steuerzeichen und ohne alles, was wie eine Adresse aussieht: `://`, `www.`, ein Hostname, `@`). Sonst: nichts. `tools/release_check.py` prüft dieselben Regeln vor der Veröffentlichung.
3. Ist die Version neuer (Vergleich Zahl für Zahl), zeigt `ui.js` einen Hinweis unter der Utility-Leiste. Der Link führt immer zur festen Adresse `https://github.com/SEM-SGG/lectora/releases/latest` (Konstante `RELEASE_URL` in `ui.js`), nie zu einer Adresse aus der Antwort. Auf GitHub Pages lautet die Aktion «Seite neu laden».
4. Scheitert die Abfrage und ist die Ausgabe älter als 90 Tage, erscheint ein Hinweis, im Repository nachzusehen.
5. «Ausblenden» gilt bis zum Neuladen.

Die Artefakt-Ausgabe fragt nichts ab (die Plattform sperrt Verbindungen).

Vertrauensmodell: Die Versionsdatei ist nicht signiert. Wer das Repository übernimmt, bestimmt den Hinweistext, könnte aber ebenso eine veränderte Lectora-Datei veröffentlichen; eine Signatur würde Schlüssel verlangen, die die Sektion über Jahre sicher verwalten müsste. Schutz bieten die Rulesets für `main` und `v*`, wenige Personen mit Schreibrecht und die Regel, Organisation und Repository nie umzubenennen oder zu löschen ([repo-einstellungen.md](repo-einstellungen.md)). Der Hinweistext kann nie einen Link setzen.

## KI-Schnittstelle und Zustimmung

Nur die Artefakt-Ausgabe auf claude.ai hat KI-Funktionen. Der einzige Weg zu Claude ist `DP.ai.getSample()`:

```js
const sample = await DP.ai.getSample();      // null, wenn es keine Schnittstelle gibt
const result = await sample.json(prompt, { signal });
```

`getSample()` ruft einmal `window.claude.use('sample')` auf. In der Offline-Ausgabe fragt es gar nicht erst nach. Fehler tragen einen `code`; `DP.ai.errKey()` übersetzt ihn in eine Meldung.

Regeln für jede Funktion, die Text an Claude sendet:

1. Sie startet nur auf einen ausdrücklichen Klick, nie von selbst.
2. Vorher zeigt ein Dialog, was gesendet wird («Gesendet wird»: welches Dokument, welche Teile, eigene Kriterien im Wortlaut, Obergrenze). Erst «Senden» startet den Lauf. Einzige Ausnahme: Formulierungsvorschläge (ein Satz) lassen sich für die Sitzung ohne Rückfrage anfordern.
3. Klassifizierungsvermerk (`DP.lang.findClassification`, ganze Zeilen in Kopf- und Fusszeilen, Folienfüssen, Randzeilen jeder PDF-Seite und am Anfang): INTERN verlangt eine zusätzliche Bestätigung; VERTRAULICH und GEHEIM (und die Entsprechungen) sperren jede KI-Funktion, ohne Möglichkeit, trotzdem zu senden (`aiBlocked` in `ui.js`).
4. Die Plattform fragt beim ersten Aufruf einer Fähigkeit selbst um Zustimmung.
5. Jede Anfrage behandelt den Dokumenttext als Daten: Der Text steht als JSON zwischen Markierungen (`<<<DOCUMENT` … `DOCUMENT>>>`, Zeilenumbrüche flach), der Prompt sagt Claude vorher und nachher, dass Anweisungen darin nicht zu befolgen sind. Eigene Kriterien (Q07) stehen als Prüfkriterien gerahmt, die Regeln und Antwortform nicht ändern können.
6. Jeder Korrekturvorschlag aus einer KI-Funktion (KI-Prüfung, Bedeutungsvergleich, Formulierungsvorschlag) besteht `DP.ai.checkFacts` mit `meaningGuards`: Zahlen, Uhrzeiten, Daten, Verweise, Links; Zahl mit Einheit; Richtung von Fristen und Daten; Verneinung; Verbindlichkeit (Klassen von `DP.modal`; L06 darf sie ändern, mit Warnung; X11 muss der Referenz entsprechen); andere handelnde Stelle ergibt eine Warnung. Ein Vorschlag, der nicht besteht, bleibt nur als Hinweis mit Grund (`fixRej`). Alles sind Näherungen.
7. KI-Vorschläge (`aiFix` in `ui.js`) nimmt nur an, wer sie einzeln entscheidet; Sammelentscheide übergehen sie. Exporte kennzeichnen sie: Word mit eigenem Autor «<Name> (KI-Vorschlag)» und einem Kommentar zur Herkunft, KI-Befunde als «KI-Befund (Claude)» in Kommentaren, Anmerkungen und im Bericht.
8. Ohne Schnittstelle erscheint die Funktion als «nicht verfügbar», ohne Fehler. Nach «ausgelastet» (`rate_limited`) nimmt Lectora 30 Sekunden keine neue Anfrage an; es wiederholt nie von selbst.

Speichern läuft in der Artefakt-Ausgabe über `DP.ai.getDownloads()` (`window.claude.use('downloads')`, dann `downloads.save({ filename, data })`). Die Plattform fragt vor jedem Download nach. Ohne diese Fähigkeit zeigt Lectora den Inhalt zum Kopieren.

Die Tests simulieren `window.claude` (siehe `MOCK` in `test/ui_test.py`).

## Prüfung und Befunde

1. `DP.parse.parseFile(file)` liefert ein Dokument: Absätze (`paras` mit `text`, `kind`, `level`, Fundstelle), Metadaten, Sprache, Typ.
2. `DP.rules.runRules(doc, settings)` liefert `{ findings, checked }`. Ein Befund trägt Kriterium (`crit`), Schweregrad (`sev`), Textschlüssel (`key`) mit Parametern, Absatz und Stelle, wahlweise einen Korrekturvorschlag (`fix: { start, end, repl }`). Texte stehen nie im Befund, nur Schlüssel: Die Oberfläche zeigt jeden Befund in der gewählten Sprache.
3. Entscheide (annehmen, ablehnen, ignorieren, Fehlalarm) speichert `ui.js` am Befund. Der Export schreibt nur angenommene Vorschläge.

## Bekannte Punkte

- **Office-Prüfung:** `test/ooxml_check.py` prüft Paket, Beziehungen, Kennungen, Änderungen und Kommentare, aber nicht gegen das Schema (Reihenfolge der Elemente, Pflichtattribute, Werte, Feldfunktionen). Ein zusätzlicher Auftrag mit dem Validator des Open XML SDK (Microsoft, MIT-Lizenz, .NET) in GitHub Actions würde diese Lücke schliessen.
- **pdf.js 3.11.174:** betroffen von CVE-2024-4367; Lectora setzt `isEvalSupported: false`, und die Offline-Ausgabe verbietet `eval` per CSP. Der Wechsel auf pdf.js 4 (nur noch ES-Module) verlangt Änderungen am Build.
- **pdf-lib 1.17.1** wird seit 2021 nicht mehr gepflegt. Ersatz prüfen, wenn Fehler auftreten.
- **PowerPoint-Kommentare:** Lectora schreibt klassische Kommentare (`p:cmLst`); PowerPoint für Microsoft 365 zeigt sie als ältere Kommentare an und bietet die Umwandlung an. Mit modernen Kommentaren in derselben Datei ist das Zusammenspiel nicht getestet.
- **Tabs im Ruhezustand:** Edge (Schlafende Tabs) und Chrome (Speichersparmodus) können einen Tab im Hintergrund verwerfen. Beim Zurückkehren lädt die Seite neu; die Sitzung ist dann leer, ohne Warnung.
- **Lesen grosser PDF-Dateien in der Artefakt-Ausgabe** geschieht im Hauptthread: Die Testdokumente brauchen rund 0,1 Sekunden, eine Datei mit 164 Seiten 0,7 Sekunden, eine mit 656 Seiten 2,6 Sekunden, während derer die Seite nicht reagiert (die Fortschrittsanzeige steht vorher).

## Design

Das Design System «Carbon» (nach IBM Carbon) steht in `src/styles.css`: Tokens in `:root`, darunter die Komponenten. Regeln in [AGENTS.md](../AGENTS.md#gestaltung).
