"""Hygiene des öffentlichen Repositorys: Nichts Internes darf hinein.

Geprüft werden alle Dateien, die Git verfolgt oder verfolgen würde (git ls-files, auch neue, nicht ignorierte Dateien). Die Art einer
Datei bestimmt ihr Inhalt (Signatur), nicht die Endung: Eine umbenannte Word-Datei bleibt eine Word-Datei.
  - keine absoluten Pfade einer Arbeitsumgebung (Home-Verzeichnisse unter Linux, macOS und Windows, auch mit /, /mnt/…, UNC-Pfade \\\\server\\freigabe)
  - keine Links auf Sitzungen, Chats, Projekte oder Artefakte von claude.ai (auch claude.site)
  - keine internen Adressen: Hosts unter admin.ch ausser den öffentlichen (Liste PUBLIC_HOSTS), Intranet, SharePoint, .local, .intra
  - keine E-Mail-Adressen ausser unter example.com (example.org, example.net), users.noreply.github.com, noreply@anthropic.com und den
    Adressen von GitHub selbst (noreply@github.com, support@github.com),
    auch nicht verschleiert («name [at] domain»); Ausnahmen: die unverändert übernommenen Lizenztexte in THIRD-PARTY-NOTICES.md,
    die Paketangaben Dritter in package-lock.json und genau eine Funktionsadresse der Sektion für Rückmeldungen (FUNCTION_ADDR, keine
    Adresse einer Person; nur im Inhalt von Dateien und Commit-Nachrichten, nie als Autor oder Committer)
  - keine Zugangsdaten (Token von GitHub, Anthropic, AWS, Slack, private Schlüssel) und keine Dateien wie .env oder settings.local.json
  - Office-Dateien (ZIP mit [Content_Types].xml) und PDF-Dateien: nur in test/fixtures, mit passender Endung, vom Generator
    test/make_fixtures.py erzeugt (Dateiname steht im Generator); Personen in den Metadaten nur erfundene Namen (Liste FICTIONAL):
    Autor, zuletzt geändert von, Firma, Vorgesetzte(r), Vorlage, eigene Eigenschaften (custom.xml), Personen (people.xml),
    Kommentarautoren (Word, PowerPoint klassisch und modern), Bilder in der Datei (EXIF, PNG-Text); PDF: Info, XMP, Autoren von
    Anmerkungen, Namen von Anhängen
  - andere ZIP-Archive: nicht im Repository
  - Bilder (PNG, JPEG): Metadaten (PNG-Text, EXIF) nach denselben Regeln
  - optional: eigene Sperrliste (eine Zeichenfolge je Zeile, als ganzes Wort gesucht, z. B. Namen von Personen oder interne Bezeichnungen) in einer Datei
    ausserhalb des Repositorys: LECTORA_HYGIENE_SPERRLISTE=/pfad/zur/liste (in GitHub Actions aus dem Secret LECTORA_HYGIENE_SPERRLISTE).
    Die Liste selbst gehört nie ins Repository.

Mit --commits zusätzlich alle Commits (git log): Name und Adresse von Autor und Committer, Nachricht. Erlaubt sind in Nachrichten die
Zeilen, die Werkzeuge für KI-Sitzungen anhängen («Co-Authored-By: …», «Claude-Session: …»); sonst gelten dieselben Regeln.

Verwendung: python3 tools/hygiene.py [--commits] [--verbose] [--root VERZEICHNIS]. Exit-Code 0 = sauber, 1 = Befunde.
"""
import io, os, re, subprocess, sys, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FICTIONAL = {'Dana Muster', 'Kai Beispiel', 'Lectora', 'python-docx', 'Writer', 'LibreOffice', '', 'Python-pptx', 'python-pptx', 'Steve Canny', 'Office User', 'Microsoft Office User'}
# Felder der Office-Metadaten, deren Inhalt eine Person oder Organisation nennen kann; Template nur ohne Pfad
OFFICE_TEMPLATES_OK = {'', 'Normal.dotm', 'Normal'}
PUBLIC_HOSTS = {'fedlex.admin.ch', 'www.fedlex.admin.ch', 'fedlex.data.admin.ch', 'www.admin.ch', 'www.bk.admin.ch'}
ALLOWED_MAIL = re.compile(r'(?:^|\.)example\.(?:com|org|net)$|^users\.noreply\.github\.com$', re.I)
# GitHub selbst schreibt Commits als «GitHub <noreply@github.com>» (Zusammenführen im Web) und Dependabot zeichnet mit support@github.com.
ALLOWED_ADDR = {'noreply@anthropic.com', 'noreply@github.com', 'support@github.com'}
# Funktionsadresse der Sektion für Rückmeldungen ohne GitHub-Konto (README, Anleitung in Lectora, docs/rueckmeldungen.md). Vom Auftraggeber
# so vorgegeben; keine Adresse einer Person. Zugelassen ist genau diese Zeichenfolge, nicht die Domain und keine andere Adresse darunter.
FUNCTION_ADDR = re.compile(r'(?<![\w.%+-])sektion-grenze@sem\.admin\.ch(?![\w-]|\.[\w-])', re.I)

