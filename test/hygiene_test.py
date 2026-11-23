"""Test der Hygieneprüfung (tools/hygiene.py): Jeder Fall, mit dem sich interne Inhalte bisher am Werkzeug vorbeischmuggeln liessen,
muss als Befund erscheinen; erlaubte Inhalte (erfundene Testdokumente, Anhänge von KI-Werkzeugen in Commit-Nachrichten) dürfen es nicht.
Baut dazu ein Wegwerf-Repository in einem temporären Verzeichnis. Aufruf: python3 test/hygiene_test.py. Schluss: «FEHLER: keine»."""
import io, os, shutil, subprocess, sys, tempfile, zipfile
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import hygiene

errors = []
def check(ok, msg):
    print(('  ok   ' if ok else '  FEHLER ') + msg)
    if not ok: errors.append(msg)

FX = os.path.join(ROOT, 'test', 'fixtures')
tmp = tempfile.mkdtemp(prefix='hyg-')
repo = os.path.join(tmp, 'repo'); os.makedirs(os.path.join(repo, 'test', 'fixtures'))
git = lambda *a, **k: subprocess.run(['git', *a], cwd=repo, capture_output=True, text=True, check=True, **k)
git('init', '-q')
git('config', 'user.name', 'Lectora'); git('config', 'user.email', 'lectora@example.com')
open(os.path.join(repo, 'test', 'make_fixtures.py'), 'w').write("NAMES = ['weisung_de_demo.docx', 'weisung_de_flawed.pdf', 'echt.docx', 'meta.docx', 'bild.docx']\n")

def run(*extra, env=None):
    """Befunde als Liste von Zeilen."""
    old = os.environ.copy()
    if env: os.environ.update(env)
    try:
        buf = io.StringIO(); so = sys.stdout; sys.stdout = buf
        try: hygiene.main(['--root', repo, *extra])
        finally: sys.stdout = so
    finally:
        os.environ.clear(); os.environ.update(old)
    return [l.strip() for l in buf.getvalue().splitlines() if l.startswith('  ')]

def put(rel, data):
    p = os.path.join(repo, rel); os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, 'wb' if isinstance(data, bytes) else 'w').write(data)

def has(found, rel, word):
    return any(l.startswith(rel + ':') or l.startswith(rel + ' ›') for l in found if word in l)

def office_variant(src, changes=None, extra=None):
    zin = zipfile.ZipFile(src); out = io.BytesIO(); zout = zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED)
    for n in zin.namelist():
        d = zin.read(n)
        if changes and n in changes: d = changes[n](d)
        zout.writestr(n, d)
    for n, d in (extra or {}).items(): zout.writestr(n, d)
    zout.close(); return out.getvalue()

# ---------- Sauber: erfundene Testdokumente unter ihrem Namen ----------
shutil.copy(os.path.join(FX, 'weisung_de_demo.docx'), os.path.join(repo, 'test', 'fixtures', 'weisung_de_demo.docx'))
shutil.copy(os.path.join(FX, 'weisung_de_flawed.pdf'), os.path.join(repo, 'test', 'fixtures', 'weisung_de_flawed.pdf'))
put('README.md', 'Lectora. Kontakt: lectora@example.com. Quelle: https://www.fedlex.admin.ch/eli/cc/2007/758/de\n')
found = run()
check(found == [], f'sauberes Repository ohne Befund {found[:3]}')

# ---------- Text: Pfade, Adressen, Links, Zugangsdaten, Personen ----------
# Die Fälle stehen zerlegt im Quelltext, damit diese Datei selbst die Hygiene besteht (J setzt sie wieder zusammen)
J = lambda *p: ''.join(p)
ADMIN = J('ad', 'min.ch')
put('notizen.md', '\n'.join([
    'Kontakt: Erika Beispielhaft, Sektion',
    J('Ablage: ', '\\\\', 'sem-fs01.', ADMIN, '\\daten\\SGG\\Lectora'),
    J('Intranet: https://intra', 'net.sem.', ADMIN, '/sgg/lectora'),
    J('Artefakt: https://claude', '.ai/public/artifacts/0123abcd-1111-2222-3333-444455556666'),
    J('Artefakt2: https://claude', '.site/artifacts/0123abcd-1111'),
    J('Pfad: /mnt', '/user', '-data/uploads/Weisung_echt.docx und C:', '/Use', 'rs/ebeispiel/Desktop/x.docx'),
    J('Mail: erika.beispielhaft [', 'at] sem.', ADMIN),
    J('Token: github_', 'pat_short123456789'),
    J('Server: http://fileserver', '.intern/share')]) + '\n')
