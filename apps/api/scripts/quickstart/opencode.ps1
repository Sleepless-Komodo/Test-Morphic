# ╔══════════════════════════════════════════════════════════╗
# ║       Morphic x OpenCode — Auto-Setup Quickstart         ║
# ║       Windows PowerShell Edition                         ║
# ╚══════════════════════════════════════════════════════════╝
#
# Usage:
#   $env:BASE_URL  = "https://api.yourdomain.com/v1"
#   $env:MORPHIC_API_KEY = "mp-xxxxxxxxxxxxxxxxxxxx"
#   irm https://api.yourdomain.com/quickstart/opencode.ps1 | iex
#
#   Or one-liner:
#   $env:BASE_URL="https://api.yourdomain.com/v1"; $env:MORPHIC_API_KEY="mp-xxxx"; irm https://api.yourdomain.com/quickstart/opencode.ps1 | iex

#Requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ── Colour helpers ────────────────────────────────────────
function Write-Ok($msg)   { Write-Host "  " -NoNewline; Write-Host "✓" -ForegroundColor Green  -NoNewline; Write-Host " $msg" }
function Write-Say($msg)  { Write-Host "  " -NoNewline; Write-Host "›" -ForegroundColor Cyan   -NoNewline; Write-Host " $msg" }
function Write-Warn($msg) { Write-Host "  " -NoNewline; Write-Host " -ForegroundColor Yellow -NoNewline; Write-Host " $msg" }
function Write-Hr         { Write-Host ("─" * 46) -ForegroundColor DarkGray }
function Write-Die($msg)  {
    Write-Host ""
    Write-Host "  " -NoNewline; Write-Host "✗ $msg" -ForegroundColor Red
    Write-Host ""
    exit 1
}

# ── Banner ────────────────────────────────────────────────
Write-Host ""
Write-Host "  " -NoNewline; Write-Host "╔══════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "  " -NoNewline; Write-Host "║   Morphic  ×  OpenCode  Quickstart   ║" -ForegroundColor Cyan
Write-Host "  " -NoNewline; Write-Host "║          Windows PowerShell          ║" -ForegroundColor Cyan
Write-Host "  " -NoNewline; Write-Host "╚══════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host "    Konfigurasi otomatis dalam hitungan detik" -ForegroundColor DarkGray
Write-Host ""

# ── Required env vars ─────────────────────────────────────
$BaseUrl = $env:BASE_URL
$ApiKey  = $env:MORPHIC_API_KEY

if (-not $BaseUrl) { Write-Die "BASE_URL belum di-set. Contoh: `$env:BASE_URL='https://api.yourdomain.com/v1'" }
if (-not $ApiKey)  { Write-Die "MORPHIC_API_KEY belum di-set. Dapatkan API key dari dashboard Morphic" }

# Normalise BASE_URL — strip trailing slash
$BaseUrl = $BaseUrl.TrimEnd('/')

Write-Hr
Write-Say "Memeriksa environment..."

# ── Dependency check (curl.exe) ───────────────────────────
if (-not (Get-Command 'curl.exe' -ErrorAction SilentlyContinue)) {
    Write-Die "curl.exe tidak ditemukan. Install curl dari https://curl.se/windows atau gunakan Windows 10 1803+ yang sudah bundled."
}
Write-Ok "curl.exe tersedia"

# ── Install OpenCode if missing ───────────────────────────
Write-Hr
$opencodeCmd = Get-Command 'opencode' -ErrorAction SilentlyContinue
if ($opencodeCmd) {
    $opencodeVersion = & opencode --version 2>$null
    if (-not $opencodeVersion) { $opencodeVersion = 'unknown' }
    Write-Ok "OpenCode sudah terpasang ($opencodeVersion)"
} else {
    Write-Say "OpenCode belum terpasang — memasang sekarang..."
    try {
        irm https://opencode.ai/install.ps1 | iex
    } catch {
        Write-Die "Gagal memasang OpenCode. Coba pasang manual: https://opencode.ai"
    }

    # Refresh PATH for this session — common install locations on Windows
    $userLocal = Join-Path $env:LOCALAPPDATA 'Programs\opencode'
    $userBin   = Join-Path $env:USERPROFILE  '.local\bin'
    foreach ($p in @($userLocal, $userBin)) {
        if (Test-Path $p) { $env:PATH = "$p;$env:PATH" }
    }

    if (Get-Command 'opencode' -ErrorAction SilentlyContinue) {
        Write-Ok "OpenCode berhasil dipasang"
    } else {
        Write-Warn "OpenCode dipasang tapi tidak ditemukan di PATH — Anda mungkin perlu restart PowerShell"
        Write-Warn "Lanjutkan menulis config saja..."
    }
}

# ── Fetch available models ────────────────────────────────
Write-Hr
Write-Say "Mengambil daftar model dari Morphic API..."

$modelsUrl = "$BaseUrl/models"
$tmpFile   = Join-Path $env:TEMP "_morphic_models.json"

$httpCode = & curl.exe -s -o $tmpFile -w "%{http_code}" `
    -H "Authorization: Bearer $ApiKey" `
    $modelsUrl 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Die "Gagal terhubung ke $modelsUrl — periksa koneksi internet"
}