PATTERNS = [
    ('absoluter Pfad', re.compile(r'(?<![\w.~-])/(?:home/[a-z_][\w-]*|root)/|(?<![\w])/Users/[A-Za-z][\w.-]+/|(?<![\w])/mnt/(?:user-data|c/Users|data|uploads)\b|(?<![\w])/var/folder[s]/'
                                  r'|[A-Za-z]:[\\/]{1,2}Users[\\/]{1,2}[A-Za-z]|(?<![\w\\])\\\\[A-Za-z0-9][\w.-]*\\[\w$.-]+')),
    ('Link auf claude.ai (Sitzung, Chat, Projekt, Artefakt)', re.compile(r'claude\.ai/(?:code/session|chat/|project/|share/|public/artifacts|artifacts/)|claude\.site/|session_0[0-9A-Za-z]{20,}')),
    ('interne Adresse', re.compile(r'(?i)\b(?:[a-z0-9-]+\.)*(?:intranet|intra|sharepoint|teams\.microsoft)\.[a-z.]+\b|(?:https?://|//|@)[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:local|intern|internal|lan)\b(?![.\w-])')),
    ('Zugangsdaten', re.compile(r'gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{12,}|sk-ant-[A-Za-z0-9_-]{12,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|xox[abp]-[A-Za-z0-9-]{12,}')),
]
ADMIN_HOST = re.compile(r'(?i)(?<![\w.-])((?:[a-z0-9-]+\.)+admin\.ch)\b')
EMAIL = re.compile(r'(?<![\w.+-])([A-Za-z0-9._%+-]+)@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)')
EMAIL_HIDDEN = re.compile(r'(?i)\b[\w.+-]+\s*[\[(]\s*(?:at|ät|chez)\s*[\])]\s*[\w-]+(?:\s*[\[(]?\s*(?:dot|punkt|point)\s*[\])]?\s*[\w-]+|\.[\w-]+)+')
FORBIDDEN_NAMES = re.compile(r'(?:^|/)(?:\.env(?:\..*)?|settings\.local\.json|credentials\.json|id_rsa|.*\.pem|.*\.key|.*\.p12|.*\.pfx)$')
OFFICE_EXT = {'.docx', '.pptx', '.xlsx', '.docm', '.dotx', '.potx', '.pptm', '.xlsm'}
TRAILER_OK = re.compile(r'^(?:Co-Authored-By: [^\n]*|Signed-off-by: dependabot\[bot\] <support@github\.com>|Claude-Session: https://claude\.ai/code/session_[0-9A-Za-z]+)\s*$', re.M)


