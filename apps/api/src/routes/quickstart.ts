import { Hono } from 'hono';

const quickstart = new Hono();

quickstart.get('/opencode.sh', (c) => {
  const host = c.req.header('host') || 'morphic-api.web.id';
  const proto = c.req.header('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
  const apiRootUrl = `${proto}://${host}`;
  const baseUrl = `${apiRootUrl}/v1`;

  const script = `#!/usr/bin/env bash
set -e

# Morphic API Quickstart for OpenCode
# Target endpoint: ${baseUrl}

BOLD='\\033[1m'
GREEN='\\033[0;32m'
CYAN='\\033[0;36m'
YELLOW='\\033[0;33m'
RED='\\033[0;31m'
NC='\\033[0m'

echo -e "\${CYAN}\${BOLD}=== Morphic API Quickstart for OpenCode ===\${NC}\\n"

BASE_URL="${baseUrl}"

# Determine API Key from environment or prompt user
API_KEY="\${MORPHIC_API_KEY:-\${API_KEY:-}}"

if [ -z "\$API_KEY" ]; then
  if [ -t 0 ]; then
    read -p "Enter your Morphic API Key (press Enter to skip): " USER_KEY
    API_KEY="\$USER_KEY"
  elif [ -e /dev/tty ]; then
    read -p "Enter your Morphic API Key (press Enter to skip): " USER_KEY < /dev/tty 2>/dev/null || true
    API_KEY="\$USER_KEY"
  fi
fi

KEY_IS_PLACEHOLDER=0
if [ -z "\$API_KEY" ]; then
  API_KEY="{env:MORPHIC_API_KEY}"
  KEY_IS_PLACEHOLDER=1
fi

CONFIG_DIR="\$HOME/.config/opencode"
mkdir -p "\$CONFIG_DIR"
CONFIG_FILE="\$CONFIG_DIR/opencode.json"

echo -e "Configuring OpenCode in \${BOLD}\${CONFIG_FILE}\${NC}..."

if command -v node >/dev/null 2>&1; then
  node -e "
const fs = require('fs');
const filePath = process.argv[1];
const baseUrl = process.argv[2];
const apiKey = process.argv[3];

let config = {};
try {
  if (fs.existsSync(filePath)) {
    config = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }
} catch (e) {
  config = {};
}

if (typeof config !== 'object' || !config) config = {};
config['\$schema'] = config['\$schema'] || 'https://opencode.ai/config.json';
config.provider = config.provider || {};
config.provider.morphic = {
  npm: '@ai-sdk/openai-compatible',
  name: 'Morphic API',
  options: {
    baseURL: baseUrl,
    apiKey: apiKey
  },
  models: {
    'deepseek-v4': { name: 'DeepSeek V4' },
    'deepseek-r1': { name: 'DeepSeek R1' },
    'qwen-2.5-coder-32b': { name: 'Qwen 2.5 Coder 32B' },
    'claude-3-5-sonnet': { name: 'Claude 3.5 Sonnet' },
    'gpt-4o': { name: 'GPT-4o' }
  }
};
config.model = 'morphic/deepseek-v4';

fs.writeFileSync(filePath, JSON.stringify(config, null, 2) + '\\n');
" "\$CONFIG_FILE" "\$BASE_URL" "\$API_KEY"
elif command -v python3 >/dev/null 2>&1; then
  python3 -c "
import json, sys, os
file_path, base_url, api_key = sys.argv[1], sys.argv[2], sys.argv[3]
config = {}
if os.path.exists(file_path):
    try:
        with open(file_path, 'r') as f:
            config = json.load(f)
    except Exception:
        config = {}

if not isinstance(config, dict): config = {};
config['\$schema'] = config.get('\$schema', 'https://opencode.ai/config.json')
if 'provider' not in config or not isinstance(config['provider'], dict):
    config['provider'] = {}

config['provider']['morphic'] = {
    'npm': '@ai-sdk/openai-compatible',
    'name': 'Morphic API',
    'options': {
        'baseURL': base_url,
        'apiKey': api_key
    },
    'models': {
        'deepseek-v4': {'name': 'DeepSeek V4'},
        'deepseek-r1': {'name': 'DeepSeek R1'},
        'qwen-2.5-coder-32b': {'name': 'Qwen 2.5 Coder 32B'},
        'claude-3-5-sonnet': {'name': 'Claude 3.5 Sonnet'},
        'gpt-4o': {'name': 'GPT-4o'}
    }
}
config['model'] = 'morphic/deepseek-v4'

with open(file_path, 'w') as f:
    json.dump(config, f, indent=2)
    f.write('\\n')
" "\$CONFIG_FILE" "\$BASE_URL" "\$API_KEY"
else
  cat <<EOF > "\$CONFIG_FILE"
{
  "\$schema": "https://opencode.ai/config.json",
  "provider": {
    "morphic": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Morphic API",
      "options": {
        "baseURL": "$BASE_URL",
        "apiKey": "$API_KEY"
      },
      "models": {
        "deepseek-v4": { "name": "DeepSeek V4" },
        "deepseek-r1": { "name": "DeepSeek R1" },
        "qwen-2.5-coder-32b": { "name": "Qwen 2.5 Coder 32B" },
        "claude-3-5-sonnet": { "name": "Claude 3.5 Sonnet" },
        "gpt-4o": { "name": "GPT-4o" }
      }
    }
  },
  "model": "morphic/deepseek-v4"
}
EOF
fi

if [ -d "\$HOME/.opencode" ]; then
  cp "\$CONFIG_FILE" "\$HOME/.opencode/config.json" 2>/dev/null || true
fi

echo -e "\${GREEN}\${BOLD}✔ OpenCode successfully configured for Morphic!\${NC}\\n"
echo -e "  Config File   : \${CYAN}\${CONFIG_FILE}\${NC}"
echo -e "  Base URL      : \${CYAN}\${BASE_URL}\${NC}"
echo -e "  Default Model : \${CYAN}morphic/deepseek-v4\${NC}\\n"

if [ "\$KEY_IS_PLACEHOLDER" -eq 1 ]; then
  echo -e "\${YELLOW}\${BOLD}⚠️  API Key Notice:\${NC}"
  echo -e "  No API key was entered or found in \\$MORPHIC_API_KEY."
  echo -e "  Configured to use environment variable \${BOLD}{env:MORPHIC_API_KEY}\${NC}."
  echo -e "  To connect, run:"
  echo -e "    \${BOLD}export MORPHIC_API_KEY=\"mp-live-your-key-here\"\${NC}"
  echo -e "  or edit \${BOLD}\${CONFIG_FILE}\${NC} directly.\\n"
else
  echo -e "\${GREEN}API Key configured! You're ready to use OpenCode with Morphic.\${NC}\\n"
fi

echo -e "Run \${BOLD}opencode\${NC} in your terminal to start coding with Morphic!"
`;

  return c.text(script, 200, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'public, max-age=3600',
  });
});

export { quickstart };
