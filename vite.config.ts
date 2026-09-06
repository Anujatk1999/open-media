import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    modulePreload: false,
    chunkSizeWarningLimit: 1000,
    // Without an explicit multi-page `input`, Vite only builds/crawls
    // index.html. library.html was silently excluded from production
    // builds, and — since the dev-server dependency optimizer crawls the
    // same `input` list to decide what to pre-bundle — its dependencies
    // were never pre-bundled either.
    rollupOptions: {
      input: {
        main: 'index.html',
        library: 'library.html',
        help: 'help.html',
      },
    },
  },
});
