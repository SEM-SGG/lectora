# Sicherheit

## Eine Sicherheitslücke melden

Melde Sicherheitslücken **nicht** als öffentliches Issue.

1. Öffne im Repository den Reiter «Security» und wähle «Report a vulnerability» (private Meldung an die Verantwortlichen).
2. Beschreibe, was passiert, wie es sich auslösen lässt und welche Ausgabe betroffen ist (Offline-Ausgabe, GitHub Pages, Artefakt).
3. Lege keine echten Dokumente bei. Ein erfundenes Beispiel genügt.

Ist die private Meldung nicht eingeschaltet, schreibe ein Issue ohne Einzelheiten («Bitte um Kontakt wegen einer Sicherheitsfrage»). Die Sektion meldet sich.

## Was als Sicherheitslücke gilt

- Lectora sendet Daten an eine Stelle, die nicht in [docs/datenschutz.md](docs/datenschutz.md) steht.
- Inhalt eines Dokuments, einer Profil- oder Rückmeldedatei oder der Versionsdatei führt Code aus oder verändert die Oberfläche über Text hinaus.
- Die Sicherheitsrichtlinie (CSP) der Offline-Ausgabe lässt sich umgehen.
- Eine KI-Funktion sendet Text ohne ausdrückliche Zustimmung.
- Ein Export enthält Daten, die nicht hineingehören (zum Beispiel Inhalte eines anderen Dokuments).

## Unterstützte Versionen

Korrekturen erscheinen in der neusten Version. Ältere Versionen erhalten keine Korrekturen; die Offline-Ausgabe weist beim Start auf eine neuere Version hin.
