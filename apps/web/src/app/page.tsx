import { MarketingNav } from '@/components/landing/MarketingNav';
import { Hero } from '@/components/landing/Hero';
import { StatsStrip } from '@/components/landing/StatsStrip';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { Audiences } from '@/components/landing/Audiences';
import { Architecture } from '@/components/landing/Architecture';
import { Compliance } from '@/components/landing/Compliance';
import { CtaBackgroundPaths } from '@/components/landing/CtaBackgroundPaths';
import { Faq } from '@/components/landing/Faq';
import { Footer } from '@/components/landing/Footer';

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <MarketingNav />
      <Hero />
      <StatsStrip />
      <HowItWorks />
      <Audiences />
      <Architecture />
      <Compliance />
      <CtaBackgroundPaths />
      <Faq />
      <Footer />
    </div>
  );
}
