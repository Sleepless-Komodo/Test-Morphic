import { Hono } from 'hono';
import { db, schema as s } from '@morphic/db';
import { eq } from 'drizzle-orm';

/**
 * Public install scripts, meant for `curl -fsSL <url> | bash`. They contain no secrets: the
 * API key is read from the caller's own environment ($API_KEY) and only ever written to a
 * local file on their machine.
 */
const quickstart = new Hono();

const CACHE_MS = 60_000;
let cached: { at: number; models: Array<{ id: string; name: string }> } | null = null;

async function activeModels() {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.models;
  const models = await db
    .select({ id: s.models.publicModelId, name: s.models.displayName })
    .from(s.models)
    .where(eq(s.models.status, 'active'));
  cached = { at: Date.now(), models };
  return models;
}

quickstart.get('/opencode.sh', async (c) => {
  const models = await activeModels();
  const modelsJson = JSON.stringify(Object.fromEntries(models.map((m) => [m.id, { name: m.name }])), null, 2)
    .split('\n')
    .join('\n      ')
    // Goes inside an unquoted heredoc: keep $, ` and \ literal.
    .replace(/[\\$`]/g, '\\$&');
  const defaultBase = `${(process.env.NEXT_PUBLIC_GATEWAY_URL || new URL(c.req.url).origin).replace(/\/+$/, '')}/v1`;

  const script = `#!/usr/bin/env bash
# Morphic x opencode quickstart. Writes ~/.config/opencode/opencode.json for the Morphic provider.
# Usage:
#   export BASE_URL=${defaultBase}
#   export API_KEY=mp-...
#   curl -fsSL "$BASE_URL/../quickstart/opencode.sh" | bash
set -euo pipefail

BASE_URL="\${BASE_URL:-${defaultBase}}"
BASE_URL="\${BASE_URL%/}"
API_KEY="\${API_KEY:-\${MORPHIC_API_KEY:-}}"

if [ -z "$API_KEY" ]; then
  echo "x API_KEY is not set. Run: export API_KEY=mp-your-key" >&2
  exit 1
fi
case "$API_KEY" in
  mp-*) ;;
  *) echo "x API_KEY should start with mp-. Copy it from your Morphic dashboard (API Keys)." >&2; exit 1 ;;
esac
# Keys are [A-Za-z0-9_-] only; anything else would break the JSON written below.
if ! printf '%s' "$API_KEY" | grep -Eq '^mp-[A-Za-z0-9_-]+$'; then
  echo "x API_KEY contains unexpected characters." >&2
  exit 1
fi

echo "> Checking your key against $BASE_URL ..."
if ! curl -fsS -o /dev/null -H "Authorization: Bearer $API_KEY" "$BASE_URL/models"; then
  echo "x The gateway rejected this key (or is unreachable). Check the key and BASE_URL." >&2
  exit 1
fi

CONFIG_DIR="\${XDG_CONFIG_HOME:-$HOME/.config}/opencode"
CONFIG="$CONFIG_DIR/opencode.json"
mkdir -p "$CONFIG_DIR"
if [ -f "$CONFIG" ]; then
  BACKUP="$CONFIG.bak.$(date +%Y%m%d%H%M%S)"
  cp "$CONFIG" "$BACKUP"
  echo "> Existing config saved to $BACKUP"
fi

umask 077
cat > "$CONFIG" <<JSON
{
  "\\$schema": "https://opencode.ai/config.json",
  "provider": {
    "morphic": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Morphic AI",
      "options": {
        "baseURL": "$BASE_URL",
        "apiKey": "$API_KEY"
      },
      "models": ${modelsJson}
    }
  }
}
JSON
chmod 600 "$CONFIG"

echo "OK opencode is connected to Morphic (${models.length} models)."
echo "  Config: $CONFIG"
echo "  Run: opencode   then pick a model with /models"
`;

  return c.body(script, 200, {
    'Content-Type': 'text/x-shellscript; charset=utf-8',
    'Cache-Control': 'public, max-age=60',
  });
});

export { quickstart };
