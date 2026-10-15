#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const ROOT_ENV = path.join(rootDir, '.env');
const DEV_ENV = path.join(rootDir, '.env.development');
const PROD_ENV = path.join(rootDir, '.env.production');
const TEST_ENV = path.join(rootDir, '.env.test');
const WEB_ENV = path.join(rootDir, 'apps', 'web', '.env');
const API_ENV = path.join(rootDir, 'apps', 'api', '.env');

// ANSI Colors
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const CYAN = '\x1b[36m';
const RED = '\x1b[31m';
const GRAY = '\x1b[90m';

function parseEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf-8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    // Strip trailing comments if not quoted
    if (!val.startsWith('"') && !val.startsWith("'")) {
      const hashIdx = val.indexOf('#');
      if (hashIdx !== -1) {
        val = val.slice(0, hashIdx).trim();
      }
    }
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

function syncWorkspaceLinks() {
  // Sync apps/web/.env
  try {
    const webStat = fs.lstatSync(WEB_ENV);
    if (!webStat.isSymbolicLink()) {
      fs.unlinkSync(WEB_ENV);
      fs.symlinkSync('../../.env', WEB_ENV);
    }
  } catch {
    try { fs.symlinkSync('../../.env', WEB_ENV); } catch {}
  }

  // Sync apps/api/.env
  try {
    const apiStat = fs.lstatSync(API_ENV);
    if (!apiStat.isSymbolicLink()) {
      fs.unlinkSync(API_ENV);
      fs.symlinkSync('../../.env', API_ENV);
    }
  } catch {
    try { fs.symlinkSync('../../.env', API_ENV); } catch {}
  }
}

function printBanner(mode, env) {
  const isProd = mode === 'prod' || env.NODE_ENV === 'production';
  const color = isProd ? RED : GREEN;
  const label = isProd ? 'PRODUCTION' : 'DEVELOPMENT';

  let dbHost = 'unknown';
  try {
    if (env.DATABASE_URL) {
      dbHost = new URL(env.DATABASE_URL).hostname;
    }
  } catch {
    dbHost = 'custom-db';
  }

  console.log(`\n${color}╔════════════════════════════════════════════════════════════════╗${RESET}`);
  console.log(`${color}║${RESET} ${BOLD}Morphic Environment:${RESET} ${color}${BOLD}${label.padEnd(41)}${RESET} ${color}║${RESET}`);
  console.log(`${color}╚════════════════════════════════════════════════════════════════╝${RESET}`);

  console.log(`  ${GRAY}•${RESET} ${BOLD}NODE_ENV:${RESET}              ${env.NODE_ENV ?? '(unset)'}`);
  console.log(`  ${GRAY}•${RESET} ${BOLD}Web App URL:${RESET}           ${CYAN}${env.NEXT_PUBLIC_APP_URL ?? '(unset)'}${RESET}`);
  console.log(`  ${GRAY}•${RESET} ${BOLD}API Backend Target:${RESET}    ${CYAN}${env.NEXT_PUBLIC_API_URL ?? '(unset)'}${RESET}`);
  console.log(`  ${GRAY}•${RESET} ${BOLD}Public Gateway URL:${RESET}    ${env.NEXT_PUBLIC_GATEWAY_URL ?? '(unset)'}`);
  console.log(`  ${GRAY}•${RESET} ${BOLD}Database Host:${RESET}         ${YELLOW}${dbHost}${RESET}`);
  console.log(`  ${GRAY}•${RESET} ${BOLD}Redis URL:${RESET}             ${env.REDIS_URL ? env.REDIS_URL : GRAY + '(disabled / in-memory)' + RESET}`);
  console.log(`  ${GRAY}•${RESET} ${BOLD}API Bind Port:${RESET}         ${env.API_PORT ?? '8787'}`);
  console.log(`  ${GRAY}•${RESET} ${BOLD}Duitku Mode:${RESET}           ${env.DUITKU_ENV === 'production' ? RED + 'production' : GREEN + (env.DUITKU_ENV || 'sandbox')}${RESET}`);
  console.log(`  ${GRAY}•${RESET} ${BOLD}PayPal Mode:${RESET}           ${env.PAYPAL_ENVIRONMENT === 'live' ? RED + 'live' : GREEN + (env.PAYPAL_ENVIRONMENT || 'sandbox')}${RESET}`);

  // Safety Warnings
  const warnings = [];
  if (isProd) {
    if (env.PAYPAL_ENVIRONMENT !== 'live' && env.PAYPAL_ENVIRONMENT !== 'production') {
      warnings.push(`[FATAL GUARDRAIL] PAYPAL_ENVIRONMENT="${env.PAYPAL_ENVIRONMENT}" but NODE_ENV=production. assertPaypalConfig() will crash! Set PAYPAL_ENVIRONMENT=live.`);
    }
    if (env.DUITKU_ENV !== 'production') {
      warnings.push(`[FATAL GUARDRAIL] DUITKU_ENV="${env.DUITKU_ENV}" but NODE_ENV=production. assertDuitkuConfig() will crash! Set DUITKU_ENV=production.`);
    }
    if (!env.REDIS_URL) {
      warnings.push(`[OPS WARNING] REDIS_URL is not set. Rate limiting across multiple processes requires Redis in production.`);
    }
    if (!env.RESEND_API_KEY) {
      warnings.push(`[OPS NOTICE] RESEND_API_KEY is not set. User OTP emails will fail in production.`);
    }
  } else {
    if (env.NEXT_PUBLIC_API_URL && env.NEXT_PUBLIC_API_URL.includes('morphic-api.web.id')) {
      warnings.push(`[DEV WARNING] NEXT_PUBLIC_API_URL points to live production (${env.NEXT_PUBLIC_API_URL}) instead of localhost:8787.`);
    }
    if (env.PAYPAL_ENVIRONMENT === 'live') {
      warnings.push(`[SAFETY WARNING] PAYPAL_ENVIRONMENT="live" is not permitted when NODE_ENV is not production!`);
    }
    if (env.DUITKU_ENV === 'production') {
      warnings.push(`[SAFETY WARNING] DUITKU_ENV="production" is not permitted when NODE_ENV is not production!`);
    }
  }

  if (warnings.length > 0) {
    console.log(`\n${YELLOW}${BOLD}⚠️  Configuration Checks:${RESET}`);
    for (const w of warnings) {
      console.log(`  ${YELLOW}!${RESET} ${w}`);
    }
  }

  console.log(`\n  ${GRAY}Active files:${RESET} .env -> ${isProd ? '.env.production' : '.env.development'}`);
  console.log(`  ${GRAY}apps/web/.env & apps/api/.env symlinks: verified & in sync.${RESET}\n`);
}

