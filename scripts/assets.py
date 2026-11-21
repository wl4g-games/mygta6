"""Verify bundled assets, or restore only the pinned files with --fetch."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from hashlib import sha256
from importlib.util import module_from_spec, spec_from_file_location
import json
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'public/assets'


def entries(group):
    if group in ('all', 'characters'):
        spec = spec_from_file_location('character_assets', ROOT / 'scripts/fetch-character-assets.py')
        characters = module_from_spec(spec)
        spec.loader.exec_module(characters)
        for name, (path, checksum) in characters.ASSETS.items():
            yield ASSETS / 'characters' / name, characters.BASE + path, checksum
        citizen = json.loads((ASSETS / 'characters/citizen-source.json').read_text())
        item = next(file for file in citizen['files'] if file['lod'] == 1)
        yield ASSETS / 'characters/citizen.glb', 'https://tevy.dev' + item['path'], item['sha256']
    if group in ('all', 'vehicles'):
        for vehicle in json.loads((ASSETS / 'vehicles/sources.json').read_text()):
            for item in vehicle['files']:
                yield ASSETS / 'vehicles' / item['file'], 'https://tevy.dev' + item['path'], item['sha256']
    if group in ('all', 'city'):
        for building in json.loads((ASSETS / 'city/sources.json').read_text()):
            for item in building['files']:
                if item['lod'] in (1, 2):
                    yield ASSETS / 'city' / f"{building['slug']}-{item['lod']}.glb", 'https://tevy.dev' + item['path'], item['sha256']
        for item in json.loads((ASSETS / 'city/district-sources.json').read_text())['sources']:
            yield ASSETS / 'city' / item['file'], item['url'], item['sha256']
    if group in ('all', 'props'):
        for item in json.loads((ASSETS / 'props/sources.json').read_text())['sources']:
            yield ASSETS / 'props' / item['file'], item['url'], item['sha256']
    if group in ('all', 'surfaces'):
        for item in json.loads((ASSETS / 'surfaces/sources.json').read_text()):
            yield ROOT / item['file'], item['source'], item['sha256']
    if group in ('all', 'basis'):
        for name in ('basis_transcoder.js', 'basis_transcoder.wasm'):
            source = ROOT / 'node_modules/three/examples/jsm/libs/basis' / name
            yield ASSETS / 'basis' / name, source.as_uri(), sha256(source.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--group', choices=('all', 'characters', 'vehicles', 'city', 'props', 'surfaces', 'basis'), default='all')
    parser.add_argument('--fetch', action='store_true', help='Download missing / changed assets after checking their pinned hash')
    options = parser.parse_args()

    def verify(entry):
        target, source, checksum = entry
        if target.exists() and sha256(target.read_bytes()).hexdigest() == checksum:
            return True
        if not options.fetch:
            print(f'Missing or changed: {target.relative_to(ROOT)}')
            return False
        with urlopen(source, timeout=60) as response:
            data = response.read()
        if sha256(data).hexdigest() != checksum:
            raise ValueError(f'Checksum mismatch: {target.name}; file was not replaced')
        target.parent.mkdir(parents=True, exist_ok=True)
        temporary = target.with_suffix(target.suffix + '.download')
        temporary.write_bytes(data)
        temporary.replace(target)
        print(f'Restored: {target.relative_to(ROOT)}')
        return True

    files = list(entries(options.group))
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(verify, files))
    print(f'{sum(results)} / {len(files)} pinned assets verified')
    if not all(results):
        raise SystemExit(1)


if __name__ == '__main__':
    main()
