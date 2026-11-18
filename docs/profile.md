# Prüfprofile und Standardprofile

Ein Prüfprofil hält Einstellungen in einer Datei fest: ausgeschaltete Kriterien, Prüfparameter (zum Beispiel die Satzlänge), Begriffsliste, eigene Erlasse, eigene KI-Kriterien, Autorname und Kommentaroption des Word-Exports. Es enthält nie Dokumentinhalte, Dateinamen oder Befunde.

## In Lectora

Auf der Seite «Kriterien», im Band «Prüfprofil»:

- **Profil speichern:** schreibt die aktuellen Einstellungen in eine Datei `Lectora-Profil_<Name>.json`.
- **Profil laden:** liest eine Profildatei. Vor dem Übernehmen zeigt Lectora, was sich ändert und was es nicht übernimmt (unbekannte Kriterien, Werte ausserhalb der Grenzen).
- **Standardprofil laden:** lädt eines der Profile, die mit Lectora ausgeliefert werden. Die Rückfrage ist dieselbe wie bei einer Datei.

Ein geladenes Profil gilt bis zum Neuladen der Seite oder bis «Sitzung leeren». Lectora merkt sich nichts.

## Standardprofile der Sektion

Die Dateien liegen in [`profile/`](../profile/). Der Build bettet sie in alle Ausgaben ein. Heute gibt es drei:

| Datei | Name (de / fr / it) | Für |
| --- | --- | --- |
| `sgg-weisung.json` | SGG Weisung / SGG Directive / SGG Direttiva | Weisungen: kürzere Sätze und Absätze |
| `sgg-konzept.json` | SGG Konzept / SGG Concept / SGG Concetto | Konzepte: Zusammenfassung und Inhaltsverzeichnis früher verlangt |
| `sgg-aktennotiz.json` | SGG Aktennotiz / SGG Note au dossier / SGG Nota agli atti | Aktennotizen: ohne Zusammenfassung und Inhaltsverzeichnis |

Die Werte sind **Startwerte**. Jede Abweichung vom Standard steht mit Begründung in [`profile/README.md`](../profile/README.md).

## Ein Standardprofil ändern oder hinzufügen

1. Lade in Lectora das Profil (oder beginne mit den Standardeinstellungen), passe die Einstellungen an und speichere mit «Profil speichern».
2. Lege die Datei unter `profile/` ab, mit einem Namen aus Kleinbuchstaben und Bindestrichen (zum Beispiel `sgg-bericht.json`).
3. Ergänze das Feld `names` mit dem Namen auf Deutsch, Französisch und Italienisch. `name` ist gleich `names.de`.
4. Trage jede Abweichung vom Standard in die Tabelle in `profile/README.md` ein.
5. Prüfe:
   ```sh
   node test/profile_test.mjs
   npm run build
   ```
   Der Test scheitert, wenn ein Kriterium oder Parameter im Katalog nicht (mehr) vorkommt, wenn ein Wert ausserhalb der Grenzen liegt, wenn ein Name fehlt oder wenn die Tabelle eine Abweichung nicht nennt. Er erwartet heute genau drei Profile; passe die Zahl in `test/profile_test.mjs` an, wenn ein Profil dazukommt.

## Wenn sich der Katalog ändert

Benennt jemand ein Kriterium oder einen Parameter um, schlägt `test/profile_test.mjs` fehl. So kann ein Profil nicht still eine Einstellung verlieren. Passe dann die Profile im selben Pull Request an.

## Format

Siehe [`profile/README.md`](../profile/README.md#format). Das Format liest und prüft `src/profile.js` (`DP.profile.parse`): höchstens 512 KiB, `format: "lectora-profil"`, `schema: 1`; unbekannte Felder werden übergangen.