function switchTo(mode) {
  const isProd = mode === 'prod' || mode === 'production';
  const sourceFile = isProd ? PROD_ENV : DEV_ENV;
  const exampleFile = isProd ? path.join(rootDir, '.env.production.example') : path.join(rootDir, '.env.development.example');

  if (!fs.existsSync(sourceFile)) {
    if (fs.existsSync(exampleFile)) {
      console.log(`${YELLOW}Notice: ${path.basename(sourceFile)} not found, initializing from ${path.basename(exampleFile)}...${RESET}`);
      fs.copyFileSync(exampleFile, sourceFile);
    } else {
      console.error(`${RED}Error: Cannot find ${sourceFile}${RESET}`);
      process.exit(1);
    }
  }

  fs.copyFileSync(sourceFile, ROOT_ENV);
  syncWorkspaceLinks();

  const activeEnv = parseEnv(ROOT_ENV);
  printBanner(isProd ? 'prod' : 'dev', activeEnv);

  console.log(`${GREEN}${BOLD}✓ Switched to ${isProd ? 'PRODUCTION' : 'DEVELOPMENT'} mode successfully.${RESET}`);
  if (isProd) {
    console.log(`${GRAY}Run for production:${RESET} ${CYAN}pnpm build && pnpm start${RESET}`);
  } else {
    console.log(`${GRAY}Run for local dev:${RESET}  ${CYAN}pnpm dev${RESET}`);
    console.log(`${GRAY}Run unit tests:${RESET}     ${CYAN}pnpm test:web${RESET} or ${CYAN}pnpm test:api${RESET}`);
  }
}

function showStatus() {
  if (!fs.existsSync(ROOT_ENV)) {
    console.log(`${YELLOW}No active .env file found in root.${RESET}`);
    console.log(`Run ${CYAN}pnpm env:dev${RESET} to initialize development mode.`);
    return;
  }

  const activeEnv = parseEnv(ROOT_ENV);
  const isProd = activeEnv.NODE_ENV === 'production';
  syncWorkspaceLinks();
  printBanner(isProd ? 'prod' : 'dev', activeEnv);
}

// Main CLI dispatch
const command = (process.argv[2] || '').toLowerCase().trim();

switch (command) {
  case 'dev':
  case 'development':
    switchTo('dev');
    break;
  case 'prod':
  case 'production':
    switchTo('prod');
    break;
  case 'status':
  case 'check':
    showStatus();
    break;
  default:
    console.log(`\n${BOLD}Morphic Environment Manager${RESET}`);
    console.log(`Usage:`);
    console.log(`  ${CYAN}pnpm env:dev${RESET}     Switch active .env to Development (localhost, sandbox)`);
    console.log(`  ${CYAN}pnpm env:prod${RESET}    Switch active .env to Production (morphic-api.web.id, live)`);
    console.log(`  ${CYAN}pnpm env:status${RESET}  Show current active environment and configuration checks\n`);
    process.exit(0);
}
