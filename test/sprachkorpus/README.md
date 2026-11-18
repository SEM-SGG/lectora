# Sprachkorpus für X11, X12 und R04

`faelle.json` enthält Satzpaare und Einzelsätze, an denen die Prüfungen X11 (gleiche Verbindlichkeit), X12 (gleiche Erlasse) und R04 (Abkürzungen von Erlassen) gemessen werden. Alle Sätze sind eigene oder synthetische Formulierungen im Stil der Bundesverwaltung; kein Satz stammt aus einem echten Dokument.

| Teil | Inhalt |
| --- | --- |
| `X11` | Satzpaare DE–FR, DE–IT, FR–IT. `flag: true`: die Verbindlichkeit weicht ab und X11 muss melden; `false`: korrekte Übersetzung, X11 darf nicht melden (Indikativ für Pflicht, «soll», «kann» als Fähigkeit, epistemisches «peut», «ne … que», Fragen, Bedingungen, Verneinungsumfang, «vous», «voi») |
| `X12` | Satzpaare mit zitierten Erlassen. `r04: true`: in der Anwendung meldet R04 die Stelle in der Zielfassung (X12 schweigt dann); der Fall zählt als gemeldet, wenn X12 oder R04 anschlägt |
| `R04` | Einzelsätze; `kind: "h"` steht für eine Überschrift |
| `muster` | Ein Mustererlass in drei gleichwertigen Fassungen. Jede Bestimmung wird als Paar DE–FR, DE–IT und FR–IT verglichen (X11, X12) und in jeder Sprache einzeln geprüft (R04). Nichts darf anschlagen. Er ersetzt die frühere Probe mit dem AIG |

`bekannt` beschreibt eine bewusste Grenze der Prüfung (zum Beispiel: Aussagen im Indikativ vergleicht X11 nicht). Ein solcher Fall zählt in Präzision und Trefferquote, bricht den Lauf aber nicht ab.

## Lauf

```sh
node test/sprachkorpus_test.mjs           # Kennzahlen, Abweichungen, Vergleich mit basis.json
node test/sprachkorpus_test.mjs --alle    # auch die richtig beurteilten Fälle zeigen
node test/sprachkorpus_test.mjs --basis-schreiben   # nach einer bewussten Verbesserung
```

Der Test scheitert, wenn ein Fall ohne `bekannt` falsch beurteilt wird, wenn Präzision oder Trefferquote eines Kriteriums unter `basis.json` fällt oder wenn Fälle verschwinden. Er gehört zur Gruppe «schnell» in `test/run.py`.

## Pflege

Neue Fälle kommen ans Ende des jeweiligen Teils, mit der nächsten freien Kennung (`X11-087` usw.). Jede Regeländerung an `src/modal.js`, `src/erlasse.js` oder `checkModal`/`checkActs` in `src/align.js` braucht Fälle in beide Richtungen: einen, der melden muss, und einen, der nicht melden darf.
