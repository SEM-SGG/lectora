# Eigenes Artefakt auf claude.ai erstellen

Die KI-Funktionen von Lectora laufen nur in der Artefakt-Ausgabe auf claude.ai:

- KI-Prüfung (inhaltliche Qualität, Kriterien Q01–Q07)
- Bedeutungsvergleich zweier Sprachfassungen
- Formulierungsvorschlag je Befund
- Rückübersetzung im Sprachvergleich
- Pflichtenmatrix (wer muss was bis wann tun) mit Abgleich der Fassungen

Die Offline-Ausgabe (`Lectora.html`) enthält diese Funktionen nicht. Diese Anleitung zeigt, wie die Sektion aus dem Repository ein eigenes Artefakt erstellt und aktuell hält.

Produktdetails von claude.ai können sich ändern. Die aktuellen Hilfeseiten findest du unter [support.claude.com](https://support.claude.com).

## Was du wissen musst

- `node build.mjs` schreibt `dist/index.html`: eine einzige, in sich geschlossene Seite. Sie lädt JSZip, pdf.js (mit seiner Hilfsdatei) und pdf-lib von cdnjs; der Browser prüft alle vier Dateien mit einer Integritätsprüfung.
- Claude veröffentlicht diese Datei als Artefakt. Danach erklärt Claude zwei Fähigkeiten der Seite (die Erklärung lautet `{sample:{}, downloads:true}`):
  - `sample`: Die Seite darf Claude fragen (KI-Funktionen).
  - `downloads`: Die Seite darf erzeugte Dateien zum Herunterladen anbieten (Word, Bericht, Profil).
- Reihenfolge bei einem neuen Artefakt: zuerst veröffentlichen, dann die Fähigkeiten erklären. Spätere Versionen veröffentlicht Claude über dasselbe Artefakt; die Erklärung bleibt bestehen.
- Das Artefakt ist privat, bis du es teilst. Wer es nutzt, muss bei Claude angemeldet sein. Lectora fragt vor jeder KI-Funktion um Zustimmung; die Plattform fragt beim ersten Aufruf zusätzlich. Die Nutzung zählt zum Kontingent der Person, die das Artefakt verwendet, und für den gesendeten Text gelten die Bedingungen ihres Kontos (siehe [datenschutz.md](datenschutz.md#was-eine-datenschutzberaterin-oder-ein-datenschutzberater-fragen-wird)).
- Die Umgebung des Artefakts verbietet Speicher im Browser, eigene Netzwerkaufrufe der Seite (fetch und ähnliche) und gewöhnliche Downloads; Skripte von cdnjs darf sie laden. Deshalb unterscheidet sich die Artefakt-Ausgabe von der Offline-Ausgabe: Sie lädt die Bibliotheken als Skripte von cdnjs und speichert über die Downloads von Claude.

## Voraussetzungen

- ein Claude-Konto mit Zugang zu Artefakten
- eine Claude-Sitzung, die Dateien veröffentlichen kann, zum Beispiel Claude Code im Web mit diesem Repository
- das Repository mit installierten Paketen (`npm ci`), siehe [entwicklung.md](entwicklung.md)

## Schritt für Schritt

1. Öffne eine Claude-Sitzung mit dem Repository (zum Beispiel Claude Code im Web, Repository `SEM-SGG/lectora`). Suche auf der Seite [Releases](https://github.com/SEM-SGG/lectora/releases/latest) die Nummer der neusten Version (zum Beispiel `v2.1.0`); du brauchst sie im Auftrag.
2. Gib Claude den folgenden Auftrag. Ersetze `vX.Y.Z` durch die Nummer der neusten Version. Passe den Titel an, wenn du willst.
3. Prüfe das Ergebnis mit der Checkliste unten.
4. Teile das Artefakt mit den Personen, die es brauchen (Teilen-Funktion von claude.ai).

### Auftrag an Claude

```text
Erstelle bitte aus diesem Repository ein Artefakt von Lectora.

1. Führe im Repository aus: git fetch --tags, dann git checkout vX.Y.Z. Prüfe mit git describe --tags --exact-match, dass genau
   dieser Tag ausgecheckt ist; sonst brich ab.
2. Führe aus: npm ci, dann node build.mjs. Prüfe, dass dist/index.html entstanden ist und mit <!DOCTYPE html> beginnt.
3. Veröffentliche dist/index.html unverändert als neues Artefakt mit dem Titel «Lectora Dokumentenprüfung». Ändere am Inhalt nichts.
4. Erkläre danach für dieses Artefakt genau diese Fähigkeiten: {sample:{}, downloads:true}. «sample»: die Seite darf Claude fragen;
   «downloads»: die Seite darf Dateien zum Herunterladen anbieten. Erkläre keine weiteren Fähigkeiten.
5. Gib mir den Link zum Artefakt, den Tag und die Version aus package.json.

Wenn ein Schritt nicht geht, brich ab und sag mir genau, woran es liegt. Veröffentliche nichts anderes als dist/index.html.
```

### Checkliste nach dem Veröffentlichen

Öffne das Artefakt in claude.ai und prüfe:

- [ ] Die Startseite zeigt die Karte «KI nur auf Ihren Auftrag» (nicht «Ohne Konto und ohne KI»). Oben links steht keine Kennzeichnung «Offline-Ausgabe».
- [ ] «Beispieldokumente laden» lädt drei Dokumente (JSZip ist geladen).
- [ ] Eine PDF-Datei lässt sich öffnen (pdf.js und seine Hilfsdatei sind geladen).
- [ ] Prüfung → «KI-Prüfung starten»: Lectora zeigt unter «Gesendet wird», was gesendet wird, und fragt nach. Beim ersten Mal fragt claude.ai zusätzlich um Zustimmung. Ohne Zustimmung geht nichts weg.
- [ ] Ein Beispieldokument mit dem Vermerk «VERTRAULICH» in der Fusszeile: Jede KI-Funktion zeigt «Nicht an Claude senden» und sendet nichts.
- [ ] Export einer Word-Datei → «Mit Korrekturmodus herunterladen»: claude.ai fragt vor dem Herunterladen nach.
- [ ] Export einer PDF-Datei → «Mit Kommentaren herunterladen» funktioniert (pdf-lib ist geladen).
- [ ] Anleitung → Abschnitt «Datenhaltung» nennt cdnjs und die Integritätsprüfung aller vier Dateien; Abschnitt «KI-Prüfung ist freiwillig» beschreibt Claude.

Fehlt eine KI-Funktion oder steht dort «nicht verfügbar», ist die Fähigkeit `sample` nicht erklärt. Fehlt das Herunterladen (Lectora bietet nur Kopieren an), ist `downloads` nicht erklärt. Bitte Claude, die fehlende Fähigkeit für dasselbe Artefakt zu erklären.

## Eine neue Version veröffentlichen

1. Suche die Nummer der neusten Version auf der Seite [Releases](https://github.com/SEM-SGG/lectora/releases/latest) (siehe [release.md](release.md)).
2. Gib Claude diesen Auftrag (mit dieser Nummer statt `vX.Y.Z`):

```text
Aktualisiere bitte das bestehende Lectora-Artefakt <Link zum Artefakt>.

1. Führe im Repository aus: git fetch --tags, dann git checkout vX.Y.Z; prüfe mit git describe --tags --exact-match, dass genau
   dieser Tag ausgecheckt ist; sonst brich ab.
2. Führe aus: npm ci, dann node build.mjs.
3. Veröffentliche dist/index.html unverändert als neue Version über dasselbe Artefakt. Titel und Fähigkeiten bleiben, wie sie sind
   ({sample:{}, downloads:true}).
4. Gib mir den Link, den Tag und die Version aus package.json.
```

3. Prüfe die Checkliste oben. Die Anleitung zeigt am Schluss «Version … · Stand …».

Wer das Artefakt schon geöffnet hat, sieht die neue Version nach dem Neuladen.

## Häufige Fragen

**Warum nicht einfach die Offline-Datei hochladen?** Die Offline-Ausgabe schaltet die KI-Funktionen ab und speichert über den Download des Browsers, den das Artefakt nicht erlaubt.

**Kann ich das Artefakt der Sektion öffentlich teilen?** Technisch ja. Jede Person braucht aber ein eigenes Claude-Konto für die KI-Funktionen, und ihre Nutzung zählt zu ihrem Kontingent. Kläre vorher mit der Informationssicherheit, welche Dokumente an Claude gehen dürfen.

**Was sieht Claude von den Dokumenten?** Nur, was eine KI-Funktion nach deinem Klick sendet. Siehe [datenschutz.md](datenschutz.md).
