# Einstellungen des Repositorys

Die Workflows und die Dokumente setzen einige Einstellungen bei GitHub voraus. Ohne sie scheitern Veröffentlichungen, Pull Requests der Erlasstabelle oder private Meldungen von Sicherheitslücken. Diese Seite nennt jede Einstellung, wo sie steht, wozu sie dient und was ohne sie geschieht.

Die Pfade beziehen sich auf die englische Oberfläche von GitHub. «Organisation» meint die Einstellungen der Organisation `SEM-SGG`, «Repository» die von `SEM-SGG/lectora`. Für die meisten Einstellungen braucht es die Rolle «Admin» im Repository bzw. «Owner» in der Organisation. Bezeichnungen mit ¹ stehen nicht in der Hilfe von GitHub; auf dem Bildschirm können sie leicht anders lauten.

## Übersicht

| Einstellung | Wo | Nötig für | Ohne sie |
| --- | --- | --- | --- |
| Pages aus GitHub Actions | Repository → Settings → Pages → Build and deployment → Source: **GitHub Actions** | Workflow `release` (Auftrag `pages`, beide Wege), Workflow `pages` (Zurückrollen) | Der Auftrag `pages` scheitert; Webseite und `version.json` werden nicht veröffentlicht, ältere Offline-Ausgaben erfahren nichts von der neuen Version |
| Umgebung `github-pages` lässt `main` zu | Repository → Settings → Environments → `github-pages` → Deployment branches and tags: **No restriction** oder **Selected branches and tags** mit einer Regel für den Branch `main` (GitHub legt die Umgebung beim Umstellen von Pages auf GitHub Actions selbst an; prüfe, dass `main` zugelassen ist) | Workflow `release` beim Start von Hand (läuft für `main`), Workflow `pages` (Zurückrollen, läuft für `main`) | Release angelegt, Pages nicht; der Auftrag `pages` meldet «… is not allowed to deploy to github-pages due to environment protection rules» |
| Umgebung `github-pages` lässt Tags zu (nur für den Weg über die Kommandozeile) | Repository → Settings → Environments → `github-pages` → Deployment branches and tags → **Add deployment branch or tag rule**¹ → Ref type **Tag**¹, Name pattern **`v*`** | Workflow `release`, nur wenn ein geschobener Tag ihn startet (der Auftrag `pages` läuft dann für den Tag) | «Tag "vX.Y.Z" is not allowed to deploy to github-pages due to environment protection rules»: Release angelegt, Pages nicht. Der Start von Hand braucht diese Regel nicht |
| Pull Requests durch Actions | Organisation → Settings → Actions → General → Workflow permissions → **Allow GitHub Actions to create and approve pull requests**; danach dieselbe Einstellung im Repository (Settings → Actions → General) | Workflow `erlasse` | `gh pr create` scheitert («GitHub Actions is not permitted to create or approve pull requests»); der Zweig `erlasse/abgleich` ist geschoben, aber es gibt keinen Pull Request |
| Leserechte als Vorgabe für den Token | Repository → Settings → Actions → General → Workflow permissions → **Read repository contents and packages permissions** | alle Workflows (jeder Auftrag verlangt seine Rechte selbst) | Nichts scheitert, aber Aufträge ohne eigene Angabe hätten Schreibrechte |
| Private Meldung von Sicherheitslücken | Repository → Settings → Code security → **Private vulnerability reporting: Enable** | `SECURITY.md`, Vorlage «Sicherheitslücke melden» | Der Link in der Issue-Auswahl führt ins Leere; Meldende weichen auf öffentliche Issues aus |
| Ruleset für `main` | Repository → Settings → Rules → Rulesets → **New branch ruleset**, Target: Default branch; **Restrict deletions**, **Block force pushes**, **Require a pull request before merging** (mindestens 1 Freigabe, **Require review from Code Owners**), **Require status checks to pass**: die beiden Aufträge von `checks` («Logik, Export, Hygiene» und «Oberfläche, Barrierefreiheit, Offline-Ausgabe») | Prüfungen und Freigabe vor jedem Zusammenführen; veröffentlicht wird nur ein geprüfter und freigegebener Stand von `main`, auch die neue Versionsnummer selbst | Ungeprüfter Code kann auf `main` gelangen und veröffentlicht werden |
| Ruleset für Tags `v*` | Repository → Settings → Rules → Rulesets → **New ruleset** → **New tag ruleset**, Target: Include by pattern `v*`; **Restrict updates**, **Restrict deletions**; **Restrict creations** nur mit passender Ausnahme, siehe [Ruleset für Tags und der Start von Hand](#ruleset-für-tags-und-der-start-von-hand) | Workflow `release` | Jede Person mit Schreibrecht kann einen Tag verschieben oder löschen; mit **Restrict creations** ohne Ausnahme für den Workflow scheitert der Start von Hand im Auftrag «GitHub Release» |
| CODEOWNERS ausgefüllt | Datei `.github/CODEOWNERS`: Platzhalter durch Team oder Personen ersetzen, `#` entfernen | Ruleset «Require review from Code Owners» | Die Regel greift nicht; Änderungen an `src/ai.js`, `src/update.js`, `build.mjs`, `.github/` brauchen keine Freigabe der Verantwortlichen |
| Secret scanning und Push protection | Repository → Settings → Code security → **Secret scanning: Enable**, **Push protection: Enable** | Schutz vor versehentlich eingecheckten Zugangsdaten (zusätzlich zur Hygiene) | Ein Token im Commit bleibt unbemerkt, bis die Hygiene läuft – dann ist er schon öffentlich |
| Dependabot | Repository → Settings → Code security → **Dependabot alerts** und **Dependabot security updates: Enable** (die Datei `.github/dependabot.yml` steuert die Versions-Updates) | Hinweise auf veraltete Aktionen und Pakete | Keine Pull Requests für neue Versionen der Aktionen (die per Commit festgelegt sind) |
| Sperrliste der Hygiene (optional) | Repository → Settings → Secrets and variables → Actions → **New repository secret**, Name `LECTORA_HYGIENE_SPERRLISTE`, Inhalt: eine Zeichenfolge je Zeile (Namen von Personen, interne Bezeichnungen) | Workflow `checks` (Hygiene der Dateien und Commits) | Die Hygiene prüft ohne Sperrliste: Namen von Personen findet sie dann nur in Metadaten, nicht im Text |
| Labels | Repository → Issues → Labels: **fehler**, **fehlalarm** anlegen | Vorlagen `.github/ISSUE_TEMPLATE/fehler.yml` und `fehlalarm.yml` | Issues entstehen ohne Label; die Sortierung fehlt |

## Was jeder Weg der Veröffentlichung braucht

| Einstellung | Start von Hand (Actions → release → Run workflow) | Tag über die Kommandozeile | Zurückrollen (Actions → pages) |
| --- | --- | --- | --- |
| Pages aus GitHub Actions | ja | ja | ja |
| Umgebung `github-pages` lässt `main` zu | ja | nein | ja |
| Umgebung `github-pages` lässt Tags `v*` zu | nein | ja | nein |
| Ruleset für Tags `v*` | Der Workflow muss Tags `v*` anlegen dürfen (siehe unten) | Die Person, die den Tag schiebt, muss Tags `v*` anlegen dürfen | nichts |
| Ruleset für `main` | ja: Es sorgt dafür, dass nur geprüfter und freigegebener Stand veröffentlicht wird | ja | – |
| Rolle | Schreibrecht im Repository (für «Run workflow») | Schreibrecht und Ausnahme im Ruleset für Tags | Schreibrecht |

## Ruleset für Tags und der Start von Hand

Beim Start von Hand legt der Workflow den Tag `vX.Y.Z` selbst an, mit dem eingebauten Token (`GITHUB_TOKEN`). Ist im Ruleset für Tags **Restrict creations** eingeschaltet, dürfen nur die Akteure in der **Bypass list** Tags `v*` anlegen. Die Frage ist also: Wie kommt der eingebaute Token in die Bypass list?

Was die Dokumentation von GitHub dazu sagt (Stand November 2026):

- **Restrict creations:** «If selected, only users with bypass permissions can create branches or tags whose name matches the pattern you specify.» ([Available rules for rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets))
- **Wer in die Bypass list kann:** Repository admins, organization owners und enterprise owners; die Rollen maintain und write sowie eigene Rollen auf Grundlage von write; Teams (ausser geheimen); **GitHub Apps**; Dependabot. ([Creating rulesets for a repository](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository), Abschnitt zu den Bypass-Rechten). Seit Mai 2026 auch einzelne Personen ([Changelog vom 7. Mai 2026](https://github.blog/changelog/2026-05-07-repository-rulesets-user-bypass-and-branch-renaming)).
- **Was der eingebaute Token ist:** «The `GITHUB_TOKEN` secret is a GitHub App installation access token.» ([GITHUB_TOKEN](https://docs.github.com/en/actions/concepts/security/github_token))
- **Nicht geklärt:** Keine dieser Seiten sagt, ob die App hinter dem eingebauten Token («GitHub Actions») im Dialog **Add bypass** wählbar ist. Ebenso wenig steht dort, ob eine Ausnahme für eine Rolle (zum Beispiel «Repository admin» oder «Write») auch für den Token gilt. Eine [Diskussion in der Community von GitHub](https://github.com/orgs/community/discussions/13836) (2022, mit Beiträgen bis 2026) beschreibt, dass sich der Token nicht als Ausnahme eintragen lässt, und nennt als Umweg eine eigene GitHub App; eine Aussage von GitHub selbst fehlt dort.

Die Dokumentation entscheidet die Frage also nicht. So gehst du vor:

1. Öffne das Ruleset für Tags (Settings → Rules → Rulesets → Ruleset für `v*`).
2. Klicke im Abschnitt **Bypass list** auf **Add bypass** und suche nach «GitHub Actions».
3. **Erscheint «GitHub Actions»:** Wähle es aus, klicke **Add Selected** und lass die Einstellung auf **Always allow**. Speichere. Die erste Veröffentlichung mit dem Knopf zeigt, ob es wirkt: Wenn nicht, scheitert der Auftrag «GitHub Release» mit «Der Tag vX.Y.Z liess sich nicht anlegen: … Verhindert ein Ruleset für Tags v* das Anlegen, …». Veröffentlicht ist dann nichts.
4. **Erscheint es nicht, oder scheitert der Test:** Schalte im Ruleset für Tags **Restrict creations** aus. Lass **Restrict updates** und **Restrict deletions** eingeschaltet: Der Workflow braucht sie nicht, er legt Tags nur neu an. Wähle danach beim gescheiterten Lauf **Re-run jobs** → **Re-run failed jobs**; die Tests laufen nicht noch einmal.

Was ohne **Restrict creations** schützt: Veröffentlicht wird nur ein Stand von `main`, und auf `main` kommt nur, was die Prüfungen bestanden hat und freigegeben ist (Ruleset für `main`). Auch die neue Versionsnummer kommt nur über einen freigegebenen Pull Request in die Dateien. Der Workflow legt keinen Tag an, der schon besteht, und keinen für eine Nummer, die nicht in den Dateien steht. Was eine Person mit Schreibrecht ohne diese Regel zusätzlich kann: einen Tag `v*` von Hand anlegen. Er startet denselben Workflow mit denselben Prüfungen.

Mit oder ohne Ausnahme gilt: Jede Person mit Schreibrecht kann den Knopf **Run workflow** drücken (Hilfe von GitHub, Seite «Manually running a workflow»: «Write access to the repository is required to perform these steps.»). Wer veröffentlichen darf, steuerst du über die Personen mit Schreibrecht und über die Freigabe des Pull Request mit der neuen Versionsnummer.

## Adresse in den eigenen Commits

Die Hygieneprüfung lässt in Commits nur Adressen zu, die nichts über eine Person verraten: die `noreply`-Adressen von GitHub, Adressen unter `example.com` und die Adressen von GitHub selbst. Ein Commit mit einer persönlichen oder dienstlichen Adresse lässt den Workflow `checks` scheitern.

1. Öffne bei GitHub Settings → Emails und schalte **Keep my email addresses private** ein.
2. Kopiere die dort angezeigte Adresse der Form `ID+name@users.noreply.github.com`.
3. Trage sie lokal ein: `git config user.email "ID+name@users.noreply.github.com"`.

## Organisation und Repository: nicht umbenennen, nicht löschen

Offline-Ausgaben, die schon verteilt sind, fragen fest bei `https://sem-sgg.github.io/lectora/version.json` nach und verweisen zum Herunterladen fest auf `https://github.com/SEM-SGG/lectora/releases/latest/download/Lectora.html` (ältere Ausgaben bis 2.0.1 auf die Seite `https://github.com/SEM-SGG/lectora/releases/latest`). Die Anleitung verweist fest auf die Produktdokumentation `https://sem-sgg.github.io/lectora/dokumentation.html`. Daraus folgt:

- **Benenne die Organisation `SEM-SGG` und das Repository `lectora` nie um.** Nach einer Umbenennung findet keine verteilte Ausgabe mehr eine neue Version (Weiterleitungen sind für die Abfrage gesperrt).
- **Lösche sie nie.** Ist der Name frei, kann ihn jemand anders anlegen: Dann zeigen alle verteilten Ausgaben dessen Hinweise und verweisen auf dessen Downloads. Ein Repository, das nicht mehr gepflegt wird, wird **archiviert** (Settings → General → Danger Zone → Archive this repository), nicht gelöscht.
- Muss Lectora umziehen, bleibt das alte Repository bestehen und archiviert; die letzte Version darin weist im Hinweis (`version.json`, ohne Adresse) auf den Umzug hin, und die Anleitung nennt den neuen Ort.

## Prüfen, ob alles eingestellt ist

1. Settings → Pages: «Your site is live at https://sem-sgg.github.io/lectora/» (nach dem ersten Release).
2. Settings → Environments → `github-pages`: `main` ist zugelassen; für den Weg über die Kommandozeile zusätzlich eine Regel für Tags `v*`.
3. Actions → `erlasse` → «Run workflow»: Der Lauf endet grün (ohne Unterschiede ohne Pull Request).
4. Security → «Report a vulnerability» ist sichtbar.
5. Settings → Rules: zwei Rulesets, aktiv («Active»); im Ruleset für Tags entweder «GitHub Actions» in der Bypass list oder **Restrict creations** ausgeschaltet (siehe oben).
