import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/index.vercel.ts'],
  format: ['esm'],
  clean: true,
  bundle: true,
  splitting: false,
  noExternal: ['@morphic/db', '@morphic/shared'],
});
