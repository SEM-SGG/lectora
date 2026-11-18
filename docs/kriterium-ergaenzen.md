# Ein Kriterium ergänzen: Beispiel

Dieses Beispiel ergänzt eine lokale Regel: **T11 – Abkürzungen mit Leerzeichen**. Nach den Schreibweisungen des Bundes steht in «z. B.», «d. h.», «u. a.» ein Leerzeichen zwischen den Teilen. Lectora soll «z.B.» finden und «z. B.» (mit geschütztem Leerzeichen) vorschlagen.

Die Schritte gelten für jede lokale Regel: Katalog, Regel, Texte in drei Sprachen, Testdokument, Korpus, Tests.

Grundsatz: **Präzision vor Trefferquote.** Ein falscher Befund kostet Vertrauen. Lässt sich ein Muster nicht zuverlässig erkennen, wird die Regel ein Hinweis (Schweregrad `info`) oder entfällt.

## 1. Katalogeintrag

In `src/rules.js`, Liste `CATALOG`, nach `T10`:

```js
{ id: 'T11', cat: 'typo', sev: 'info', langs: ['de'] },
```

- `cat`: Kategorie (`formal`, `struct`, `lang`, `typo`, `refs`, `tech`); bestimmt den Abschnitt auf der Seite «Kriterien».
- `sev`: `error`, `warn` oder `info`. Neue Regeln beginnen als `info`, bis der Korpus zeigt, dass sie zuverlässig sind.
- Einschränkungen: `langs` (Sprachen), `types` (Dokumenttypen), `formats` (`docx`, `pdf`, `pptx`).

## 2. Regel

In `src/rules.js`, Funktion `runRules`, im Abschnitt Schreibweisen, nach der Regel `T10`:

```js
if (run('T11')) for (const p of body) {
  // «z.B.», «d.h.», «u.a.», «s.o.», «s.u.» ohne Leerzeichen; nicht mitten in einem Wort oder einer Zahl
  const re = /(?<![\p{L}\p{N}.])(?:z\.B|d\.h|u\.a|s\.o|s\.u)\./gu;
  let m;
  while ((m = re.exec(p.text))) F.push(mk('T11', { para: p.i, start: m.index, end: m.index + m[0].length, fix: { start: m.index + 2, end: m.index + 2, repl: ' ' } }));
}
```

- `run('T11')` ist wahr, wenn das Kriterium eingeschaltet ist und zum Dokument passt (Sprache, Typ, Format).
- `body` sind die Absätze ohne Fussnoten; `p.i` ist die Nummer des Absatzes.
- `start` und `end` markieren die Stelle im Absatz. `fix` ist der Vorschlag: an Position `start` bis `end` den Text `repl` einsetzen (hier ein geschütztes Leerzeichen nach dem ersten Punkt).
- Muster mit Buchstaben: nie `\b` (kennt keine Umlaute und Akzente). Nimm Unicode-Klassen wie oben oder die Hilfen in `src/lang.js` (`L.U()`).
- Schreibe in `src/` geschützte Leerzeichen immer als ` `. Danach: `python3 tools/norm.py`.

## 3. Texte in drei Sprachen

In `src/i18n.js`, je im Block `de`, `fr` und `it`, bei den anderen T-Kriterien:

```js
// de
'c.T11.t': 'Abkürzungen mit Leerzeichen', 'c.T11.d': 'In Abkürzungen wie «z. B.» oder «d. h.» steht ein geschütztes Leerzeichen.',
'f.T11': 'Geschütztes Leerzeichen in der Abkürzung setzen.',
// fr
'c.T11.t': 'Abréviations allemandes avec espace', 'c.T11.d': 'Dans les abréviations allemandes comme « z. B. » ou « d. h. », une espace insécable sépare les éléments.',
'f.T11': 'Placer une espace insécable dans l’abréviation.',
// it
'c.T11.t': 'Abbreviazioni tedesche con spazio', 'c.T11.d': 'Nelle abbreviazioni tedesche come «z. B.» o «d. h.» uno spazio non separabile separa gli elementi.',
'f.T11': 'Inserire uno spazio non separabile nell’abbreviazione.',
```

- `c.<id>.t` und `c.<id>.d`: Titel und Beschreibung auf der Seite «Kriterien».
- `f.<id>`: Text des Befunds. Braucht der Text Werte, kommen sie als `{name}` und im Befund als `params`.
- Deutsch: Schweizer Schreibweise ohne «ß», Anrede «Sie» wie in den übrigen Texten. Französisch und Italienisch: idiomatisch, im Sprachgebrauch des Bundes, nicht Wort für Wort.
- Prüfen: `node test/i18n_test.mjs` muss «0 Fehler» melden.

