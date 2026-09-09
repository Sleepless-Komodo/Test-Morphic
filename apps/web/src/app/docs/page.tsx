import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { BookOpen } from 'lucide-react';

export const metadata = {
  title: 'Docs — Morphic AI Gateway',
  description: 'Dokumentasi penggunaan Morphic AI Gateway: setup API key, integrasi IDE, dan referensi endpoint OpenAI-compatible.',
};

export default async function DocsPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  return (
    <main className="min-h-screen bg-[#fafafa] text-neutral-900 selection:bg-neutral-900 selection:text-white flex flex-col justify-between overflow-x-hidden">
      <Navbar session={session} />
      <section className="relative z-10 pt-32 pb-24 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="w-12 h-12 rounded-2xl bg-neutral-100 border border-neutral-200 flex items-center justify-center text-neutral-950 mx-auto mb-4 shadow-sm">
            <BookOpen className="h-6 w-6" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-heading font-extrabold tracking-tight text-neutral-950 mb-3">
            Dokumentasi
          </h1>
          <p className="text-neutral-600 text-sm sm:text-base max-w-xl mx-auto">
            Dokumentasi sedang disiapkan. Segera hadir panduan setup API key, integrasi IDE, dan referensi endpoint.
          </p>
        </div>
      </section>
      <Footer />
    </main>
  );
}
