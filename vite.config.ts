import { defineConfig } from 'vite';
export default defineConfig({
  build: {
    target: 'es2022',
    rollupOptions: { output: { manualChunks: { three: ['three'], physics: ['@dimforge/rapier3d-compat'] } } },
    chunkSizeWarningLimit: 2300,
  },
  worker: { format: 'es' },
});
