import Link from "next/link";

type FeatureCard = {
  title: string;
  description: string;
  tone: "light" | "purple";
  span?: string;
};

type EventCard = {
  title: string;
  date: string;
  imageTone: string;
};

const featureCards: FeatureCard[] = [
  {
    title: "Explore events",
    description:
      "Discover hidden workshops, late-night hackathons, and networking mixers exclusively for student pass holders.",
    tone: "light",
  },
  {
    title: "Submit entries",
    description:
      "Seamless project uploads for competitions and talent showcases.",
    tone: "light",
  },
  {
    title: "Track activity",
    description:
      "Real-time stats on your leaderboard position and schedule updates.",
    tone: "light",
  },
  {
    title: "Access perks",
    description:
      "Unlock student-only discounts, early access to limited workshops, and digital swag kits that never expire.",
    tone: "purple",
  },
];

const eventCards: EventCard[] = [
  {
    title: "Cyber Defense Cup",
    date: "March 14 • 10:00 AM",
    imageTone: "from-slate-950 via-slate-900 to-slate-800",
  },
  {
    title: "AI & Future Tech",
    date: "March 14 • 02:00 PM",
    imageTone: "from-slate-950 via-slate-950 to-slate-900",
  },
  {
    title: "E-Sports Invitational",
    date: "March 15 • 11:00 AM",
    imageTone: "from-slate-900 via-slate-950 to-slate-900",
  },
  {
    title: "Design Sprint 2.0",
    date: "March 16 • 09:00 AM",
    imageTone: "from-slate-950 via-slate-900 to-slate-950",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f4f6f9] text-slate-900">
      <HeroSection />
      <FeaturesSection />
      <VerificationSection />
      <EventsPreviewSection />
      <FaqSection />
      <SiteFooter />
    </main>
  );
}

function HeroSection() {
  return (
    <section className="bg-[linear-gradient(180deg,#f7f8fb_0%,#eff2f6_100%)] px-5 pb-24 pt-6 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[1280px]">
        <header className="grid items-center gap-5 px-1 pb-16 sm:grid-cols-[1fr_auto_1fr] sm:pb-20">
          <div className="flex items-center justify-start">
            <Link
              href="#hero"
              className="text-[18px] font-extrabold tracking-[-0.05em] text-slate-900"
            >
              TechFest
            </Link>
          </div>

          <nav className="hidden items-center justify-center gap-10 text-[13px] font-medium text-slate-500 sm:flex">
            <Link
              href="#events"
              className="transition-colors hover:text-slate-900"
            >
              Events
            </Link>
            <Link
              href="#schedule"
              className="transition-colors hover:text-slate-900"
            >
              Schedule
            </Link>
            <Link
              href="#faq"
              className="transition-colors hover:text-slate-900"
            >
              FAQ
            </Link>
          </nav>

          <div className="flex justify-start sm:justify-end">
            <Link
              href="#verification"
              className="inline-flex h-10 items-center justify-center rounded-full bg-[linear-gradient(180deg,#5f55ee_0%,#4f45e0_100%)] px-6 text-[14px] font-semibold text-white shadow-[0_8px_22px_rgba(79,69,224,0.35)] transition-transform duration-200 hover:-translate-y-0.5"
            >
              Get Access
            </Link>
          </div>
        </header>

        <div
          id="hero"
          className="grid items-center gap-12 lg:grid-cols-[1.02fr_0.98fr] lg:gap-14"
        >
          <div className="max-w-[640px]">
            <div className="mb-6 inline-flex items-center rounded-full bg-[#dbe3f4] px-3 py-1.5 text-[10px] font-black tracking-[0.26em] text-[#5b657b] shadow-[0_1px_0_rgba(255,255,255,0.7)]">
              EXCLUSIVELY FOR STUDENTS
            </div>

            <h1 className="max-w-[620px] font-[family-name:var(--font-space-grotesk)] text-[60px] leading-[0.94] tracking-[-0.08em] text-[#1f2430] sm:text-[72px] lg:text-[82px]">
              Student Access Portal
            </h1>

            <p className="mt-6 max-w-[560px] text-[18px] leading-[1.38] text-[#7e8595] sm:text-[20px]">
              Unlock tech fest events, submissions, dashboard, and exclusive
              access tailored for the next generation of innovators.
            </p>

            <div className="mt-8 flex flex-wrap gap-3.5">
              <Link
                href="#verification"
                className="inline-flex h-11 items-center justify-center rounded-full bg-[linear-gradient(180deg,#5f55ee_0%,#4f45e0_100%)] px-6 text-[14px] font-semibold text-white shadow-[0_10px_24px_rgba(79,69,224,0.35)] transition-transform duration-200 hover:-translate-y-0.5"
              >
                Get Access
              </Link>
              <Link
                href="#events"
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
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(77,218,219,0.12),transparent_38%),radial-gradient(circle_at_bottom,rgba(71,145,146,0.16),transparent_55%)]" />
          <div className="absolute inset-0 opacity-[0.28] [background-image:linear-gradient(rgba(95,236,230,0.13)_1px,transparent_1px),linear-gradient(90deg,rgba(95,236,230,0.13)_1px,transparent_1px)] [background-size:46px_46px]" />

          <div className="absolute left-1/2 top-[40%] w-[41%] -translate-x-1/2 -translate-y-1/2 rounded-[12px] border border-[#16b0b1]/35 bg-[linear-gradient(180deg,#202a31_0%,#132022_100%)] px-4 py-3 shadow-[0_14px_30px_rgba(0,0,0,0.3)]">
            <div className="rounded-[10px] border border-[#1be2dd]/35 bg-[linear-gradient(180deg,rgba(25,74,80,0.85)_0%,rgba(8,22,25,0.95)_100%)] px-4 py-5 text-center shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]">
              <div className="font-[family-name:var(--font-space-grotesk)] text-[26px] font-semibold leading-[0.9] tracking-[-0.08em] text-[#dff9f8]">
                TECH
                <br />
                FEST
              </div>
              <div className="mt-2 text-[8px] font-semibold tracking-[0.36em] text-[#66d9d6]">
                FOR EXCLUSIVE USE
              </div>
            </div>
          </div>

          <div className="absolute bottom-[17%] left-1/2 -translate-x-1/2 text-center text-[31px] font-medium tracking-[-0.06em] text-[#34c8c1]/75">
            SAFE FOR WORK
          </div>

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

