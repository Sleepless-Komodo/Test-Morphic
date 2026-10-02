import { Hono } from 'hono';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const quickstart = new Hono();

/**
 * GET /quickstart/opencode.sh
 *
 * Serve the Morphic x OpenCode auto-setup shell script.
 * The script auto-configures OpenCode with all available Morphic
 * models using the caller's BASE_URL and API_KEY env vars.
 *
 * Usage (user runs):
 *   export BASE_URL=https://api.yourdomain.com/v1 API_KEY=mk_...
 *   curl -fsSL "$BASE_URL/../quickstart/opencode.sh" | bash
 */
quickstart.get('/opencode.sh', (c) => {
  let script: string;

  try {
    // __dirname-equivalent for ESM / CJS build output
    const scriptPath = join(
      // dist/ is the compiled output; scripts/ is copied alongside it via tsup
      new URL('.', import.meta.url).pathname,
      '..',
      'scripts',
      'quickstart',
      'opencode.sh',
    );
    script = readFileSync(scriptPath, 'utf-8');
  } catch {
    // Fallback: try relative to process.cwd() (useful in dev)
    try {
      const scriptPath = join(process.cwd(), 'scripts', 'quickstart', 'opencode.sh');
      script = readFileSync(scriptPath, 'utf-8');
    } catch {
      return c.json(
        { error: { message: 'quickstart script not found', type: 'not_found', code: 'script_not_found' } },
        404,
      );
    }
  }

  return c.body(script, 200, {
    'Content-Type': 'text/x-shellscript; charset=utf-8',
    // Prevent caches from serving stale scripts
    'Cache-Control': 'no-store',
    // Security: prevent browsers from sniffing MIME type
    'X-Content-Type-Options': 'nosniff',
  });
});

export { quickstart };
