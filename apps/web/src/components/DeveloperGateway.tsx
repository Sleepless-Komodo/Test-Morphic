'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';
import {
  Sparkles,
  Copy,
  Check,
  Search,
  Key,
  Code2,
  Cpu,
  Zap,
  RefreshCw,
  ArrowUpRight,
  CheckCircle2,
  Activity,
  QrCode,
} from 'lucide-react';

type CapabilityTag = 'Chat' | 'Code' | 'Reasoning' | 'Multimodal' | 'Image' | 'Video';
type RouteSection = 'inference' | 'provider' | 'media';

export interface ModelItem {
  id: string;
  name: string;
  provider: string;
  capabilities: CapabilityTag[];
  contextWindow: string;
  rate: string;
  dailyPrice: string;
  category: string;
  description: string;
  descriptionEn?: string;
  isAvailable: boolean;
  section: RouteSection;
  badge?: string;
  badgeEn?: string;
  note?: string;
}

const INFERENCE_MODELS: ModelItem[] = [
  {
    id: 'deepseek-v4-coder',
    name: 'DeepSeek V4 Coder',
    provider: 'DeepSeek',
    capabilities: ['Code', 'Chat', 'Reasoning'],
    contextWindow: '64K Tokens',
    rate: '100 credits / 1M in',
    dailyPrice: 'Rp 2.500 / hari',
    category: 'DeepSeek Family',
    description: 'Sangat cepat & akurat untuk auto-complete, refactoring, dan debugging di Cursor & Cline.',
    descriptionEn: 'Ultra-fast and precise for auto-complete, refactoring, and debugging in Cursor & Cline.',
    isAvailable: true,
    section: 'inference',
    badge: 'PALING POPULER',
    badgeEn: 'MOST POPULAR',
  },
  {
    id: 'deepseek-r1-reasoning',
    name: 'DeepSeek R1 Reasoning',
    provider: 'DeepSeek',
    capabilities: ['Reasoning', 'Code'],
    contextWindow: '128K Tokens',
    rate: '220 credits / 1M in',
    dailyPrice: 'Rp 4.500 / hari',
    category: 'DeepSeek Family',
    description: 'Model penalaran bertahap (Chain-of-Thought) untuk arsitektur sistem dan algoritma rumit.',
    descriptionEn: 'Step-by-step reasoning (Chain-of-Thought) model for complex system architecture and algorithms.',
    isAvailable: true,
    section: 'inference',
    badge: 'REASONING',
    badgeEn: 'REASONING',
  },
  {
    id: 'qwen-2.5-max',
    name: 'Qwen 2.5 Max',
    provider: 'Qwen',
    capabilities: ['Chat', 'Reasoning', 'Multimodal'],
    contextWindow: '128K Tokens',
    rate: '180 credits / 1M in',
    dailyPrice: 'Rp 3.500 / hari',
    category: 'Qwen & Kimi Turbo',
    description: 'Model flagship serba bisa untuk analisis data bisnis, bahasa Indonesia alami, dan coding.',
    descriptionEn: 'All-around flagship model for business data analysis, natural Indonesian, and coding.',
    isAvailable: true,
    section: 'inference',
    badge: 'FLAGSHIP',
    badgeEn: 'FLAGSHIP',
  },
  {
    id: 'kimi-k1.5-coding',
    name: 'Kimi Coding 256K',
    provider: 'Kimi',
    capabilities: ['Code', 'Chat'],
    contextWindow: '256K Tokens',
    rate: '190 credits / 1M in',
    dailyPrice: 'Rp 4.000 / hari',
    category: 'Qwen & Kimi Turbo',
    description: 'Kapasitas context window masif 256K tokens untuk membaca seluruh repository codebase.',
    descriptionEn: 'Massive 256K token context window to ingest and reason over entire codebase repositories.',
    isAvailable: true,
    section: 'inference',
    badge: 'MASIF 256K',
    badgeEn: 'MASSIVE 256K',
  },
  {
    id: 'claude-3.5-sonnet-proxy',
    name: 'Claude 3.5 Sonnet Proxy',
    provider: 'Anthropic Proxy',
    capabilities: ['Code', 'Reasoning', 'Chat'],
    contextWindow: '200K Tokens',
    rate: '450 credits / 1M in',
    dailyPrice: 'Rp 8.500 / hari',
    category: 'Coding Specialists',
    description: 'Benchmark coding tertinggi di dunia untuk refactoring tingkat lanjut dan software engineering.',
    descriptionEn: 'World-leading coding benchmark for advanced refactoring and software engineering.',
    isAvailable: true,
    section: 'inference',
    badge: 'PRO DEV',
    badgeEn: 'PRO DEV',
  },
  {
    id: 'gpt-4o-mini-proxy',
    name: 'GPT-4o Mini Gateway',
    provider: 'OpenAI',
    capabilities: ['Chat', 'Code', 'Multimodal'],
    contextWindow: '128K Tokens',
    rate: '150 credits / 1M in',
    dailyPrice: 'Rp 3.500 / hari',
    category: 'GPT Compatible Routes',
    description: 'Endpoint drop-in OpenAI resmi dengan tarif hemat dan burst limit 180 RPM.',
    descriptionEn: 'Drop-in official OpenAI endpoint with economical rates and 180 RPM burst limits.',
    isAvailable: true,
    section: 'inference',
  },
];

