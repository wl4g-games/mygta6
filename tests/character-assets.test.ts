import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { CharacterAssets } from '../src/assets/CharacterAssets';
import { AnimatedCharacter } from '../src/character/AnimatedCharacter';

describe('real glTF character asset ownership', () => {
  afterEach(() => vi.unstubAllGlobals());
  const fetchLocal = async (url: string) => {
    const name = url.endsWith('female.glb') ? 'female' : 'male';
    const data = await readFile(new URL(`../public/assets/characters/${name}.glb`, import.meta.url));
    return new Response(data);
  };
  it('deduplicates preloads and isolates skeletons and clothing between actor leases', async () => {
    const fetch = vi.fn(fetchLocal); vi.stubGlobal('fetch', fetch);
    const assets = new CharacterAssets(); await Promise.all([assets.preload(), assets.preload()]); expect(fetch).toHaveBeenCalledTimes(2);
    const first = assets.acquire('male', '#d0b485', '#b18364', false)!, second = assets.acquire('male', '#729b96', '#b18364', false)!;
    const mesh = (root: THREE.Object3D) => { let result!: THREE.SkinnedMesh; root.traverse(o => { if (!result && o instanceof THREE.SkinnedMesh) result = o; }); return result; };
    const a = mesh(first.root), b = mesh(second.root);
    expect(a.geometry).toBe(b.geometry); expect(a.skeleton).not.toBe(b.skeleton); expect(a.skeleton.bones[0]).not.toBe(b.skeleton.bones[0]); expect(a.material).not.toBe(b.material);
    const animation = new AnimatedCharacter(first); animation.update(.2, 4, false); animation.dispose();
    expect(assets.refs).toBe(1); second.dispose(); second.dispose(); expect(assets.refs).toBe(0); assets.close();
  });
  it('discards a late parsed asset after cancellation rather than resurrecting the cache', async () => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    vi.stubGlobal('fetch', async (url: string) => { await gate; return fetchLocal(url); });
    const assets = new CharacterAssets(), loading = assets.preload(); assets.close(); release();
    await expect(loading).rejects.toMatchObject({ name: 'AbortError' }); expect(assets.ready).toBe(false); expect(assets.refs).toBe(0);
  });
});
