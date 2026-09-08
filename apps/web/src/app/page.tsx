import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import Navbar from '@/components/Navbar';
import HeroOpening from '@/components/HeroOpening';
import HowItWorksSteps from '@/components/HowItWorksSteps';
import MagicTerminal from '@/components/MagicTerminal';
import ModelCatalogTeaser from '@/components/ModelCatalogTeaser';
import LandingApiCta from '@/components/LandingApiCta';
import MarketingFaq from '@/components/MarketingFaq';
import Footer from '@/components/Footer';

export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() });

  return (
    <main className="min-h-screen bg-[#fafafa] text-neutral-900 selection:bg-neutral-900 selection:text-white relative flex flex-col justify-between overflow-x-hidden">
      {/* 1. Capsule Floating Navbar */}
      <Navbar session={session} />

      {/* 2. Focused Hero Section */}
      <HeroOpening isLoggedIn={!!session} />

      {/* 3. 4 Langkah Mudah Menggunakan API Key AI (Integrasi IDE) */}
      <HowItWorksSteps isLoggedIn={!!session} />

      {/* 4. Interactive Multi-IDE Terminal (Separate Section) */}
      <MagicTerminal />

      {/* 5. Small Curated Model Showcase */}
      <ModelCatalogTeaser isLoggedIn={!!session} />

      {/* 5. Direct API Key CTA Area */}
      <LandingApiCta isLoggedIn={!!session} />

      {/* 6. Minimal FAQ */}
      <MarketingFaq />

      {/* 7. Footer with Morphic Interactive Hover Effect */}
      <Footer />
    </main>
  );
}
