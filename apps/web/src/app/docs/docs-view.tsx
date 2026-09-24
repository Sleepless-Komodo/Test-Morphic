'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Terminal,
  Copy,
  Check,
  Code2,
  Cpu,
  Layers,
  ShieldCheck,
  AlertCircle,
  ArrowRight,
  Server,
  KeyRound,
  FileCode,
  ChevronRight,
  CheckCircle2,
  HelpCircle,
  ExternalLink,
  Menu,
  X,
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { API_BASE_URL } from '@/lib/utils';

const BASE_URL = API_BASE_URL;

type IdeKey = 'cursor' | 'cline' | 'windsurf' | 'claudecode' | 'aider';
type SdkKey = 'ts' | 'python' | 'curl';

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={label || 'Copy'}
      className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-700/80 bg-neutral-800 px-2 py-1 text-[11px] font-semibold text-neutral-300 transition-colors hover:bg-neutral-700 hover:text-white cursor-pointer shrink-0"
    >
      {copied ? (
        <Check className="h-3 w-3 text-emerald-400" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
      <span>{copied ? 'Tersalin' : 'Salin'}</span>
    </button>
  );
}

function CodeBlock({
  code,
  filename,
  language,
}: {
  code: string;
  filename?: string;
  language?: string;
}) {
  return (
    <div className="rounded-xl bg-neutral-950 border border-neutral-800/90 overflow-hidden text-neutral-200 shadow-2xs my-3">
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-neutral-800/80 bg-neutral-900/60">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56] border border-[#e0443e]/50" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e] border border-[#dea123]/50" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f] border border-[#1aab29]/50" />
          </div>
          {filename && (
            <span className="font-mono text-[11px] text-neutral-400 font-medium ml-2">
              {filename}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2.5">
          {language && (
            <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 font-semibold">
              {language}
            </span>
          )}
          <CopyButton text={code} />
        </div>
      </div>
      <div className="p-3.5 sm:p-4 overflow-x-auto">
        <pre className="font-mono text-xs leading-relaxed text-neutral-200 selection:bg-neutral-800">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}

interface DocsViewProps {
  session?: any;
}

export default function DocsView({ session }: DocsViewProps) {
  const { locale } = useTranslation();
  const isId = locale === 'id';

  const [activeIde, setActiveIde] = useState<IdeKey>('cursor');
  const [activeSdk, setActiveSdk] = useState<SdkKey>('ts');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [copiedBaseUrl, setCopiedBaseUrl] = useState(false);
  const [activeSection, setActiveSection] = useState('overview');

  useEffect(() => {
    if (!mobileSidebarOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileSidebarOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileSidebarOpen]);

  useEffect(() => {
    const mainSectionIds = [
      'overview',
      'quickstart',
      'base-url',
      'ide-setup',
      'sdk-integration',
      'endpoint-chat',
      'endpoint-models',
      'model-ids',
      'error-codes',
      'security',
    ];

    const handleScroll = () => {
      // Dynamic reading threshold: comfortable eye-level reading zone
      const readingLine = Math.min(280, window.innerHeight * 0.4);

      // Check if near bottom of document
      const isNearBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 300;

      if (isNearBottom) {
        // Prioritize bottom sections when they are visible in viewport
        const secEl = document.getElementById('security');
        if (secEl) {
          const secRect = secEl.getBoundingClientRect();
          if (secRect.top <= window.innerHeight * 0.75) {
            setActiveSection('security');
            return;
          }
        }

        const errEl = document.getElementById('error-codes');
        if (errEl) {
          const errRect = errEl.getBoundingClientRect();
          if (errRect.top <= window.innerHeight * 0.75) {
            setActiveSection('error-codes');
            return;
          }
        }
      }

      let currentSection = mainSectionIds[0];
      for (const id of mainSectionIds) {
        const el = document.getElementById(id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= readingLine) {
            currentSection = id;
          }
        }
      }
      setActiveSection(currentSection);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const copyBaseUrl = () => {
    navigator.clipboard.writeText(BASE_URL);
    setCopiedBaseUrl(true);
    setTimeout(() => setCopiedBaseUrl(false), 2000);
  };

  const ideConfigs: Record<
    IdeKey,
    {
      name: string;
      title: string;
      desc: string;
      descEn: string;
      menuPath: string;
      file: string;
      code: string;
    }
  > = {
    cursor: {
      name: 'Cursor',
      title: 'Cursor IDE (Composer & Inline)',
      desc: 'Gunakan seluruh model AI langsung di Cursor Composer & Inline Edit melalui protokol resmi OpenAI API.',
      descEn: 'Use all AI models directly in Cursor Composer & Inline Edit via the official OpenAI API protocol.',
      menuPath: 'Settings (Ctrl+Shift+J / Cmd+Shift+J) > Models > OpenAI API',
      file: 'cursor.settings.json',
      code: `// Cursor Settings > Models > OpenAI API:
Base URL: https://api.morphic.sh/v1
API Key:  mp-live-xxxxxxxxxxxxxxxxxxxx

// Rekomendasi Model IDs untuk ditambahkan (+ Add Model):
- deepseek-v4              (Coding cepat, presisi, hemat biaya)
- claude-3.5-sonnet-proxy  (Arsitektur multi-file & refactoring)
- qwen-2.5-max             (Reasoning kompleks & full-stack)`,
    },
    cline: {
      name: 'Cline / Roo',
      title: 'Cline & Roo Code (VS Code Extension)',
      desc: 'Konfigurasi ekstensi autonomous coding agent di VS Code dengan Morphic Gateway.',
      descEn: 'Configure autonomous coding agents in VS Code with Morphic Gateway.',
      menuPath: 'Cline Extension > Settings (Gear icon) > API Provider: OpenAI Compatible',
      file: 'cline_settings.json',
      code: `{
  "apiProvider": "openai",
  "openAiBaseUrl": "https://api.morphic.sh/v1",
  "openAiApiKey": "mp-live-xxxxxxxxxxxxxxxxxxxx",
  "openAiModelId": "deepseek-v4"
}`,
    },
    windsurf: {
      name: 'Windsurf',
      title: 'Windsurf (Codeium Cascade)',
      desc: 'Jalankan fitur Cascade AI pada Windsurf dengan menghubungkan custom model provider OpenAI.',
      descEn: 'Run Cascade AI features in Windsurf by connecting a custom OpenAI provider.',
      menuPath: 'Windsurf Settings > AI Providers > Custom OpenAI-Compatible Provider',
      file: 'windsurf_config.json',
      code: `{
  "provider": "openai-compatible",
  "endpoint": "https://api.morphic.sh/v1",
  "apiKey": "mp-live-xxxxxxxxxxxxxxxxxxxx",
  "defaultModel": "deepseek-v4"
}`,
    },
    claudecode: {
      name: 'Claude Code CLI',
      title: 'Claude Code CLI (Terminal)',
      desc: 'Jalankan CLI Claude Code resmi di terminal dengan mengarahkan basis endpoint proxy ke Morphic.',
      descEn: 'Run the official Claude Code CLI in your terminal by routing base endpoints to Morphic.',
      menuPath: 'Terminal Environment Variable Configuration',
      file: 'terminal_session.sh',
      code: `# Linux / macOS / Bash:
export ANTHROPIC_BASE_URL="https://api.morphic.sh/v1"
export ANTHROPIC_API_KEY="mp-live-xxxxxxxxxxxxxxxxxxxx"
claude "Analyze this repository architecture"

# Windows PowerShell:
$env:ANTHROPIC_BASE_URL="https://api.morphic.sh/v1"
$env:ANTHROPIC_API_KEY="mp-live-xxxxxxxxxxxxxxxxxxxx"
claude "Analyze this repository architecture"`,
    },
    aider: {
      name: 'Aider',
      title: 'Aider (Command-line Pair Programming)',
      desc: 'Pair programming di command line dengan Aider menggunakan satu baris perintah.',
      descEn: 'Pair program in the command line with Aider using a single terminal command.',
      menuPath: 'Terminal CLI Flags',
      file: 'run-aider.sh',
      code: `# Jalankan Aider dengan Morphic Gateway
export OPENAI_API_BASE="https://api.morphic.sh/v1"
export OPENAI_API_KEY="mp-live-xxxxxxxxxxxxxxxxxxxx"

aider --model openai/deepseek-v4`,
    },
  };

  const tsCode = `import OpenAI from "openai";

// Inisialisasi client resmi OpenAI mengarah ke Morphic Gateway
const client = new OpenAI({
  baseURL: "https://api.morphic.sh/v1",
  apiKey: process.env.MORPHIC_API_KEY || "mp-live-xxxxxxxxxxxxxxxxxxxx",
});

async function main() {
  // 1. Chat Completion Standar
  const completion = await client.chat.completions.create({
    model: "deepseek-v4",
    messages: [
      { role: "system", content: "You are an expert TypeScript engineer." },
      { role: "user", content: "Buatkan helper debounce typed di TypeScript." },
    ],
    temperature: 0.2,
  });

  console.log(completion.choices[0].message.content);

  // 2. Real-time Streaming (SSE)
  const stream = await client.chat.completions.create({
    model: "deepseek-v4",
    messages: [{ role: "user", content: "Jelaskan arsitektur micro-frontend." }],
    stream: true,
  });

  for await (const chunk of stream) {
    process.stdout.write(chunk.choices[0]?.delta?.content || "");
  }
}

main().catch(console.error);`;

  const pythonCode = `import os
from openai import OpenAI

# Inisialisasi OpenAI SDK resmi dengan endpoint Morphic Gateway
client = OpenAI(
    base_url="https://api.morphic.sh/v1",
    api_key=os.environ.get("MORPHIC_API_KEY", "mp-live-xxxxxxxxxxxxxxxxxxxx"),
)

# 1. Non-streaming completion
response = client.chat.completions.create(
    model="deepseek-v4",
    messages=[
        {"role": "system", "content": "You are a backend architect."},
        {"role": "user", "content": "Tuliskan implementasi caching Redis di Python."},
    ],
    temperature=0.3,
)

print(response.choices[0].message.content)

# 2. Real-time Streaming (SSE)
stream = client.chat.completions.create(
    model="claude-3.5-sonnet-proxy",
    messages=[{"role": "user", "content": "Optimasi query PostgreSQL berikut..."}],
    stream=True,
)

for chunk in stream:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="", flush=True)
`;

  const curlCode = `# 1. Chat Completion Standar (JSON):
curl https://api.morphic.sh/v1/chat/completions \\
  -H "Authorization: Bearer mp-live-xxxxxxxxxxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "deepseek-v4",
    "messages": [
      { "role": "user", "content": "Halo Morphic! Buatkan fungsi validasi email." }
    ],
    "temperature": 0.5,
    "max_tokens": 512
  }'

# 2. Server-Sent Events (SSE Streaming):
curl https://api.morphic.sh/v1/chat/completions \\
  -N \\
  -H "Authorization: Bearer mp-live-xxxxxxxxxxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "deepseek-v4",
    "messages": [{ "role": "user", "content": "Hitung 1 sampai 5 perlahan." }],
    "stream": true
  }'`;

  interface SidebarSubItem {
    id: string;
    label: string;
    href: string;
    key?: string;
    onClick?: () => void;
  }

  interface SidebarItem {
    id: string;
    sectionId?: string;
    label: string;
    href: string;
    isMono?: boolean;
    key?: string;
    onClick?: () => void;
  }

  interface SidebarGroup {
    title: string;
    items: SidebarItem[];
  }

  const navGroups: SidebarGroup[] = [
    {
      title: isId ? 'Memulai' : 'Getting Started',
      items: [
        {
          id: 'overview',
          label: isId ? 'Arsitektur Gateway' : 'Gateway Architecture',
          href: '#overview',
        },
        {
          id: 'quickstart',
          label: isId ? 'Mulai Cepat (< 30s)' : 'Quickstart (< 30s)',
          href: '#quickstart',
        },
        {
          id: 'base-url',
          label: isId ? 'Base URL & Kredensial' : 'Base URL & Auth',
          href: '#base-url',
        },
      ],
    },
    {
      title: isId ? 'Integrasi Editor & Agent' : 'IDE & Coding Agents',
      items: [
        {
          id: 'ide-cursor',
          sectionId: 'ide-setup',
          key: 'cursor',
          label: 'Cursor IDE',
          href: '#ide-setup',
          onClick: () => setActiveIde('cursor'),
        },
        {
          id: 'ide-cline',
          sectionId: 'ide-setup',
          key: 'cline',
          label: 'Cline / Roo Code',
          href: '#ide-setup',
          onClick: () => setActiveIde('cline'),
        },
        {
          id: 'ide-windsurf',
          sectionId: 'ide-setup',
          key: 'windsurf',
          label: 'Windsurf Cascade',
          href: '#ide-setup',
          onClick: () => setActiveIde('windsurf'),
        },
        {
          id: 'ide-claudecode',
          sectionId: 'ide-setup',
          key: 'claudecode',
          label: 'Claude Code CLI',
          href: '#ide-setup',
          onClick: () => setActiveIde('claudecode'),
        },
        {
          id: 'ide-aider',
          sectionId: 'ide-setup',
          key: 'aider',
          label: 'Aider CLI',
          href: '#ide-setup',
          onClick: () => setActiveIde('aider'),
        },
      ],
    },
    {
      title: isId ? 'SDK & Kode Bahasa' : 'Libraries & SDKs',
      items: [
        {
          id: 'sdk-ts',
          sectionId: 'sdk-integration',
          key: 'ts',
          label: 'TypeScript / Node.js',
          href: '#sdk-integration',
          onClick: () => setActiveSdk('ts'),
        },
        {
          id: 'sdk-python',
          sectionId: 'sdk-integration',
          key: 'python',
          label: 'Python (openai)',
          href: '#sdk-integration',
          onClick: () => setActiveSdk('python'),
        },
        {
          id: 'sdk-curl',
          sectionId: 'sdk-integration',
          key: 'curl',
          label: 'cURL / Raw HTTP',
          href: '#sdk-integration',
          onClick: () => setActiveSdk('curl'),
        },
      ],
    },
    {
      title: isId ? 'Referensi API' : 'API Reference',
      items: [
        {
          id: 'endpoint-chat',
          label: 'POST /v1/chat/completions',
          href: '#endpoint-chat',
          isMono: true,
        },
        {
          id: 'endpoint-models',
          label: 'GET /v1/models',
          href: '#endpoint-models',
          isMono: true,
        },
        {
          id: 'model-ids',
          label: isId ? 'Katalog Model ID' : 'Model IDs Catalog',
          href: '#model-ids',
        },
      ],
    },
    {
      title: isId ? 'Keandalan & Error' : 'Reliability & Errors',
      items: [
        {
          id: 'error-codes',
          label: isId ? 'Daftar Kode Error' : 'HTTP Error Codes',
          href: '#error-codes',
        },
        {
          id: 'security',
          label: isId ? 'Praktik Keamanan' : 'Security Best Practices',
          href: '#security',
        },
      ],
    },
  ];

  const sidebarNav = (
    <nav className="space-y-6 text-xs select-none">
      {navGroups.map((group) => (
        <div key={group.title} className="space-y-1.5">
          <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-neutral-500 px-3">
            {group.title}
          </div>

          <div className="space-y-0.5">
            {group.items.map((item) => {
              const isActive =
                item.sectionId === 'ide-setup'
                  ? activeSection === 'ide-setup' && activeIde === item.key
                  : item.sectionId === 'sdk-integration'
                  ? activeSection === 'sdk-integration' && activeSdk === item.key
                  : activeSection === item.id;

              return (
                <div key={item.id} className="relative">
                  <a
                    href={item.href}
                    onClick={() => {
                      if (item.onClick) item.onClick();
                      setMobileSidebarOpen(false);
                    }}
                    className={`relative flex items-center justify-between px-3 py-1.5 rounded-lg transition-colors ${
                      item.isMono ? 'font-mono text-[11px]' : 'text-xs'
                    } ${
                      isActive
                        ? 'font-bold text-neutral-950'
                        : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50 font-medium'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="sidebarActiveHighlight"
                        className="absolute inset-0 bg-neutral-100 rounded-lg -z-10 shadow-2xs border border-neutral-200/80"
                        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                      />
                    )}
                    <span className="truncate">{item.label}</span>
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="w-full bg-white text-neutral-900 pt-28 sm:pt-32 pb-24">
      {/* Main 2-Column Documentation Canvas */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 flex items-start">
        <aside className="hidden lg:block w-64 xl:w-72 shrink-0 sticky top-28 sm:top-32 self-start max-h-[calc(100vh-8.5rem)] overflow-y-auto py-2 pr-6 border-r border-neutral-200/80 [scrollbar-width:thin]">
          {sidebarNav}
        </aside>

        {/* Mobile Floating Drawer Button */}
        <button
          type="button"
          onClick={() => setMobileSidebarOpen(true)}
          className="lg:hidden fixed bottom-6 left-6 z-40 px-3.5 py-2.5 rounded-full bg-neutral-950 text-white shadow-2xl cursor-pointer hover:bg-neutral-800 transition flex items-center gap-2 text-xs font-bold"
          aria-label="Open Documentation Table of Contents"
        >
          <Menu className="h-4 w-4" />
          <span>{isId ? 'Daftar Isi Dokumen' : 'Documentation Menu'}</span>
        </button>

        {/* Mobile Drawer */}
        {mobileSidebarOpen && (
          <div className="lg:hidden fixed inset-0 z-50">
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-xs"
              onClick={() => setMobileSidebarOpen(false)}
            />
            <div className="absolute top-0 left-0 h-full w-72 bg-white border-r border-neutral-200 p-6 shadow-2xl overflow-y-auto z-10 animate-in slide-in-from-left duration-200">
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-neutral-100">
                <span className="font-heading font-bold text-sm text-neutral-950">
                  {isId ? 'Daftar Isi Dokumen' : 'Documentation'}
                </span>
                <button
                  type="button"
                  onClick={() => setMobileSidebarOpen(false)}
                  className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-950 hover:bg-neutral-100 transition cursor-pointer"
                  aria-label="Close Documentation Menu"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {sidebarNav}
            </div>
          </div>
        )}

        {/* RIGHT: Clean Editorial Reading Column (Only this area scrolls!) */}
        <div className="flex-1 min-w-0 max-w-4xl py-2 lg:py-2 px-0 lg:px-12 space-y-16">
          {/* Header & Quick Endpoint Callout */}
          <div className="space-y-4 pb-4 border-b border-neutral-100">
            <div className="flex items-center gap-2 text-xs text-neutral-500 font-mono">
              <Link href="/" className="hover:text-neutral-900 transition">Morphic</Link>
              <span>/</span>
              <span className="text-neutral-900 font-semibold">{isId ? 'Dokumentasi Gateway' : 'Gateway Docs'}</span>
            </div>

            <div className="space-y-2">
              <h1 className="text-3xl sm:text-4xl font-heading font-extrabold text-neutral-950 tracking-tight">
                {isId ? 'Dokumentasi & Integrasi Morphic Gateway' : 'Morphic AI Gateway Documentation'}
              </h1>
              <p className="text-sm sm:text-base text-neutral-600 leading-relaxed max-w-3xl">
                {isId
                  ? 'Morphic AI Gateway adalah reverse proxy cerdas berkecepatan tinggi yang kompatibel 100% dengan OpenAI wire protocol. Gunakan satu Base URL dan satu API Key untuk mengakses DeepSeek V4, Claude 3.5 Sonnet, Qwen 2.5, dan model terbaik lainnya tanpa berlangganan kartu kredit internasional terpisah.'
                  : 'Morphic AI Gateway is a high-speed intelligent reverse-proxy 100% compliant with the OpenAI wire protocol. Use a single Base URL and API Key to access DeepSeek V4, Claude 3.5 Sonnet, Qwen 2.5, and more without separate international subscriptions.'}
              </p>
            </div>

            {/* Quick Monospace Base URL Callout in Header */}
            <div className="pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-neutral-50 border border-neutral-200/90 text-xs">
                <div className="flex items-center gap-2.5 truncate font-mono">
                  <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider shrink-0">
                    CANONICAL BASE URL
                  </span>
                  <span className="text-neutral-950 font-bold select-all truncate">
                    {BASE_URL}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={copyBaseUrl}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-neutral-200 hover:bg-neutral-100 text-neutral-800 text-xs font-semibold transition cursor-pointer shadow-2xs"
                  >
                    {copiedBaseUrl ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="text-emerald-700">{isId ? 'Tersalin' : 'Copied'}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5 text-neutral-500" />
                        <span>{isId ? 'Salin URL' : 'Copy URL'}</span>
                      </>
                    )}
                  </button>

                  <Link
                    href={session ? '/dashboard/keys' : '/login'}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-bold transition cursor-pointer shadow-2xs"
                  >
                    <KeyRound className="h-3 w-3" />
                    <span>{session ? (isId ? 'Kunci API' : 'API Keys') : (isId ? 'Dapatkan Kunci' : 'Get Key')}</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 1: ARCHITECTURE */}
          <section id="overview" className="scroll-mt-32 sm:scroll-mt-36 space-y-4">
            <h2 className="text-xl sm:text-2xl font-heading font-bold text-neutral-950 pb-2 border-b border-neutral-100">
              {isId ? 'Arsitektur & Kompatibilitas Wire-Protocol' : 'Gateway Architecture & Wire-Protocol'}
            </h2>

            <p className="text-sm text-neutral-600 leading-relaxed">
              {isId
                ? 'Morphic beroperasi sebagai drop-in reverse proxy resmi untuk ekosistem OpenAI. Seluruh request client dialirkan secara transparan ke provider model upstream (DeepSeek, Anthropic, Qwen, Moonshot Kimi) dengan mempertahankan format wire-protocol OpenAI.'
                : 'Morphic operates as a transparent drop-in reverse proxy for the OpenAI ecosystem. All client requests are streamed directly to upstream providers (DeepSeek, Anthropic, Qwen, Moonshot Kimi) maintaining exact OpenAI wire specifications.'}
            </p>

            <ul className="space-y-2 text-xs sm:text-sm text-neutral-700 pt-1">
              <li id="overview-wire" className="scroll-mt-36 flex items-start gap-2">
                <span className="font-mono text-neutral-400 font-bold">&bull;</span>
                <div>
                  <strong className="text-neutral-950">100% Drop-in Compatibility:</strong> Mendukung rute <code className="font-mono bg-neutral-100 px-1 py-0.5 rounded text-neutral-900">/v1/chat/completions</code> dan <code className="font-mono bg-neutral-100 px-1 py-0.5 rounded text-neutral-900">/v1/models</code> tanpa perubahan kode aplikasi Anda.
                </div>
              </li>
              <li id="overview-sse" className="scroll-mt-36 flex items-start gap-2">
                <span className="font-mono text-neutral-400 font-bold">&bull;</span>
                <div>
                  <strong className="text-neutral-950">Low-Latency SSE Streaming:</strong> Mendukung Server-Sent Events real-time chunking (<code className="font-mono bg-neutral-100 px-1 py-0.5 rounded text-neutral-900">stream: true</code>) yang dioptimasi untuk Cursor Composer, Cline, dan interactive chat.
                </div>
              </li>
              <li id="overview-zdr" className="scroll-mt-36 flex items-start gap-2">
                <span className="font-mono text-neutral-400 font-bold">&bull;</span>
                <div>
                  <strong className="text-neutral-950">Zero Data Retention (ZDR):</strong> Seluruh payload prompt, file context, dan completions dialirkan secara ephemeral tanpa pernah disimpan ke persistent disk atau database kami.
                </div>
              </li>
            </ul>
          </section>

          {/* SECTION 2: QUICKSTART */}
          <section id="quickstart" className="scroll-mt-32 sm:scroll-mt-36 space-y-5">
            <h2 className="text-xl sm:text-2xl font-heading font-bold text-neutral-950 pb-2 border-b border-neutral-100">
              {isId ? 'Mulai Cepat (< 30 Detik)' : 'Quickstart (< 30 Seconds)'}
            </h2>

            <p className="text-sm text-neutral-600 leading-relaxed">
              {isId
                ? 'Jalankan chat completion pertama Anda melalui terminal dalam dua langkah ringkas:'
                : 'Send your first chat completion through Morphic Gateway directly from your terminal in two steps:'}
            </p>

            {/* Step 1 */}
            <div id="qs-key" className="scroll-mt-36 space-y-2">
              <div className="flex items-center gap-2 text-sm font-bold text-neutral-950">
                <span className="w-5 h-5 rounded-full bg-neutral-900 text-white flex items-center justify-center text-xs font-mono">1</span>
                <span>{isId ? 'Dapatkan Kunci API dari Dashboard' : 'Obtain Your API Key'}</span>
              </div>
              <p className="text-xs text-neutral-600 pl-7">
                {isId ? 'Kunci diawali prefix' : 'Keys start with prefix'}{' '}
                <code className="font-mono bg-neutral-100 px-1 py-0.5 rounded text-neutral-900">mp-live-xxxxxxxxxxxxxxxxxxxx</code>.{' '}
                <Link href="/dashboard/keys" className="font-semibold text-neutral-950 hover:underline">
                  {isId ? 'Buka tab API Keys →' : 'Go to API Keys →'}
                </Link>
              </p>
            </div>

            {/* Step 2 */}
            <div id="qs-curl" className="scroll-mt-36 space-y-2 pt-2">
              <div className="flex items-center gap-2 text-sm font-bold text-neutral-950">
                <span className="w-5 h-5 rounded-full bg-neutral-900 text-white flex items-center justify-center text-xs font-mono">2</span>
                <span>{isId ? 'Kirim Permintaan Pertama via cURL' : 'Execute First cURL Request'}</span>
              </div>
              <div className="pl-7 space-y-3">
                <CodeBlock
                  filename="curl_quickstart.sh"
                  language="bash"
                  code={`curl https://api.morphic.sh/v1/chat/completions \\
  -H "Authorization: Bearer mp-live-xxxxxxxxxxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "deepseek-v4",
    "messages": [
      { "role": "system", "content": "You are an expert developer." },
      { "role": "user", "content": "Hello Morphic Gateway!" }
    ],
    "temperature": 0.2
  }'`}
                />

                <div id="qs-response" className="scroll-mt-36 text-[11px] font-semibold text-neutral-500 uppercase tracking-wider pt-1">
                  {isId ? 'Contoh Respon Server (HTTP 200 OK):' : 'Expected Server Response (HTTP 200 OK):'}
                </div>
                <CodeBlock
                  filename="response_200.json"
                  language="json"
                  code={`{
  "id": "chatcmpl-morph-98f2b314d",
  "object": "chat.completion",
  "created": 1741628400,
  "model": "deepseek-v4",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! I am DeepSeek V4 running via Morphic Gateway. How can I help you build today?"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 18,
    "completion_tokens": 24,
    "total_tokens": 42
  }
}`}
                />
              </div>
            </div>
          </section>

          {/* SECTION 3: BASE URL & AUTH */}
          <section id="base-url" className="scroll-mt-32 sm:scroll-mt-36 space-y-4">
            <h2 className="text-xl sm:text-2xl font-heading font-bold text-neutral-950 pb-2 border-b border-neutral-100">
              {isId ? 'Basis URL & Otentikasi' : 'Base URL & Authentication'}
            </h2>

            <p className="text-sm text-neutral-600 leading-relaxed">
              {isId
                ? 'Semua request API diarahkan ke endpoint kanonikal Morphic dengan otentikasi Bearer Token. Kunci API Anda diautentikasi dengan proteksi Zero Data Retention (ZDR).'
                : 'All API requests route through Morphic’s canonical base endpoint using a Bearer token. Your API key is authenticated cryptographically with Zero Data Retention (ZDR).'}
            </p>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-neutral-50 border border-neutral-200/90 text-xs">
              <div className="flex items-center gap-2.5 truncate font-mono">
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider shrink-0">
                  CANONICAL BASE URL
                </span>
                <span className="text-neutral-950 font-bold select-all truncate">
                  {BASE_URL}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={copyBaseUrl}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-neutral-200 hover:bg-neutral-100 text-neutral-800 text-xs font-semibold transition cursor-pointer shadow-2xs"
                >
                  {copiedBaseUrl ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      <span className="text-emerald-700">{isId ? 'Tersalin' : 'Copied'}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 text-neutral-500" />
                      <span>{isId ? 'Salin URL' : 'Copy URL'}</span>
                    </>
                  )}
                </button>

                <Link
                  href={session ? '/dashboard/keys' : '/login'}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-bold transition cursor-pointer shadow-2xs"
                >
                  <KeyRound className="h-3 w-3" />
                  <span>{session ? (isId ? 'Kunci API' : 'API Keys') : (isId ? 'Dapatkan Kunci' : 'Get Key')}</span>
                </Link>
              </div>
            </div>
          </section>

          {/* SECTION 4: IDE SETUP */}
          <section id="ide-setup" className="scroll-mt-32 sm:scroll-mt-36 space-y-4">
            <h2 className="text-xl sm:text-2xl font-heading font-bold text-neutral-950 pb-2 border-b border-neutral-100">
              {isId ? 'Integrasi Editor & Coding Agent' : 'IDE & Coding Agents Setup'}
            </h2>

            <p className="text-sm text-neutral-600 leading-relaxed">
              {isId
                ? 'Pilih editor coding Anda di bawah ini untuk melihat jalur pengaturan dan snippet konfigurasi yang tepat:'
                : 'Select your coding editor below to view exact setup paths and configuration snippets:'}
            </p>

            {/* Apple/shadcn segmented tab bar */}
            <div className="border border-neutral-200 rounded-2xl overflow-hidden">
              <div className="flex items-center gap-1 p-2 bg-neutral-50 border-b border-neutral-200 overflow-x-auto">
                {(Object.keys(ideConfigs) as IdeKey[]).map((key) => {
                  const cfg = ideConfigs[key];
                  const isActive = activeIde === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setActiveIde(key)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                        isActive
                          ? 'bg-white text-neutral-950 shadow-2xs font-bold'
                          : 'text-neutral-600 hover:text-neutral-950 hover:bg-neutral-200/50'
                      }`}
                    >
                      {cfg.name}
                    </button>
                  );
                })}
              </div>

              <div className="p-5 space-y-3">
                <div className="space-y-1">
                  <h3 className="font-bold text-sm sm:text-base text-neutral-950">
                    {ideConfigs[activeIde].title}
                  </h3>
                  <p className="text-xs text-neutral-600">
                    {isId ? ideConfigs[activeIde].desc : ideConfigs[activeIde].descEn}
                  </p>
                </div>

                <div className="p-2.5 rounded-lg bg-neutral-100/80 font-mono text-xs text-neutral-700 flex items-center gap-2">
                  <span className="text-neutral-500 font-bold uppercase text-[10px]">Path:</span>
                  <span className="truncate">{ideConfigs[activeIde].menuPath}</span>
                </div>

                <CodeBlock
                  filename={ideConfigs[activeIde].file}
                  language="json"
                  code={ideConfigs[activeIde].code}
                />
              </div>
            </div>
          </section>

          {/* SECTION 4: SDKS */}
          <section id="sdk-integration" className="scroll-mt-32 sm:scroll-mt-36 space-y-4">
            <h2 className="text-xl sm:text-2xl font-heading font-bold text-neutral-950 pb-2 border-b border-neutral-100">
              {isId ? 'SDK & Kode Bahasa Pemrograman' : 'Libraries & Language SDKs'}
            </h2>

            <p className="text-sm text-neutral-600 leading-relaxed">
              {isId
                ? 'Gunakan library resmi OpenAI di TypeScript atau Python tanpa library proprietary pihak ketiga:'
                : 'Use official OpenAI libraries in TypeScript or Python without third-party proprietary wrappers:'}
            </p>

            <div className="border border-neutral-200 rounded-2xl overflow-hidden">
              <div className="flex items-center gap-1 p-2 bg-neutral-50 border-b border-neutral-200 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setActiveSdk('ts')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                    activeSdk === 'ts'
                      ? 'bg-white text-neutral-950 shadow-2xs font-bold'
                      : 'text-neutral-600 hover:text-neutral-950 hover:bg-neutral-200/50'
                  }`}
                >
                  TypeScript / Node.js
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSdk('python')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                    activeSdk === 'python'
                      ? 'bg-white text-neutral-950 shadow-2xs font-bold'
                      : 'text-neutral-600 hover:text-neutral-950 hover:bg-neutral-200/50'
                  }`}
                >
                  Python (openai)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSdk('curl')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                    activeSdk === 'curl'
                      ? 'bg-white text-neutral-950 shadow-2xs font-bold'
                      : 'text-neutral-600 hover:text-neutral-950 hover:bg-neutral-200/50'
                  }`}
                >
                  cURL / Raw HTTP
                </button>
              </div>

              <div className="p-5">
                {activeSdk === 'ts' && (
                  <div className="space-y-2">
                    <div className="p-2 rounded-lg bg-neutral-100 font-mono text-xs text-neutral-800">
                      npm install openai
                    </div>
                    <CodeBlock
                      filename="gateway-client.ts"
                      language="typescript"
                      code={tsCode}
                    />
                  </div>
                )}

                {activeSdk === 'python' && (
                  <div className="space-y-2">
                    <div className="p-2 rounded-lg bg-neutral-100 font-mono text-xs text-neutral-800">
                      pip install openai
                    </div>
                    <CodeBlock
                      filename="quickstart.py"
                      language="python"
                      code={pythonCode}
                    />
                  </div>
                )}

                {activeSdk === 'curl' && (
                  <div className="space-y-2">
                    <CodeBlock
                      filename="curl_example.sh"
                      language="bash"
                      code={curlCode}
                    />
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* SECTION 5: API REFERENCE */}
          <section id="endpoint-chat" className="scroll-mt-32 sm:scroll-mt-36 space-y-6">
            <h2 className="text-xl sm:text-2xl font-heading font-bold text-neutral-950 pb-2 border-b border-neutral-100">
              {isId ? 'Referensi API Endpoint' : 'API Reference'}
            </h2>

            {/* Route 1: POST /v1/chat/completions */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-emerald-100 text-emerald-800">
                  POST
                </span>
                <span className="font-mono text-sm font-bold text-neutral-950">
                  /v1/chat/completions
                </span>
              </div>

              <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
                {isId
                  ? 'Membuat respon chat completion dari model AI. Mendukung konteks percakapan multi-turn, SSE streaming, dan parameter sampling standar.'
                  : 'Creates a model response for the given chat conversation. Supports multi-turn context, SSE streaming, and sampling parameters.'}
              </p>

              {/* Headers Table */}
              <div id="chat-headers" className="scroll-mt-36 space-y-2">
                <div className="text-[11px] font-mono font-bold text-neutral-400 uppercase tracking-wider">
                  Request Headers
                </div>
                <div className="border border-neutral-200 rounded-xl overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 font-semibold">
                      <tr>
                        <th className="p-3">Header</th>
                        <th className="p-3">Tipe</th>
                        <th className="p-3">Keterangan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 text-neutral-700">
                      <tr>
                        <td className="p-3 font-mono font-bold text-neutral-950">Authorization</td>
                        <td className="p-3 font-mono text-neutral-500">string</td>
                        <td className="p-3">Format wajib: <code className="font-mono bg-neutral-100 px-1 rounded">Bearer mp-live-xxxx</code></td>
                      </tr>
                      <tr>
                        <td className="p-3 font-mono font-bold text-neutral-950">Content-Type</td>
                        <td className="p-3 font-mono text-neutral-500">string</td>
                        <td className="p-3">Wajib: <code className="font-mono bg-neutral-100 px-1 rounded">application/json</code></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Body Parameters Table */}
              <div id="chat-params" className="scroll-mt-36 space-y-2 pt-2">
                <div className="text-[11px] font-mono font-bold text-neutral-400 uppercase tracking-wider">
                  Request Body Parameters
                </div>
                <div className="border border-neutral-200 rounded-xl overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 font-semibold">
                      <tr>
                        <th className="p-3">Field</th>
                        <th className="p-3">Tipe</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Deskripsi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 text-neutral-700">
                      <tr>
                        <td className="p-3 font-mono font-bold text-neutral-950">model</td>
                        <td className="p-3 font-mono text-neutral-500">string</td>
                        <td className="p-3 text-red-600 font-bold">Required</td>
                        <td className="p-3">ID Model resmi (misal: <code className="font-mono bg-neutral-100 px-1 rounded">deepseek-v4</code>, <code className="font-mono bg-neutral-100 px-1 rounded">claude-3.5-sonnet-proxy</code>).</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-mono font-bold text-neutral-950">messages</td>
                        <td className="p-3 font-mono text-neutral-500">array</td>
                        <td className="p-3 text-red-600 font-bold">Required</td>
                        <td className="p-3">Array objek pesan percakapan dengan properti <code className="font-mono bg-neutral-100 px-1 rounded">role</code> dan <code className="font-mono bg-neutral-100 px-1 rounded">content</code>.</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-mono font-bold text-neutral-950">stream</td>
                        <td className="p-3 font-mono text-neutral-500">boolean</td>
                        <td className="p-3 text-neutral-500">Optional</td>
                        <td className="p-3">Jika true, gateway mengirim token chunks via Server-Sent Events (SSE). Default: false.</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-mono font-bold text-neutral-950">temperature</td>
                        <td className="p-3 font-mono text-neutral-500">number</td>
                        <td className="p-3 text-neutral-500">Optional</td>
                        <td className="p-3">Tingkat variasi respon (0.0 sampai 2.0). Disarankan 0.0 - 0.3 untuk tugas coding presisi.</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-mono font-bold text-neutral-950">max_tokens</td>
                        <td className="p-3 font-mono text-neutral-500">integer</td>
                        <td className="p-3 text-neutral-500">Optional</td>
                        <td className="p-3">Batas maksimum output token yang digenerasikan oleh model.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Route 2: GET /v1/models */}
            <div id="endpoint-models" className="scroll-mt-36 space-y-3 pt-6 border-t border-neutral-100">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-blue-100 text-blue-800">
                  GET
                </span>
                <span className="font-mono text-sm font-bold text-neutral-950">
                  /v1/models
                </span>
              </div>

              <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
                {isId
                  ? 'Menampilkan daftar seluruh model AI aktif yang didukung oleh Morphic AI Gateway.'
                  : 'Lists all available models currently supported and routed by Morphic AI Gateway.'}
              </p>

              <div id="models-spec" className="scroll-mt-36">
                <CodeBlock
                  filename="models_response.json"
                  language="json"
                  code={`// GET https://api.morphic.sh/v1/models
// Header: Authorization: Bearer mp-live-xxxx

{
  "object": "list",
  "data": [
    {
      "id": "deepseek-v4",
      "object": "model",
      "created": 1740000000,
      "owned_by": "morphic"
    },
    {
      "id": "claude-3.5-sonnet-proxy",
      "object": "model",
      "created": 1740000000,
      "owned_by": "morphic"
    },
    {
      "id": "qwen-2.5-max",
      "object": "model",
      "created": 1740000000,
      "owned_by": "morphic"
    }
  ]
}`}
                />
              </div>
            </div>
          </section>

          {/* SECTION 6: MODEL IDS CATALOG */}
          <section id="model-ids" className="scroll-mt-32 sm:scroll-mt-36 space-y-4">
            <h2 className="text-xl sm:text-2xl font-heading font-bold text-neutral-950 pb-2 border-b border-neutral-100">
              {isId ? 'Model ID Resmi & Karakteristik' : 'Official Model IDs'}
            </h2>

            <div className="border border-neutral-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 font-semibold">
                    <tr>
                      <th className="p-3 sm:p-3.5">Model ID</th>
                      <th className="p-3 sm:p-3.5">Provider</th>
                      <th className="p-3 sm:p-3.5">Context</th>
                      <th className="p-3 sm:p-3.5">Use Case</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 text-neutral-700">
                    <tr>
                      <td className="p-3 sm:p-3.5 font-mono font-bold text-neutral-950">
                        deepseek-v4
                      </td>
                      <td className="p-3 sm:p-3.5">DeepSeek</td>
                      <td className="p-3 sm:p-3.5 font-mono">64K</td>
                      <td className="p-3 sm:p-3.5 text-xs text-neutral-600">
                        Paling hemat & responsif. Ideal untuk auto-complete Cursor dan routine coding.
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 sm:p-3.5 font-mono font-bold text-neutral-950">
                        claude-3.5-sonnet-proxy
                      </td>
                      <td className="p-3 sm:p-3.5">Anthropic</td>
                      <td className="p-3 sm:p-3.5 font-mono">200K</td>
                      <td className="p-3 sm:p-3.5 text-xs text-neutral-600">
                        Standar industri coding agent. Terbaik untuk refactoring multi-file di Cursor Composer.
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 sm:p-3.5 font-mono font-bold text-neutral-950">
                        qwen-2.5-max
                      </td>
                      <td className="p-3 sm:p-3.5">Alibaba Cloud</td>
                      <td className="p-3 sm:p-3.5 font-mono">128K</td>
                      <td className="p-3 sm:p-3.5 text-xs text-neutral-600">
                        Kuat dalam logika matematika, data engineering, dan database schema design.
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 sm:p-3.5 font-mono font-bold text-neutral-950">
                        deepseek-r1
                      </td>
                      <td className="p-3 sm:p-3.5">DeepSeek</td>
                      <td className="p-3 sm:p-3.5 font-mono">64K</td>
                      <td className="p-3 sm:p-3.5 text-xs text-neutral-600">
                        Reasoning model dengan chain-of-thought transparan untuk debugging mendalam.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="p-3 bg-neutral-50 border-t border-neutral-200 flex items-center justify-between text-xs">
                <span className="text-neutral-500">
                  {isId ? 'Ingin mengecek seluruh tarif per 1M token?' : 'Explore all rates and experimental models'}
                </span>
                <Link
                  href="/models"
                  className="font-bold text-neutral-950 hover:underline flex items-center gap-1"
                >
                  <span>{isId ? 'Lihat Katalog Model' : 'View Models'}</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </section>

          {/* SECTION 7: ERROR CODES */}
          <section id="error-codes" className="scroll-mt-32 sm:scroll-mt-36 space-y-4">
            <h2 className="text-xl sm:text-2xl font-heading font-bold text-neutral-950 pb-2 border-b border-neutral-100">
              {isId ? 'Kode Error HTTP & Pemecahan Masalah' : 'HTTP Error Codes & Troubleshooting'}
            </h2>

            <div className="border border-neutral-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 font-semibold">
                  <tr>
                    <th className="p-3 sm:p-3.5">Status</th>
                    <th className="p-3 sm:p-3.5">Kode</th>
                    <th className="p-3 sm:p-3.5">Penyebab</th>
                    <th className="p-3 sm:p-3.5">Solusi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 text-neutral-700">
                  <tr id="err-401" className="scroll-mt-36">
                    <td className="p-3 sm:p-3.5 font-mono font-bold text-amber-800">
                      401 Unauthorized
                    </td>
                    <td className="p-3 sm:p-3.5 font-mono text-neutral-900 font-semibold">
                      INVALID_KEY_FORMAT
                    </td>
                    <td className="p-3 sm:p-3.5 text-xs text-neutral-600">
                      Header Authorization tidak ada, tidak berawalan <code className="font-mono bg-neutral-100 px-1 rounded">mp-</code>, atau key sudah dicabut.
                    </td>
                    <td className="p-3 sm:p-3.5 text-xs text-neutral-950 font-medium">
                      Periksa kunci di Dashboard API Keys atau generate key baru.
                    </td>
                  </tr>
                  <tr>
                    <td className="p-3 sm:p-3.5 font-mono font-bold text-rose-800">
                      402 Payment Required
                    </td>
                    <td className="p-3 sm:p-3.5 font-mono text-neutral-900 font-semibold">
                      INSUFFICIENT_CREDITS
                    </td>
                    <td className="p-3 sm:p-3.5 text-xs text-neutral-600">
                      Saldo kredit akun Anda habis (&le; 0).
                    </td>
                    <td className="p-3 sm:p-3.5 text-xs text-neutral-950 font-medium">
                      Top up saldo via QRIS instan di menu Billing.
                    </td>
                  </tr>
                  <tr id="err-429" className="scroll-mt-36">
                    <td className="p-3 sm:p-3.5 font-mono font-bold text-amber-800">
                      429 Too Many Requests
                    </td>
                    <td className="p-3 sm:p-3.5 font-mono text-neutral-900 font-semibold">
                      RATE_LIMIT_EXCEEDED
                    </td>
                    <td className="p-3 sm:p-3.5 text-xs text-neutral-600">
                      Batas request per menit (RPM) akun telah tercapai.
                    </td>
                    <td className="p-3 sm:p-3.5 text-xs text-neutral-950 font-medium">
                      Tambahkan exponential retry backoff pada client Anda.
                    </td>
                  </tr>
                  <tr id="err-503" className="scroll-mt-36">
                    <td className="p-3 sm:p-3.5 font-mono font-bold text-neutral-800">
                      503 Service Unavailable
                    </td>
                    <td className="p-3 sm:p-3.5 font-mono text-neutral-900 font-semibold">
                      UPSTREAM_TIMEOUT
                    </td>
                    <td className="p-3 sm:p-3.5 text-xs text-neutral-600">
                      Server provider upstream sedang overload atau antrean penuh.
                    </td>
                    <td className="p-3 sm:p-3.5 text-xs text-neutral-950 font-medium">
                      Gateway melakukan retry otomatis; jika berlanjut, alihkan sementara ke model alternatif.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Trailing slash tip */}
            <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80 text-amber-900 flex items-start gap-2.5 text-xs">
              <HelpCircle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <strong className="font-semibold text-amber-950">Penting:</strong>{' '}
                {isId
                  ? 'Jika Cursor menampilkan peringatan "Connection failed", pastikan tidak menambahkan garis miring di akhir URL: gunakan persis https://api.morphic.sh/v1 (bukan .../v1/).'
                  : 'If Cursor displays "Connection failed", ensure there is no trailing slash: use strictly https://api.morphic.sh/v1 (not .../v1/).'}
              </p>
            </div>
          </section>

          {/* SECTION 8: BEST PRACTICES */}
          <section id="security" className="scroll-mt-32 sm:scroll-mt-36 space-y-4">
            <h2 className="text-xl sm:text-2xl font-heading font-bold text-neutral-950 pb-2 border-b border-neutral-100">
              {isId ? 'Praktik Terbaik Keamanan' : 'Security Best Practices'}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div id="sec-env" className="scroll-mt-36 p-4 rounded-xl border border-neutral-200 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-xs text-neutral-950">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>{isId ? 'Gunakan Environment Variables' : 'Use Environment Variables'}</span>
                </div>
                <p className="text-xs text-neutral-600 leading-relaxed">
                  {isId
                    ? 'Jangan pernah commit API Key langsung di repositori publik. Simpan di .env.local dan pastikan terdaftar di .gitignore.'
                    : 'Never commit API keys into public repositories. Store them in .env.local and add it to your .gitignore.'}
                </p>
              </div>

              <div id="sec-keys" className="scroll-mt-36 p-4 rounded-xl border border-neutral-200 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-xs text-neutral-950">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>{isId ? 'Pisahkan Key Dev & Production' : 'Separate Dev & Production Keys'}</span>
                </div>
                <p className="text-xs text-neutral-600 leading-relaxed">
                  {isId
                    ? 'Buat key terpisah untuk laptop kerja harian dan server produksi agar dapat direvoke secara independen saat darurat.'
                    : 'Create dedicated keys for local workstations and production servers to enable isolated key revocation.'}
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