deny = os.path.join(tmp, 'sperrliste.txt'); open(deny, 'w').write('Erika Beispielhaft\n')
found = run(env={'LECTORA_HYGIENE_SPERRLISTE': deny})
for word, what in (('Sperrliste', 'Name aus der Sperrliste'), ('absoluter Pfad: «\\\\sem-fs01', 'UNC-Pfad'), (J('intra', 'net.sem.', ADMIN), 'Intranet-Adresse'),
                   (J('claude', '.ai/public/artifacts'), 'Artefakt-Link claude.ai'), (J('claude', '.site/'), 'Artefakt-Link claude.site'), (J('/mnt', '/user', '-data'), 'Pfad unter /mnt'),
                   (J('C:', '/Use', 'rs/e'), 'Windows-Pfad mit /'), ('verschleierte E-Mail', 'verschleierte Adresse'), (J('github_', 'pat_'), 'kurzes GitHub-Token'), (J('fileserver', '.intern'), 'Host .intern')):
    check(has(found, 'notizen.md', word), f'Text: {what} erkannt')
os.remove(os.path.join(repo, 'notizen.md'))

# ---------- Funktionsadresse der Sektion: genau diese eine Adresse ist erlaubt, keine andere unter derselben Domain ----------
FA = J('sektion-grenze', '@sem.', ADMIN)
put('kontakt.md', f'Ohne GitHub-Konto: {FA}. Als Link: <mailto:{FA}>. In Klammern ({FA}).\n')
found = run()
check(found == [], f'Funktionsadresse der Sektion ohne Befund {found[:3]}')
put('kontakt.md', '\n'.join([J('Person: erika.beispielhaft', '@sem.', ADMIN), J('Andere: sektion-grenze2', '@sem.', ADMIN), J('Unterdomain: sektion-grenze', '@in', 'tra.sem.', ADMIN),
                              J('Verlängert: ', FA, '.beispiel.net'), J('Vorne: x.', FA)]) + '\n')
found = run()
for word, what in ((J('erika.beispielhaft', '@sem.'), 'Adresse einer Person unter derselben Domain'), (J('sektion-grenze2', '@'), 'ähnliche Adresse'),
                   (J('in', 'tra.sem.', ADMIN), 'Unterdomain'), ('.beispiel.net', 'verlängerte Domain'), (J('x.sektion-grenze', '@'), 'Adresse mit Vorsatz')):
    check(has(found, 'kontakt.md', word), f'Funktionsadresse: {what} erkannt')
os.remove(os.path.join(repo, 'kontakt.md'))

# ---------- Dokumente unter falschem Namen und Metadaten ----------
real = open(os.path.join(FX, 'weisung_de_demo.docx'), 'rb').read()
put('test/fixtures/echt.zip', real)
put('test/fixtures/echt.docx.bak', real)
put('docs/anhang.dat', real)
put('test/fixtures/meta.docx', office_variant(os.path.join(FX, 'weisung_de_demo.docx'),
    {'docProps/app.xml': lambda d: d.replace(b'</Properties>', b'<Company>Staatssekretariat Beispiel</Company><Manager>Max Vorgesetzter</Manager></Properties>').replace(b'<Template>Normal.dotm</Template>', rb'<Template>C:\Vorlagen\SEM-Weisung.dotx</Template>')},
    {'word/people.xml': '<w15:people xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml"><w15:person w15:author="Echte Person"><w15:presenceInfo w15:providerId="AD" w15:userId="S-1-5-21-123"/></w15:person></w15:people>',
     'docProps/custom.xml': '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="2" name="Sachbearbeitung"><vt:lpwstr>Hans Sachbearbeiter</vt:lpwstr></property></Properties>'}))
from PIL import Image
jb = io.BytesIO(); im = Image.new('RGB', (4, 4)); ex = im.getexif(); ex[0x013B] = 'Anna Fotografin'; im.save(jb, 'JPEG', exif=ex)
put('test/fixtures/bild.docx', office_variant(os.path.join(FX, 'weisung_de_demo.docx'), None, {'word/media/foto.jpg': jb.getvalue()}))
zb = io.BytesIO(); zz = zipfile.ZipFile(zb, 'w'); zz.writestr('liste.txt', 'intern'); zz.close(); put('tools/daten.zip', zb.getvalue())
put('docs/bild.jpg', jb.getvalue())
found = run()
check(has(found, 'test/fixtures/echt.zip', 'fremder Endung'), 'umbenannte Word-Datei (.zip) erkannt')
check(has(found, 'test/fixtures/echt.docx.bak', 'fremder Endung'), 'umbenannte Word-Datei (.docx.bak) erkannt')
check(has(found, 'docs/anhang.dat', 'ausserhalb von test/fixtures'), 'Word-Datei ausserhalb von test/fixtures, beliebige Endung')
for word, what in (('Staatssekretariat Beispiel', 'Firma (app.xml)'), ('Max Vorgesetzter', 'Vorgesetzte(r) (app.xml)'), ('Echte Person', 'Person (people.xml)'), ('Hans Sachbearbeiter', 'eigene Eigenschaft (custom.xml)'), ('Vorlage in den Metadaten', 'Vorlage mit Pfad')):
    check(has(found, 'test/fixtures/meta.docx', word), f'Office-Metadaten: {what} erkannt')