def files(root):
    out = subprocess.run(['git', 'ls-files', '-co', '--exclude-standard', '-z'], cwd=root, capture_output=True, text=True, check=True).stdout
    return sorted(f for f in out.split('\0') if f and os.path.isfile(os.path.join(root, f)))


def scan_text(name, text, deny, findings, emails_ok=False):
    text = FUNCTION_ADDR.sub(' ', text)
    for label, rx in PATTERNS:
        for m in rx.finditer(text):
            findings.append(f'{name}: {label}: «{m.group(0)[:60]}»')
    for m in ADMIN_HOST.finditer(text):
        if m.group(1).lower() not in PUBLIC_HOSTS: findings.append(f'{name}: interne Adresse: «{m.group(1)[:60]}»')
    if not emails_ok:
        for m in EMAIL.finditer(text):
            dom = m.group(2).lower()
            if dom.endswith(('.png', '.svg', '.js', '.css', '.jpg')): continue  # Dateinamen wie icon@2x.png
            if not ALLOWED_MAIL.search(dom) and m.group(0).lower() not in ALLOWED_ADDR: findings.append(f'{name}: E-Mail-Adresse ausserhalb von example.com: «{m.group(0)}»')
        for m in EMAIL_HIDDEN.finditer(text):
            if 'example' not in m.group(0).lower(): findings.append(f'{name}: verschleierte E-Mail-Adresse: «{m.group(0)[:60]}»')
    for d in deny:
        # ganze Wörter, ohne Rücksicht auf Gross- und Kleinschreibung
        if re.search(r'(?<!\w)' + re.escape(d) + r'(?!\w)', text, re.I): findings.append(f'{name}: Eintrag der Sperrliste gefunden («{d[:2]}…», {len(d)} Zeichen)')


def image_meta(data):
    """Text aus Bild-Metadaten: PNG-Textblöcke und EXIF (JPEG, PNG). Leer, wenn nichts lesbar ist."""
    parts = [c.decode('latin-1') for c in re.findall(rb'(?:tEXt|iTXt|zTXt)([\x20-\x7e\x00]{1,400})', data[:200000])]
    try:
        from PIL import Image
        im = Image.open(io.BytesIO(data))
        ex = im.getexif()
        for k, v in ex.items():
            if isinstance(v, bytes):
                try: v = v.decode('utf-16-le' if k in (0x9c9b, 0x9c9c, 0x9c9d, 0x9c9e, 0x9c9f) else 'latin-1').strip('\x00')
                except Exception: v = ''
            parts.append(str(v))
        for k, v in (im.info or {}).items():
            if isinstance(v, (str, bytes)) and k not in ('icc_profile', 'exif'): parts.append(v if isinstance(v, str) else v.decode('latin-1', 'replace'))
    except Exception:
        pass
    return '\n'.join(parts)


def image_scan(name, data, deny, findings):
    """Bild-Metadaten: dieselben Muster wie für Text, dazu Namen (zwei gross geschriebene Wörter), die nicht erfunden sind."""
    meta = image_meta(data)
    if not meta.strip(): return
    scan_text(name, meta, deny, findings)
    for w in re.findall(r'[A-ZÄÖÜ][a-zäöüé]+ [A-ZÄÖÜ][a-zäöüé]+', meta):
        if w not in FICTIONAL: findings.append(f'{name}: Name in den Bild-Metadaten: «{w}»')


