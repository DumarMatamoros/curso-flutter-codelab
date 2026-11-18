"""Verifica el contenido original sin red ni dependencias externas."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
THEME_HEAD = '  <link rel="stylesheet" href="theme.css" />\n  <script src="theme.js"></script>\n'


def verify():
    manifest = json.loads((ROOT / 'tests/original-content.json').read_text())
    errors = []
    for name, expected in manifest['files'].items():
        path = ROOT / name
        if not path.is_file():
            errors.append(f'{name}: falta el archivo')
            continue
        data = path.read_bytes()
        if path.suffix == '.html':
            text = data.decode('utf-8')
            if text.count(THEME_HEAD) != 1:
                errors.append(f'{name}: falta o se duplicó la integración del tema')
            data = text.replace(THEME_HEAD, '').encode('utf-8')
        if hashlib.sha256(data).hexdigest() != expected:
            errors.append(f'{name}: difiere del original publicado')
    if errors:
        raise SystemExit('\n'.join(errors))
    print(f"OK: {len(manifest['files'])} archivos idénticos al original, excluyendo la integración del tema.")


if __name__ == '__main__':
    verify()
