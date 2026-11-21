import type { IWorldGenerator } from '../core/contracts';
import type { ChunkPlan } from './ProceduralGenerator';

export class GenerationWorker implements IWorldGenerator<ChunkPlan> {
  private worker?: Worker;
  private request = 0;
  private closed = false;
  private pending = new Map<number, { resolve: (plan: ChunkPlan) => void; reject: (error: Error) => void; clean: () => void }>();
  private acquireWorker() {
    if (this.closed) throw new DOMException('Closed', 'AbortError');
    if (this.worker) return this.worker;
    const worker = new Worker(new URL('../workers/world.worker.ts', import.meta.url), { type: 'module' });
    this.worker = worker;
    worker.onmessage = (event: MessageEvent<{ request: number; plan: ChunkPlan }>) => {
      if (this.worker !== worker) return;
      const entry = this.pending.get(event.data.request); if (!entry) return;
      entry.clean(); this.pending.delete(event.data.request); entry.resolve(event.data.plan);
    };
    worker.onerror = event => { event.preventDefault(); if (this.worker === worker) this.stop(new Error('World generator failed')); };
    return worker;
  }
  private stop(error: Error) {
    this.worker?.terminate(); this.worker = undefined;
    for (const entry of this.pending.values()) { entry.clean(); entry.reject(error); }
    this.pending.clear();
  }
  generate(seed: number, id: string, signal?: AbortSignal): Promise<ChunkPlan> {
    if (signal?.aborted || this.closed) return Promise.reject(new DOMException('Cancelled', 'AbortError'));
    let worker: Worker;
    try { worker = this.acquireWorker(); } catch (error) { return Promise.reject(error); }
    return new Promise((resolve, reject) => {
      const request = ++this.request;
      const abort = () => { clean(); this.pending.delete(request); reject(new DOMException('Cancelled', 'AbortError')); };
      const timer = setTimeout(() => this.stop(new Error('Generation timeout')), 8000);
      const clean = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); };
      this.pending.set(request, { resolve, reject, clean }); signal?.addEventListener('abort', abort, { once: true });
      try { worker.postMessage({ request, seed, id }); } catch (error) { clean(); this.pending.delete(request); reject(error); }
    });
  }
  close() { if (this.closed) return; this.closed = true; this.stop(new DOMException('Closed', 'AbortError')); }
}
