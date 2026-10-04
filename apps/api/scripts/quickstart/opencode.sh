#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════╗
# ║        Morphic x OpenCode — Auto-Setup Quickstart        ║
# ╚══════════════════════════════════════════════════════════╝
#
# Usage:
#   export BASE_URL=https://api.yourdomain.com/v1 API_KEY=mk_YOUR_KEY
#   curl -fsSL "$BASE_URL/../quickstart/opencode.sh" | bash
#
#   Or one-liner:
#   BASE_URL=https://api.yourdomain.com/v1 API_KEY=mk_YOUR_KEY \
#     curl -fsSL https://api.yourdomain.com/quickstart/opencode.sh | bash

set -euo pipefail

# ── Colour codes ──────────────────────────────────────────
g='\033[1;32m'   # bold green
c='\033[1;36m'   # bold cyan
d='\033[0;90m'   # dim grey
r='\033[1;31m'   # bold red
y='\033[1;33m'   # bold yellow
b='\033[1m'      # bold
n='\033[0m'      # reset

# ── Helpers ───────────────────────────────────────────────
say()  { printf "  ${g}›${n} %s\n" "$*"; }
ok()   { printf "  ${g}✓${n} %s\n" "$*"; }
warn() { printf "  ${y}!${n} %s\n" "$*"; }
die()  { printf "\n  ${r}✗ %s${n}\n\n" "$*" >&2; exit 1; }
hr()   { printf "${d}%s${n}\n" "──────────────────────────────────────────────"; }

# ── Banner ────────────────────────────────────────────────
printf "\n"
printf "  ${c}${b}╔══════════════════════════════════════╗${n}\n"
printf "  ${c}${b}║   Morphic  ×  OpenCode  Quickstart   ║${n}\n"
printf "  ${c}${b}╚══════════════════════════════════════╝${n}\n"
printf "  ${d}  Konfigurasi otomatis dalam hitungan detik${n}\n"
printf "\n"

# ── Required env vars ─────────────────────────────────────
: "${BASE_URL:?BASE_URL belum di-set. Contoh: export BASE_URL=https://api.yourdomain.com/v1}"
: "${API_KEY:?API_KEY belum di-set. Dapatkan API key dari dashboard Morphic}"

# Normalise BASE_URL — strip trailing slash
BASE_URL="${BASE_URL%/}"

hr
say "Memeriksa environment..."

# ── Dependency checks ─────────────────────────────────────
for dep in curl; do
  command -v "$dep" >/dev/null 2>&1 || die "dependency '$dep' tidak ditemukan — pasang dulu lalu coba lagi"
done
ok "curl tersedia"

# ── Install OpenCode if missing ───────────────────────────
hr
if command -v opencode >/dev/null 2>&1; then
  OPENCODE_VERSION="$(opencode --version 2>/dev/null || echo 'unknown')"
  ok "OpenCode sudah terpasang (${OPENCODE_VERSION})"
else
  say "OpenCode belum terpasang — memasang sekarang..."
  curl -fsSL https://opencode.ai/install | bash \
    || die "Gagal memasang OpenCode. Coba pasang manual: https://opencode.ai"
  # Add common install locations to PATH for this session
  export PATH="$HOME/.opencode/bin:$HOME/.local/bin:$PATH"
  if command -v opencode >/dev/null 2>&1; then
    ok "OpenCode berhasil dipasang"
  else
    warn "OpenCode dipasang tapi tidak ditemukan di PATH — Anda mungkin perlu restart shell"
    warn "Lanjutkan menulis config saja..."
  fi
fi

# ── Fetch available models ────────────────────────────────
hr
say "Mengambil daftar model dari Morphic API..."

HTTP_CODE="$(curl -s -o /tmp/_morphic_models.json -w "%{http_code}" \
  -H "Authorization: Bearer ${API_KEY}" \
  "${BASE_URL}/models")" || die "Gagal terhubung ke ${BASE_URL}/models — periksa koneksi internet"

case "$HTTP_CODE" in
  200) ;;
  401|403) die "API key tidak valid atau sudah kadaluarsa (HTTP ${HTTP_CODE}) — cek API key Anda di dashboard" ;;
  402)     die "Kredit habis (HTTP 402) — top up dulu di dashboard" ;;
  *)       die "Unexpected response dari API (HTTP ${HTTP_CODE})" ;;
esac

resp="$(cat /tmp/_morphic_models.json)"
rm -f /tmp/_morphic_models.json

