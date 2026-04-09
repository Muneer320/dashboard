import {
  EventsPreviewSection,
  FaqStripSection,
  FeaturesSection,
  HeroSection,
  SiteFooter,
  VerificationSection,
} from "@/components/landing";

export default function Home() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#F5F7F9] text-slate-900">
      <HeroSection />
      <FeaturesSection />
      <VerificationSection />
      <EventsPreviewSection />
      <FaqStripSection />
      <SiteFooter />
    </main>
  );
}
