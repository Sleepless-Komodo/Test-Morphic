import { eq } from 'drizzle-orm';
import { db, schema as s } from '@morphic/db';
import { ModelsView } from './models-view';

const FALLBACK_MODELS = [
  {
    publicModelId: 'deepseek-v4',
    displayName: 'DeepSeek V4 Coder',
    description: 'Sangat cepat & presisi untuk coding, debugging, dan auto-complete di Cursor & Cline.',
    descriptionEn: 'Ultra-fast and precise for coding, debugging, and auto-complete in Cursor & Cline.',
    contextLength: 65536,
    capabilities: ['coding', 'chat', 'reasoning'],
    inputCreditsPer1m: 100,
    outputCreditsPer1m: 200,
    dailyRate: 'Rp 2.500 / hari',
    dailyRateEn: 'Rp 2,500 / day',
    providerName: 'DeepSeek',
  },
  {
    publicModelId: 'deepseek-r1',
    displayName: 'DeepSeek R1 Reasoning',
    description: 'Penalaran bertahap (Chain-of-Thought) untuk arsitektur kompleks dan algoritma rumit.',
    descriptionEn: 'Step-by-step reasoning (Chain-of-Thought) for complex architecture and algorithms.',
    contextLength: 131072,
    capabilities: ['reasoning', 'coding'],
    inputCreditsPer1m: 220,
    outputCreditsPer1m: 450,
    dailyRate: 'Rp 4.500 / hari',
    dailyRateEn: 'Rp 4,500 / day',
    providerName: 'DeepSeek',
  },
  {
    publicModelId: 'qwen-max',
    displayName: 'Qwen 2.5 Max',
    description: 'Model flagship serba bisa untuk analisis data, bahasa Indonesia alami, dan multi-step tasks.',
    descriptionEn: 'Versatile flagship model for data analysis, natural language, and multi-step tasks.',
    contextLength: 131072,
    capabilities: ['general', 'reasoning', 'multimodal'],
    inputCreditsPer1m: 180,
    outputCreditsPer1m: 360,
    dailyRate: 'Rp 3.500 / hari',
    dailyRateEn: 'Rp 3,500 / day',
    providerName: 'Qwen',
  },
  {
    publicModelId: 'kimi-coding',
    displayName: 'Kimi Coding 256K',
    description: 'Context window super masif 256K tokens untuk membaca seluruh file repository codebase.',
    descriptionEn: 'Massive 256K token context window to read entire codebase repositories.',
    contextLength: 262144,
    capabilities: ['coding', 'long-context'],
    inputCreditsPer1m: 190,
    outputCreditsPer1m: 380,
    dailyRate: 'Rp 4.000 / hari',
    dailyRateEn: 'Rp 4,000 / day',
    providerName: 'Kimi',
  },
  {
    publicModelId: 'glm-4-air',
    displayName: 'GLM-4 Air Ultra Fast',
    description: 'Model ringan super cepat dengan latensi rendah untuk instant chat & quick reasoning.',
    descriptionEn: 'Ultra-fast lightweight model with low latency for instant chat & quick reasoning.',
    contextLength: 131072,
    capabilities: ['chat', 'coding'],
    inputCreditsPer1m: 80,
    outputCreditsPer1m: 160,
    dailyRate: 'Rp 1.500 / hari',
    dailyRateEn: 'Rp 1,500 / day',
    providerName: 'Zhipu AI',
  },
  {
    publicModelId: 'yi-lightning',
    displayName: 'Yi Lightning 01.AI',
    description: 'Respon instan ultra-low latency untuk perulangan instruksi cepat dan auto-complete.',
    descriptionEn: 'Ultra-low latency instant response for rapid instruction following and auto-complete.',
    contextLength: 16384,
    capabilities: ['chat', 'reasoning'],
    inputCreditsPer1m: 60,
    outputCreditsPer1m: 120,
    dailyRate: 'Rp 1.000 / hari',
    dailyRateEn: 'Rp 1,000 / day',
    providerName: '01.AI',
  },
];

export default async function ModelsPage() {
  let models: any[] = FALLBACK_MODELS;

  try {
    const dbModels = await db
      .select({
        publicModelId: s.models.publicModelId,
        displayName: s.models.displayName,
        description: s.models.description,
        contextLength: s.models.contextLength,
        capabilities: s.models.capabilities,
        inputCreditsPer1m: s.models.inputCreditsPer1m,
        outputCreditsPer1m: s.models.outputCreditsPer1m,
        providerName: s.providers.name,
      })
      .from(s.models)
      .innerJoin(s.providers, eq(s.models.providerId, s.providers.id))
      .where(eq(s.models.status, 'active'));

    if (dbModels.length > 0) {
      models = dbModels;
    }
  } catch (err) {
    console.warn('[ModelsPage] Database offline, showing fallback model catalog:', err);
  }

  return <ModelsView initialModels={models} />;
}