def office_scan(name, data, deny, findings):
    """Alle XML-Teile, Metadaten mit Personen, Bilder in der Datei."""
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        xmls, persons = [], set()
        for n in z.namelist():
            raw = z.read(n)
            if n.endswith(('.xml', '.rels')):
                t = raw.decode('utf-8', 'replace'); xmls.append(t)
                persons |= set(re.findall(r'<(?:dc:creator|cp:lastModifiedBy|Company|Manager)>([^<]*)<', t))
                persons |= set(re.findall(r'\bw(?:15)?:author="([^"]*)"', t)) | set(re.findall(r'\bw:initials="([^"]*)"', t))
                persons |= set(re.findall(r'<p:cmAuthor [^>]*name="([^"]*)"', t)) | set(re.findall(r'<p188:author [^>]*name="([^"]*)"', t))
                persons |= set(re.findall(r'\buserId="([^"]*)"', t))
                for m in re.findall(r'<Template>([^<]*)<', t):
                    if m not in OFFICE_TEMPLATES_OK: findings.append(f'{name}: Vorlage in den Metadaten: «{m[:60]}»')
                if n == 'docProps/custom.xml':
                    for v in re.findall(r'<vt:lpwstr>([^<]*)<', t): persons.add(v)
            elif re.search(r'\.(?:jpe?g|png|tiff?|gif|bmp)$', n, re.I):
                image_scan(f'{name} › {n}', raw, deny, findings)
        scan_text(name, '\n'.join(xmls), deny, findings)
        bad = {p for p in persons if p.strip() not in FICTIONAL and p not in ('KB', 'DM', 'LE', 'L')}
        if bad: findings.append(f'{name}: Person oder Organisation nicht in der Liste erfundener Namen: {sorted(bad)}')


def pdf_scan(name, path, deny, findings):
    try:
        from pypdf import PdfReader
        r = PdfReader(path)
        if r.is_encrypted:
            try: r.decrypt('')
            except Exception: pass
        meta = {k: str(v) for k, v in (r.metadata or {}).items()}
        try: body = '\n'.join((p.extract_text() or '') for p in r.pages)
        except Exception: body = ''
        xmp = ''
        try:
            root = r.trailer['/Root']
            if '/Metadata' in root: xmp = root['/Metadata'].get_object().get_data().decode('utf-8', 'replace')
        except Exception: pass
        annot_authors, attach = set(), []
        try:
            for p in r.pages:
                for a in (p.get('/Annots') or []):
                    a = a.get_object()
                    # /T ist bei Formularfeldern (Widget) der Feldname, sonst der Autor der Anmerkung
                    if a.get('/T') is not None and a.get('/Subtype') != '/Widget': annot_authors.add(str(a.get('/T')))
            attach = list(r.attachments.keys())
        except Exception: pass
    except Exception as e:
        findings.append(f'{name}: PDF nicht lesbar ({e})'); return
    scan_text(name, '\n'.join(meta.values()) + '\n' + body + '\n' + xmp + '\n' + '\n'.join(annot_authors) + '\n' + '\n'.join(attach), deny, findings)
    persons = set()
    if meta.get('/Author'): persons.add(meta['/Author'])
    persons |= set(re.findall(r'<rdf:li[^>]*>([^<]*)</rdf:li>', xmp.split('</dc:creator>')[0].split('<dc:creator>')[-1])) if '<dc:creator>' in xmp else set()
    persons |= set(re.findall(r'<pdf:Author>([^<]*)<', xmp))
    persons |= annot_authors
    bad = {p for p in persons if p.strip() not in FICTIONAL}
    if bad: findings.append(f'{name}: Person nicht in der Liste erfundener Namen (PDF-Metadaten, XMP, Anmerkungen): {sorted(bad)}')


