"""Ersetzt unsichtbare Zeichen in den JS-Quellen (src/*.js) durch \\u-Escapes.
Nach jedem Schreiben einer Datei in src/ ausführen: Manche Schreibwerkzeuge (auch KI-Assistenten) machen aus \\u00a0 und
ähnlichen Escapes sonst unsichtbare Zeichen, die im Code niemand sieht."""
import glob, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CODES = (0x00a0, 0x202f, 0x2011, 0x00ad, 0x2028, 0x2029, 0x200b, 0xfeff)  # geschützte und unsichtbare Zeichen
MAP = {chr(c): '\\u%04x' % c for c in CODES}
for p in sorted(glob.glob(os.path.join(ROOT, 'src', '*.js'))):
    s = open(p, encoding='utf-8').read(); o = s
    for k, v in MAP.items(): s = s.replace(k, v)
    s = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', lambda m: '\\u%04x' % ord(m.group()), s)
    if s != o: open(p, 'w', encoding='utf-8').write(s); print('normalisiert', os.path.relpath(p, ROOT))
