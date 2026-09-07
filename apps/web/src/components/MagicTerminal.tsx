'use client';

import React, { useState, useEffect } from 'react';
import { Copy, Check, Terminal as TerminalIcon, Sparkles } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

type TabKey = 'cursor' | 'cline' | 'python' | 'curl';

const TERMINAL_SNIPPETS: Record<
  TabKey,
  {
    label: string;
    file: string;
    command: string;
    outputLines: string[];
    rawSnippet: string;
  }
> = {
  cursor: {
    label: 'Cursor IDE',
    file: 'cursor.settings.json',
    command: 'curl -s https://api.morphic.sh/v1/models',
    outputLines: [
      '✔ Base URL: https://api.morphic.sh/v1',
      '✔ API Key:  mp-live-xxxxxxxxxxxx',
      '✔ Active Model: deepseek-v4-coder (Latensi: 120ms)',
      '✔ Status: 100% OpenAI-compatible ready for composer',
    ],
    rawSnippet: `// Cursor Settings > Models > OpenAI API:
Base URL: https://api.morphic.sh/v1
API Key:  mp-xxxxxxxxxxxxxxxxxxxx

// Models supported:
- deepseek-v4-coder
- claude-3.5-sonnet-proxy
- qwen-2.5-max
- kimi-k1.5-coding`,
  },
  cline: {
    label: 'Cline / VSCode',
    file: 'cline_mcp_settings.json',
    command: 'cline config set provider=openai-compatible',
    outputLines: [
      '✔ Provider configured: OpenAI Compatible',
      '✔ Endpoint set: https://api.morphic.sh/v1',
      '✔ Auth token validated: mp-live-active',
      '✔ High-concurrency mode: Enabled (180 RPM)',
    ],
    rawSnippet: `{
  "apiProvider": "openai",
  "openAiBaseUrl": "https://api.morphic.sh/v1",
  "openAiApiKey": "mp-xxxxxxxxxxxxxxxxxxxx",
  "openAiModelId": "deepseek-v4-coder"
}`,
  },
  python: {
    label: 'Python SDK',
    file: 'quickstart.py',
    command: 'python -m pip install openai -q && python quickstart.py',
    outputLines: [
      '>>> Morphic Client Initialized...',
      '>>> Sending prompt to model="deepseek-v4-coder"',
      '<<< [Response 200 OK]: "Here is your clean TypeScript auth module..."',
      '✔ Completed in 184ms | Tokens: 42 in / 158 out',
    ],
    rawSnippet: `from openai import OpenAI

client = OpenAI(
    base_url="https://api.morphic.sh/v1",
    api_key="mp-xxxxxxxxxxxxxxxxxxxx",
)

response = client.chat.completions.create(
    model="deepseek-v4-coder",
    messages=[{"role": "user", "content": "Write TypeScript auth helper"}]
)
print(response.choices[0].message.content)`,
  },
  curl: {
    label: 'cURL',
    file: 'request.sh',
    command: 'curl -i https://api.morphic.sh/v1/chat/completions \\',
    outputLines: [
      'HTTP/2 200 OK',
      'content-type: application/json',
      'x-morphic-latency: 142ms',
      '{"id":"chatcmpl-9x","choices":[{"message":{"role":"assistant","content":"Ready."}}]}',
    ],
    rawSnippet: `curl https://api.morphic.sh/v1/chat/completions \\
  -H "Authorization: Bearer mp-xxxxxxxxxxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "deepseek-v4-coder",
    "messages": [{"role": "user", "content": "Hello Morphic!"}]
  }'`,
  },
};

