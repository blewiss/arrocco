import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // `import.meta.url` invece di __dirname: il file è ESM ("type": "module").
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // Relative base so the built bundle works from any sub-path on a self-hosted
  // server and from Tauri's asset protocol without rebuilding.
  base: './',
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: true,
  },
});
