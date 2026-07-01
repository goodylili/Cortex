import { Hero } from "@/components/landing/hero";
import { ProblemSection } from "@/components/landing/problem-section";
import { SolutionSection } from "@/components/landing/solution-section";
import { SuiStackSection } from "@/components/landing/sui-stack-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { ComparisonSection } from "@/components/landing/comparison-section";
import { TestimonialsSection } from "@/components/landing/testimonials-section";
import { FaqSection } from "@/components/landing/faq-section";
import { CtaSection } from "@/components/landing/cta-section";
import { Footer } from "@/components/landing/footer";
import { MarqueeBand } from "@/components/landing/marquee-band";
import { LandingThemeProvider } from "@/components/landing/theme-provider";
export default function Home() {
  return (
    <LandingThemeProvider>
      <div className="pointer-events-none fixed inset-0 z-50 hidden md:block">
        <div className="mx-auto h-full max-w-7xl">
          <div className="relative h-full">
            <div className="absolute left-0 top-0 h-full w-px bg-ink/5" />
            <div className="absolute right-0 top-0 h-full w-px bg-ink/5" />
          </div>
        </div>
      </div>

      <main>
        <Hero />
        <ProblemSection />
        <SolutionSection />
        <FeaturesSection />
        <ComparisonSection />
        <TestimonialsSection />
        <SuiStackSection />
        <FaqSection />
        <CtaSection />
      </main>

      <Footer />
      <MarqueeBand />
    </LandingThemeProvider>
  );
}