switch ($httpCode) {
    '200' { <# ok #> }
    { $_ -in '401','403' } { Write-Die "API key tidak valid atau sudah kadaluarsa (HTTP $httpCode) — cek API key Anda di dashboard" }
    '402' { Write-Die "Kredit habis (HTTP 402) — top up dulu di dashboard" }
    default { Write-Die "Unexpected response dari API (HTTP $httpCode)" }
}

$resp = Get-Content $tmpFile -Raw
Remove-Item $tmpFile -Force -ErrorAction SilentlyContinue

# Extract model IDs from JSON
$ids = @()
try {
    $parsed = $resp | ConvertFrom-Json
    $ids = @($parsed.data | ForEach-Object { $_.id } | Where-Object { $_ })
} catch {
    # Fallback: regex extraction
    $ids = @([regex]::Matches($resp, '"id"\s*:\s*"([^"]+)"') |
        ForEach-Object { $_.Groups[1].Value } |
        Where-Object { $_ -notmatch '^(model|list|morphic)$' })
}

if (-not $ids -or $ids.Count -eq 0) {
    Write-Die "Tidak ada model yang tersedia — kredit habis? Top up dulu di dashboard"
}

Write-Ok "$($ids.Count) model tersedia"

# ── Choose default model ──────────────────────────────────
# Priority: claude-3-7/3-5 / o3 / gpt-4o > claude / gpt-4 / gemini-2 > first available
$default = $ids[0]
foreach ($id in $ids) {
    if ($id -match 'claude-3-7|claude-3-5|o3|gpt-4o') {
        $default = $id
        break
    }
    if ($id -match 'claude|gpt-4|gemini-2') {
        $default = $id
    }
}

Write-Ok "Model default terpilih: $default"

# ── Build models JSON block ───────────────────────────────
$modelsJsonLines = [System.Collections.Generic.List[string]]::new()
foreach ($id in $ids) {
    $displayName = (Get-Culture).TextInfo.ToTitleCase(($id -replace '-', ' '))
    $modelsJsonLines.Add("        `"$id`": {")
    $modelsJsonLines.Add("          `"name`": `"$displayName`"")
    $modelsJsonLines.Add("        },")
}
# Remove trailing comma from last entry
if ($modelsJsonLines.Count -gt 0) {
    $modelsJsonLines[$modelsJsonLines.Count - 1] = $modelsJsonLines[$modelsJsonLines.Count - 1].TrimEnd(',')
}
$modelsJson = $modelsJsonLines -join "`n"

# ── Write opencode.json config ────────────────────────────
Write-Hr
$cfgDir = Join-Path $env:USERPROFILE '.config\opencode'
if (-not (Test-Path $cfgDir)) { New-Item -ItemType Directory -Path $cfgDir -Force | Out-Null }
$cfg = Join-Path $cfgDir 'opencode.json'

# Backup existing config
if (Test-Path $cfg) {
    $timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
    $backup = "$cfg.bak.$timestamp"
    Copy-Item $cfg $backup
    Write-Warn "Config lama dicadangkan ke: $backup"
}

$configContent = "{`n  `"`$schema`": `"https://opencode.ai/config.json`",`n  `"provider`": {`n    `"morphic`": {`n      `"npm`": `"@ai-sdk/openai-compatible`",`n      `"name`": `"Morphic`",`n      `"options`": {`n        `"baseURL`": `"$BaseUrl`",`n        `"apiKey`": `"$ApiKey`"`n      },`n      `"models`": {`n$modelsJson`n      }`n    }`n  },`n  `"model`": `"morphic/$default`"`n}"

Set-Content -Path $cfg -Value $configContent -Encoding UTF8
Write-Ok "Config ditulis ke: $cfg"

# ── Add PATH hint for new installs (PowerShell profile) ───
$profilePath = $PROFILE.CurrentUserAllHosts
if ($profilePath -and (Test-Path (Split-Path $profilePath))) {
    if (-not (Test-Path $profilePath)) { New-Item $profilePath -ItemType File -Force | Out-Null }
    $profileContent = Get-Content $profilePath -Raw -ErrorAction SilentlyContinue
    $pathEntries = @(
        (Join-Path $env:LOCALAPPDATA 'Programs\opencode'),
        (Join-Path $env:USERPROFILE  '.local\bin')
    )
    $needsUpdate = $pathEntries | Where-Object { $profileContent -notmatch [regex]::Escape($_) }
    if ($needsUpdate) {
        $pathLine = "`n# Added by Morphic x OpenCode quickstart`n"
        foreach ($p in $pathEntries) { $pathLine += "`$env:PATH = `"$p;`$env:PATH`"`n" }
        Add-Content -Path $profilePath -Value $pathLine
        Write-Warn "PATH diperbarui di $profilePath — jalankan: . `$PROFILE"
    }
}

# ── Done ──────────────────────────────────────────────────
Write-Hr
Write-Host ""
Write-Host "  " -NoNewline; Write-Host "Siap!" -ForegroundColor Green
Write-Host ""
Write-Host "  Jalankan perintah ini untuk mulai:"
Write-Host ""
Write-Host "    opencode" -ForegroundColor White
Write-Host ""
$gatewayUrl = $BaseUrl -replace '/v1.*', ''
Write-Host "  Model default aktif: $default" -ForegroundColor DarkGray
Write-Host "  Provider: Morphic ($BaseUrl)" -ForegroundColor DarkGray
Write-Host "  Semua $($ids.Count) model tersedia di OpenCode model picker" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Docs: https://opencode.ai/docs" -ForegroundColor DarkGray
Write-Host "  Dashboard Morphic: $gatewayUrl/dashboard" -ForegroundColor DarkGray
Write-Host ""
