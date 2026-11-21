# Datenschutz

Lectora verarbeitet Dokumente der Verwaltung. Deshalb ist klar geregelt, was den Computer verlässt und was nicht.

## Was auf dem Computer bleibt

- Der Browser liest die Dateien direkt. Es gibt keinen Server, der sie empfängt.
- Dokumente, Befunde, Entscheide und Einstellungen liegen nur im Arbeitsspeicher des Tabs.
- Lectora speichert nichts im Browser: kein localStorage, kein sessionStorage, keine IndexedDB, kein Cache-Speicher, keine Cookies, kein Service Worker, nichts im Verlauf (Adresse, Titel und `history.state` enthalten nie Dokumentdaten).
- Wer den Tab schliesst oder neu lädt, verliert alles. «Sitzung leeren» löscht alles sofort: Dokumente, frühere Fassungen, Befunde und Entscheide, Ergebnisse der KI-Funktionen, Rückgängig-Schritte, Einstellungen und noch gültige Download-Adressen.
- Verlässt jemand die Seite im selben Tab und kehrt mit «Zurück» zurück, lädt die Seite neu und ist leer. Lectora verwirft dafür alles beim Verlassen (der Zurück-Cache des Browsers bringt kein Dokument zurück).
- Dateien entstehen nur auf deinen Klick: Exporte, Prüfprofile, Rückmeldungen. Sie landen im Download-Ordner des Browsers (Offline-Ausgabe) bzw. über die Downloads von Claude (Artefakt-Ausgabe).
- Ein Prüfprofil enthält nur Einstellungen, nie Dokumentinhalte, Dateinamen oder Befunde.
- Eine Rückmeldung zu Fehlalarmen enthält Textstellen und Dateinamen nur, wenn du das ausdrücklich einschaltest.

**Was der Browser selbst behält:** Gespeicherte Exporte bleiben im Download-Ordner, bis du sie löschst, und der Browser führt sie mit Dateinamen in seiner Download-Liste. Die Dateinamen der Exporte enthalten den Namen des Originals. Lösche Exporte und Einträge der Download-Liste nach den Vorgaben deiner Organisation.

## Offline-Ausgabe: eine Anfrage beim Start

Die Datei `Lectora.html` baut genau eine Verbindung auf: Beim Start liest sie die Datei `https://sem-sgg.github.io/lectora/version.json` auf GitHub Pages. So erfährt sie, ob es eine neuere Version gibt. Diese Datei legt der Workflow `release` erst ab, wenn eine neue Version alle Tests bestanden hat und veröffentlicht ist.

Was die Anfrage enthält: eine GET-Anfrage an genau diese Adresse, ohne Abfrageteil, ohne Cookies, ohne Referrer, ohne eigene Kopfzeilen, ohne Zwischenspeicher, Weiterleitungen gesperrt. Was GitHub dabei wie bei jedem Webzugriff erfährt:

- die IP-Adresse deines Computers (im Bundesnetz in der Regel die Adresse des Proxys),
- die Uhrzeit, also wann und wie oft eine Lectora-Datei gestartet wird,
- den Browser und das Betriebssystem (User-Agent und die Client Hints `sec-ch-ua`, `sec-ch-ua-mobile`, `sec-ch-ua-platform`),
- die bevorzugten Sprachen des Browsers (`Accept-Language`),
- die Herkunft der Seite (`Origin`): `null` für die geöffnete Datei, `https://sem-sgg.github.io` für die Webseite.

Die Anfrage enthält keine Dokumentdaten, keine Dateinamen, keine Einstellungen und keine Kennung von Lectora. Für diese Daten gelten die Bedingungen von GitHub. Ein Proxy deiner Organisation kann die Anfrage zusätzlich protokollieren.

- Die Sicherheitsrichtlinie (Content Security Policy) in der Datei erlaubt nur diese eine Adresse. Jede andere Verbindung sperrt der Browser. In den Entwicklerwerkzeugen des Browsers (Netzwerk, Konsole) lässt sich das nachprüfen.
- Ohne Internet bleibt die Anfrage ohne Antwort; Lectora arbeitet normal weiter.
- Klickst du auf «Neue Version herunterladen» oder «Im Repository nachsehen», öffnet der Browser die Seite der neusten Ausgabe auf GitHub in einem neuen Tab. Das ist ein gewöhnlicher Seitenaufruf auf deinen Klick.

### Was die Antwort bewirken kann (Vertrauensmodell)

Die Antwort ist fremd und wird streng geprüft: höchstens 4 KiB, ein JSON-Objekt mit Version, Datum und einem kurzen Hinweis in drei Sprachen. Der Hinweis darf weder Markup noch Steuerzeichen noch etwas enthalten, das wie eine Adresse aussieht (`://`, `www.`, ein Hostname, `@`); sonst verwirft Lectora die ganze Antwort. Angezeigt wird er nur als Text. Der Link zum Herunterladen steht fest im Code und kommt nie aus der Antwort.

