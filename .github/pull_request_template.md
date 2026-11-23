## Was ändert sich

<!-- Für Nutzerinnen und Nutzer: was neu ist, was anders ist, was behoben ist. Kein Text aus echten Dokumenten. -->

Produktdokumentation: nachgeführt
<!-- oder: «Produktdokumentation: nicht betroffen, weil …» (mit Grund). Bei jeder Änderung an Funktion, Oberfläche oder Bedienweg
     muss docs/lectora-dokumentation.html in allen drei Sprachen nachgeführt werden (AGENTS.md, Abschnitt «Produktdokumentation»). -->

## Prüfliste

- [ ] `python3 tools/norm.py` nach Änderungen in `src/`
- [ ] `node test/i18n_test.mjs`: 0 Fehler (neue Texte in de, fr und it)
- [ ] `npm test` lokal oder die Prüfungen (`checks`) in diesem Pull Request grün
- [ ] Neue Regel oder geänderte Regel: Referenzkorpus gepflegt (`test/corpus/`), `python3 test/corpus_test.py` ohne Fehler
- [ ] Neue Bedienelemente: festes `data-fid`, in `a11y_test.py` und `contrast_test.py` erfasst, Bildschirmfotos bei 1440 und 375 px (DE und FR) angesehen
- [ ] Keine Speicherung, keine neuen Netzwerkaufrufe, KI nur auf ausdrücklichen Klick (siehe AGENTS.md)
- [ ] `python3 tools/hygiene.py`: 0 Befunde (nichts Internes, keine echten Dokumente)
- [ ] `CHANGELOG.md` ergänzt (bei Änderungen für Nutzerinnen und Nutzer)
- [ ] Dokumentation in `docs/` angepasst, wo nötig
- [ ] Produktdokumentation (`docs/lectora-dokumentation.html`, DE, FR, IT) nachgeführt oder begründet nicht betroffen; `python3 tools/doku_check.py` ohne Abweichung
- [ ] Kein Inhalt mit Vermerk INTERN oder höher, keine Personendaten (Datenregel der SGG, README.md)