# Extract model IDs — works with both jq and pure shell grep
if command -v jq >/dev/null 2>&1; then
  ids="$(printf '%s' "$resp" | jq -r '.data[].id' 2>/dev/null)"
else
  # Fallback: grep for "id" fields inside the data array
  ids="$(printf '%s' "$resp" | grep -oE '"id"[[:space:]]*:[[:space:]]*"[^"]+"' \
        | sed -E 's/.*:[[:space:]]*"([^"]+)".*/\1/' \
        | grep -v '^model$\|^list$\|^morphic$')"
fi

[ -n "$ids" ] || die "Tidak ada model yang tersedia — kredit habis? Top up dulu di dashboard"

MODEL_COUNT="$(printf '%s\n' "$ids" | grep -c .)"
ok "${MODEL_COUNT} model tersedia"

# ── Choose default model ──────────────────────────────────
# Priority: claude-3-7/3-5 / o3 / gpt-4o > claude / gpt-4 / gemini-2 > first available
default=""
while IFS= read -r id; do
  [ -z "$id" ] && continue
  [ -z "$default" ] && default="$id"
  case "$id" in
    *claude-3-7*|*claude-3-5*|*o3*|*gpt-4o*)
      default="$id"
      break
      ;;
    *claude*|*gpt-4*|*gemini-2*)
      default="$id"
      ;;
  esac
done <<< "$ids"

ok "Model default terpilih: ${b}${default}${n}"

# ── Build models JSON block ───────────────────────────────
models_json=""
while IFS= read -r id; do
  [ -z "$id" ] && continue

  # Derive a human-friendly display name
  display_name="$(printf '%s' "$id" \
    | sed -E 's/-/ /g' \
    | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) tolower(substr($i,2)); print}')"

  models_json="${models_json}        \"${id}\": {
          \"name\": \"${display_name}\"
        },
"
done <<< "$ids"

# Strip trailing comma from last entry
models_json="$(printf '%s' "$models_json" | sed -e '$ s/,[[:space:]]*$//')"

# ── Write opencode.json config ────────────────────────────
hr
cfg_dir="${XDG_CONFIG_HOME:-$HOME/.config}/opencode"
mkdir -p "$cfg_dir"
cfg="${cfg_dir}/opencode.json"

# Backup existing config
if [ -f "$cfg" ]; then
  backup="${cfg}.bak.$(date +%s)"
  cp "$cfg" "$backup"
  warn "Config lama dicadangkan ke: ${d}${backup}${n}"
fi

cat > "$cfg" <<EOCONFIG
{
  "\$schema": "https://opencode.ai/config.json",
  "provider": {
    "morphic": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Morphic",
      "options": {
        "baseURL": "${BASE_URL}",
        "apiKey": "${API_KEY}"
      },
      "models": {
${models_json}
      }
    }
  },
  "model": "morphic/${default}"
}
EOCONFIG

ok "Config ditulis ke: ${d}${cfg}${n}"

# ── Add PATH hint for new installs ────────────────────────
SHELL_RC=""
case "${SHELL:-}" in
  */zsh)  SHELL_RC="$HOME/.zshrc" ;;
  */bash) SHELL_RC="$HOME/.bashrc" ;;
esac

if [ -n "$SHELL_RC" ] && [ -f "$SHELL_RC" ]; then
  if ! grep -q '\.opencode/bin\|\.local/bin' "$SHELL_RC" 2>/dev/null; then
    printf '\n# Added by Morphic x OpenCode quickstart\nexport PATH="$HOME/.opencode/bin:$HOME/.local/bin:$PATH"\n' >> "$SHELL_RC"
    warn "PATH diperbarui di ${SHELL_RC} — jalankan: source ${SHELL_RC}"
  fi
fi

# ── Done ──────────────────────────────────────────────────
hr
printf "\n"
printf "  ${g}${b}Siap!${n}\n\n"
printf "  Jalankan perintah ini untuk mulai:\n\n"
printf "    ${b}opencode${n}\n\n"
printf "  ${d}Model default aktif: ${b}${default}${n}\n"
printf "  ${d}Provider: Morphic (${BASE_URL})${n}\n"
printf "  ${d}Semua ${MODEL_COUNT} model tersedia di OpenCode model picker${n}\n"
printf "\n"
printf "  ${d}Docs: https://opencode.ai/docs${n}\n"
printf "  ${d}Dashboard Morphic: $(printf '%s' "${BASE_URL}" | sed 's|/v1.*||')/dashboard${n}\n"
printf "\n"
