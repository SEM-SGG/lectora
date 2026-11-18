# Einstellungen des Repositorys

Die Workflows und die Dokumente setzen einige Einstellungen bei GitHub voraus. Ohne sie scheitern Veröffentlichungen, Pull Requests der Erlasstabelle oder private Meldungen von Sicherheitslücken. Diese Seite nennt jede Einstellung, wo sie steht, wozu sie dient und was ohne sie geschieht.

Die Pfade beziehen sich auf die englische Oberfläche von GitHub. «Organisation» meint die Einstellungen der Organisation `SEM-SGG`, «Repository» die von `SEM-SGG/lectora`. Für die meisten Einstellungen braucht es die Rolle «Admin» im Repository bzw. «Owner» in der Organisation.

## Übersicht

| Einstellung | Wo | Nötig für | Ohne sie |
| --- | --- | --- | --- |
| Pages aus GitHub Actions | Repository → Settings → Pages → Build and deployment → Source: **GitHub Actions** | Workflow `release`, Auftrag `pages` | Der Auftrag `pages` scheitert; Webseite und `version.json` werden nicht veröffentlicht, ältere Offline-Ausgaben erfahren nichts von der neuen Version |
| Umgebung `github-pages` lässt Tags zu | Repository → Settings → Environments → `github-pages` → Deployment branches and tags → **Add deployment branch or tag rule** → Ref type **Tag**, Name pattern **`v*`** | Workflow `release`, Auftrag `pages` (läuft für einen Tag) | «Tag "vX.Y.Z" is not allowed to deploy to github-pages due to environment protection rules»: Release angelegt, Pages nicht |
| Pull Requests durch Actions | Organisation → Settings → Actions → General → Workflow permissions → **Allow GitHub Actions to create and approve pull requests**; danach dieselbe Einstellung im Repository (Settings → Actions → General) | Workflow `erlasse` | `gh pr create` scheitert («GitHub Actions is not permitted to create or approve pull requests»); der Zweig `erlasse/abgleich` ist geschoben, aber es gibt keinen Pull Request |
| Leserechte als Vorgabe für den Token | Repository → Settings → Actions → General → Workflow permissions → **Read repository contents and packages permissions** | alle Workflows (jeder Auftrag verlangt seine Rechte selbst) | Nichts scheitert, aber Aufträge ohne eigene Angabe hätten Schreibrechte |
| Private Meldung von Sicherheitslücken | Repository → Settings → Code security → **Private vulnerability reporting: Enable** | `SECURITY.md`, Vorlage «Sicherheitslücke melden» | Der Link in der Issue-Auswahl führt ins Leere; Meldende weichen auf öffentliche Issues aus |
| Ruleset für `main` | Repository → Settings → Rules → Rulesets → **New branch ruleset**, Target: Default branch; **Restrict deletions**, **Block force pushes**, **Require a pull request before merging** (mindestens 1 Freigabe, **Require review from Code Owners**), **Require status checks to pass**: die beiden Aufträge von `checks` («Logik, Export, Hygiene» und «Oberfläche, Barrierefreiheit, Offline-Ausgabe») | Prüfungen vor jedem Zusammenführen; Release nur von geprüftem Stand | Ungeprüfter Code kann auf `main` gelangen und mit einem Tag veröffentlicht werden |
| Ruleset für Tags `v*` | Repository → Settings → Rules → Rulesets → **New tag ruleset**, Target: Include by pattern `v*`; **Restrict creations**, **Restrict updates**, **Restrict deletions**, Bypass list: die verantwortlichen Personen oder das Team | Workflow `release` | Jede Person mit Schreibrecht kann eine Version veröffentlichen oder einen Tag verschieben |
| CODEOWNERS ausgefüllt | Datei `.github/CODEOWNERS`: Platzhalter durch Team oder Personen ersetzen, `#` entfernen | Ruleset «Require review from Code Owners» | Die Regel greift nicht; Änderungen an `src/ai.js`, `src/update.js`, `build.mjs`, `.github/` brauchen keine Freigabe der Verantwortlichen |
| Secret scanning und Push protection | Repository → Settings → Code security → **Secret scanning: Enable**, **Push protection: Enable** | Schutz vor versehentlich eingecheckten Zugangsdaten (zusätzlich zur Hygiene) | Ein Token im Commit bleibt unbemerkt, bis die Hygiene läuft – dann ist er schon öffentlich |
| Dependabot | Repository → Settings → Code security → **Dependabot alerts** und **Dependabot security updates: Enable** (die Datei `.github/dependabot.yml` steuert die Versions-Updates) | Hinweise auf veraltete Aktionen und Pakete | Keine Pull Requests für neue Versionen der Aktionen (die per Commit festgelegt sind) |
| Sperrliste der Hygiene (optional) | Repository → Settings → Secrets and variables → Actions → **New repository secret**, Name `LECTORA_HYGIENE_SPERRLISTE`, Inhalt: eine Zeichenfolge je Zeile (Namen von Personen, interne Bezeichnungen) | Workflow `checks` (Hygiene der Dateien und Commits) | Die Hygiene prüft ohne Sperrliste: Namen von Personen findet sie dann nur in Metadaten, nicht im Text |
| Labels | Repository → Issues → Labels: **fehler**, **fehlalarm** anlegen | Vorlagen `.github/ISSUE_TEMPLATE/fehler.yml` und `fehlalarm.yml` | Issues entstehen ohne Label; die Sortierung fehlt |

## Organisation und Repository: nicht umbenennen, nicht löschen

Offline-Ausgaben, die schon verteilt sind, fragen fest bei `https://sem-sgg.github.io/lectora/version.json` nach und verweisen zum Herunterladen fest auf `https://github.com/SEM-SGG/lectora/releases/latest`. Daraus folgt:

- **Benenne die Organisation `SEM-SGG` und das Repository `lectora` nie um.** Nach einer Umbenennung findet keine verteilte Ausgabe mehr eine neue Version (Weiterleitungen sind für die Abfrage gesperrt).
- **Lösche sie nie.** Ist der Name frei, kann ihn jemand anders anlegen: Dann zeigen alle verteilten Ausgaben dessen Hinweise und verweisen auf dessen Downloads. Ein Repository, das nicht mehr gepflegt wird, wird **archiviert** (Settings → General → Danger Zone → Archive this repository), nicht gelöscht.
- Muss Lectora umziehen, bleibt das alte Repository bestehen und archiviert; die letzte Version darin weist im Hinweis (`version.json`, ohne Adresse) auf den Umzug hin, und die Anleitung nennt den neuen Ort.

## Prüfen, ob alles eingestellt ist

1. Settings → Pages: «Your site is live at https://sem-sgg.github.io/lectora/» (nach dem ersten Release).
2. Settings → Environments → `github-pages`: eine Regel für Tags `v*`.
3. Actions → `erlasse` → «Run workflow»: Der Lauf endet grün (ohne Unterschiede ohne Pull Request).
4. Security → «Report a vulnerability» ist sichtbar.
5. Settings → Rules: zwei Rulesets, aktiv («Active»).
