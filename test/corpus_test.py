"""Referenzkorpus der Regeln: misst je Kriterium, wie zuverlässig die lokalen Prüfungen auf den Testdokumenten sind.

test/corpus/*.json beschreibt je Testdokument (oder Sprachpaar) von Hand beurteilte Erwartungen:
  must     Befunde, die erscheinen MÜSSEN (Kriterium und eine Stelle: quote = Textstelle, para = Absatztext, refPara = Absatz der
           Referenzfassung, slide = Folie, kind = Absatzart, key = Befundart, params = Teilmenge der Parameter; ohne Stelle: Befund zum
           ganzen Dokument)
  mustNot  Stellen, an denen ein Kriterium NICHT anschlagen darf (ohne Stelle: nirgends im Dokument). Mit «known» (Begründung) ein
           bekannter Fehlalarm: zählt als falsch, bricht den Lauf aber nicht ab.
Ausgabe je Kriterium: erwartet, gefunden, verpasst, falsch, unbeurteilt, Präzision, Trefferquote; als Tabelle hier und in
test/out/korpus-bericht.md. Exit-Code 1, wenn eine Stelle aus mustNot anschlägt (ohne «known») oder ein Kriterium unter die Basis in
test/corpus/baseline.json fällt (Präzision, Trefferquote, mehr unbeurteilte Befunde).

Aufruf:  python3 test/corpus_test.py                      Korpus prüfen
         python3 test/corpus_test.py --write-baseline     Basis aus dem aktuellen Stand schreiben (nach bewusster Änderung)
         python3 test/corpus_test.py --feedback datei.json [weitere]  (Beispiel: test/corpus/rueckmeldungen/beispiel.json)   Rückmeldungen aus Lectora («Fehlalarm melden», Export) als
                                                          Kandidaten für mustNot je Kriterium auflisten (Einträge mit Textstelle)"""
import sys, os, json, glob, datetime
sys.path.insert(0, os.path.dirname(__file__))
from engine_test import ROOT, FX, serve, url, launch, b64, sync_playwright

CORPUS = os.path.join(ROOT, 'test', 'corpus')
BASE = os.path.join(CORPUS, 'baseline.json')
REPORT = os.path.join(ROOT, 'test', 'out', 'korpus-bericht.md')

MATCH_JS = r'''([spec]) => {
  const doc = docs[spec.tgt || spec.fixture], ref = spec.ref ? docs[spec.ref] : null;
  if (spec.lang) doc.lang = spec.lang; if (spec.type) doc.type = spec.type;
  const findings = ref ? DP.align.compare(ref, doc, {}).findings : DP.rules.runRules(doc, {}).findings;
  const occ = (text, q) => { const out = []; let i = text.indexOf(q); while (i >= 0) { out.push([i, i + q.length]); i = text.indexOf(q, i + 1); } return out; };
  const P = (i) => i != null && doc.paras[i] ? doc.paras[i] : null;
  function hit(f, e, strictPlace) {
    if (f.crit !== e.crit) return false;
    if (e.key && f.key !== e.key) return false;
    if (e.slide != null && (f.slide || (f.params && f.params.slide)) !== e.slide) return false;
    if (e.params) for (const k in e.params) if (!f.params || f.params[k] !== e.params[k]) return false;
    const p = P(f.para);
    if (e.kind && (!p || p.kind !== e.kind)) return false;
    if (e.quote) {
      if (!p) return false;
      const os = occ(p.text, e.quote); if (!os.length) return false;
      if (f.start == null) return true;
      const fe = Math.max(f.end, f.start + 1);
      return os.some(([a, b]) => f.start < b && fe > a);
    }
    if (e.para && !(p && p.text.includes(e.para))) return false;
    if (e.refPara && !(ref && f.refPara && f.refPara.some(k => ref.paras[k] && ref.paras[k].text.includes(e.refPara)))) return false;
    // must ohne Stelle: Befund zum ganzen Dokument (bzw. zur Folie); mustNot ohne Stelle: irgendwo im Dokument
    if (strictPlace && !e.quote && !e.para && !e.refPara && e.slide == null && f.para != null) return false;
    return true;
  }
  const must = (spec.must || []).map(e => findings.filter(f => hit(f, e, true)).map(f => f.id));
  const not = (spec.mustNot || []).map(e => findings.filter(f => hit(f, e, false)).map(f => f.id));
  const desc = (f) => { const p = P(f.para); return f.crit + ' ' + f.key + (f.quote ? ' «' + f.quote.slice(0, 60) + '»' : p ? ' ¶ ' + p.text.slice(0, 60) : f.slide ? ' Folie ' + f.slide : ' (ganzes Dokument)'); };
  return { findings: findings.map(f => ({ id: f.id, crit: f.crit, d: desc(f) })), must, not };
}'''


