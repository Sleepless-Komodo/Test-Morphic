import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { existsSync, watch } from 'node:fs';
import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const apiRoot = resolve(root, 'apps/api');
const output = resolve(apiRoot, 'context-duitku-payment.md');
const envFiles = [
  '.env.example',
  '.env.development.example',
  '.env.test.example',
  '.env.production.example',
];

const entryFiles = [
  'src/app.ts',
  'src/index.ts',
  'src/middleware/body-limit.ts',
  'src/middleware/session-ratelimit.ts',
  'src/handlers/payments.ts',
  'src/lib/duitku.ts',
  'src/lib/paypal-reconcile.ts',
  'src/routes/payments.ts',
  'src/routes/webhooks.ts',
  'src/openapi/routes/payments.ts',
  'src/openapi/routes/webhooks.ts',
  'src/openapi/schemas/payments.ts',
  'src/openapi/schemas/webhooks.ts',
  'src/routes/payments.test.ts',
  'src/openapi/phase5-payments.test.ts',
  'src/openapi/phase7-quickstart-webhooks.test.ts',
  'src/routes/bugfixes-audit.test.ts',
  'src/routes/gateway.test.ts',
];

const sourceExtensions = ['.ts', '.tsx', '.js', '.jsx'];
const importPattern =
  /(?:import\s+(?:[\s\S]*?\s+from\s+)?|export\s+[\s\S]*?\s+from\s+|import\s*\()\s*['"](\.[^'"]+)['"]/g;

function followsImports(file) {
  return (
    !/\.test\.[cm]?[jt]sx?$/.test(displayPath(file)) &&
    /(?:payment|duitku|paypal|webhook|billing)/i.test(displayPath(file))
  );
}

function displayPath(file) {
  return relative(root, file).replaceAll('\\', '/');
}

async function resolveImport(fromFile, importPath) {
  const base = resolve(dirname(fromFile), importPath);
  const candidates = [
    base,
    ...sourceExtensions.map((extension) => `${base}${extension}`),
    ...sourceExtensions.map((extension) => resolve(base, `index${extension}`)),
  ];

  for (const candidate of candidates) {
    try {
      if ((await stat(candidate)).isFile()) return candidate;
    } catch {
      // An unresolved package or optional import is outside this context bundle.
    }
  }
  return null;
}

async function collectSourceFiles() {
  const files = new Set();
  const pending = entryFiles.map((file) => {
    const resolved = resolve(apiRoot, file);
    return { file: resolved, followImports: followsImports(resolved) };
  });

  while (pending.length > 0) {
    const item = pending.pop();
    const file = item?.file;
    if (!file || files.has(file)) continue;
    if (!existsSync(file)) {
      throw new Error(`Duitku context entry file does not exist: ${displayPath(file)}`);
    }

    files.add(file);
    const source = await readFile(file, 'utf8');
    if (item.followImports) {
      for (const match of source.matchAll(importPattern)) {
        const importedFile = await resolveImport(file, match[1]);
        if (importedFile) pending.push({ file: importedFile, followImports: true });
      }
    }
  }

  return [...files].sort((a, b) => displayPath(a).localeCompare(displayPath(b)));
}

async function renderBlock(file, language) {
  return `## \`${displayPath(file)}\`\n\n\`\`\`${language}\n${await readFile(file, 'utf8')}\n\`\`\`\n`;
}

async function generate() {
  const sourceFiles = await collectSourceFiles();
  const sections = [
    '# Duitku payment context for `apps/api`',
    '',
    '> Complete source bundle for handing the Duitku payment implementation to another AI.',
    '> Generated from the current working tree by `scripts/generate-duitku-context.mjs`.',
    '> Environment examples and all relative TypeScript/JavaScript dependencies of the payment entry files are included in full.',
    '> Production and production-mode test runs fail startup with variable-specific errors when required Duitku configuration is missing or invalid; PayPal-only deployments remain valid when both Duitku credentials are unset.',
    '> `POST /v1/payments/create` has a per-user-and-IP limiter of 5 requests per minute, followed by the existing 5 recent payment-attempts-per-hour business rule.',
    '> Duitku payment creation returns `503` before inserting a payment row when either the primary channel or either merchant credential is missing.',
    '> The example values `SQ` and `SP` are deployment configuration, not universal Duitku mappings.',
    '',
    '## Included environment examples',
    '',
    ...envFiles.map((file) => `- \`${file}\``),
    '',
    '## Included source files',
    '',
    ...sourceFiles.map((file) => `- \`${displayPath(file)}\``),
    '',
    '---',
    '',
  ];

  for (const file of envFiles) {
    sections.push(await renderBlock(resolve(root, file), 'dotenv'));
  }
  for (const file of sourceFiles) {
    sections.push(await renderBlock(file, 'typescript'));
  }

  await writeFile(output, `${sections.join('\n')}\n`, 'utf8');
  console.log(`[duitku-context] generated ${displayPath(output)} (${sourceFiles.length} source files)`);
}

async function watchSourceTree() {
  const watchedDirectories = new Set();
  let timer;
  let generating = false;
  let queued = false;

  const schedule = () => {
    if (generating) {
      queued = true;
      return;
    }
    clearTimeout(timer);
    timer = setTimeout(async () => {
      generating = true;
      try {
        await generate();
      } catch (error) {
        console.error('[duitku-context] generation failed:', error);
      } finally {
        generating = false;
        if (queued) {
          queued = false;
          schedule();
        }
      }
    }, 100);
  };

  const addDirectoryWatcher = async (directory) => {
    if (watchedDirectories.has(directory)) return;
    watchedDirectories.add(directory);
    watch(directory, async (_eventType, filename) => {
      if (!filename) return;
      const changed = resolve(directory, filename.toString());
      try {
        if ((await stat(changed)).isDirectory()) await addDirectoryWatcher(changed);
      } catch {
        // Deleted files still require regeneration; the generator will report a useful error if needed.
      }
      schedule();
    });

    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) await addDirectoryWatcher(resolve(directory, entry.name));
    }
  };

  await addDirectoryWatcher(resolve(apiRoot, 'src'));
  for (const file of envFiles) {
    watch(resolve(root, file), schedule);
  }
  console.log('[duitku-context] watching apps/api/src and environment examples');
}

await generate();
if (process.argv.includes('--watch')) await watchSourceTree();
