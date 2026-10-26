"""Package final artifacts, excluding logs, caches and CAD recovery backups."""
from pathlib import Path
import hashlib
import json
import zipfile

root = Path(__file__).resolve().parent.parent
suffixes = {'.fcstd', '.step', '.glb', '.html', '.js', '.json', '.txt', '.png', '.py'}
files = [p for p in root.rglob('*') if p.is_file()
         and '__pycache__' not in p.parts
         and (p.suffix.lower() in suffixes or p.name == 'LICENSE')
         and p.name != 'checksums.json']
checksums = {str(p.relative_to(root)): hashlib.sha256(p.read_bytes()).hexdigest()
             for p in sorted(files)}
(root / 'checksums.json').write_text(json.dumps(checksums, indent=2) + '\n')
files.append(root / 'checksums.json')
target = root.parent / (root.name + '.zip')
with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED, compresslevel=7) as archive:
    for p in sorted(files):
        archive.write(p, str(Path(root.name) / p.relative_to(root)))
with zipfile.ZipFile(target) as archive:
    assert archive.testzip() is None
print(f'Packaged {len(files)} files: {target} ({target.stat().st_size:,} bytes)')