def load_specs():
    specs = []
    for p in sorted(glob.glob(os.path.join(CORPUS, '*.json'))):
        if os.path.basename(p) == 'baseline.json': continue
        s = json.load(open(p, encoding='utf-8')); s['_file'] = os.path.basename(p); specs.append(s)
    return specs


def feedback(paths):
    """Rückmeldedateien aus Lectora: Einträge mit Textstelle als Kandidaten für mustNot je Kriterium."""
    by = {}
    for p in paths:
        try: fb = json.load(open(p, encoding='utf-8'))
        except Exception as e: print('Rückmeldung nicht lesbar:', p, e); continue
        if fb.get('format') != 'lectora-rueckmeldung': print('keine Lectora-Rückmeldung:', p); continue
        for e in fb.get('entries', []): by.setdefault(e.get('crit', '?'), []).append((p, e))
    specs = load_specs()
    def clash(crit, e):
        # Steht dieselbe Stelle im Korpus schon als Muss-Befund? Dann widerspricht die Rückmeldung einem Urteil im Korpus
        return [sp['_file'] for sp in specs if e.get('file') in (sp.get('fixture'), sp.get('tgt')) for m in sp.get('must', [])
                if m['crit'] == crit and m.get('quote') and (m['quote'] in e['quote'] or e['quote'] in m['quote'])]
    print('\nRückmeldungen: Kandidaten für mustNot (von Hand beurteilen, dann in test/corpus/<Testdokument>.json übernehmen)')
    for crit in sorted(by):
        es = by[crit]; withq = [x for x in es if x[1].get('quote')]
        print(f'\n{crit}: {len(es)} Fehlalarm(e), davon {len(withq)} mit Textstelle')
        for p, e in withq:
            cand = {'crit': crit, 'quote': e['quote'], 'why': (e.get('note') or 'Fehlalarm aus der Praxis') + ' [' + os.path.basename(p) + ']'}
            if e.get('key'): cand['key'] = e['key']
            c = clash(crit, e)
            print('  ', json.dumps(cand, ensure_ascii=False), '| Satz:', (e.get('sentence') or '')[:160], '| Datei:', e.get('file', '–'), '| Parameter:', json.dumps(e.get('params', {})),
                  '| WIDERSPRUCH: im Korpus als Muss-Befund (' + ', '.join(c) + ')' if c else '')
        for p, e in es:
            if not e.get('quote'): print('   ohne Textstelle:', e.get('key') or e.get('source'), e.get('lang'), e.get('type'), '| Notiz:', e.get('note', '–'), '| Parameter:', json.dumps(e.get('params', {})))