export default function MagicTerminal() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabKey>('cursor');
  const [copied, setCopied] = useState(false);
  const [visibleLines, setVisibleLines] = useState<number>(0);

  const snippet = TERMINAL_SNIPPETS[activeTab];

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    setVisibleLines(0);
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setVisibleLines((prev) => {
        if (prev < snippet.outputLines.length) {
          return prev + 1;
        }
        clearInterval(timer);
        return prev;
      });
    }, 180);
    return () => clearInterval(timer);
  }, [activeTab, snippet.outputLines.length]);

  const handleCopy = () => {
    navigator.clipboard.writeText(snippet.rawSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section id="terminal" className="relative z-10 py-20 px-4 sm:px-6 bg-white text-neutral-900 border-t border-neutral-200/90">
      <div className="max-w-4xl mx-auto">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-neutral-100 border border-neutral-200 text-neutral-800 text-xs font-semibold mb-4 shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-neutral-900" />
            <span>{t.terminal.badge}</span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-heading font-extrabold tracking-tight mb-3 text-neutral-950">
            {t.terminal.title}
          </h2>

          <p className="text-neutral-600 font-body text-sm sm:text-base leading-relaxed">
            {t.terminal.desc}
          </p>
        </div>

        {/* Minimalist MagicUI Style Terminal Window */}
        <div className="rounded-2xl border border-neutral-300/90 bg-neutral-950 text-neutral-100 shadow-[0_20px_50px_rgba(0,0,0,0.12)] overflow-hidden">
          {/* macOS Window Title Bar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800/80 bg-neutral-900/90 backdrop-blur-md select-none">
            {/* Window Dots */}
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#FF5F56] border border-[#E0443E]/50 inline-block shadow-xs" />
              <span className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-[#DEA123]/50 inline-block shadow-xs" />
              <span className="w-3 h-3 rounded-full bg-[#27C93F] border border-[#1AAB29]/50 inline-block shadow-xs" />
              <div className="ml-3 hidden sm:flex items-center gap-1.5 text-neutral-400 text-xs font-mono">
                <TerminalIcon className="h-3.5 w-3.5 text-neutral-500" />
                <span>morphic-runtime — {snippet.file}</span>
              </div>
            </div>

            {/* Tab Selectors */}
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {(Object.keys(TERMINAL_SNIPPETS) as TabKey[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => handleTabChange(tab)}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer ${
                    activeTab === tab
                      ? 'bg-neutral-800 text-white shadow-inner border border-neutral-700'
                      : 'text-neutral-400 hover:text-white hover:bg-neutral-800/50'
                  }`}
                >
                  {TERMINAL_SNIPPETS[tab].label}
                </button>
              ))}
            </div>
          </div>

          {/* Terminal Body */}
          <div className="p-5 sm:p-6 font-mono text-xs sm:text-sm relative">
            {/* Copy button */}
            <button
              onClick={handleCopy}
              className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800/80 hover:bg-neutral-700/80 text-neutral-300 hover:text-white text-xs border border-neutral-700 transition-all cursor-pointer shadow-sm z-10"
              title="Copy snippet"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-sans font-semibold">{t.terminal.copied}</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-neutral-400" />
                  <span className="font-sans font-medium">{t.terminal.copy}</span>
                </>
              )}
            </button>

            {/* Command execution line */}
            <div className="flex items-center gap-2 text-emerald-400 mb-3 select-none">
              <span className="text-neutral-500 font-bold">$</span>
              <span className="text-neutral-100 font-semibold">{snippet.command}</span>
            </div>

            {/* Animated Output Lines */}
            <div className="space-y-1.5 text-neutral-300 min-h-[100px]">
              {snippet.outputLines.slice(0, visibleLines).map((line, idx) => (
                <div
                  key={idx}
                  className="animate-in fade-in slide-in-from-bottom-1 duration-150 flex items-start gap-2 text-neutral-300"
                >
                  <span className="text-neutral-500 text-[11px] select-none">{idx + 1}</span>
                  <span className={line.startsWith('✔') ? 'text-emerald-300' : line.startsWith('<<<') ? 'text-cyan-300' : 'text-neutral-300'}>
                    {line}
                  </span>
                </div>
              ))}
              {visibleLines < snippet.outputLines.length && (
                <div className="inline-block w-2 h-4 bg-emerald-400 animate-pulse ml-4 align-middle" />
              )}
            </div>

            {/* Live Telemetry Footer Bar */}
            <div className="mt-5 pt-4 border-t border-neutral-800/80 flex flex-wrap items-center justify-between gap-3 text-[11px] text-neutral-400">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-neutral-300 font-semibold">{t.terminal.connected}</span>
              </div>
              <div className="text-neutral-500 font-mono">
                API Standard: OpenAI v1/chat/completions
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
