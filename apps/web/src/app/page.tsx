export const dynamic = 'force-dynamic';

import { getSessionSafe } from '@/lib/auth';
import { headers } from 'next/headers';
import Navbar from '@/components/Navbar';
import HeroOpening from '@/components/HeroOpening';
import HowItWorksSteps from '@/components/HowItWorksSteps';
import FeatureShowcase from '@/components/FeatureShowcase';
import PricingPlans from '@/components/PricingPlans';
import MarketingFaq from '@/components/MarketingFaq';
import ClosingKey from '@/components/ClosingKey';
import Footer from '@/components/Footer';

export default async function Home() {
  let session = null;
  try {
    session = await getSessionSafe(await headers());
  } catch (err) {
    console.warn('[Home] Session check failed, rendering as guest:', err);
  }

  return (
    <main className="min-h-screen bg-[#fafafa] text-neutral-900 selection:bg-neutral-900 selection:text-white relative flex flex-col justify-between overflow-x-clip">
      {/* 1. Capsule Floating Navbar */}
      <Navbar session={session} />

      {/* 2. Focused Hero Section */}
      <HeroOpening isLoggedIn={!!session} />

      {/* 3. 4 Langkah Mudah Menggunakan API Key AI (Integrasi IDE) */}
      <HowItWorksSteps />

      {/* 3.5 Asymmetric Image Showcase — visual breathing room */}
      <FeatureShowcase />

      {/* 5.5 Transparent Pricing & Token Packs */}
      <PricingPlans isLoggedIn={!!session} />

      {/* 6. Editorial FAQ with Sticky Header */}
      <MarketingFaq />

      {/* 7. Closing: every model into one key */}
      <ClosingKey />

      {/* 8. Footer with Submerged Wireframe Morphic Horizon */}
      <Footer />
    </main>
  );
}
