import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwind()],
  server: {
    port: 5173,
  },
  // The workspace packages are TypeScript source, not built bundles. Excluding
  // them from pre-bundling lets Vite transform them in place and keeps HMR
  // working when the engine changes.
  optimizeDeps: {
    exclude: ['@codenames/engine', '@codenames/protocol', '@codenames/words'],
  },
});