## 4. Testdokument

Die Testdokumente sind erfunden und entstehen in `test/make_fixtures.py`. Baue den Fehler in ein Dokument ein, in dem die Regel anschlagen muss. In der Funktion `de_flawed()`, nach dem letzten `r.insert(…)`:

```python
r.insert(i + 7, ('P', 'Rückfragen, z.B. zur Identität, beantwortet die Kanzlei.'))
```

Dann neu erzeugen:

```sh
python3 test/make_fixtures.py
```

Der Generator schreibt alle Testdokumente neu. Auch unveränderte Dateien unterscheiden sich danach in einzelnen Bytes (Zeitstempel); das ist normal.

Ein Gegenbeispiel gibt es schon: Das Konzept `konzept_real_de.docx` schreibt «z. B.» richtig.

## 5. Referenzkorpus

Der Korpus in `test/corpus/` hält von Hand beurteilte Erwartungen fest. Trage den Fall ein, der erscheinen **muss**, in `test/corpus/weisung_de_flawed.json` unter `must`:

```json
{ "crit": "T11", "quote": "z.B.", "why": "Abkürzung ohne Leerzeichen" }
```

und die Stelle, an der die Regel **nicht** anschlagen darf, in `test/corpus/konzept_real_de.json` unter `mustNot`:

```json
{ "crit": "T11", "quote": "z. B.", "why": "richtig geschrieben" }
```

Dann:

```sh
node build.mjs --local
python3 test/corpus_test.py
```

Meldet der Lauf einen unbeurteilten Befund, beurteile ihn: in `must` (richtig) oder in `mustNot` (Fehlalarm). Stimmt alles, schreibe die Basis neu:

```sh
python3 test/corpus_test.py --write-baseline
```

Die Basis (`test/corpus/baseline.json`) hält Präzision und Trefferquote je Kriterium fest. Ein späterer Lauf scheitert, wenn ein Kriterium schlechter wird.

Für die Vergleichsprüfungen X11 und X12 und für R04 gibt es zusätzlich einen Sprachkorpus aus Satzpaaren (`test/sprachkorpus/`, Lauf `node test/sprachkorpus_test.mjs`). Wer diese Prüfungen ändert, ergänzt dort Fälle in beide Richtungen.

Dieser Ablauf ist erprobt: Mit den Schritten 1 bis 5 meldet `corpus_test.py` für T11 einen erwarteten und gefundenen Befund, keinen Fehlalarm und «FEHLER: keine».

## 6. Tests

```sh
python3 tools/norm.py
npm test
```

Das neue Testdokument und das neue Kriterium verändern Zahlen, die andere Tests erwarten, zum Beispiel die Zahl der Kriterien auf der Startseite oder die Zahl der Befunde in `weisung_de_flawed.docx`. Passe diese Erwartungen an, wenn die Änderung gewollt ist, und nenne sie im Pull Request.

Ergänze einen Logiktest mit einem Fall, der anschlagen muss, und einem, der es nicht darf, zum Beispiel in `test/ausbau_test.mjs` (Muster dort: Dokument aus wenigen Absätzen bauen, `DP.rules.runRules` aufrufen, Befunde zählen):

- «z.B. morgen» → ein Befund T11
- «z. B. morgen», «Az.B.12» (Aktenzeichen) und ein französischer Text mit «z.B.» → kein Befund

## 7. Prüfen und abgeben

- Seite «Kriterien»: T11 steht unter «Schreibweisen und Typografie» in allen drei Sprachen.
- Prüfung von `weisung_de_flawed.docx`: Der Befund erscheint an der richtigen Stelle; «Annehmen» setzt das Leerzeichen; der Word-Export enthält die Änderung.
- `CHANGELOG.md`: neuer Eintrag unter der kommenden Version («Neues Kriterium T11: Abkürzungen mit Leerzeichen»).
- Pull Request mit der Checkliste aus der Vorlage.

## KI-Kriterien

Kriterien, die Claude prüft (`ai: true`), haben keine lokale Regel. Ihre Beschreibung für Claude steht in `src/ai.js` (`QDESC`). Jede Anfrage behandelt den Dokumenttext als Daten, nie als Anweisung. Neue KI-Kriterien brauchen einen Test mit simuliertem `window.claude` (`test/ki_test.mjs`, `test/ki_ui_test.py`).
