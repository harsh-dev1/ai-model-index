import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Project-site deploys live under /<repo>/ on github.io; dev and preview use /.
const base = process.env.DEPLOY_BASE ?? '/';

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // Recharts and React change far less often than the site does. Splitting them out
        // means a content update invalidates a ~30 kB chunk instead of the whole bundle.
        manualChunks: {
          charts: ['recharts'],
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
});
