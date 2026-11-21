"""Reproduce the pinned CC0 character assets without a Google Drive account."""
from hashlib import sha256
from pathlib import Path
from urllib.request import urlopen

COMMIT = 'fcd215b58eec5c9ed97d0ba5f696d0e7dc085e08'
BASE = f'https://raw.githubusercontent.com/LuanDucate/Ducz.CharacterCreator/{COMMIT}/public/models/'
ASSETS = {
    'male.glb': ('Male/Casual_Hoodie.glb', 'f5b722199f7628b24550989af4230f65d5230727df9c326fd2b3e360effe5249'),
    'female.glb': ('Female/Casual.glb', 'bc2d84fba249ebaa0629cb9d133ad37234196e4b8004aa205a6397abed04e05c'),
}
DESTINATION = Path(__file__).resolve().parents[1] / 'public/assets/characters'

def fetch():
    for name, (source, expected) in ASSETS.items():
        target = DESTINATION / name
        if target.exists() and sha256(target.read_bytes()).hexdigest() == expected:
            print(f'{name}: already verified')
            continue
        with urlopen(BASE + source, timeout=120) as response:
            data = response.read()
        if sha256(data).hexdigest() != expected:
            raise RuntimeError(f'{name}: checksum mismatch; refusing to replace the asset')
        DESTINATION.mkdir(parents=True, exist_ok=True)
        temporary = target.with_suffix('.download')
        temporary.write_bytes(data)
        temporary.replace(target)
        print(f'{name}: verified {len(data)} bytes')

if __name__ == '__main__':
    fetch()