Die Antwort ist nicht signiert. Wer das Repository oder die Organisation bei GitHub übernimmt, kann den Hinweistext bestimmen – und könnte ebenso eine veränderte Lectora-Datei als neue Version veröffentlichen. Eine Signatur der Versionsdatei würde Letzteres nicht verhindern, aber Schlüssel verlangen, die die Sektion über Jahre sicher verwalten müsste. Lectora verlässt sich deshalb auf den Schutz des Repositorys: Rulesets für `main` und für Tags, wenige Personen mit Schreibrecht, Zwei-Faktor-Anmeldung, und Organisation und Repository werden nie umbenannt oder gelöscht (siehe [repo-einstellungen.md](repo-einstellungen.md)). Die Prüfsummen in `SHA256SUMS.txt` stammen aus demselben Workflow; sie erkennen beschädigte Downloads, nicht ein übernommenes Repository.

### Ausgabe ohne Versionsabfrage

Wer auch diese eine Anfrage nicht will, baut eine Ausgabe ohne Versionsabfrage:

```sh
npm ci
node build.mjs --offline --no-update-check
```

Ergebnis: `dist-offline/Lectora-<Version>-ohne-Versionsabfrage.html`. Diese Datei enthält den Code der Abfrage nicht, und ihre Sicherheitsrichtlinie sperrt jede Verbindung (`connect-src 'none'`). Sie zeigt nach 90 Tagen einen Hinweis, im Repository nach einer neueren Ausgabe zu sehen. Diese Ausgabe wird nicht veröffentlicht; wer sie braucht, baut sie selbst.

## GitHub Pages

Unter `https://sem-sgg.github.io/lectora/` liegt dieselbe Datei als Webseite. GitHub liefert sie aus und sieht dabei dieselben Angaben wie oben, wie bei jeder Webseite. Danach gilt alles wie oben: Dokumente bleiben im Browser, die einzige weitere Anfrage ist die Versionsabfrage. Die Webseite teilt ihre Herkunft (`sem-sgg.github.io`) mit allen anderen Pages-Seiten der Organisation; Lectora legt nichts im Browser ab, das andere Seiten dieser Herkunft lesen könnten.

### Webseite für unklassifizierte Dokumente, Datei für klassifizierte

Die Webseite ist für unklassifizierte Dokumente und zum Ausprobieren gedacht. Für Dokumente mit dem Vermerk INTERN, VERTRAULICH oder GEHEIM verwendest du die lokal gespeicherte Datei `Lectora.html`. Die Startseite der Webseite sagt das sichtbar und führt mit «Als Datei speichern» zur Seite der neusten Ausgabe, wo du die Datei herunterlädst.

Warum die Unterscheidung: Auch auf der Webseite bleiben die Dokumente im Browser, und Lectora lädt nichts hoch. Den Programmcode liefert aber GitHub, also eine fremde Infrastruktur, bei jedem Aufruf neu aus. Ändert sich der Code auf GitHub, etwa weil jemand das Repository oder die Organisation übernimmt, läuft beim nächsten Aufruf der geänderte Code, ohne dass du es bemerkst. Dazu teilt die Webseite ihre Herkunft mit den anderen Pages-Seiten der Organisation. Eine gespeicherte `Lectora.html` ändert sich dagegen nicht: Sie läuft so, wie du sie heruntergeladen hast, und ihre Prüfsumme lässt sich mit `SHA256SUMS.txt` vergleichen.

Was Lectora auf der Webseite beim Laden eines Dokuments tut:

- **VERTRAULICH oder GEHEIM** (auch CONFIDENTIEL, SECRET, CONFIDENZIALE, SEGRETO, CONFIDENTIAL): Lectora prüft das Dokument nicht. Es erscheint eine Erklärung mit dem Hinweis auf die Datei `Lectora.html`.
- **INTERN** (auch INTERNE, INTERNO, AD USO INTERNO, USO INTERNO, INTERNAL): Ein Warndialog empfiehlt die Datei `Lectora.html`. Lectora lädt das Dokument nur, wenn du mit einem Häkchen bestätigst, dass du es trotzdem auf der Webseite prüfen willst; ohne Bestätigung bleibt es ungeladen.
- **Ohne Vermerk:** keine Rückfrage.

Die geöffnete Datei `Lectora.html` (Adresse `file://`) kennt diese Einschränkung nicht. Sie prüft alle Dokumente, auch INTERN, VERTRAULICH und GEHEIM, vollständig im Browser und ohne Internet. Die Artefakt-Ausgabe auf claude.ai bleibt ebenfalls unverändert: Die lokale Prüfung ist für alle Dokumente möglich; für die KI-Funktionen gelten die Regeln im nächsten Abschnitt.

**Die Erkennung ist eine Näherung.** Lectora sucht den Vermerk nach Muster in Kopf- und Fusszeilen, in Folienfüssen, an den Seitenrändern jeder PDF-Seite und am Anfang des Dokuments. Einen Vermerk an anderer Stelle, in einem Bild oder in abweichender Schreibweise erkennt es nicht; ein solches Dokument lädt die Webseite ohne Rückfrage. Die Prüfung ergänzt die Weisungen der Organisation, sie ersetzt sie nicht: Welche Dokumente du auf der Webseite öffnest, verantwortest du.

