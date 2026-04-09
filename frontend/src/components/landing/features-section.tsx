import Image from "next/image";
import Link from "next/link";

import { featureCards } from "@/features/landing/data";
import type { FeatureCard } from "@/features/landing/types";

import { ArrowRight } from "./icons";

export function FeaturesSection() {
  return (
    <section className="bg-[#EEF1F3] px-5 py-24 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[1280px]">
        <div className="mb-14">
          <h2 className="font-[family-name:var(--font-space-grotesk)] text-[42px] tracking-[-0.06em] text-[#1f2430] sm:text-[44px]">
            Elevate Your Fest Experience
          </h2>
          <p className="mt-2 text-[15px] text-[#8a92a1]">
            Four ways the portal transforms your participation.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <FeatureTile card={featureCards[0]} />
          </div>

          {featureCards.slice(1, 3).map((card) => (
            <FeatureTile key={card.title} card={card} />
          ))}

          <div className="lg:col-span-2">
            <FeatureTile card={featureCards[3]} />
          </div>
        </div>
      </div>
    </section>
  );
}

function FeatureTile({ card }: { card: FeatureCard }) {
  if (card.tone === "purple") {
    return (
      <div className="relative overflow-hidden rounded-[8px] bg-[linear-gradient(180deg,#5447e8_0%,#4c40e0_100%)] p-7 text-white shadow-[0_12px_30px_rgba(76,64,224,0.34)] min-h-[184px]">
        <Image
          src={card.iconSrc}
          alt=""
          aria-hidden="true"
          width={190}
          height={190}
          className="pointer-events-none absolute -right-4 top-2 h-36 w-36 opacity-35"
        />
        <div className="relative flex h-full flex-col justify-between">
          <div>
            <h3 className="text-[18px] font-medium tracking-[-0.03em]">
              {card.title}
            </h3>
            <p className="mt-2 max-w-[470px] text-[15px] leading-[1.55] text-white/82">
              {card.description}
            </p>
          </div>
          <Link
            href="#verification"
            className="mt-7 inline-flex h-9 w-fit items-center gap-2 rounded-full bg-white px-4 text-[13px] font-semibold text-[#4f45e0] shadow-[0_8px_18px_rgba(255,255,255,0.15)]"
          >
            View All Perks <ArrowRight />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[184px] rounded-[8px] bg-white p-7 shadow-[0_10px_30px_rgba(72,84,106,0.08)]">
      <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#e6e9fb] text-[#5d57ec]">
        <Image
          src={card.iconSrc}
          alt="Feature icon"
          width={20}
          height={20}
          className="h-5 w-5"
        />
      </div>
      <h3 className="mt-7 text-[18px] font-medium tracking-[-0.03em] text-[#323846]">
        {card.title}
      </h3>
      <p className="mt-3 max-w-[340px] text-[15px] leading-[1.55] text-[#8d93a2]">
        {card.description}
      </p>
    </div>
  );
}
