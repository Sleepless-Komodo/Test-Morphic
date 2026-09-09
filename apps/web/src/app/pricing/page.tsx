import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import Navbar from '@/components/Navbar';
import PricingPlans from '@/components/PricingPlans';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Pricing — Morphic AI Gateway',
  description:
    'Harga paket kredit Morphic mulai Rp 15.000 tanpa langganan mengikat. Pass harian mulai Rp 1.000/hari, pembayaran instan via QRIS.',
};

export default async function PricingPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  return (
    <main className="min-h-screen bg-[#fafafa] text-neutral-900 selection:bg-neutral-900 selection:text-white flex flex-col justify-between overflow-x-hidden">
      <Navbar session={session} />
      <PricingPlans isLoggedIn={!!session} />
      <Footer />
    </main>
  );
}
