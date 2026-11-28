import type { WebGLRenderer } from 'three';
import type { AssetManager } from './AssetManager';

export interface BootstrapProgress { loading(message: string): void; fallback(message: string): void; closed(): boolean; }

/** Sequential startup groups share the bounded loader and stop between stages on shutdown. */
export async function preloadCoreAssets(assets: AssetManager, renderer: WebGLRenderer, progress: BootstrapProgress, selectedVehicle?: string) {
  if (progress.closed()) return false;
  assets.initModels(renderer);
  const stages: { label: string; load(): Promise<unknown>; fallback?: string }[] = [
    { label: 'MEETING THE NEIGHBORHOOD', load: () => assets.characters.preload(), fallback: '人物素材暂不可用，已使用程序化备用形象' },
    { label: 'PREPARING CITY SURFACES', load: () => assets.preloadSurfaces() },
    { label: 'PREPARING THE GARAGE', load: () => assets.vehicles.preload(selectedVehicle) },
    { label: 'BUILDING THE SKYLINE', load: () => assets.preloadBuildings() },
    { label: 'ADDING THE STREET DETAILS', load: () => assets.preloadProps() },
    { label: 'BRINGING THE STREETS TO LIFE', load: () => assets.preloadCitizens() },
  ];
  for (const stage of stages) {
    if (progress.closed()) return false;
    progress.loading(stage.label);
    try { await stage.load(); }
    catch (error) { if (progress.closed()) return false; console.warn(stage.label, error); if (stage.fallback) progress.fallback(stage.fallback); }
  }
  return !progress.closed();
}
