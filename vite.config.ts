import { defineConfig } from 'vite';
export default defineConfig({
  server: { watch: { ignored: ['**/artifacts/**', '**/test-results/**', '**/playwright-report/**'] } },
  build: {
    target: 'es2022',
    rollupOptions: { output: { manualChunks: { three: ['three'], physics: ['@dimforge/rapier3d-compat'] } } },
    chunkSizeWarningLimit: 2300,
  },
  worker: { format: 'es' },
});
