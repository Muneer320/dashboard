import Image from "next/image";
import Link from "next/link";

import { eventCards } from "@/features/landing/data";
import type { EventCard } from "@/features/landing/types";

import { ArrowRight, LockIcon } from "./icons";

export function EventsPreviewSection() {
  return (
    <section id="events" className="bg-[#F5F7F9] px-5 py-24 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[1280px]">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-[family-name:var(--font-space-grotesk)] text-[32px] font-semibold tracking-[-0.06em] text-[#1f2430] sm:text-[38px]">
              Locked Event Preview
            </h2>
            <p className="mt-2 text-[14px] text-[#8a92a1]">
              Get verified to register for these student-exclusive sessions.
            </p>
          </div>

          <Link
            href="#faq"
            className="hidden items-center gap-2 whitespace-nowrap text-[14px] font-semibold text-[#5145e0] sm:inline-flex"
          >
            Browse More <ArrowRight className="h-4 w-4 text-[#5145e0]" />
          </Link>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {eventCards.map((event) => (
            <EventPreviewCard key={event.title} event={event} />
          ))}
        </div>
      </div>
    </section>
  );
}

function EventPreviewCard({ event }: { event: EventCard }) {
  return (
    <article className="overflow-hidden rounded-[8px] bg-transparent">
      <div className="relative aspect-[0.74/1] overflow-hidden rounded-[8px] shadow-[0_10px_24px_rgba(10,14,20,0.18)]">
        <Image
          src={event.imageSrc}
          alt={event.title}
          fill
          className="object-cover blur-[1.2px]"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,8,12,0.16),rgba(3,6,9,0.54))]" />
        <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full border border-white/12 bg-white/10 px-4 py-1.5 text-[10px] font-semibold text-white/78 backdrop-blur-sm">
          <LockIcon className="h-3.5 w-3.5 text-white/76" />
          Student Only
        </div>
      </div>

      <div className="px-1 pt-4">
        <h3 className="text-[18px] font-medium tracking-[-0.03em] text-[#222835]">
          {event.title}
        </h3>
        <p className="mt-1 text-[12px] text-[#7f8797]">{event.date}</p>
      </div>
    </article>
  );
}
