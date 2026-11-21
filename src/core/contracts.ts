import type { Vector3 } from 'three';

export type ChunkState = 'UNLOADED' | 'FAR' | 'NEAR' | 'ACTIVE';
export interface IGameSystem { init(): void | Promise<void>; update(dt: number): void; close(): void; }
export interface IWorldChunk {
  readonly id: string;
  readonly state: ChunkState;
  load(state: Exclude<ChunkState, 'UNLOADED'>, signal: AbortSignal): Promise<void>;
  activate(): void;
  deactivate(): void;
  unload(): void;
}
export interface IStreamableAsset<T> { preload(): Promise<void>; acquire(): T; release(): void; }
export interface IEntity<S> { update(dt: number): void; serialize(): S; restore(state: S): void; dispose(): void; }
export interface IInteractable { id: string; position: Vector3; canInteract(): boolean; interact(): void; }
export interface IWorldGenerator<T> { generate(seed: number, chunkId: string, signal?: AbortSignal): Promise<T>; }
export interface INPCBehavior { update(dt: number): void; onEvent(event: string): void; }
export interface IVehicle { enter(): void; exit(): void; control(throttle: number, steering: number, brake: boolean): void; applyDamage(amount: number): void; }
export interface IStore { enter(): void; exit(): void; purchase(product: string): boolean; onEvent(event: string): void; }
