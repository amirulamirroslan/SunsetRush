import { defineConfig } from 'vite';

// `base: './'` keeps the production build relocatable, so it can later be mounted under any sub-path of a multi-game site.
export default defineConfig({
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 900, sourcemap: false },
  server: { host: true },
});