const PROVIDER_MODELS: ModelItem[] = [
  {
    id: 'glm-4-air',
    name: 'GLM-4 Air',
    provider: 'Zhipu AI',
    capabilities: ['Chat', 'Code'],
    contextWindow: '128K Tokens',
    rate: '80 credits / 1M in',
    dailyPrice: 'Rp 1.500 / hari',
    category: 'Partner Routes',
    description: 'Model chat cepat & hemat dari Zhipu AI, dipanggil melalui endpoint Morphic yang sama.',
    descriptionEn: 'Fast & affordable chat model from Zhipu AI, routed through the same Morphic base URL.',
    isAvailable: true,
    section: 'provider',
    badge: 'SUPER HEMAT',
    badgeEn: 'SUPER VALUE',
  },
  {
    id: 'yi-lightning',
    name: 'Yi Lightning',
    provider: '01.AI',
    capabilities: ['Chat', 'Reasoning'],
    contextWindow: '16K Tokens',
    rate: '60 credits / 1M in',
    dailyPrice: 'Rp 1.000 / hari',
    category: 'Partner Routes',
    description: 'Routing latensi ultra-rendah dari 01.AI. Terbaik untuk percakapan kilat dan eksekusi instruksi.',
    descriptionEn: 'Ultra-low latency routing from 01.AI. Best for rapid chat and instruction-following tasks.',
    isAvailable: true,
    section: 'provider',
    badge: 'TERHEMAT',
    badgeEn: 'BEST VALUE',
  },
  {
    id: 'minimax-abab6.5',
    name: 'MiniMax ABAB 6.5',
    provider: 'MiniMax',
    capabilities: ['Chat', 'Multimodal'],
    contextWindow: '245K Tokens',
    rate: '120 credits / 1M in',
    dailyPrice: 'Rp 2.000 / hari',
    category: 'Partner Routes',
    description: 'Model multimodal context panjang dengan salah satu context window terbesar di rute mitra.',
    descriptionEn: 'Long-context multimodal model with one of the largest context windows among partner routes.',
    isAvailable: true,
    section: 'provider',
  },
  {
    id: 'moonshot-v1-128k',
    name: 'Moonshot v1 128K',
    provider: 'Moonshot',
    capabilities: ['Chat', 'Reasoning'],
    contextWindow: '128K Tokens',
    rate: '160 credits / 1M in',
    dailyPrice: 'Rp 3.000 / hari',
    category: 'Partner Routes',
    description: 'Inferensi chat dokumen panjang dari Moonshot AI. Ideal untuk pipeline analisis teks besar.',
    descriptionEn: 'Context-heavy chat inference from Moonshot AI. Ideal for document analysis pipelines.',
    isAvailable: true,
    section: 'provider',
  },
];

const MEDIA_MODELS: ModelItem[] = [
  {
    id: 'gpt-image-2',
    name: 'GPT Image 2',
    provider: 'OpenAI',
    capabilities: ['Image'],
    contextWindow: '-',
    rate: '40 credits / image',
    dailyPrice: 'Rp 4.000 / hari',
    category: 'Image Generation',
    description: 'Model generasi gambar photorealistic dengan prompt adherence presisi.',
    descriptionEn: 'Photorealistic image generation model with high prompt fidelity.',
    isAvailable: true,
    section: 'media',
    badge: 'NEW',
    badgeEn: 'NEW',
    note: 'POST /v1/images/generations',
  },
  {
    id: 'byteplus-seedream-v3',
    name: 'BytePlus Seedream v3',
    provider: 'BytePlus',
    capabilities: ['Image'],
    contextWindow: '-',
    rate: '30 credits / image',
    dailyPrice: 'Rp 3.000 / hari',
    category: 'Image Generation',
    description: 'Text-to-image berkualitas tinggi dari BytePlus. Resolusi hingga 2048x2048.',
    descriptionEn: 'High-quality text-to-image by BytePlus. Resolution up to 2048x2048.',
    isAvailable: true,
    section: 'media',
    note: 'POST /v1/images/generations',
  },
  {
    id: 'byteplus-seedance-motion',
    name: 'BytePlus Seedance Motion',
    provider: 'BytePlus',
    capabilities: ['Video'],
    contextWindow: '-',
    rate: '200 credits / clip',
    dailyPrice: 'Rp 8.000 / hari',
    category: 'Video Generation',
    description: 'Sintesis video 6-10 detik mulus resolusi 720p dari teks ataupun gambar referensi.',
    descriptionEn: 'Smooth 6-10s 720p video synthesis from text or reference imagery.',
    isAvailable: true,
    section: 'media',
    badge: 'NEW',
    badgeEn: 'NEW',
    note: 'POST /v1/videos/generations',
  },
];

