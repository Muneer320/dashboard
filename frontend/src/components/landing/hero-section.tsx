import Image from "next/image";
import Link from "next/link";

import { SiteHeader } from "@/components/layout";

import { LockIcon } from "./icons";

export function HeroSection() {
  return (
    <section className="bg-[#F5F7F9] px-5 pb-24 pt-6 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[1280px]">
        <SiteHeader />

        <div
          id="hero"
          className="grid items-center gap-12 lg:grid-cols-[1.02fr_0.98fr] lg:gap-14"
        >
          <div className="max-w-[640px]">
            <div className="mb-6 inline-flex items-center rounded-full bg-[#dbe3f4] px-3 py-1.5 text-[10px] font-black tracking-[0.26em] text-[#5b657b] shadow-[0_1px_0_rgba(255,255,255,0.7)]">
              EXCLUSIVELY FOR STUDENTS
            </div>

            <h1 className="max-w-[620px] font-[family-name:var(--font-space-grotesk)] text-[72px] font-normal leading-[72px] tracking-[-1.8px] text-[#1f2430]">
              Student Access Portal
            </h1>

            <p className="mt-6 max-w-[560px] text-[18px] leading-[1.38] text-[#7e8595] sm:text-[20px]">
              Unlock tech fest events, submissions, dashboard, and exclusive
              access tailored for the next generation of innovators.
            </p>

            <div className="mt-8 flex flex-wrap gap-3.5">
              <Link
                href="/auth-choice"
                className="inline-flex h-11 items-center justify-center rounded-full bg-[linear-gradient(180deg,#5f55ee_0%,#4f45e0_100%)] px-6 text-[14px] font-semibold text-white shadow-[0_10px_24px_rgba(79,69,224,0.35)] transition-transform duration-200 hover:-translate-y-0.5"
              >
                Get Access
              </Link>
              <Link
                href="/login"
                className="inline-flex h-11 items-center justify-center rounded-full bg-[#e3e5ea] px-6 text-[14px] font-semibold text-[#555b68] shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] transition-transform duration-200 hover:-translate-y-0.5"
              >
                Log In
              </Link>
            </div>
          </div>

          <ShowcaseArtwork />
        </div>
      </div>
    </section>
  );
}

function ShowcaseArtwork() {
  return (
    <div className="relative mx-auto w-full max-w-[610px]">
      <div className="absolute -inset-5 rounded-[36px] bg-[radial-gradient(circle_at_50%_50%,rgba(120,118,255,0.18),transparent_62%)] blur-2xl" />
      <div className="relative rotate-[1.2deg] rounded-[18px] border-[10px] border-white bg-white shadow-[0_28px_72px_rgba(116,124,141,0.22)]">
        <div className="relative aspect-[1.35/1] overflow-hidden rounded-[8px] bg-[#0f141b]">
          <Image
            src="/images/hero/tech-fest-atmosphere.svg"
            alt="TechFest atmosphere"
            fill
            priority
            className="object-cover"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,10,13,0.2),rgba(4,10,13,0.45))]" />

          <div className="absolute right-5 top-5 inline-flex h-9 w-9 items-center justify-center rounded-[10px] bg-[linear-gradient(180deg,#6156ef_0%,#4e44e0_100%)] text-white shadow-[0_10px_20px_rgba(79,69,224,0.45)]">
            <LockIcon />
          </div>

          <div className="absolute left-7 top-10 h-20 w-20 rounded-full bg-[#20e0db]/8 blur-2xl" />
          <div className="absolute right-14 bottom-12 h-24 w-24 rounded-full bg-[#20e0db]/10 blur-2xl" />
        </div>
      </div>
    </div>
  );
}
