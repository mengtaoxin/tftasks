import { chmodSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

const root = path.dirname(fileURLToPath(import.meta.url));
const outfile = path.join(root, 'dist/tftasks.js');

function markExecutable(): Plugin {
  return {
    name: 'tftasks-executable',
    apply: 'build',
    closeBundle() {
      chmodSync(outfile, 0o755);
    },
  };
}

export default defineConfig({
  plugins: [markExecutable()],
  build: {
    ssr: 'src/main.ts',
    outDir: 'dist',
    emptyOutDir: true,
    target: 'node22',
    sourcemap: true,
    minify: false,
    rolldownOptions: {
      output: {
        entryFileNames: 'tftasks.js',
        banner: '#!/usr/bin/env node',
      },
    },
  },
});