// Daily Passes & Cheap packages strictly under Rp 10.000
const CHEAP_DAILY_PACKAGES = [
  {
    id: 'dp-deepseek-v4',
    name: 'Pass Harian DeepSeek V4',
    nameEn: 'DeepSeek V4 Daily Pass',
    price: 2500,
    credits: 15000,
    badge: 'Terlaris',
    badgeEn: 'Best Seller',
    desc: 'Akses 24 jam full speed model DeepSeek V4 untuk Cursor & Cline.',
    descEn: '24-hour full-speed access to DeepSeek V4 for Cursor & Cline.',
  },
  {
    id: 'dp-qwen-max',
    name: 'Pass Harian Qwen Max',
    nameEn: 'Qwen Max Daily Pass',
    price: 3500,
    credits: 22000,
    badge: 'Bahasa ID',
    badgeEn: 'Indonesian NLP',
    desc: 'Akses 24 jam model Qwen 2.5 Max untuk analisis & coding.',
    descEn: '24-hour access to Qwen 2.5 Max for analysis & coding.',
  },
  {
    id: 'dp-deepseek-r1',
    name: 'Pass Harian DeepSeek R1',
    nameEn: 'DeepSeek R1 Daily Pass',
    price: 4500,
    credits: 28000,
    badge: 'Reasoning',
    badgeEn: 'Reasoning',
    desc: 'Akses 24 jam model penalaran bertahap Chain-of-Thought.',
    descEn: '24-hour access to Chain-of-Thought reasoning model.',
  },
  {
    id: 'dp-all-access',
    name: 'All-Access Pass (24 Jam)',
    nameEn: 'All-Access 24h Pass',
    price: 7500,
    credits: 45000,
    badge: 'Semua Model',
    badgeEn: 'All Models',
    desc: 'Bebas bergantian akses seluruh model (DeepSeek, Qwen, Kimi, GLM).',
    descEn: 'Freely switch across all models (DeepSeek, Qwen, Kimi, GLM).',
  },
  {
    id: 'micro-saldo-3k',
    name: 'Mikro Saldo Hemat',
    nameEn: 'Micro Balance Saver',
    price: 3000,
    credits: 15000,
    badge: 'Mikro',
    badgeEn: 'Micro',
    desc: 'Saldo kredit instan tanpa batas kedaluwarsa pendek.',
    descEn: 'Instant credit balance without short expiry.',
  },
  {
    id: 'micro-saldo-5k',
    name: 'Mikro Saldo Pro',
    nameEn: 'Micro Balance Pro',
    price: 5000,
    credits: 30000,
    badge: 'Populer',
    badgeEn: 'Popular',
    desc: 'Cukup untuk ribuan baris prompt debugging.',
    descEn: 'Sufficient for thousands of debugging prompt lines.',
  },
  {
    id: 'weekly-saldo-9k',
    name: 'Paket Hemat Mingguan',
    nameEn: 'Weekly Saver Pack',
    price: 9900,
    credits: 70000,
    badge: 'Best Value',
    badgeEn: 'Best Value',
    desc: 'Kredit cukup untuk 7 hari coding harian.',
    descEn: 'Credits sufficient for 7 days of daily coding.',
  },
];

/**
 * Interface representing component props for DeveloperGateway.
 */
interface DeveloperGatewayProps {
  session?: any;
  userBalance?: number;
  /**
   * Optional initial models passed from the Server Component (fetched from PostgreSQL database).
   * If not provided or empty, the component will fall back to static default models.
   */
  initialModels?: ModelItem[];
}

