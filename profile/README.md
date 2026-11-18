# Standardprofile der Sektion

Dieser Ordner enthält die Standardprofile, die Lectora mitliefert. Der Build bettet jede Datei `*.json` ein. Auf der Seite «Kriterien» wählst du im Profilband ein Standardprofil und klickst «Standardprofil laden». Lectora zeigt vor dem Übernehmen dieselbe Rückfrage wie bei einer Profildatei.

**Die Werte sind Startwerte.** Die Sektion passt sie an ihre Praxis an. Sie sind aus dem Kriterienkatalog abgeleitet, nicht aus einer Vorgabe der Sektion.

## Abweichungen vom Standard

Alles, was hier nicht steht, entspricht der Grundeinstellung von Lectora (alle Kriterien eingeschaltet, Parameter auf dem Standardwert).

| Profil | Einstellung | Standard | Startwert | Begründung |
| --- | --- | --- | --- | --- |
| SGG Weisung | `L01.note` Satzlänge, Hinweis ab | 32 Wörter | 25 Wörter | Pflichten sollen in kurzen Sätzen stehen. |
| SGG Weisung | `L01.warn` Satzlänge, Warnung ab | 45 Wörter | 35 Wörter | Lange Sätze verdecken, wer was tun muss. |
| SGG Weisung | `S06.maxWords` Absatzlänge | 150 Wörter | 120 Wörter | Eine Regel je Absatz. |
| SGG Weisung | `L06` Verbindliche Formulierungen | eingeschaltet | eingeschaltet | Bleibt bewusst an: Das Kriterium gilt nur für Weisungen. |
| SGG Konzept | `L01.note` Satzlänge, Hinweis ab | 32 Wörter | 30 Wörter | Etwas strenger als der Standard. |
| SGG Konzept | `L01.warn` Satzlänge, Warnung ab | 45 Wörter | 40 Wörter | Etwas strenger als der Standard. |
| SGG Konzept | `S04.minWords` Zusammenfassung ab | 1500 Wörter | 1000 Wörter | Konzepte gehen an Entscheidgremien; eine Zusammenfassung lohnt sich früh. |
| SGG Konzept | `S05.minWords` Inhaltsverzeichnis ab | 2500 Wörter | 2000 Wörter | Längere Konzepte brauchen eine Übersicht. |
| SGG Konzept | `S05.minHeads` Inhaltsverzeichnis ab | 8 Überschriften | 6 Überschriften | Wie oben. |
| SGG Aktennotiz | `S04` Zusammenfassung bei langen Dokumenten | eingeschaltet | ausgeschaltet | Eine Aktennotiz ist selbst die Zusammenfassung. |
| SGG Aktennotiz | `S05` Inhaltsverzeichnis bei langen Dokumenten | eingeschaltet | ausgeschaltet | Aktennotizen haben keine Kapitelstruktur, die ein Verzeichnis braucht. |

Die Profile ändern keine KI-Kriterien. Sie gelten deshalb in der Offline-Ausgabe und in der Artefakt-Ausgabe gleich.

## Format

Jede Datei ist ein gewöhnliches Prüfprofil (wie «Profil speichern» es schreibt) mit einem zusätzlichen Feld `names` für die Anzeige in drei Sprachen:

```json
{
  "format": "lectora-profil",
  "schema": 1,
  "name": "SGG Weisung",
  "names": { "de": "SGG Weisung", "fr": "SGG Directive", "it": "SGG Direttiva" },
  "created": "2026-11-18T00:00:00.000Z",
  "lectora": "2.0.0",
  "settings": { "off": [], "params": { "L01.note": 25 }, "custom": "", "terms": "", "acts": "", "author": "Lectora", "comments": true }
}
```

- `settings.off`: Kennungen der ausgeschalteten Kriterien (siehe Seite «Kriterien»).
- `settings.params`: nur Parameter, die vom Standard abweichen.
- Begriffsliste (`terms`), eigene Erlasse (`acts`) und eigene KI-Kriterien (`custom`) bleiben leer, solange die Sektion nichts festlegt.

## Ändern

1. Lade das Profil in Lectora, passe die Einstellungen an und speichere es mit «Profil speichern». Oder bearbeite die JSON-Datei direkt.
2. Ergänze `names` (de, fr, it), falls die Datei aus Lectora kommt.
3. Trage jede Abweichung vom Standard in die Tabelle oben ein.
4. Prüfe: `node test/profile_test.mjs` (meldet unbekannte Kriterien, Werte ausserhalb der Grenzen und fehlende Einträge in dieser Tabelle).
5. Baue neu: `npm run build`.

Mehr dazu in [docs/profile.md](../docs/profile.md).