function FeaturesSection() {
  return (
    <section className="bg-[#edf1f5] px-5 py-24 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[1280px]">
        <div className="mb-14">
          <h2 className="font-[family-name:var(--font-space-grotesk)] text-[42px] tracking-[-0.06em] text-[#1f2430] sm:text-[44px]">
            Elevate Your Fest Experience
          </h2>
          <p className="mt-2 text-[15px] text-[#8a92a1]">
            Four ways the portal transforms your participation.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {featureCards.slice(0, 3).map((card, index) => (
            <FeatureTile key={card.title} card={card} index={index} />
          ))}

          <div className="lg:col-span-2">
            <FeatureTile card={featureCards[3]} index={3} />
          </div>
        </div>
      </div>
    </section>
  );
}

function FeatureTile({ card, index }: { card: FeatureCard; index: number }) {
  const icons = [CompassIcon, UploadIcon, StatsIcon, PerksIcon];
  const Icon = icons[index];

  if (card.tone === "purple") {
    return (
      <div className="relative overflow-hidden rounded-[8px] bg-[linear-gradient(180deg,#5447e8_0%,#4c40e0_100%)] p-7 text-white shadow-[0_12px_30px_rgba(76,64,224,0.34)] min-h-[184px]">
        <div className="absolute right-4 top-2 h-28 w-28 rounded-full border border-white/10" />
        <div className="absolute right-10 top-8 h-14 w-14 rounded-full border border-white/10" />
        <div className="relative flex h-full flex-col justify-between">
          <div>
            <div className="mb-6 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/18 text-white/95">
              <Icon />
            </div>
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
        <Icon />
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

function VerificationSection() {
  return (
    <section
      id="verification"
      className="bg-[#edf1f5] px-5 py-24 sm:px-8 lg:px-10"
    >
      <div className="mx-auto max-w-[1280px]">
        <div className="relative overflow-hidden rounded-[14px] bg-[#090b0d] px-6 py-10 text-white shadow-[0_28px_70px_rgba(11,15,20,0.34)] sm:px-8 lg:px-10 lg:py-12">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_30%,rgba(55,211,177,0.11),transparent_32%),radial-gradient(circle_at_76%_22%,rgba(91,104,255,0.08),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.04),transparent_20%)]" />

          <div className="relative grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-8">
            <div className="max-w-[640px]">
              <h2 className="font-[family-name:var(--font-space-grotesk)] text-[42px] tracking-[-0.06em] text-white sm:text-[44px] lg:text-[52px]">
                Student Verification
              </h2>
              <p className="mt-4 max-w-[520px] text-[16px] leading-[1.56] text-white/70 sm:text-[17px]">
                Only college students can access this page. Verify using college
                email or student ID to protect the community and unlock
                exclusive prizes.
              </p>

              <div className="mt-10 flex flex-wrap items-center gap-8 sm:gap-10">
                <VerificationStep icon={<MailIcon />} label="EDU EMAIL" />
                <div className="h-px w-12 bg-white/15 sm:w-16" />
                <VerificationStep icon={<IdIcon />} label="STUDENT ID" />
              </div>
            </div>

            <div className="relative flex justify-center lg:justify-end">
              <div className="w-full max-w-[316px] rounded-[12px] bg-white px-5 py-5 text-slate-900 shadow-[0_16px_28px_rgba(0,0,0,0.24)]">
                <label className="block text-[12px] font-medium text-slate-500">
                  College Email Address
                </label>
                <input
                  type="email"
                  value="archived-1f4b58b58c@example.invalid"
                  readOnly
                  className="mt-2 h-14 w-full rounded-[8px] border-0 bg-[#e8ebee] px-4 text-[15px] text-slate-400 outline-none placeholder:text-slate-400"
                />
                <button className="mt-4 flex h-11 w-full items-center justify-center rounded-full bg-[linear-gradient(180deg,#5f55ee_0%,#4f45e0_100%)] text-[14px] font-semibold text-white shadow-[0_10px_20px_rgba(79,69,224,0.35)]">
                  Verify My Status
                </button>
                <p className="mt-3 text-center text-[9px] font-semibold tracking-[0.32em] text-slate-400">
                  SECURE 256-BIT VERIFICATION
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function VerificationStep({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2b2a7d] text-[#7367ff]">
        {icon}
      </div>
      <span className="text-[9px] font-bold tracking-[0.24em] text-white/68">
        {label}
      </span>
    </div>
  );
}

function EventsPreviewSection() {
  return (
    <section id="events" className="bg-[#edf1f5] px-5 py-24 sm:px-8 lg:px-10">
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
            className="hidden items-center gap-2 text-[14px] font-semibold text-[#5145e0] sm:inline-flex"
          >
            Browse More <ArrowRight className="text-[#5145e0]" />
          </Link>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {eventCards.map((event, index) => (
            <EventPreviewCard key={event.title} event={event} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}

function EventPreviewCard({
  event,
  index,
}: {
  event: EventCard;
  index: number;
}) {
  const thumbVariants = [
    "bg-[radial-gradient(circle_at_25%_25%,rgba(93,129,255,0.26),transparent_20%),linear-gradient(180deg,#15181d_0%,#08090c_100%)]",
    "bg-[radial-gradient(circle_at_50%_35%,rgba(87,91,255,0.18),transparent_28%),linear-gradient(180deg,#101215_0%,#050608_100%)]",
    "bg-[radial-gradient(circle_at_60%_30%,rgba(74,145,255,0.2),transparent_22%),linear-gradient(180deg,#14161a_0%,#07080b_100%)]",
    "bg-[radial-gradient(circle_at_50%_25%,rgba(104,104,104,0.18),transparent_28%),linear-gradient(180deg,#121418_0%,#07080a_100%)]",
  ];

  return (
    <article className="overflow-hidden rounded-[8px] bg-transparent">
      <div
        className={`relative aspect-[0.74/1] overflow-hidden rounded-[8px] ${thumbVariants[index]} shadow-[0_10px_24px_rgba(10,14,20,0.18)]`}
      >
        <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:48px_48px]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(0,0,0,0.36))]" />
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

function FaqSection() {
  const faqs = [
    {
      title: "Why is access restricted?",
      body: "Our sponsors provide exclusive rewards and internship opportunities specifically for verified students. Restriction ensures these benefits reach the intended audience.",
    },
    {
      title: "What counts as student verification?",
      body: "We accept valid .edu email addresses or a high-quality photo of your current institutional ID card showing the academic year.",
    },
    {
      title: "Can I use my college ID?",
      body: "Yes! Simply upload a clear image of your physical ID card in the portal. Our team reviews all manual submissions within 12 hours.",
    },
  ];

  return (
    <section id="faq" className="bg-[#edf1f5] px-5 pb-8 pt-10 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[1280px]">
        <div className="grid gap-10 border-t border-black/5 py-12 sm:grid-cols-2 lg:grid-cols-3">
          {faqs.map((faq) => (
            <article key={faq.title} className="max-w-[340px]">
              <h3 className="text-[17px] font-medium tracking-[-0.03em] text-[#252b37]">
                {faq.title}
              </h3>
              <p className="mt-3 text-[14px] leading-[1.6] text-[#7f8797]">
                {faq.body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="bg-[#edf1f5] px-5 pb-8 sm:px-8 lg:px-10">
      <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 border-t border-black/5 pt-8 text-[13px] text-[#8d94a2]">
        <div className="text-[18px] font-extrabold tracking-[-0.05em] text-[#1f2430]">
          TechFest
        </div>
        <div className="hidden items-center gap-8 sm:flex">
          <Link href="#hero" className="transition-colors hover:text-[#1f2430]">
            Home
          </Link>
          <Link href="#faq" className="transition-colors hover:text-[#1f2430]">
            Terms
          </Link>
          <Link href="#faq" className="transition-colors hover:text-[#1f2430]">
            Privacy
          </Link>
          <Link href="#faq" className="transition-colors hover:text-[#1f2430]">
            Support
          </Link>
        </div>
        <div className="text-right">© 2024 TechFest Curator</div>
      </div>
    </footer>
  );
}

function LockIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M7 11V8.75a5 5 0 1 1 10 0V11"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <rect
        x="5.5"
        y="11"
        width="13"
        height="9"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.9"
      />
      <circle cx="12" cy="15.25" r="1.1" fill="currentColor" />
    </svg>
  );
}

function ArrowRight({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M5 12h12m0 0-5-5m5 5-5 5"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CompassIcon() {
  return (
    <MiniStroke path="M12 4a8 8 0 1 0 8 8 8 8 0 0 0-8-8Zm3.6 4.4-1.9 5.1-5.1 1.9 1.9-5.1Z" />
  );
}

function UploadIcon() {
  return (
    <MiniStroke path="M12 5v10m0-10 3.5 3.5M12 5 8.5 8.5M6.5 15.5v2a1.5 1.5 0 0 0 1.5 1.5h8a1.5 1.5 0 0 0 1.5-1.5v-2" />
  );
}

function StatsIcon() {
  return <MiniStroke path="M6.5 16.5V13m5.5 3.5V9m5.5 7.5V6.5" />;
}

function PerksIcon() {
  return (
    <MiniStroke path="M12 4.8 14 7l2.9-.2-.2 2.9 2.3 2-2.3 2 .2 2.9-2.9-.2-2 2.3-2-2.3-2.9.2.2-2.9-2.3-2 2.3-2-.2-2.9L10 7z" />
  );
}

function MailIcon() {
  return <MiniStroke path="M5.5 8.2 12 12.5l6.5-4.3M5.5 8.2V16h13V8.2" />;
}

function IdIcon() {
  return (
    <MiniStroke path="M7.2 6.8h9.6A1.2 1.2 0 0 1 18 8v8a1.2 1.2 0 0 1-1.2 1.2H7.2A1.2 1.2 0 0 1 6 16V8a1.2 1.2 0 0 1 1.2-1.2Zm1.6 2.4h6.4m-6.4 3h4.4" />
  );
}

function MiniStroke({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-5 w-5">
      <path
        d={path}
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
