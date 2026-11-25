export const dynamic = 'force-dynamic';

import { headers } from 'next/headers';
import { getSessionSafe } from '@/lib/auth';
import { loadPublicPackages } from '@/lib/public-packages';
import Navbar from '@/components/Navbar';
import PricingPlans from '@/components/PricingPlans';
import PricingCalculator from '@/components/PricingCalculator';
import PricingComparisonTable from '@/components/PricingComparisonTable';
import PricingFaq from '@/components/PricingFaq';
import ClosingKey from '@/components/ClosingKey';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Paket & Harga Kredit | Morphic AI Gateway',
  description:
    'Paket saldo, token pack, dan pass unlimited Morphic AI gateway. Tanpa langganan, bayar dengan QRIS dalam Rupiah atau PayPal dalam USD.',
};

export default async function PricingPage() {
  let session = null;
  try {
    session = await getSessionSafe(await headers());
  } catch (err) {
    console.warn('[PricingPage] Session check failed, rendering as guest:', err);
  }
  const packages = await loadPublicPackages().catch((err) => {
    console.warn('[PricingPage] Package catalogue read failed:', err);
    return [];
  });

  return (
    <main className="min-h-screen bg-[#fafafa] text-neutral-900 selection:bg-neutral-900 selection:text-white relative flex flex-col justify-between overflow-x-clip">
      {/* 1. Floating Navbar */}
      <Navbar session={session} />

      {/* 2. Core Pricing Tiers & Daily Passes */}
      <PricingPlans packages={packages} isLoggedIn={!!session} showPricingHubLink={false} />

      {/* 3. Interactive Token Savings Calculator */}
      <PricingCalculator />

      {/* 4. Comprehensive Feature Comparison Matrix */}
      <PricingComparisonTable packages={packages} isLoggedIn={!!session} />

      {/* 5. Dedicated Billing & Payment FAQ */}
      <PricingFaq />

      {/* 6. Closing: every model into one key */}
      <ClosingKey />

      {/* 7. Horizon Deck Footer */}
      <Footer />
    </main>
  );
}
