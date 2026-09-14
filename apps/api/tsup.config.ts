import { defineConfig } from 'tsup';

export default defineConfig([
  // Local Node.js server bundle
  {
    entry: { index: 'src/index.ts' },
    outDir: 'dist',
    format: ['esm'],
    clean: true,
    bundle: true,
    splitting: false,
    noExternal: ['@morphic/db', '@morphic/shared'],
  },
  // Vercel Serverless Function bundle — output directly into api/ so Vercel
  // picks it up as a native zero-config function without re-compiling TS.
  {
    entry: { index: 'src/index.vercel.ts' },
    outDir: 'api',
    format: ['esm'],
    clean: false,
    bundle: true,
    splitting: false,
    noExternal: ['@morphic/db', '@morphic/shared'],
  },
]);
