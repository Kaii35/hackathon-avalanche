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
import { WelcomePreSplash } from '@/components/welcome/WelcomePreSplash';
import { WelcomeSplashMount } from '@/components/welcome/WelcomeSplashMount';

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* PreSplash is a server component — its <div id="arca-pre-splash">
          is in the initial SSR HTML, so it paints BEFORE any JS runs and
          hides the landing during the few seconds it takes to load the
          animated splash chunk. The animated splash mounts on top and then
          fades both away together at the end of the 4-second welcome.
          For SPA navigation, WelcomeSplash removes it synchronously in
          useLayoutEffect before the browser ever paints it. */}
      <WelcomePreSplash />
      <WelcomeSplashMount />
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