check(has(found, 'test/fixtures/bild.docx', 'Anna Fotografin'), 'Bild in der Word-Datei: EXIF-Autor erkannt')
check(has(found, 'docs/bild.jpg', 'Anna Fotografin'), 'JPEG im Repository: EXIF-Autor erkannt')
check(has(found, 'tools/daten.zip', 'ZIP-Archiv'), 'ZIP-Archiv erkannt')
for f in ('test/fixtures/echt.zip', 'test/fixtures/echt.docx.bak', 'docs/anhang.dat', 'test/fixtures/meta.docx', 'test/fixtures/bild.docx', 'tools/daten.zip', 'docs/bild.jpg'): os.remove(os.path.join(repo, f))

# ---------- PDF: XMP und Autoren von Anmerkungen ----------
from pypdf import PdfReader, PdfWriter
from pypdf.generic import ArrayObject, DictionaryObject, FloatObject, NameObject, TextStringObject
w = PdfWriter(clone_from=PdfReader(os.path.join(FX, 'weisung_de_flawed.pdf')))
a = DictionaryObject({NameObject('/Type'): NameObject('/Annot'), NameObject('/Subtype'): NameObject('/Text'), NameObject('/Rect'): ArrayObject([FloatObject(10)] * 4), NameObject('/T'): TextStringObject('Paula Prüferin')})
w.pages[0][NameObject('/Annots')] = ArrayObject([w._add_object(a)])
xmp = '<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:creator><rdf:Seq><rdf:li>Otto Ersteller</rdf:li></rdf:Seq></dc:creator></rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>'
from pypdf.generic import StreamObject
st = StreamObject(); st._data = xmp.encode(); st[NameObject('/Type')] = NameObject('/Metadata'); st[NameObject('/Subtype')] = NameObject('/XML')
w._root_object[NameObject('/Metadata')] = w._add_object(st)
b = io.BytesIO(); w.write(b); put('test/fixtures/weisung_de_flawed.pdf', b.getvalue())
found = run()
check(has(found, 'test/fixtures/weisung_de_flawed.pdf', 'Paula Prüferin'), 'PDF: Autor einer Anmerkung erkannt')
check(has(found, 'test/fixtures/weisung_de_flawed.pdf', 'Otto Ersteller'), 'PDF: Autor in den XMP-Metadaten erkannt')
shutil.copy(os.path.join(FX, 'weisung_de_flawed.pdf'), os.path.join(repo, 'test', 'fixtures', 'weisung_de_flawed.pdf'))
check(run() == [], 'nach dem Aufräumen wieder ohne Befund')

# ---------- Commits ----------
git('add', '-A'); git('commit', '-q', '-m', J('Import\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\nClaude-Session: https://claude', '.ai/code/sess', 'ion_01AbCdEfGhIjKlMnOpQrStUv'))
check(run('--commits') == [], 'Commit mit den Anhängen von KI-Werkzeugen (Co-Authored-By, Claude-Session) ist erlaubt')
put('a.txt', 'a\n'); git('add', '-A'); git('-c', 'user.name=Erika Beispielhaft', '-c', J('user.email=erika.beispielhaft', '@sem.', ADMIN), 'commit', '-q', '-m', J('Stand aus /ho', 'me/erika/arbeit übernommen\n\nSiehe https://claude', '.ai/chat/0123abcd'))
found = run('--commits', env={'LECTORA_HYGIENE_SPERRLISTE': deny})
check(any(J('Adresse «erika.beispielhaft', '@sem.', ADMIN, '»') in l for l in found), 'Commit: Adresse des Autors erkannt')
check(any('(Nachricht): absoluter Pfad' in l for l in found), 'Commit: Pfad in der Nachricht erkannt')
check(any('(Nachricht): Link auf claude.ai' in l for l in found), 'Commit: Chat-Link in der Nachricht erkannt')
check(any('(Name): Eintrag der Sperrliste' in l for l in found), 'Commit: Name aus der Sperrliste erkannt')

shutil.rmtree(tmp, ignore_errors=True)
print('FEHLER:', 'keine' if not errors else '\n  ' + '\n  '.join(errors))
sys.exit(1 if errors else 0)
