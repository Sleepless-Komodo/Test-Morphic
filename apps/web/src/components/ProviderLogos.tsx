'use client';

import React from 'react';

interface LogoProps {
  className?: string;
}

// Anthropic geometric mark
export function ClaudeLogo({ className = 'w-4 h-4' }: LogoProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M13.8 4.5L18.5 19.5H15.8L14.7 15.8H9.3L8.2 19.5H5.5L10.2 4.5H13.8ZM10.1 13.5H13.9L12 7.2L10.1 13.5Z"
        fill="#CC785C"
      />
    </svg>
  );
}

// OpenAI authentic spiral knot
export function OpenAILogo({ className = 'w-4 h-4' }: LogoProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M19.4 10.3c-.2-1.3-.9-2.3-2-2.9-.4-.2-.8-.4-1.3-.4-.2-.5-.5-.9-.9-1.3-1.1-.9-2.6-1.2-4-.8-.4-.6-1-1-1.7-1.3-1.5-.6-3.2-.3-4.4.7-.8.7-1.3 1.6-1.5 2.6-1.2.3-2.2 1.1-2.7 2.2-.7 1.4-.6 3.1.2 4.4.2 1.3.9 2.3 2 2.9.4.2.8.4 1.3.4.2.5.5.9.9 1.3 1.1.9 2.6 1.2 4 .8.4.6 1 1 1.7 1.3 1.5.6 3.2.3 4.4-.7.8-.7 1.3-1.6 1.5-2.6 1.2-.3 2.2-1.1 2.7-2.2.7-1.4.6-3.1-.2-4.3zm-6.9 7.7v-2.7l2.3-1.3c.4-.2.8-.2 1.2 0 .5.3.8.8.8 1.4v.2c0 .9-.5 1.8-1.3 2.2l-3 1.7v-1.5zm-5-1.4l2.3-1.3 2.3 1.3v2.7l-3-1.7c-.8-.4-1.3-1.3-1.3-2.2v-.2c0-.6.3-1.1.8-1.4.4-.2.8-.2 1.2 0zm-1.5-4.6c0-.6.3-1.1.8-1.4l2.3-1.3v2.7l-2.3 1.3c-.4.2-.8.2-1.2 0-.5-.3-.8-.8-.8-1.3h.2zm8-4.6l-2.3 1.3-2.3-1.3v-2.7l3 1.7c.8.4 1.3 1.3 1.3 2.2v.2c0 .6-.3 1.1-.8 1.4-.4.2-.8.2-1.2 0zm3.5 3.3c0 .6-.3 1.1-.8 1.4l-2.3 1.3v-2.7l2.3-1.3c.4-.2.8-.2 1.2 0 .5.3.8.8.8 1.3h-.2z"
        fill="#10A37F"
      />
    </svg>
  );
}

// DeepSeek dolphin mark
export function DeepSeekLogo({ className = 'w-4 h-4' }: LogoProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M5 14C5 9.5 8.5 6 13 6C17.5 6 20 9.5 20 12C20 14.5 18 17 15 17C12.5 17 11.5 15.5 10 15.5C8.5 15.5 7.5 17 5 17V14Z"
        fill="#1D4ED8"
      />
      <circle cx="9" cy="10" r="1.2" fill="white" />
      <path d="M14 6C15 4 17 3.5 18 3.5" stroke="#1D4ED8" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

// Alibaba Cloud / Qwen mark
export function QwenLogo({ className = 'w-4 h-4' }: LogoProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="12,3 19,7 19,17 12,21 5,17 5,7" stroke="#6366F1" strokeWidth="2" strokeLinejoin="round" />
      <polygon points="12,7 16,9.5 16,14.5 12,17 8,14.5 8,9.5" fill="#6366F1" />
    </svg>
  );
}

// Moonshot AI / Kimi mark
export function KimiLogo({ className = 'w-4 h-4' }: LogoProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="7.5" stroke="#0284C7" strokeWidth="2" />
      <path d="M12 4.5C14.5 7 16 9.5 16 12C16 14.5 14.5 17 12 19.5" stroke="#0284C7" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="12" r="2.5" fill="#0284C7" />
    </svg>
  );
}

// Zhipu GLM mark
export function ZhipuLogo({ className = 'w-4 h-4' }: LogoProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M6 7H18L10 17H18"
        stroke="#7C3AED"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="6" cy="7" r="1.5" fill="#7C3AED" />
      <circle cx="18" cy="17" r="1.5" fill="#7C3AED" />
    </svg>
  );
}

// 01.AI / Yi mark
export function YiLogo({ className = 'w-4 h-4' }: LogoProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8.5" cy="12" r="4.5" stroke="#D97706" strokeWidth="2" />
      <path d="M15.5 7.5V16.5" stroke="#D97706" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function ModelProviderLogo({ provider, className = 'w-4 h-4' }: { provider: string; className?: string }) {
  const p = provider.toLowerCase();
  if (p.includes('claude') || p.includes('anthropic')) {
    return <ClaudeLogo className={className} />;
  }
  if (p.includes('openai') || p.includes('gpt')) {
    return <OpenAILogo className={className} />;
  }
  if (p.includes('deepseek')) {
    return <DeepSeekLogo className={className} />;
  }
  if (p.includes('qwen') || p.includes('alibaba')) {
    return <QwenLogo className={className} />;
  }
  if (p.includes('kimi') || p.includes('moonshot')) {
    return <KimiLogo className={className} />;
  }
  if (p.includes('zhipu') || p.includes('glm')) {
    return <ZhipuLogo className={className} />;
  }
  if (p.includes('01.ai') || p.includes('yi')) {
    return <YiLogo className={className} />;
  }
  return <DeepSeekLogo className={className} />;
}
