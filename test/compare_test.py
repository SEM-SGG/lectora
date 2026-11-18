import sys, os, json
sys.path.insert(0, os.path.dirname(__file__))
from engine_test import *
# Neue Prüfungen (X11 Modalverben, X12 Erlasse, R04 Abkürzungen von Erlassen): auf den echten Paralleltexten keine Befunde,
# auf den Demodokumenten genau die erwarteten (geprüft von Hand: echte Abweichungen)
EXPECT_NEW = {('weisung_de_demo.docx', 'weisung_fr_errors.docx'): ['X11 [info] f.X11.absent'], ('weisung_de_demo.docx', 'weisung_it_clean.docx'): ['X11 [info] f.X11.absent'],
  ('weisung_fr_errors.docx', 'weisung_de_demo.docx'): ['X11 [info] f.X11.added'], ('weisung_it_clean.docx', 'weisung_de_demo.docx'): ['X11 [info] f.X11.added']}
PAIRS = [('weisung_de_demo.docx','weisung_it_clean.docx'),('weisung_fr_errors.docx','weisung_it_clean.docx'),('weisung_it_clean.docx','weisung_fr_errors.docx'),('weisung_fr_errors.docx','weisung_de_demo.docx'),('weisung_it_clean.docx','weisung_de_demo.docx'),('weisung_fr_clean.docx','weisung_de_clean.docx'),('weisung_it_clean.docx','weisung_de_clean.docx'),('weisung_it_clean.docx','weisung_fr_clean.docx'),('konzept_real_fr.docx','konzept_real_de.docx'),('konzept_real_it.docx','konzept_real_fr.docx'),('konzept_real_fr.pdf','konzept_real_it.docx'),
  ('konzept_real_de.docx','konzept_real_fr.docx'),('konzept_real_de.docx','konzept_real_it.docx'),('konzept_real_fr.docx','konzept_real_it.docx'),('konzept_real_it.docx','konzept_real_de.docx'),('konzept_real_de.docx','konzept_real_fr.pdf'),('weisung_de_clean.docx','weisung_fr_clean.docx'),('weisung_de_clean.docx','weisung_it_clean.docx'),('weisung_fr_clean.docx','weisung_it_clean.docx'),('weisung_de_clean.docx','weisung_fr_errors.docx'),('weisung_de_demo.docx','weisung_fr_errors.docx'),('weisung_de_clean.pdf','weisung_fr_clean.docx')]
serve(8766)
with sync_playwright() as pw:
    br = launch(pw)
    pg = br.new_page(); pg.on('pageerror', lambda e: print('[pageerror]', e))
    pg.goto(url(8766) + '/test/harness.html')
    bad = []
    for n in set(sum(PAIRS, ())): pg.evaluate('([n,b]) => loadDoc(n,b)', [n, b64(n)])
    print(pg.evaluate('''() => Object.keys(docs).map(n => n+': '+DP.rules.runRules(docs[n],{}).findings.map(f=>f.crit).join(','))'''))
    print(pg.evaluate('''() => docs['weisung_de_clean.pdf'].paras.map(p=>p.kind+p.level+'|'+p.text.slice(0,60))'''))
    for a, b in PAIRS:
        r = pg.evaluate('''([a,b]) => { const c = DP.align.compare(docs[a], docs[b], {}); return {stats:c.stats, f:c.findings.map(f => f.crit+' ['+f.sev+'] '+f.key+' '+JSON.stringify(f.params)+(f.quote?' «'+f.quote.slice(0,50)+'»':'')+(f.fix?' → «'+f.fix.repl+'»':''))}; }''', [a, b])
        print('\n=====', a, '→', b, r['stats'])
        for f in r['f']: print('  ', f)
        got = [f.split(' {')[0] for f in r['f'] if f.startswith(('X11', 'X12'))]
        exp = EXPECT_NEW.get((a, b), [])
        if got != exp: print('FEHLER neue Prüfungen', a, b, got, 'erwartet', exp); bad.append((a, b))
    # R04 auf allen Fixtures: keine Befunde (keine falsche Paarung, kein Kürzel einer anderen Sprache)
    r04 = pg.evaluate('''() => Object.keys(docs).map(n => [n, DP.rules.runRules(docs[n], {}).findings.filter(f => f.crit === 'R04').map(f => f.key + ' «' + f.quote + '»')]).filter(x => x[1].length)''')
    print('\nR04 auf allen Fixtures:', r04 or 'keine Befunde')
    if r04: bad.append('R04')
    # Synopse: Demo DE/FR/IT, jede Referenz- und Zielzeile genau einmal
    j = pg.evaluate('''() => { const [a, b, c] = ['weisung_de_demo.docx', 'weisung_fr_errors.docx', 'weisung_it_clean.docx'].map(n => docs[n]);
      const c1 = DP.align.compare(a, b, {}), c2 = DP.align.compare(a, c, {}), rows = DP.align.join3(c1, c2);
      const flat = (k) => rows.flatMap(r => r[k]).sort((x, y) => x - y).join();
      return [rows.length, flat('a') === a.paras.map(p => p.i).join(), flat('b1') === b.paras.map(p => p.i).join(), flat('b2') === c.paras.map(p => p.i).join(), rows.filter(r => !r.b1.length).length]; }''')
    print('Synopse Demo: Zeilen', j[0], '| Abdeckung Referenz/FR/IT', j[1:4], '| Zeilen ohne FR', j[4])
    if not all(j[1:4]) or j[4] != 1: bad.append('join3')
    print('FEHLER:', bad if bad else 'keine')
    br.close()
    sys.exit(1 if bad else 0)
