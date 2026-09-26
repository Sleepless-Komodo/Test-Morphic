import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '../../.env') });
import { db } from './index.ts';
import * as s from './schema.ts';
import { sql } from 'drizzle-orm';

async function seed() {
  // Providers — credentials encrypted at runtime by the API; seed uses
  // credential_reference placeholder so no plaintext secret lands in DB.
  const [deepseek] = await db
    .insert(s.providers)
    .values([
      {
        name: 'deepseek',
        baseUrl: 'https://api.deepseek.com/v1',
        credentialReference: 'env:DEEPSEEK_API_KEY',
        status: 'active',
      },
      {
        name: 'qwen',
        baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
        credentialReference: 'env:DASHSCOPE_API_KEY',
        status: 'active',
      },
      {
        name: 'kimi',
        baseUrl: 'https://api.moonshot.ai/v1',
        credentialReference: 'env:MOONSHOT_API_KEY',
        status: 'active',
      },
    ])
    .onConflictDoNothing({ target: s.providers.name })
    .returning();

  const providersByName = Object.fromEntries(
    (await db.select().from(s.providers)).map((p) => [p.name, p.id]),
  ) as Record<string, string>;

  await db
    .insert(s.models)
    .values([
      {
        providerId: providersByName['deepseek']!,
        publicModelId: 'deepseek-v4',
        providerModelId: 'deepseek-chat',
        displayName: 'DeepSeek V4',
        description: 'Coding & reasoning model',
        contextLength: 65536,
        capabilities: ['coding', 'reasoning'],
        inputCreditsPer1m: 100,
        outputCreditsPer1m: 200,
      },
      {
        providerId: providersByName['qwen']!,
        publicModelId: 'qwen-max',
        providerModelId: 'qwen-max',
        displayName: 'Qwen Max',
        description: 'General purpose & reasoning',
        contextLength: 32768,
        capabilities: ['general', 'reasoning'],
        inputCreditsPer1m: 120,
        outputCreditsPer1m: 360,
      },
      {
        providerId: providersByName['kimi']!,
        publicModelId: 'kimi-coding',
        providerModelId: 'kimi-k2-0905-preview',
        displayName: 'Kimi Coding',
        description: 'Coding with long context',
        contextLength: 262144,
        capabilities: ['coding', 'long-context'],
        inputCreditsPer1m: 80,
        outputCreditsPer1m: 240,
      },
    ])
    .onConflictDoNothing({ target: s.models.publicModelId });

  const deepseekV4 = await db
    .select()
    .from(s.models)
    .where(sql`${s.models.publicModelId} = 'deepseek-v4'`)
    .limit(1);

  const qwenMax = await db
    .select()
    .from(s.models)
    .where(sql`${s.models.publicModelId} = 'qwen-max'`)
    .limit(1);

  await db
    .insert(s.packages)
    .values([
      // 1. VIA TOKEN (Token Quota)
      {
        name: '1M Token Pack',
        description: '1.000.000 Token AI murni untuk API & otomasi, tanpa masa berlaku',
        creditAllowance: 1_000_000,
        modelId: null,
        durationHours: 24 * 365,
        priceCents: 25_000,
        currency: 'IDR',
        status: 'active',
      },
      {
        name: '5M Token Pack',
        description: '5.000.000 Token AI untuk sistem produksi & beban kerja besar',
        creditAllowance: 5_000_000,
        modelId: null,
        durationHours: 24 * 365,
        priceCents: 100_000,
        currency: 'IDR',
        status: 'active',
      },
      {
        name: '1M Token Pack USD',
        description: '1,000,000 AI tokens for API integration & automated workflows',
        creditAllowance: 1_000_000,
        modelId: null,
        durationHours: 24 * 365,
        priceCents: 200,
        currency: 'USD',
        status: 'active',
      },
      {
        name: '5M Token Pack USD',
        description: '5,000,000 high-speed tokens for high-throughput AI agent pipelines',
        creditAllowance: 5_000_000,
        modelId: null,
        durationHours: 24 * 365,
        priceCents: 800,
        currency: 'USD',
        status: 'active',
      },

      // 2. PACKAGE PASS (Time Pass & Dedicated Model)
      {
        name: 'DeepSeek V4 — 1 Day',
        description: 'Akses penuh DeepSeek V4 selama 24 jam untuk coding sprint (fair use 100k tokens)',
        creditAllowance: 100_000,
        modelId: deepseekV4[0]?.id ?? null,
        durationHours: 24,
        priceCents: 25_000,
        currency: 'IDR',
        status: 'active',
      },
      {
        name: 'Qwen Max — 24h Sprint',
        description: 'Akses penalaran intensif model Qwen 2.5 Max selama 24 jam (fair use 150k tokens)',
        creditAllowance: 150_000,
        modelId: qwenMax[0]?.id ?? null,
        durationHours: 24,
        priceCents: 35_000,
        currency: 'IDR',
        status: 'active',
      },
      {
        name: 'DeepSeek V4 — 24h Pass USD',
        description: '24-Hour full access for DeepSeek V4 coding sprints (fair use 100k tokens)',
        creditAllowance: 100_000,
        modelId: deepseekV4[0]?.id ?? null,
        durationHours: 24,
        priceCents: 200,
        currency: 'USD',
        status: 'active',
      },
      {
        name: 'Qwen Max — 24h Sprint USD',
        description: '24-Hour intense reasoning access with Qwen 2.5 Max (fair use 150k tokens)',
        creditAllowance: 150_000,
        modelId: qwenMax[0]?.id ?? null,
        durationHours: 24,
        priceCents: 300,
        currency: 'USD',
        status: 'active',
      },

      // 3. BALANCE / CREDIT (Universal Multi-Model Balance)
      {
        name: '100K Credits',
        description: '100.000 saldo kredit akun fleksibel untuk coba seluruh katalog model AI',
        creditAllowance: 100_000,
        modelId: null,
        durationHours: 24 * 30,
        priceCents: 50_000,
        currency: 'IDR',
        status: 'active',
      },
      {
        name: '500K Credits Pro',
        description: '500.000 saldo kredit akun fleksibel untuk eksplorasi multi-provider bebas',
        creditAllowance: 500_000,
        modelId: null,
        durationHours: 24 * 60,
        priceCents: 200_000,
        currency: 'IDR',
        status: 'active',
      },
      {
        name: 'Starter USD',
        description: '5,000 credits, pay-as-you-go balance for all AI providers',
        creditAllowance: 5_000,
        modelId: null,
        durationHours: 24 * 30,
        priceCents: 500,
        currency: 'USD',
        status: 'active',
      },
      {
        name: 'Pro USD',
        description: '20,000 credits, pay-as-you-go balance for all AI providers',
        creditAllowance: 20_000,
        modelId: null,
        durationHours: 24 * 60,
        priceCents: 1500,
        currency: 'USD',
        status: 'active',
      },
    ])
    .onConflictDoNothing({ target: s.packages.name });

  console.log('seed done:', { providers: Object.keys(providersByName).length });
  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
