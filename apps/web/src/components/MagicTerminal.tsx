'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Copy, Check, Terminal as TerminalIcon } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { useReducedMotionSafe } from '@/lib/use-reduced-motion-safe';

type TabKey = 'cursor' | 'cline' | 'python' | 'curl';

interface MagicTerminalProps {
  /** Milliseconds per typed character. Lower = faster typing. */
  typeSpeed?: number;
  /** Milliseconds before the first typing cycle starts. */
  startDelay?: number;
  /** Milliseconds the finished command + output stays on screen before the loop restarts. */
  loopDelay?: number;
  /** Milliseconds between each revealed output line. */
  outputLineDelay?: number;
}

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
    command: 'cursor settings apply --provider openai',
    outputLines: [
      '✔ Base URL: https://api.morphic.sh/v1',
      '✔ API Key:  mp-xxxxxxxxxxxxxxxxxxxx',
      '✔ Models: deepseek-v4-coder, claude-3.5-sonnet-proxy, qwen-2.5-max, kimi-k1.5-coding',
      '✔ Status: OpenAI-compatible ready for composer',
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
    command: 'cline settings apply cline_mcp_settings.json',
    outputLines: [
      '✔ apiProvider: openai',
      '✔ openAiBaseUrl: https://api.morphic.sh/v1',
      '✔ openAiApiKey: mp-xxxxxxxxxxxxxxxxxxxx',
      '✔ openAiModelId: deepseek-v4-coder',
      '✔ Provider ready — start chatting in VSCode',
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
    command: `curl https://api.morphic.sh/v1/chat/completions \\
  -H "Authorization: Bearer mp-xxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{"model": "deepseek-v4", "messages": [{"role": "user", "content": "Hello"}]}'`,
    outputLines: [
      'HTTP/2 200 OK',
      'content-type: application/json',
      'x-morphic-latency: 142ms',
      '{"id":"chatcmpl-9x","choices":[{"message":{"role":"assistant","content":"Hello! How can I help you?"}}]}',
    ],
    rawSnippet: `curl https://api.morphic.sh/v1/chat/completions \\
  -H "Authorization: Bearer mp-xxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{"model": "deepseek-v4", "messages": [{"role": "user", "content": "Hello"}]}'`,
  },
};