## Artefakt-Ausgabe auf claude.ai

- Die Seite lädt vier Dateien quelloffener Programmbibliotheken von cdnjs: JSZip beim Öffnen, pdf.js und seine Hilfsdatei (Worker) beim ersten PDF, pdf-lib beim ersten Export mit Kommentaren. Der Browser prüft jede dieser Dateien mit einer Integritätsprüfung (SRI). Dabei gehen keine Dokumentinhalte an cdnjs; cdnjs sieht wie jeder Webserver IP-Adresse, Browser und Uhrzeit.
- Text an Claude (Anthropic) geht nur, wenn du eine KI-Funktion startest: KI-Prüfung, Bedeutungsvergleich, Formulierungsvorschlag, Rückübersetzung, Pflichtenmatrix. Lectora zeigt vorher, was gesendet wird («Gesendet wird»: Dokument, Teile, eigene Kriterien, Obergrenze), und fragt nach. Einzige Ausnahme: Bei Formulierungsvorschlägen (je ein einzelner Satz) kannst du die Rückfrage für die laufende Sitzung abschalten; bei einem Dokument mit Klassifizierungsvermerk fragt Lectora trotzdem.
- Die Plattform claude.ai fragt beim ersten Aufruf einer Fähigkeit (Claude fragen, Datei herunterladen) selbst um Zustimmung, nicht bei jedem weiteren Aufruf. Wiederholt die Seite innert weniger Minuten genau dieselbe Anfrage, kann die Plattform die frühere Antwort wiederverwenden.
- **Klassifizierte Dokumente:** Trägt ein Dokument den Vermerk VERTRAULICH oder GEHEIM (CONFIDENTIEL, SECRET, CONFIDENZIALE, SEGRETO), sendet Lectora es nie an Claude, auch nicht teilweise, und bietet keine Möglichkeit, es trotzdem zu tun. Bei INTERN verlangt Lectora vor dem Senden eine zusätzliche Bestätigung. **Die Erkennung ist eine Näherung:** Lectora sucht den Vermerk nach Muster in Kopf- und Fusszeilen, in Folienfüssen, an den Seitenrändern jeder PDF-Seite und am Anfang des Dokuments. Einen Vermerk an anderer Stelle, in einem Bild oder in abweichender Schreibweise erkennt es nicht. Ob ein Dokument an Claude gehen darf, verantwortet die Person, die es sendet.

### Was eine Datenschutzberaterin oder ein Datenschutzberater fragen wird

- **Welche Bedingungen gelten für den Text, der an Claude geht?** Das hängt vom Konto der Person ab, die das Artefakt verwendet (persönliches Konto oder Konto einer Organisation, zum Beispiel Team oder Enterprise): Aufbewahrung, Verwendung für das Training von Modellen und Verarbeitung ausserhalb der Schweiz sind dort geregelt. Lectora ändert daran nichts. **Bevor Lectora mit echten Dokumenten und KI-Funktionen eingesetzt wird, klärt das Amt, welche Konten zulässig sind und welche Dokumente an Claude gehen dürfen**, und hält das fest.
- **Wer sieht was?** Lectora selbst hat keinen Server. Text geht nur an Claude (Anthropic) und nur bei den genannten Funktionen; Programmbibliotheken kommen von cdnjs; die Offline-Ausgabe fragt bei GitHub nach der Version.
- **Wie zuverlässig ist die Sperre für klassifizierte Dokumente?** Eine Näherung (siehe oben). Sie ergänzt die Weisungen der Organisation, sie ersetzt sie nicht. Das gilt für die Sperre der KI-Funktionen und für die Rückfrage auf GitHub Pages.
- **Welche Ausgabe für klassifizierte Dokumente?** Die lokal gespeicherte Datei `Lectora.html`. Die Webseite auf GitHub Pages ist für unklassifizierte Dokumente gedacht, weil GitHub ihren Programmcode bei jedem Aufruf neu ausliefert (siehe [GitHub Pages](#github-pages)).
- **Was bleibt auf dem Gerät?** Exporte im Download-Ordner und in der Download-Liste des Browsers; sonst nichts.
- **Sind Ergebnisse der KI erkennbar?** Ja: In Lectora tragen sie die Kennzeichnung «KI». In Exporten stehen KI-Befunde als «KI-Befund (Claude)»; eine angenommene Formulierung von Claude erscheint in Word als Änderung des Autors «<Name> (KI-Vorschlag)» mit einem Kommentar, dass Claude sie vorgeschlagen und die prüfende Person sie angenommen hat; im Prüfbericht und in PDF- und PowerPoint-Kommentaren steht dasselbe.

## Was Lectora nicht tut

- keine Statistik, keine Analyse des Verhaltens, keine Fehlerberichte an Dritte
- keine automatischen Updates: Der Hinweis auf eine neue Version führt nur zur Seite der neusten Ausgabe; herunterladen musst du selbst
- keine Weitergabe von Dokumenten an GitHub, auch nicht über Issues: Schreibe nie Dokumenttext in ein Issue (siehe [rueckmeldungen.md](rueckmeldungen.md))
