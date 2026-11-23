# Erlasstabelle

Lectora kennt rund 60 Bundeserlasse mit SR-Nummer, amtlicher Abkürzung und Kurztitel auf Deutsch, Französisch und Italienisch. Die Regeln R04 (Abkürzung und SR-Nummer gehören zum selben Erlass) und X12 (Abkürzung in der Sprache der Fassung) nutzen sie.

- Tabelle: `src/erlasse.js`, Liste `RAW`, ein Eintrag je Zeile: `[SR, Abk. de, fr, it, Kurztitel de, fr, it, ELI]`. `null` heisst: In dieser Sprache gibt es keine amtliche Abkürzung. Abkürzungen werden nie erfunden.
- Quellen: `design/erlasse-quellen.csv`, ein Eintrag je Erlass mit den Fedlex-Adressen und dem Datum der letzten Abfrage.
- Abgelöste Abkürzungen: `FORMER` in `src/erlasse.js` (AuG, LEtr, LStr bis Ende 2018; ANAG, LSEE, LDDS bis Ende 2007, alle SR 142.20). R04 meldet sie als Hinweis mit der heutigen Abkürzung, ohne Korrekturvorschlag, und nicht, wenn der Absatz den heutigen Erlass ebenfalls nennt.
- Eigene Erlasse (zum Beispiel interne Verordnungen) erfasst man in Lectora auf der Seite «Kriterien»; sie stehen im Prüfprofil, nicht in der Tabelle.

## Woher die Daten kommen

Aus dem SPARQL-Endpunkt der Bundeskanzlei (`https://fedlex.data.admin.ch/sparqlendpoint`), Erlass für Erlass über die ELI:

| Feld | Quelle |
| --- | --- |
| in Kraft | `jolux:inForceStatus` = `enforcement-status/0` |
| SR-Nummer | `jolux:historicalLegalId` |
| Abkürzung | `jolux:titleShort` der Sprachfassung |
| Kurztitel | `jolux:titleAlternative` der Sprachfassung; ohne amtlichen Kurztitel der Titel (`jolux:title`) ohne Datum und ohne die Abkürzung in Klammern |

## Abgleich

```sh
python3 tools/erlasse_abgleich.py            # Bericht, ändert nichts
python3 tools/erlasse_abgleich.py --write    # Änderungen übernehmen
```

Das Skript meldet:

- **Abkürzung geändert** und **Kurztitel geändert**: mit `--write` übernommen (abgeleitete Kurztitel nur gemeldet)
- **SR-Nummer geändert**: übernommen
- **nicht mehr in Kraft**: gemeldet; der Eintrag bleibt stehen
- **Nachfolger (neue ELI)**: ein anderer geltender Erlass mit derselben SR-Nummer; die ELI wird ersetzt, Abkürzung und Titel kommen beim nächsten Lauf

Exit-Code 0 heisst: keine Unterschiede. 3 heisst: Unterschiede. 2 heisst: Fedlex nicht erreichbar.

Nach einer Änderung:

```sh
node test/ausbau_test.mjs
python3 test/compare_test.py
python3 test/corpus_test.py
```

### Automatisch jeden Monat

Der Workflow `erlasse` läuft am 3. jedes Monats und auf Knopfdruck (Actions → `erlasse` → «Run workflow»). Findet er Unterschiede, öffnet er einen Pull Request vom Zweig `erlasse/abgleich` mit dem Bericht als Beschreibung. Ohne Unterschiede tut er nichts.

Wer die Fehlermails eines zeitgesteuerten Laufs erhält, wie die Übergabe an eine Nachfolge geht, was bei einem verspäteten oder ausgebliebenen Lauf zu tun ist und was ein Start von Hand bewirkt (er ersetzt den Inhalt eines offenen Pull Request dieses Workflows), steht in [pflege.md](pflege.md#zeitgesteuerter-lauf-übergabe-verspätung-start-von-hand).

Fedlex ist eine fremde Quelle. Liefert sie unplausible Werte (Abkürzung fehlt, wo es bisher eine gab; Markup, Adressen oder Steuerzeichen in einem Wert; SR-Nummer oder ELI in falscher Form; mehr als 6 automatische Änderungen bzw. mehr als 10 Prozent der Tabelle), übernimmt der Abgleich nichts, der Lauf scheitert mit den Gründen im Protokoll, und es entsteht kein Pull Request. Ist eine grosse Änderung echt (zum Beispiel eine Revision vieler Erlasse), führe den Abgleich lokal aus, prüfe die Werte von Hand und passe `MAX_CHANGES_ABS` in `tools/erlasse_abgleich.py` für diesen Lauf an. Die Werte im Bericht des Pull Requests sind maskiert: Markdown, Links und Erwähnungen (`@`) wirken dort nicht.

So gehst du mit dem Pull Request um:

1. Lies den Bericht. Prüfe jede Zeile auf Fedlex (Link in `design/erlasse-quellen.csv`).
2. Starte die Prüfungen: Ein Pull Request des Workflows startet `checks` nicht von selbst. Schliesse ihn und öffne ihn wieder («Close», dann «Reopen»).
3. Fälle «von Hand prüfen» (nicht mehr in Kraft ohne Nachfolger, abgeleitete Titel): Entscheide, ob der Eintrag bleibt, angepasst oder gestrichen wird. Bearbeite `src/erlasse.js` und `design/erlasse-quellen.csv` im selben Zweig.
4. Führe den Pull Request zusammen, wenn alles grün ist. Die Änderung erscheint mit der nächsten Version.

## Einen Erlass hinzufügen

1. Suche den Erlass auf [fedlex.admin.ch](https://www.fedlex.admin.ch) und notiere die ELI (zum Beispiel `cc/2007/758` aus `https://www.fedlex.admin.ch/eli/cc/2007/758/de`).
2. Füge in `src/erlasse.js` eine Zeile in `RAW` ein, sortiert nach SR-Nummer. Abkürzungen nur, wenn Fedlex sie führt; sonst `null`.
3. Füge in `design/erlasse-quellen.csv` die passende Zeile ein.
4. Prüfe mit `python3 tools/erlasse_abgleich.py`: Der neue Eintrag darf keine Unterschiede zeigen.
5. Führe die Tests oben aus und ergänze, wenn nötig, einen Fall in `test/ausbau_test.mjs`.

Der Test `test/erlasse_test.py` arbeitet mit Antworten von Fedlex, die am 18. November 2026 aufgezeichnet wurden (`test/fixtures/fedlex/`). Er braucht kein Netz und ändert sich nicht, wenn die Tabelle wächst.
