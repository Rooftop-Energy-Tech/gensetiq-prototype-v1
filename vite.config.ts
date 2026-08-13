import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vite';

import {tanstackRouter} from '@tanstack/router-plugin/vite';
import viteReact from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Port 3100 rather than 3000: rooftopiq-frontend-v3 pins :3000 with
// `strictPort`, and the two prototypes should be runnable side by side.
export default defineConfig({
  server: {
    port: 3100,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    // Must precede the React plugin — it generates routeTree.gen.ts from
    // src/routes before React transforms the modules that import it.
    tanstackRouter({target: 'react', autoCodeSplitting: true}),
    tailwindcss(),
    viteReact(),
  ],
});
