import type { StoreKind } from '../store/StoreArchetype';

export type PlaceFurniture = (color: string, x: number, y: number, z: number, w: number, h: number, d: number, solid?: boolean) => void;
/** Local room coordinates keep furnishings reusable with every storefront footprint. */
export function facilityFurniture(kind: StoreKind, box: PlaceFurniture): boolean {
  const bed = (x: number, z: number, clinical = false) => {
    const width = clinical ? 1.05 : 1.9;
    box('#7a8782', x, .3, z, width, .5, 2.25);
    box('#e8e1cf', x, .64, z, width, .22, 2.2);
    box(clinical ? '#8fb5aa' : '#879991', x, .77, z + .28, width, .05, 1.5, false);
    box('#efe9d8', x, .82, z - .75, clinical ? .65 : 1.35, .17, .5, false);
    box('#a28c6b', x, .8, z - 1.15, width + .12, 1.15, .12);
  };
  if (kind === 'home') {
    bed(-8, -6);
    box('#c3b59a', -3, 1.9, -7, .2, 3.8, 12);
    box('#978266', 0, .5, -10, 5.5, 1, 1.8);
    box('#424e4a', -1, 1.05, -10, 2, .08, 1.5, false);
    for (const x of [-1.5, -.5]) for (const z of [-10.4, -9.6]) box('#171f20', x, 1.11, z, .55, .05, .55, false);
    box('#788c80', -.5, .45, 5, 3.2, .65, 1.2);
    box('#788c80', -.5, 1, 5.5, 3.2, 1.1, .25);
    box('#a18c6d', -.5, .5, 2.5, 1.6, .12, .9);
    box('#29454f', -.5, 1.5, -.5, 2, 1.1, .1, false);
    box('#c6c2ad', -11.9, 1.5, 5, .12, 2.6, 3.2, false);
    return true;
  }
  if (kind === 'clinic') {
    for (const x of [-8, 0]) for (const z of [-7, 3]) {
      bed(x, z, true); box('#c1d5c8', x + 2.5, 1, z - 1, 1.2, 2, 1.2);
      box('#4c7772', x + 2.5, 2.3, z - 1, 1.1, .65, .12, false);
    }
    return true;
  }
  if (kind === 'hotel' || kind === 'realty') {
    for (const x of [-8, 0]) {
      bed(x, -6); box('#947a5c', x, .8, 4, 5, .2, 2);
      box('#496460', x, 1.65, 4.5, 3, 1.5, .13);
      box('#c9bba2', x - 3.4, 1.8, -6.5, .2, 3.6, 12);
      box('#c9bba2', x - 2.4, 1.8, .5, 2.2, 3.6, .2);
      box('#c9bba2', x + 2.4, 1.8, .5, 2.2, 3.6, .2);
    }
    return true;
  }
  if (kind === 'gym') {
    for (const x of [-9, -3, 3]) {
      box('#495b57', x, .25, -5, 2.7, .45, 5.5);
      box('#293d3b', x, .5, -5, 2.4, .07, 4.4, false);
      box('#6f8d83', x, 1.2, -7, .15, 2, .15);
      box('#749b8f', x, 2.15, -7, 1.5, .6, .2, false);
      for (const side of [-1, 1]) box('#6f8d83', x + side, 1.2, -6, .1, .1, 2, false);
    }
    box('#79715d', -5, .8, 5, 12, .2, 2.4);
    for (let x = -10; x < 1; x += 2) {
      box('#283a37', x, 1.05, 5, .3, .45, 1.6, false);
      box('#283a37', x, 1.05, 4.3, 1.2, .45, .22, false);
      box('#283a37', x, 1.05, 5.7, 1.2, .45, .22, false);
    }
    return true;
  }
  if (kind === 'salon') {
    for (const x of [-8, -1]) {
      box('#375d59', x, .6, -3, 2.2, .6, 2.2);
      box('#375d59', x, 1.4, -2.1, 2.2, 1.6, .25);
      box('#859c95', x, .25, -3, 1.7, .1, 1.7);
      box('#b2beb3', x, 1.2, -7, 4, .3, 1.5);
      box('#29454f', x, 2.2, -7.8, 3.4, 2.3, .12, false);
    }
    return true;
  }
  if (kind === 'bank') {
    for (const x of [-8, -2]) {
      box('#657d77', x, 1.2, 5, 2.6, 2.4, 2);
      box('#29454f', x, 1.6, 6.05, 1.6, .9, .08, false);
      box('#d7d5bd', x, .95, 6.12, .9, .08, .3, false);
      box('#435f55', x, .7, 6.13, 1.4, .1, .08, false);
    }
    box('#a1a997', -5, .65, -5, 10, .2, 1.7);
    return true;
  }
  if (kind === 'cinema') {
    box('#e8dfc8', -3, 2, -11.8, 16, 3.5, .14, false);
    for (const x of [-9, -5, -1, 3]) for (const z of [-4, 1, 6]) {
      box('#71575e', x, .55, z, 2.4, .3, 2.2);
      box('#71575e', x, 1.2, z + 1, 2.4, 1.4, .3);
    }
    return true;
  }
  if (kind === 'arcade') {
    for (const x of [-10, -5, 0]) for (const z of [-7, 2]) {
      box('#596a76', x, 1.25, z, 2, 2.5, 2);
      box('#29454f', x, 1.65, z + 1.05, 1.6, 1, .07, false);
      box('#b3a6cb', x, 1.1, z + 1.3, 1.7, .1, .8, false);
      box('#d6b677', x, 1.24, z + 1.5, .2, .2, .2, false);
    }
    return true;
  }
  return false;
}
