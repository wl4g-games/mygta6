import { generateChunk } from '../world/ProceduralGenerator';
self.onmessage = (event: MessageEvent<{ request: number; seed: number; id: string }>) => {
  const { request, seed, id } = event.data;
  self.postMessage({ request, plan: generateChunk(seed, id) });
};
