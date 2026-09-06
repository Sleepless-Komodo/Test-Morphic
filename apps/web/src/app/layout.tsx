import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Morphic — Unified AI Infrastructure',
  description: 'One API to access multiple AI models, with unified billing.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