export default function MagicTerminal({
  typeSpeed = 28,
  startDelay = 400,
  loopDelay = 2400,
  outputLineDelay = 170,
}: MagicTerminalProps = {}) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabKey>('curl');
  const [copied, setCopied] = useState(false);
  const [typedCount, setTypedCount] = useState(0);
  const [visibleLines, setVisibleLines] = useState(0);

  const snippet = TERMINAL_SNIPPETS[activeTab];
  const command = snippet.command;
  const outputLines = snippet.outputLines;

  // Looping typing animation: type command -> reveal output lines -> hold -> reset -> repeat
  useEffect(() => {
    let cancelled = false;
    let id = 0;

    const later = (fn: () => void, delay: number) => {
      id = window.setTimeout(fn, delay);
    };

    function revealOutputs(n: number) {
      if (cancelled) return;
      setVisibleLines(n);
      if (n < outputLines.length) {
        later(() => revealOutputs(n + 1), outputLineDelay);
      } else {
        later(() => {
          if (cancelled) return;
          setTypedCount(0);
          setVisibleLines(0);
          later(() => typeFrom(1), typeSpeed);
        }, loopDelay);
      }
    }

    function typeFrom(n: number) {
      if (cancelled) return;
      setTypedCount(n);
      if (n < command.length) {
        later(() => typeFrom(n + 1), typeSpeed);
      } else {
        later(() => revealOutputs(1), outputLineDelay);
      }
    }

    later(() => typeFrom(1), startDelay);

    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [command, outputLines, typeSpeed, startDelay, loopDelay, outputLineDelay]);

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    setTypedCount(0);
    setVisibleLines(0);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(snippet.rawSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const reduced = useReducedMotionSafe();

  return (
    <section id="terminal" className="relative z-10 py-14 lg:py-20 px-6 bg-white text-neutral-900 border-t border-neutral-200/70 scroll-mt-20 sm:scroll-mt-24">
      <div className="max-w-6xl mx-auto grid lg:grid-cols-[0.9fr_1.1fr] gap-10 lg:gap-14 items-center">
        {/* Left Column: Editorial Value Proposition */}
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 14, filter: 'blur(4px)' }}
          whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-start"
        >
          <div className="text-xs sm:text-sm font-mono uppercase tracking-[0.2em] text-neutral-400 font-bold mb-3">
            {t.terminal.badge}
          </div>

          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-heading font-extrabold tracking-tight mb-4 text-neutral-950">
            {t.terminal.title}
          </h2>

          <p className="text-neutral-600 font-body text-base sm:text-lg leading-relaxed mb-8 max-w-lg">
            {t.terminal.desc}
          </p>

          {/* Feature Pills */}
          <div className="flex flex-wrap gap-2.5">
            {t.terminal.pills.map((pill) => (
              <span
                key={pill}
                className="px-3.5 py-1.5 rounded-full border border-neutral-200 bg-neutral-50 text-neutral-800 font-mono text-xs tracking-wide font-bold shadow-2xs"
              >
                {pill}
              </span>
            ))}
          </div>
        </motion.div>

        {/* Right Column: Interactive Terminal Mockup */}
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 16, filter: 'blur(4px)' }}
          whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.55, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="relative group w-full"
        >
          <div className="relative bg-white border border-neutral-200 rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.04)] hover:shadow-[0_16px_40px_-18px_rgba(9,9,11,0.2)] hover:border-neutral-300 transition-all duration-300 overflow-hidden">
            {/* Terminal Header - Tabs */}
            <div className="bg-neutral-100/80 border-b border-neutral-200/80 px-4 pt-3 flex items-center justify-between">
              <div className="flex space-x-1 overflow-x-auto no-scrollbar">
                {(Object.keys(TERMINAL_SNIPPETS) as TabKey[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => handleTabChange(key)}
                    className={`px-3.5 py-2 text-[11px] font-mono font-bold rounded-t-lg transition-all whitespace-nowrap cursor-pointer ${
                      activeTab === key
                        ? 'bg-neutral-900 text-white shadow-sm'
                        : 'text-neutral-500 hover:text-neutral-800'
                    }`}
                  >
                    {TERMINAL_SNIPPETS[key].label}
                  </button>
                ))}
              </div>

              {/* Terminal Traffic Light Controls */}
              <div className="hidden sm:flex items-center space-x-1.5 pb-2 pl-3 shrink-0">
                <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56] border border-[#e0443e]/50 shadow-2xs" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e] border border-[#dea123]/50 shadow-2xs" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f] border border-[#1aab29]/50 shadow-2xs" />
              </div>
            </div>

            {/* File Name Title Bar */}
            <div className="bg-white border-b border-neutral-200/80 px-4 py-2 flex items-center justify-between">
              <div className="flex items-center gap-2 text-neutral-600">
                <TerminalIcon className="h-3.5 w-3.5 text-neutral-500" />
                <span className="text-[11px] font-mono font-medium">{snippet.file}</span>
              </div>

              <button
                onClick={handleCopy}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold border transition-all cursor-pointer ${
                  copied
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : 'border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
                }`}
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                <span>{copied ? t.terminal.copied : t.terminal.copy}</span>
              </button>
            </div>

            {/* Terminal Body - Light Surface */}
            <div className="bg-neutral-50 p-4 sm:p-5">
              {/* Typing command */}
              <div className="font-mono text-xs sm:text-[13px] leading-relaxed mb-4 min-h-[100px]">
                <span className="text-emerald-600 select-none">$ </span>
                <span className="text-neutral-800 font-semibold whitespace-pre-wrap break-words">
                  {command.slice(0, typedCount)}
                </span>
                <span className="inline-block w-[7px] h-[15px] bg-neutral-800/80 align-middle ml-0.5 animate-pulse" />
              </div>

              {/* Animated Output Lines */}
              <div className="space-y-1.5 min-h-[100px]">
                {outputLines.slice(0, visibleLines).map((line, idx) => (
                  <div
                    key={idx}
                    className="animate-in fade-in slide-in-from-bottom-1 duration-150 flex items-start gap-2"
                  >
                    <span className="text-neutral-300 text-[11px] select-none shrink-0">{idx + 1}</span>
                    <span
                      className={
                        line.startsWith('✔')
                          ? 'text-emerald-600'
                          : line.startsWith('<<<')
                            ? 'text-neutral-800 font-semibold'
                            : line.startsWith('>>>')
                              ? 'text-neutral-400'
                              : 'text-neutral-600'
                      }
                    >
                      {line}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
