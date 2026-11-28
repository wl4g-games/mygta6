import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { CharacterAssets } from '../src/assets/CharacterAssets';
import { AnimatedCharacter } from '../src/character/AnimatedCharacter';
import { Nightclub } from '../src/interior/Nightclub';
import { AssetManager } from '../src/assets/AssetManager';
import { Physics } from '../src/physics/Physics';
import { storeForChunk } from '../src/store/StoreArchetype';
import { FirstPersonArms } from '../src/character/FirstPersonArms';

describe('real glTF character asset ownership', () => {
  afterEach(() => vi.unstubAllGlobals());
  const fetchLocal = async (url: string) => {
    const name = url.split('/').at(-1)!.replace(/\.glb$/, '');
    const data = await readFile(new URL(`../public/assets/characters/${name}.glb`, import.meta.url));
    return new Response(data);
  };
  it('deduplicates preloads and isolates skeletons and clothing between actor leases', async () => {
    const fetch = vi.fn(fetchLocal); vi.stubGlobal('fetch', fetch);
    const assets = new CharacterAssets(); await Promise.all([assets.preload(), assets.preload()]); expect(fetch).toHaveBeenCalledTimes(3);
    const first = assets.acquire('male', '#d0b485', '#b18364', false)!, second = assets.acquire('male', '#729b96', '#b18364', false)!;
    const mesh = (root: THREE.Object3D) => { let result!: THREE.SkinnedMesh; root.traverse(o => { if (!result && o instanceof THREE.SkinnedMesh) result = o; }); return result; };
    const a = mesh(first.root), b = mesh(second.root);
    expect(a.geometry).toBe(b.geometry); expect(a.skeleton).not.toBe(b.skeleton); expect(a.skeleton.bones[0]).not.toBe(b.skeleton.bones[0]); expect(a.material).not.toBe(b.material);
    const animation = new AnimatedCharacter(first); animation.update(.2, 4, false); animation.dispose();
    expect(assets.refs).toBe(1); second.dispose(); second.dispose(); expect(assets.refs).toBe(0); assets.close();
  });
  it('keeps real formal and swimwear rigs finite and reaches a shoulder target with two-joint IK', async () => {
    vi.stubGlobal('fetch', fetchLocal); const assets = new CharacterAssets(); await assets.preload();
    for (const id of ['male-suit', 'female-swim']) {
      const lease = assets.acquire(id, '#b86576', '#bd9279', false)!, animation = new AnimatedCharacter(lease);
      animation.update(.016, 0, false); animation.perform('massage', 1);
      lease.root.traverseVisible(object => { if (object instanceof THREE.Mesh && object.name === 'Swimwear') expect(new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3()).length()).toBeLessThan(1.2); });
      const shoulder = animation.shoulder('right')!, target = shoulder.clone().add(new THREE.Vector3(.05, -.25, .13));
      animation.reach('right', target); let hand!: THREE.Bone;
      lease.root.traverse(object => { if (object instanceof THREE.Bone && /wrist[._]?r$/i.test(object.name)) hand = object; });
      expect(hand.getWorldPosition(new THREE.Vector3()).distanceTo(target)).toBeLessThan(.015);
      animation.update(.016, 0, false); lease.root.traverse(object => expect(object.quaternion.toArray().every(Number.isFinite)).toBe(true)); animation.dispose();
    }
    expect(assets.refs).toBe(0); assets.close();
  });
  it('discards a late parsed asset after cancellation rather than resurrecting the cache', async () => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    vi.stubGlobal('fetch', async (url: string) => { await gate; return fetchLocal(url); });
    const assets = new CharacterAssets(), loading = assets.preload(); assets.close(); release();
    await expect(loading).rejects.toMatchObject({ name: 'AbortError' }); expect(assets.ready).toBe(false); expect(assets.refs).toBe(0);
  });
  it('places both massage hands on the seated actor shoulders throughout the animation', async () => {
    vi.stubGlobal('fetch', fetchLocal); vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {}, fillText() {} }) }) });
    const assets = new AssetManager(), physics = new Physics(); await physics.init(); await assets.characters.preload();
    const club = new Nightclub(storeForChunk('0,1'), assets, physics); new THREE.Scene().add(club.root);
    for (let i = 0; i < 120; i++) { club.update(1 / 60, true); expect(club.massageContactError).toBeLessThan(.08); }
    club.close(); expect(assets.characters.refs).toBe(0); assets.close(); physics.close();
  });
  it('keeps real sleeves in first person, excludes the torso and releases the view geometry', async () => {
    vi.stubGlobal('fetch', fetchLocal); const assets = new CharacterAssets(); await assets.preload();
    const lease = assets.acquire('male', '#ded7be', '#b18364', false)!, view = new FirstPersonArms(lease.root); view.setActive(true);
    const visible: THREE.SkinnedMesh[] = []; lease.root.traverseVisible(node => { if (node instanceof THREE.SkinnedMesh) visible.push(node); });
    expect(visible.length).toBeGreaterThan(1); expect(visible.every(mesh => mesh.userData.firstPersonArms)).toBe(true);
    expect(visible.some(mesh => (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).some(material => !/skin/i.test(material.name)))).toBe(true);
    view.close(); view.close(); expect(visible.every(mesh => !mesh.parent)).toBe(true); lease.dispose(); assets.close();
  });
});
