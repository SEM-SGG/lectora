# Rückmeldungen zu den Regeln

Eine Regel, die zu Unrecht anschlägt (Fehlalarm), kostet Vertrauen. Lectora sammelt solche Fälle deshalb gezielt.

## In Lectora

1. In der Prüfung, beim Befund: «Fehlalarm melden». Optional mit einer Notiz, warum der Befund nicht stimmt.
2. Auf der Seite «Export», Abschnitt «Rückmeldung zu den Regeln»: «Rückmeldung speichern». Lectora schreibt eine Datei `Lectora-Rueckmeldung_<Datum>.json`.
3. Standardmässig enthält die Datei je Fehlalarm nur Kriterium, Art des Befunds, Sprache, Dokumenttyp, Format, die geltenden Prüfparameter und deine Notiz. Textstellen (die markierte Stelle und ihr Satz) und Dateinamen kommen nur dazu, wenn du «Textstellen beilegen» einschaltest.

## Wohin damit

**Rückmeldedateien mit Textstellen und jede Sammlung aus echten Dokumenten gehören nie in dieses öffentliche Repository.** Auch ein einzelner Satz aus einem internen Dokument kann vertraulich sein.

- Lege Rückmeldungen mit Textstellen im **internen Repository der Sektion** ab (privat, nur für die Sektion zugänglich).
- Ein Korpus aus echten Dokumenten (Beispiele, an denen Regeln anschlagen müssen oder nicht anschlagen dürfen) liegt ebenfalls nur dort.
- In diesem Repository liegen nur erfundene Beispiele: `test/corpus/` (Erwartungen zu den erfundenen Testdokumenten) und `test/corpus/rueckmeldungen/beispiel.json` (eine Rückmeldung zu einem erfundenen Dokument).

## Issues in diesem Repository

Ein Issue «Regel meldet Fehlalarm» ist willkommen, aber **ohne Dokumenttext**:

- Nenne das Kriterium (zum Beispiel `L06`), die Sprache, den Dokumenttyp und das Format.
- Beschreibe das Muster in eigenen Worten oder mit einem **selbst erfundenen** Beispielsatz, der dasselbe zeigt.
- Füge keine Rückmeldedatei mit Textstellen an, keine Bildschirmfotos von Dokumenten, keine Dokumente.

Ist das Muster ohne Originaltext nicht zu erklären, lege die Rückmeldung im internen Repository ab und verweise im Issue nur darauf («Rückmeldung vom 3. März im internen Repository»).

## Vom Fehlalarm zur besseren Regel

1. Liste die Kandidaten aus einer oder mehreren Rückmeldedateien (lokal, im internen Repository):
   ```sh
   python3 test/corpus_test.py --feedback pfad/zur/rueckmeldung.json
   ```
2. Baue das Muster mit einem erfundenen Satz in ein Testdokument ein (`test/make_fixtures.py`) und trage die Stelle in `test/corpus/<Testdokument>.json` unter `mustNot` ein.
3. Passe die Regel an, bis `python3 test/corpus_test.py` «FEHLER: keine» meldet. Lässt sich ein Fall lokal nicht zuverlässig erkennen, bleibt der Befund ein Hinweis, und der Eintrag bekommt `known` mit einer Begründung.
4. Weiter wie in [kriterium-ergaenzen.md](kriterium-ergaenzen.md).