export default function DeveloperGateway({ session, userBalance = 0, initialModels }: DeveloperGatewayProps) {
  const { t, locale } = useTranslation();

  const [baseUrlCopied, setBaseUrlCopied] = useState(false);
  const [selectedCapability, setSelectedCapability] = useState<string>('All');
  const [selectedProvider, setSelectedProvider] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [balance, setBalance] = useState<number>(userBalance);
  const [voucherCode, setVoucherCode] = useState<string>('');
  const [voucherSuccess, setVoucherSuccess] = useState<string | null>(null);
  const [selectedPackage, setSelectedPackage] = useState(CHEAP_DAILY_PACKAGES[0]);
  const [showQrisModal, setShowQrisModal] = useState<boolean>(false);
  const [paymentDone, setPaymentDone] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [keyName, setKeyName] = useState<string>('Cursor & Cline Agent');
  const [keysList, setKeysList] = useState<Array<{ id: string; name: string; key: string; date: string }>>([
    { id: 'k1', name: 'Laptop Development', key: 'mp-live-9f82a4d1082c47bc8f192b6a7139ef12', date: t.dashboard.today },
  ]);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [isCreatingKey, setIsCreatingKey] = useState<boolean>(false);
  const [showTelemetry, setShowTelemetry] = useState(false);

  const copyText = (text: string, cb: () => void) => {
    navigator.clipboard.writeText(text);
    cb();
    setTimeout(() => cb(), 2000);
  };

  const getPackageName = (pkg: (typeof CHEAP_DAILY_PACKAGES)[number]) =>
    locale === 'en' && pkg.nameEn ? pkg.nameEn : pkg.name;

  const getPackageBadge = (pkg: (typeof CHEAP_DAILY_PACKAGES)[number]) =>
    locale === 'en' && pkg.badgeEn ? pkg.badgeEn : pkg.badge;

  const getPackageDesc = (pkg: (typeof CHEAP_DAILY_PACKAGES)[number]) =>
    locale === 'en' && pkg.descEn ? pkg.descEn : pkg.desc;

  // Resolve dynamic model list: use database-fetched models if available, fallback to static defaults
  const activeModelList = useMemo(() => {
    return initialModels && initialModels.length > 0 ? initialModels : INFERENCE_MODELS;
  }, [initialModels]);

  const filteredModels = useMemo(
    () =>
      activeModelList.filter((m) => {
        const matchCap = selectedCapability === 'All' || m.capabilities.includes(selectedCapability as CapabilityTag);
        const matchProv = selectedProvider === 'All' || m.provider === selectedProvider;
        const matchSearch =
          m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.id.toLowerCase().includes(searchQuery.toLowerCase());
        return matchCap && matchProv && matchSearch;
      }),
    [activeModelList, selectedCapability, selectedProvider, searchQuery],
  );

  const categories = useMemo(() => Array.from(new Set(filteredModels.map((m) => m.category))), [filteredModels]);

  const handleCreateKey = () => {
    if (!keyName.trim()) return;
    setIsCreatingKey(true);
    setTimeout(() => {
      const hex = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
      setKeysList((prev) => [
        { id: `k-${Date.now()}`, name: keyName, key: `mp-live-${hex}`, date: t.dashboard.justNow },
        ...prev,
      ]);
      setKeyName('');
      setIsCreatingKey(false);
    }, 400);
  };

  const handleRedeemVoucher = () => {
    if (!voucherCode.trim()) return;
    const msg =
      locale === 'en'
        ? `Voucher "${voucherCode.toUpperCase()}" active! +Rp 5,000 balance added.`
        : `Kupon "${voucherCode.toUpperCase()}" aktif! +Rp 5.000 saldo ditambahkan.`;
    setVoucherSuccess(msg);
    setBalance((p) => p + 5000);
    setVoucherCode('');
    setTimeout(() => setVoucherSuccess(null), 5000);
  };

  const handleRefreshBalance = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const handleSimulatePayment = () => {
    setPaymentDone(true);
    setBalance((p) => p + selectedPackage.credits);
    setTimeout(() => {
      setPaymentDone(false);
      setShowQrisModal(false);
    }, 1500);
  };

  const CapBadge = ({ cap }: { cap: string }) => (
    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-medium bg-neutral-100 text-neutral-700 border border-neutral-200">
      {cap}
    </span>
  );

  return (
    <main className="max-w-6xl mx-auto px-4 md:px-8 py-8 space-y-8">
      {/* 1. Header Hero Panel inside Dashboard */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-neutral-200/70">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-wider text-neutral-400 font-semibold mb-1">
            {t.dashboard.consoleBadge}
          </div>
          <h1 className="text-2xl md:text-3xl font-heading font-extrabold text-neutral-950 tracking-tight">
            {t.dashboard.title}
          </h1>
          <p className="text-xs md:text-sm text-neutral-600 mt-1 max-w-2xl leading-relaxed">
            {t.dashboard.desc}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTelemetry(!showTelemetry)}
            className="px-3 py-1.5 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Activity className="h-3.5 w-3.5 text-emerald-600" />
            <span>{t.dashboard.nodeStatus}</span>
          </button>
        </div>
      </div>

      {/* Telemetry popup / banner */}
      {showTelemetry && (
        <div className="p-6 rounded-3xl bg-white border border-neutral-200/90 shadow-lg animate-in fade-in slide-in-from-top-3 duration-200">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="max-w-md">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-neutral-100 border border-neutral-200 text-neutral-800 text-[10px] font-mono font-bold tracking-wider mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>{t.dashboard.intelligenceRouterActive}</span>
              </div>
              <h3 className="text-xl font-heading font-bold text-neutral-950 mb-2">
                {t.dashboard.failoverGateway}
              </h3>
              <p className="text-xs text-neutral-600 leading-relaxed mb-4">
                {t.dashboard.failoverDesc}
              </p>
              <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
                {[
                  [t.dashboard.latency, '~118 ms', false],
                  [t.dashboard.burstLimit, '180 RPM', false],
                  [t.dashboard.upstream, t.dashboard.online, true],
                ].map(([lbl, val, green]) => (
                  <div key={lbl as string} className="p-2 rounded-xl bg-neutral-50 border border-neutral-200">
                    <div className="text-[10px] text-neutral-400">{lbl}</div>
                    <div className={`font-bold ${green ? 'text-emerald-600' : 'text-neutral-900'}`}>{val}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="w-full max-w-sm rounded-2xl bg-neutral-900 text-white p-5 border border-neutral-800 shadow-md">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-neutral-800">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                    {t.dashboard.gatewayNodes}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-neutral-400">{t.dashboard.region}</span>
              </div>
              <div className="space-y-2.5 text-xs font-mono">
                <div className="flex items-center justify-between p-2 rounded-lg bg-neutral-800/60 border border-neutral-700/50">
                  <span className="text-neutral-300">DeepSeek Cluster</span>
                  <span className="text-emerald-400 font-bold">● 98ms ({t.dashboard.active})</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-neutral-800/60 border border-neutral-700/50">
                  <span className="text-neutral-300">Claude Anthropic Proxy</span>
                  <span className="text-emerald-400 font-bold">● 145ms ({t.dashboard.active})</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-neutral-800/60 border border-neutral-700/50">
                  <span className="text-neutral-300">Qwen & Moonshot Route</span>
                  <span className="text-emerald-400 font-bold">● 122ms ({t.dashboard.active})</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Modern Bento Grid Quick Access */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Bento 1: Base URL (Span 7) */}
        <div className="md:col-span-7 p-6 rounded-3xl bg-white border border-neutral-200/90 shadow-xs flex flex-col justify-between hover:border-neutral-300 transition-all">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-500">
                  {t.dashboard.serverlessEndpoint}
                </span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-neutral-100 text-neutral-700 border border-neutral-200">
                {t.dashboard.openAiCompatible}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200/80 mb-3 group">
              <code className="font-mono font-bold text-xs sm:text-sm text-neutral-950 truncate select-all">
                https://api.morphic.sh/v1
              </code>
              <button
                onClick={() => copyText('https://api.morphic.sh/v1', () => setBaseUrlCopied(true))}
                className="p-2 rounded-xl bg-white border border-neutral-200 hover:bg-neutral-100 text-neutral-700 hover:text-black transition-colors shrink-0 shadow-xs cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
                title={t.dashboard.copyBaseUrl}
              >
                {baseUrlCopied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="text-emerald-700 text-[11px]">{t.dashboard.copied}</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span className="text-[11px]">{t.dashboard.copy}</span>
                  </>
                )}
              </button>
            </div>
          </div>
          <p className="text-xs text-neutral-500 leading-relaxed">
            {t.dashboard.baseUrlDesc}
          </p>
        </div>

        {/* Bento 2: Saldo Kredit (Span 5) */}
        <div className="md:col-span-5 p-6 rounded-3xl bg-neutral-950 text-white border border-neutral-800 shadow-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-400">
                {t.dashboard.creditBalance}
              </span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono bg-neutral-900 border border-neutral-800 text-emerald-400 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                {t.dashboard.live}
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-heading font-black text-white mb-1">
              Rp {balance.toLocaleString('id-ID')}
            </div>
            <p className="text-xs text-neutral-400">
              {t.dashboard.creditsDesc}
            </p>
          </div>
          <a
            href="#daily-packages"
            className="mt-4 w-full py-2.5 px-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all text-center cursor-pointer"
          >
            <span>{t.dashboard.topUpQris}</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </div>

        {/* Bento 3: Paket Harian (Span 4) */}
        <a
          href="#daily-packages"
          className="md:col-span-4 p-5 rounded-3xl bg-white border border-neutral-200/90 shadow-xs flex flex-col justify-between hover:border-neutral-300 hover:shadow-sm transition-all group"
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-400">
                {t.dashboard.dailyPackages}
              </span>
              <Zap className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-heading font-bold text-lg text-neutral-950 group-hover:text-black">
                {t.dashboard.fromPrice}
              </span>
              <ArrowUpRight className="h-4 w-4 text-neutral-400 group-hover:text-black transition-colors" />
            </div>
          </div>
          <p className="text-xs text-neutral-500 leading-relaxed">
            {t.dashboard.packagesDesc}
          </p>
        </a>

        {/* Bento 4: Active Keys (Span 4) */}
        <a
          href="#keys"
          className="md:col-span-4 p-5 rounded-3xl bg-white border border-neutral-200/90 shadow-xs flex flex-col justify-between hover:border-neutral-300 hover:shadow-sm transition-all group"
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-400">
                {t.dashboard.activeKeys}
              </span>
              <Code2 className="h-4 w-4 text-neutral-400 group-hover:text-black transition-colors" />
            </div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-heading font-bold text-lg text-neutral-950 group-hover:text-black">
                {keysList.length} {t.dashboard.keysActiveCount}
              </span>
              <ArrowUpRight className="h-4 w-4 text-neutral-400 group-hover:text-black transition-colors" />
            </div>
          </div>
          <p className="text-xs text-neutral-500 leading-relaxed">
            {t.dashboard.keysDesc}
          </p>
        </a>

        {/* Bento 5: Model Catalog Shortcut (Span 4) */}
        <a
          href="#models"
          className="md:col-span-4 p-5 rounded-3xl bg-white border border-neutral-200/90 shadow-xs flex flex-col justify-between hover:border-neutral-300 hover:shadow-sm transition-all group"
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-400">
                {t.dashboard.modelCatalog}
              </span>
              <Cpu className="h-4 w-4 text-neutral-400 group-hover:text-black transition-colors" />
            </div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-heading font-bold text-lg text-neutral-950 group-hover:text-black">
                {t.dashboard.modelsCount}
              </span>
              <ArrowUpRight className="h-4 w-4 text-neutral-400 group-hover:text-black transition-colors" />
            </div>
          </div>
          <p className="text-xs text-neutral-500 leading-relaxed">
            {t.dashboard.modelsDesc}
          </p>
        </a>
      </div>

      {/* 3. PAKET HARIAN & MIKRO TOP-UP (< Rp 10.000) */}
      <div id="daily-packages" className="rounded-3xl border border-neutral-200/90 bg-white shadow-sm p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-neutral-100">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-neutral-100 border border-neutral-200 text-neutral-800 text-[10px] font-mono font-bold tracking-wider mb-2">
              <Zap className="h-3 w-3 text-neutral-700" />
              <span>{t.dashboard.packagesBadge}</span>
            </div>
            <h2 className="text-xl md:text-2xl font-heading font-extrabold text-neutral-950">
              {t.dashboard.packagesTitle}
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              {t.dashboard.packagesSubtitle}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-[10px] text-neutral-400 uppercase font-mono">{t.dashboard.yourBalance}</div>
              <div className="text-lg font-extrabold text-neutral-950">Rp {balance.toLocaleString('id-ID')}</div>
            </div>
            <button
              onClick={handleRefreshBalance}
              className="p-2 rounded-xl border border-neutral-200 hover:bg-neutral-100 transition-colors cursor-pointer"
              title={t.dashboard.refreshBalance}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Grid of Cheap Packages */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {CHEAP_DAILY_PACKAGES.map((pkg) => {
            const isSelected = selectedPackage.id === pkg.id;
            const pBadge = getPackageBadge(pkg);
            const pName = getPackageName(pkg);
            const pDesc = getPackageDesc(pkg);
            return (
              <div
                key={pkg.id}
                onClick={() => setSelectedPackage(pkg)}
                className={`rounded-2xl p-5 border flex flex-col justify-between transition-all cursor-pointer ${
                  isSelected
                    ? 'border-2 border-neutral-950 bg-neutral-50 shadow-md'
                    : 'border-neutral-200/90 bg-white hover:border-neutral-300 hover:shadow-sm'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-neutral-100 border border-neutral-200 text-neutral-700">
                      {pBadge}
                    </span>
                    {isSelected && <span className="text-xs text-neutral-950 font-bold">{t.dashboard.selected}</span>}
                  </div>

                  <h3 className="font-heading font-bold text-sm text-neutral-950 mb-1">{pName}</h3>
                  <div className="text-xl font-extrabold text-neutral-950 mb-2">
                    Rp {pkg.price.toLocaleString('id-ID')}
                  </div>
                  <p className="text-xs text-neutral-500 mb-4 leading-relaxed">{pDesc}</p>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedPackage(pkg);
                    setShowQrisModal(true);
                  }}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    isSelected ? 'bg-neutral-950 text-white hover:bg-neutral-800' : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-900'
                  }`}
                >
                  <QrCode className="h-3.5 w-3.5" />
                  <span>{t.dashboard.buyQris}</span>
                </button>
              </div>
            );
          })}
        </div>

        {/* Voucher Code Redemption */}
        <div className="rounded-2xl bg-neutral-50/70 border border-neutral-200/80 p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <div className="text-xs font-bold text-neutral-950">{t.dashboard.voucherTitle}</div>
            <div className="text-xs text-neutral-500">{t.dashboard.voucherSubtitle}</div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input
              type="text"
              value={voucherCode}
              onChange={(e) => setVoucherCode(e.target.value)}
              placeholder={t.dashboard.voucherPlaceholder}
              className="bg-white border border-neutral-200 rounded-xl px-3.5 py-2 text-xs font-mono text-neutral-900 focus:outline-none focus:border-black transition-colors w-full sm:w-48"
            />
            <button
              onClick={handleRedeemVoucher}
              className="bg-neutral-950 text-white rounded-xl px-4 py-2 text-xs font-bold hover:bg-neutral-800 transition-colors shrink-0 cursor-pointer"
            >
              {t.dashboard.claim}
            </button>
          </div>
        </div>

        {voucherSuccess && (
          <div className="mt-3 text-xs text-emerald-700 font-medium flex items-center gap-1.5 animate-in fade-in">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{voucherSuccess}</span>
          </div>
        )}
      </div>

      {/* QRIS Modal Simulation */}
      {showQrisModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl border border-neutral-200 max-w-sm w-full p-6 text-center shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="text-xs font-bold text-neutral-500 uppercase font-mono">{t.dashboard.checkoutQris}</div>
              <button onClick={() => setShowQrisModal(false)} className="text-neutral-400 hover:text-black text-sm cursor-pointer">
                ✕
              </button>
            </div>

            <div>
              <h3 className="font-heading font-bold text-lg text-neutral-950">{getPackageName(selectedPackage)}</h3>
              <div className="text-2xl font-black text-neutral-950 mt-1">
                Rp {selectedPackage.price.toLocaleString('id-ID')}
              </div>
              <p className="text-xs text-neutral-500 mt-1">{t.dashboard.scanQrisDesc}</p>
            </div>

            {/* QR Mock Display */}
            <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200 inline-block mx-auto">
              <div className="w-40 h-40 bg-white border border-neutral-200 rounded-xl flex flex-col items-center justify-center text-neutral-900 p-2 mx-auto">
                <QrCode className="h-24 w-24 text-neutral-950" />
                <span className="text-[9px] font-mono text-neutral-400 mt-1">QRIS.NMID.00941829</span>
              </div>
            </div>

            {paymentDone ? (
              <div className="p-3 bg-neutral-100 border border-neutral-200 rounded-xl text-neutral-900 text-xs font-bold flex items-center justify-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>{t.dashboard.paymentSuccess}</span>
              </div>
            ) : (
              <button
                onClick={handleSimulatePayment}
                className="w-full py-3 rounded-2xl bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
              >
                {t.dashboard.confirmPayment}
              </button>
            )}
          </div>
        </div>
      )}

      {/* 4. API Keys Management Section */}
      <div id="keys" className="rounded-3xl border border-neutral-200/90 bg-white p-6 md:p-8 shadow-sm">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-mono text-neutral-400 font-bold uppercase tracking-wider">
                API.MORPHIC.SH
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-neutral-100 text-neutral-700 border border-neutral-200 font-semibold">
                MP-LIVE
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-heading font-bold text-neutral-950 mb-2">{t.dashboard.keysSectionTitle}</h2>
            <p className="text-xs text-neutral-600 leading-relaxed mb-4">
              {t.dashboard.keysSectionDesc}
            </p>
            <div className="text-[11px] text-neutral-500 space-y-1">
              <div className="flex items-center gap-1.5">
                <Check className="h-3 w-3 text-emerald-600" />
                <span>{t.dashboard.chatCompletionsCompatible}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="h-3 w-3 text-emerald-600" />
                <span>{t.dashboard.multipleKeysSupport}</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-4">
            <div className="p-4 rounded-2xl bg-neutral-50/70 border border-neutral-200/90">
              <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 font-semibold block mb-1.5">
                {t.dashboard.newKeyLabel}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  placeholder={t.dashboard.newKeyPlaceholder}
                  className="flex-1 bg-white border border-neutral-200 rounded-xl px-3.5 py-2 text-xs text-neutral-900 focus:outline-none focus:border-black transition-colors"
                />
                <button
                  onClick={handleCreateKey}
                  disabled={isCreatingKey}
                  className="bg-neutral-950 text-white rounded-xl px-4 py-2 text-xs font-bold hover:bg-neutral-800 transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
                >
                  <Key className="h-3.5 w-3.5" />
                  <span>{isCreatingKey ? t.dashboard.creatingKey : t.dashboard.createKey}</span>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-semibold px-1">
                {t.dashboard.yourKeysList} ({keysList.length})
              </div>
              {keysList.map((k) => (
                <div
                  key={k.id}
                  className="p-3.5 rounded-xl border border-neutral-200 bg-white flex items-center justify-between gap-3 shadow-sm hover:border-neutral-300 transition-all"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-neutral-900">{k.name}</span>
                      <span className="text-[10px] text-neutral-400 font-mono">· {k.date}</span>
                    </div>
                    <div className="font-mono text-xs text-neutral-500 truncate max-w-xs md:max-w-md mt-0.5">
                      {k.key.slice(0, 15)}************************
                    </div>
                  </div>
                  <button
                    onClick={() => copyText(k.key, () => setCopiedKeyId(k.id))}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-100 text-xs font-medium text-neutral-800 transition-colors cursor-pointer shrink-0"
                  >
                    {copiedKeyId === k.id ? (
                      <span className="text-emerald-700 font-bold">{t.dashboard.copied}</span>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>{t.dashboard.copy}</span>
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 5. Model Catalog with Daily Rates (< Rp 10.000) */}
      <div id="models" className="space-y-6 pt-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-4 w-4 text-neutral-800" />
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-400">
                {t.dashboard.catalogBadge}
              </span>
            </div>
            <h2 className="text-2xl md:text-3xl font-heading font-extrabold text-neutral-950 tracking-tight">
              {t.dashboard.catalogTitle}
            </h2>
            <p className="text-xs md:text-sm text-neutral-600 mt-1 max-w-xl">
              {t.dashboard.catalogDesc}
            </p>
          </div>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.dashboard.searchPlaceholder}
              className="w-full pl-9.5 pr-4 py-2 bg-white border border-neutral-200 rounded-xl text-xs text-neutral-900 focus:outline-none focus:border-black transition-colors shadow-sm"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 p-4 rounded-2xl bg-white border border-neutral-200/90 shadow-sm text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-bold">{t.dashboard.capabilities}</span>
            <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-xl">
              {[
                { id: 'All', label: t.dashboard.allCapabilities },
                { id: 'Code', label: 'Code' },
                { id: 'Reasoning', label: 'Reasoning' },
                { id: 'Chat', label: 'Chat' },
              ].map((cap) => (
                <button
                  key={cap.id}
                  onClick={() => setSelectedCapability(cap.id)}
                  className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                    selectedCapability === cap.id ? 'bg-black text-white shadow-sm' : 'text-neutral-600 hover:text-black'
                  }`}
                >
                  {cap.label}
                </button>
              ))}
            </div>
          </div>
          <div className="ml-auto text-xs font-mono text-neutral-400">
            {filteredModels.length} {t.dashboard.activeModelsSuffix}
          </div>
        </div>

        {categories.map((category) => {
          const modelsInCat = filteredModels.filter((m) => m.category === category);
          if (!modelsInCat.length) return null;
          return (
            <div key={category} className="space-y-3 pt-2">
              <div className="flex items-center justify-between border-b border-neutral-200/60 pb-2">
                <h3 className="font-heading font-bold text-base text-neutral-900">{category}</h3>
                <span className="text-xs text-neutral-500 font-mono">{t.dashboard.openAiCompatibleBadge}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {modelsInCat.map((m) => {
                  const mBadge = locale === 'en' && m.badgeEn ? m.badgeEn : m.badge;
                  const mDesc = locale === 'en' && m.descriptionEn ? m.descriptionEn : m.description;
                  const mDaily = locale === 'en' ? m.dailyPrice.replace('/ hari', '/ day') : m.dailyPrice;
                  return (
                    <div
                      key={m.id}
                      className="p-5 rounded-2xl border flex flex-col justify-between transition-all bg-white border-neutral-200/90 shadow-sm hover:border-neutral-300 hover:shadow-md group"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h4 className="font-heading font-bold text-base text-neutral-950">{m.name}</h4>
                          {mBadge && (
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-neutral-950 text-white shrink-0">
                              {mBadge}
                            </span>
                          )}
                        </div>
                        <code className="text-[11px] font-mono text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-md inline-block mb-3">
                          {m.id}
                        </code>
                        <p className="text-xs text-neutral-600 leading-relaxed mb-4">{mDesc}</p>
                        <div className="flex flex-wrap gap-1 mb-4">
                          {m.capabilities.map((c) => (
                            <CapBadge key={c} cap={c} />
                          ))}
                        </div>
                      </div>

                      <div className="pt-3 border-t border-neutral-100 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-neutral-500">{t.dashboard.dailyEstimate}</span>
                          <span className="font-bold font-mono text-neutral-950">
                            {mDaily}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-neutral-400 font-mono">
                          <span>{t.dashboard.context} {m.contextWindow}</span>
                          <span>{m.rate}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