def scan_files(root, deny, findings):
    gen_path = os.path.join(root, 'test', 'make_fixtures.py')
    gen = open(gen_path, encoding='utf-8').read() if os.path.exists(gen_path) else ''
    n = 0
    for f in files(root):
        p = os.path.join(root, f); ext = os.path.splitext(f)[1].lower(); n += 1
        if FORBIDDEN_NAMES.search(f): findings.append(f'{f}: Datei dieser Art gehört nicht ins Repository')
        data = open(p, 'rb').read()
        is_zip, is_pdf = data[:4] == b'PK\x03\x04', data[:5] == b'%PDF-' or b'%PDF-' in data[:1024]
        if is_zip:
            try: names = zipfile.ZipFile(io.BytesIO(data)).namelist()
            except Exception: names = []
            if '[Content_Types].xml' not in names:
                findings.append(f'{f}: ZIP-Archiv im Repository (Inhalt nicht prüfbar)'); continue
            if ext not in OFFICE_EXT: findings.append(f'{f}: Office-Datei mit fremder Endung')
            if not f.startswith('test/fixtures/'): findings.append(f'{f}: Dokument ausserhalb von test/fixtures')
            elif os.path.basename(f) not in gen: findings.append(f'{f}: nicht von test/make_fixtures.py erzeugt (Dateiname fehlt im Generator)')
            office_scan(f, data, deny, findings)
            continue
        if is_pdf:
            if ext != '.pdf': findings.append(f'{f}: PDF-Datei mit fremder Endung')
            if not f.startswith('test/fixtures/'): findings.append(f'{f}: Dokument ausserhalb von test/fixtures')
            elif os.path.basename(f) not in gen and not (os.path.splitext(os.path.basename(f))[0] + '.docx' in gen and 'to_pdf(' in gen): findings.append(f'{f}: nicht von test/make_fixtures.py erzeugt (Dateiname fehlt im Generator)')
            pdf_scan(f, p, deny, findings)
            continue
        if data[:8] == b'\x89PNG\r\n\x1a\n' or data[:3] == b'\xff\xd8\xff':
            image_scan(f, data, deny, findings); continue
        if b'\0' in data[:4096]:
            findings.append(f'{f}: Binärdatei unbekannter Art (nicht prüfbar)'); continue
        scan_text(f, data.decode('utf-8', 'replace'), deny, findings, emails_ok=(f in ('THIRD-PARTY-NOTICES.md', 'package-lock.json')))
    return n


def scan_commits(root, deny, findings):
    """Autor, Committer und Nachricht jedes Commits. Erlaubte Anhänge von KI-Werkzeugen werden vor der Prüfung entfernt."""
    out = subprocess.run(['git', 'log', '--all', '--format=%H%x1f%an%x1f%ae%x1f%cn%x1f%ce%x1f%B%x1e'], cwd=root, capture_output=True, text=True)
    if out.returncode: findings.append('git log: ' + out.stderr.strip()[:200]); return 0
    n = 0
    for rec in out.stdout.split('\x1e'):
        rec = rec.strip('\n')
        if not rec: continue
        n += 1
        h, an, ae, cn, ce, body = (rec.split('\x1f') + [''] * 6)[:6]
        tag = f'Commit {h[:10]}'
        for who, mail in ((an, ae), (cn, ce)):
            dom = mail.split('@')[-1].lower()
            if mail.lower() not in ALLOWED_ADDR and not ALLOWED_MAIL.search(dom): findings.append(f'{tag}: Adresse «{mail}» (erlaubt: noreply- und example-Adressen)')
            scan_text(tag + ' (Name)', who, deny, findings, emails_ok=True)
        scan_text(tag + ' (Nachricht)', TRAILER_OK.sub('', body), deny, findings)
    return n


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    root = os.path.abspath(argv[argv.index('--root') + 1]) if '--root' in argv else ROOT
    deny = []
    dl = os.environ.get('LECTORA_HYGIENE_SPERRLISTE')
    if dl:
        if os.path.abspath(dl).startswith(root + os.sep): print('Die Sperrliste liegt im Repository. Lege sie ausserhalb ab.'); return 1
        deny = [l.strip() for l in open(dl, encoding='utf-8') if l.strip() and not l.startswith('#')]
    findings = []
    if '--commits' in argv:
        n = scan_commits(root, deny, findings); what = f'{n} Commits'
    else:
        n = scan_files(root, deny, findings); what = f'{n} Dateien'
    for x in findings: print('  ' + x)
    print(f'Hygiene: {what} geprüft' + (f', Sperrliste mit {len(deny)} Einträgen' if deny else ', ohne eigene Sperrliste') + f'; {len(findings)} Befunde')
    return 1 if findings else 0


if __name__ == '__main__':
    sys.exit(main())