def main():
    args = sys.argv[1:]
    if '--feedback' in args:
        i = args.index('--feedback'); feedback(args[i + 1:]); args = args[:i]
        if not args: return 0
    specs = load_specs()
    stats, fails, notes, unjudged = {}, [], [], []
    S = lambda c: stats.setdefault(c, {'exp': 0, 'found': 0, 'missed': 0, 'false': 0, 'unj': 0, 'tp': 0, 'guard': 0})
    serve(8781)
    with sync_playwright() as pw:
        br = launch(pw)
        pg = br.new_page(); pg.on('pageerror', lambda e: fails.append('pageerror: ' + str(e)))
        pg.goto(url(8781) + '/test/harness.html')
        for n in sorted({x for s in specs for x in (s.get('fixture'), s.get('ref'), s.get('tgt')) if x}):
            pg.evaluate('([n,b]) => loadDoc(n,b)', [n, b64(n)])
        for s in specs:
            pg.evaluate('() => { for (const n in docs) { const d = docs[n]; d.lang = d.langAuto; d.type = d.typeAuto; } }')
            r = pg.evaluate(MATCH_JS, [s])
            name = s['_file'][:-5]
            byid = {f['id']: f for f in r['findings']}; judged = set()
            for e, ids in zip(s.get('must', []), r['must']):
                st = S(e['crit']); st['exp'] += 1; judged.update(ids)
                if ids: st['found'] += 1; st['tp'] += 1
                else: st['missed'] += 1; notes.append(f'verpasst  {name}: {e["crit"]} {e.get("quote") or e.get("para") or e.get("refPara") or e.get("params") or "(ganzes Dokument)"} – {e["why"]}')
            for e, ids in zip(s.get('mustNot', []), r['not']):
                judged.update(ids); S(e['crit'])['guard'] += 1
                if not ids:
                    if e.get('known'): notes.append(f'behoben   {name}: bekannter Fehlalarm {e["crit"]} «{e.get("quote", "")}» schlägt nicht mehr an')
                    continue
                S(e['crit'])['false'] += len(ids)
                for i in ids:
                    msg = f'{name}: {byid[i]["d"]} – darf nicht anschlagen ({e["why"]})'
                    if e.get('known'): notes.append('bekannt   ' + msg + ' [bekannter Fehlalarm: ' + e['known'] + ']')
                    else: fails.append('FALSCH    ' + msg)
            for f in r['findings']:
                if f['id'] not in judged: S(f['crit'])['unj'] += 1; unjudged.append(f'{name}: {f["d"]}')
        br.close()
    for st in stats.values():
        st['prec'] = st['tp'] / (st['tp'] + st['false']) if st['tp'] + st['false'] else None
        st['rec'] = st['found'] / st['exp'] if st['exp'] else None
    order = sorted(stats, key=lambda c: (c[0] != 'F', 'FSLTRDQX'.find(c[0]), c))
    fmt = lambda v: '–' if v is None else f'{v:.2f}'
    rows = [(c, stats[c]) for c in order]
    head = '| Kriterium | erwartet | gefunden | verpasst | falsch | unbeurteilt | Präzision | Trefferquote | Stellen ohne Befund |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|\n'
    table = head + ''.join(f'| {c} | {s["exp"]} | {s["found"]} | {s["missed"]} | {s["false"]} | {s["unj"]} | {fmt(s["prec"])} | {fmt(s["rec"])} | {s["guard"]} |\n' for c, s in rows)
    tot = {k: sum(s[k] for s in stats.values()) for k in ('exp', 'found', 'missed', 'false', 'unj', 'tp', 'guard')}
    totp = tot['tp'] / (tot['tp'] + tot['false']) if tot['tp'] + tot['false'] else None
    table += f'| **gesamt** | {tot["exp"]} | {tot["found"]} | {tot["missed"]} | {tot["false"]} | {tot["unj"]} | {fmt(totp)} | {fmt(tot["found"] / tot["exp"] if tot["exp"] else None)} | {tot["guard"]} |\n'
    nmust = sum(len(s.get('must', [])) for s in specs); nnot = sum(len(s.get('mustNot', [])) for s in specs)
    # Basis: Präzision und Trefferquote dürfen nicht sinken, unbeurteilte Befunde nicht zunehmen
    base = json.load(open(BASE, encoding='utf-8')) if os.path.exists(BASE) else {}
    if '--write-baseline' in args:
        base = {c: {'precision': s['prec'], 'recall': s['rec'], 'unjudged': s['unj']} for c, s in rows}
        json.dump(base, open(BASE, 'w', encoding='utf-8'), indent=1, ensure_ascii=False); open(BASE, 'a').write('\n')
        print('Basis geschrieben:', BASE)
    for c, b in base.items():
        s = stats.get(c)
        if not s: fails.append(f'BASIS     {c}: im Korpus nicht mehr vorhanden'); continue
        if b.get('precision') is not None and (s['prec'] is None or s['prec'] < b['precision'] - 1e-9): fails.append(f'BASIS     {c}: Präzision {fmt(s["prec"])} unter {fmt(b["precision"])}')
        if b.get('recall') is not None and (s['rec'] is None or s['rec'] < b['recall'] - 1e-9): fails.append(f'BASIS     {c}: Trefferquote {fmt(s["rec"])} unter {fmt(b["recall"])}')
        if s['unj'] > b.get('unjudged', 0): fails.append(f'BASIS     {c}: {s["unj"]} unbeurteilte Befunde (Basis {b.get("unjudged", 0)}); in test/corpus beurteilen')
    md = ['# Referenzkorpus der Regeln', '', f'Stand {datetime.date.today().isoformat()} · {len(specs)} Korpusdateien ({sum(1 for s in specs if s.get("ref"))} Sprachpaare) · {nmust} Muss-Befunde · {nnot} Stellen ohne Befund · erzeugt von `python3 test/corpus_test.py`', '',
          'Präzision = gefundene Muss-Befunde / (gefundene + falsche Befunde); Trefferquote = gefunden / erwartet. «unbeurteilt»: Befunde, die weder als Muss noch als Fehlalarm erfasst sind. «Stellen ohne Befund»: Stellen und Dokumente, an denen das Kriterium nicht anschlagen darf. Kriterien ohne erwartete Fälle haben keine Trefferquote («–»): Der Korpus enthält für sie nur Stellen, an denen sie nicht anschlagen dürfen. Die KI-Kriterien (Q01–Q07, X09, X10) misst der Korpus nicht.', '',
          table, '', '## Hinweise', ''] + ['- ' + x for x in notes or ['keine']] + ['', '## Unbeurteilte Befunde', ''] + ['- ' + x for x in unjudged or ['keine']] + ['', '## Fehler', ''] + ['- ' + x for x in fails or ['keine']]
    os.makedirs(os.path.dirname(REPORT), exist_ok=True); open(REPORT, 'w', encoding='utf-8').write('\n'.join(md) + '\n')
    print(table)
    for x in notes: print(x)
    for x in unjudged: print('unbeurteilt', x)
    for x in fails: print(x)
    print('Bericht:', os.path.relpath(REPORT, ROOT))
    print('FEHLER:', len(fails) if fails else 'keine')
    return 1 if fails else 0


if __name__ == '__main__': sys.exit(main())
