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
  //
  // IMPORTANT: `ws` is a CJS-only package that calls require('events') internally.
  // Bundling it inline into an ESM file causes: "Dynamic require of events is not supported".
  // Marking it external lets Node.js handle CJS→ESM interop at runtime correctly,
  // and Vercel's nft tracer will automatically include ws in the function deployment.
  {
    entry: { index: 'src/index.vercel.ts' },
    outDir: 'api',
    format: ['esm'],
    clean: false,
    bundle: true,
    splitting: false,
    noExternal: ['@morphic/db', '@morphic/shared'],
    external: ['ws'],
  },
]);
