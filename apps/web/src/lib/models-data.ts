export interface ModelItem {
  id: string;
  name: string;
  provider: string;
  category: 'Coding' | 'Reasoning' | 'Chat' | 'Multimodal';
  contextWindow: string;
  dailyRate: string;
  speed: 'Ultra Fast' | 'Fast' | 'Balanced';
  estimatedLatency: string;
  description: {
    id: string;
    en: string;
  };
  badge?: string;
  badgeType?: 'popular' | 'flagship' | 'pro' | 'hemat';
}

export const ALL_MODELS: ModelItem[] = [
  {
    id: 'claude-3.5-sonnet-proxy',
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    category: 'Coding',
    contextWindow: '200K Tokens',
    dailyRate: 'Rp 8.500 / hari',
    speed: 'Fast',
    estimatedLatency: '~180ms',
    badge: 'PRO DEV',
    badgeType: 'pro',
    description: {
      id: 'Model standar industri terbaik untuk problem-solving tingkat lanjut, refactoring kode besar, dan arsitektur enterprise.',
      en: 'The industry-leading model for advanced coding problem solving, large codebase refactoring, and complex architecture.',
    },
  },
  {
    id: 'deepseek-v4',
    name: 'DeepSeek V4 Coder',
    provider: 'DeepSeek',
    category: 'Coding',
    contextWindow: '64K Tokens',
    dailyRate: 'Rp 2.500 / hari',
    speed: 'Ultra Fast',
    estimatedLatency: '~110ms',
    badge: 'POPULER',
    badgeType: 'popular',
    description: {
      id: 'Sangat responsif dan akurat untuk auto-complete, refactoring, dan debugging di Cursor, Windsurf, dan Cline.',
      en: 'Ultra-fast and precise for auto-completion, refactoring, and debugging inside Cursor, Windsurf, and Cline.',
    },
  },
  {
    id: 'deepseek-r1',
    name: 'DeepSeek R1 Reasoning',
    provider: 'DeepSeek',
    category: 'Reasoning',
    contextWindow: '128K Tokens',
    dailyRate: 'Rp 4.500 / hari',
    speed: 'Balanced',
    estimatedLatency: '~350ms',
    badge: 'REASONING',
    badgeType: 'flagship',
    description: {
      id: 'Penalaran mendalam bertahap (Chain-of-Thought) untuk memecahkan logika matematika dan arsitektur sistem rumit.',
      en: 'In-depth step-by-step reasoning (Chain-of-Thought) for complex logic, algorithms, and deep system architecture.',
    },
  },
  {
    id: 'qwen-2.5-max',
    name: 'Qwen 2.5 Max',
    provider: 'Alibaba Cloud',
    category: 'Chat',
    contextWindow: '128K Tokens',
    dailyRate: 'Rp 3.500 / hari',
    speed: 'Fast',
    estimatedLatency: '~160ms',
    badge: 'FLAGSHIP',
    badgeType: 'flagship',
    description: {
      id: 'Model flagship serba bisa dengan pemahaman bahasa Indonesia alami tinggi, analisis data, dan multi-step agent.',
      en: 'Flagship all-round model with exceptional natural Indonesian and multilingual fluency, data analysis, and agent execution.',
    },
  },
  {
    id: 'kimi-coding',
    name: 'Kimi Coding 256K',
    provider: 'Moonshot AI',
    category: 'Coding',
    contextWindow: '256K Tokens',
    dailyRate: 'Rp 4.000 / hari',
    speed: 'Fast',
    estimatedLatency: '~190ms',
    badge: '256K CONTEXT',
    badgeType: 'pro',
    description: {
      id: 'Context window masif 256K tokens untuk membaca seluruh repositori kode tanpa terpotong.',
      en: 'Massive 256K token context window capable of ingesting entire code repositories without truncation.',
    },
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini Gateway',
    provider: 'OpenAI',
    category: 'Multimodal',
    contextWindow: '128K Tokens',
    dailyRate: 'Rp 3.500 / hari',
    speed: 'Ultra Fast',
    estimatedLatency: '~130ms',
    badge: 'OPENAI',
    badgeType: 'popular',
    description: {
      id: 'Endpoint drop-in resmi OpenAI dengan latensi kilat dan burst rate limit tinggi untuk agent otomatisasi.',
      en: 'Official drop-in OpenAI endpoint with lightning speed and generous burst rate limits for multi-agent workflows.',
    },
  },
  {
    id: 'glm-4-air',
    name: 'GLM-4 Air',
    provider: 'Zhipu AI',
    category: 'Chat',
    contextWindow: '128K Tokens',
    dailyRate: 'Rp 1.500 / hari',
    speed: 'Ultra Fast',
    estimatedLatency: '~120ms',
    badge: 'HEMAT',
    badgeType: 'hemat',
    description: {
      id: 'Model chat dan penalaran ringan berbiaya sangat terjangkau untuk kebutuhan eksekusi harian volume besar.',
      en: 'Lightweight chat and reasoning model at ultra-affordable rates for high-volume daily agent tasks.',
    },
  },
  {
    id: 'yi-lightning',
    name: 'Yi Lightning',
    provider: '01.AI',
    category: 'Chat',
    contextWindow: '16K Tokens',
    dailyRate: 'Rp 1.000 / hari',
    speed: 'Ultra Fast',
    estimatedLatency: '~90ms',
    badge: 'TERHEMAT',
    badgeType: 'hemat',
    description: {
      id: 'Model berkecepatan kilat untuk prompt instan, auto-complete cepat, dan tarif harian paling ramah kantong.',
      en: 'Lightning-fast model for instant prompts, quick completion, and the most budget-friendly daily pricing.',
    },
  },
];
