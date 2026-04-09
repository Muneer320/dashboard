import Image from "next/image";
import Link from "next/link";

import { ArrowRight } from "@/components/landing/icons";

export function AuthChoicePage() {
  return (
    <main className="min-h-screen bg-[#f6f7fb] text-slate-900">
      <section className="relative isolate min-h-screen overflow-hidden px-5 pb-8 pt-5 sm:px-8 lg:px-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(99,102,241,0.12),transparent_32%),radial-gradient(circle_at_100%_70%,rgba(168,85,247,0.12),transparent_30%),radial-gradient(circle_at_50%_45%,rgba(255,255,255,0.9),transparent_48%)]" />

        <div className="relative mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-[1280px] flex-col">
          <header className="flex items-center justify-between pb-8">
            <Link
              href="/"
              className="font-[family-name:var(--font-space-grotesk)] text-[24px] font-[900] leading-[32px] tracking-[-0.4px] text-[#1f2430]"
            >
              TechFest
            </Link>
          </header>

          <div className="flex flex-1 items-center justify-center py-6 sm:py-10">
            <div className="w-full max-w-[780px] overflow-hidden rounded-[22px] bg-white shadow-[0_24px_60px_rgba(15,23,42,0.08)] ring-1 ring-black/5">
              <div className="grid md:grid-cols-2">
                <AuthChoiceCard
                  iconSrc="/images/auth/add-user-icon.svg"
                  iconLabel="Sign up"
                  title="New here?"
                  description="Join the next generation of innovators. Create your account to access curated tech experiences."
                  buttonLabel="Sign Up"
                  buttonHref="#"
                  buttonTone="primary"
                />

                <AuthChoiceCard
                  iconSrc="/images/auth/enter-icon.svg"
                  iconLabel="Log in"
                  title="Already registered?"
                  description="Welcome back. Log in to your curator dashboard and continue your journey."
                  buttonLabel="Log In"
                  buttonHref="#"
                  buttonTone="secondary"
                  isSecondary
                />
              </div>
            </div>
          </div>

          <footer className="flex flex-col gap-6 border-t border-black/5 py-6 text-[#7f8797] sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="font-[family-name:var(--font-space-grotesk)] text-[18px] font-[900] tracking-[-0.04em] text-[#1f2430]">
                TechFest Curator
              </div>
              <p className="mt-1 text-[13px]">© 2024 TechFest Curator</p>
            </div>

            <div className="hidden items-center gap-8 text-[13px] sm:flex">
              <Link href="/" className="transition-colors hover:text-[#1f2430]">
                Home
              </Link>
              <Link href="#" className="transition-colors hover:text-[#1f2430]">
                Terms
              </Link>
              <Link href="#" className="transition-colors hover:text-[#1f2430]">
                Privacy
              </Link>
              <Link href="#" className="transition-colors hover:text-[#1f2430]">
                Support
              </Link>
            </div>

            <div className="flex items-center gap-3 self-start sm:self-auto">
              <RoundIcon iconSrc="/images/auth/world-icon.svg" label="Global" />
              <RoundIcon iconSrc="/images/auth/share-icon.svg" label="Share" />
            </div>
          </footer>
        </div>
      </section>
    </main>
  );
}

function AuthChoiceCard({
  iconSrc,
  iconLabel,
  title,
  description,
  buttonLabel,
  buttonHref,
  buttonTone,
  isSecondary = false,
}: {
  iconSrc: string;
  iconLabel: string;
  title: string;
  description: string;
  buttonLabel: string;
  buttonHref: string;
  buttonTone: "primary" | "secondary";
  isSecondary?: boolean;
}) {
  return (
    <article
      className={`flex min-h-[304px] flex-col items-center justify-center px-8 py-10 text-center sm:px-10 ${
        isSecondary
          ? "border-t border-black/5 md:border-l md:border-t-0"
          : "border-black/5 md:border-r"
      }`}
    >
      <div
        className={`flex h-14 w-14 items-center justify-center rounded-full ${
          isSecondary ? "bg-[#e8ecf6]" : "bg-[#e5e0ff]"
        }`}
      >
        <Image
          src={iconSrc}
          alt={iconLabel}
          width={24}
          height={24}
          className="h-6 w-6"
        />
      </div>

      <h2 className="mt-7 font-[family-name:var(--font-space-grotesk)] text-[34px] font-[900] tracking-[-0.05em] text-[#31353f] sm:text-[38px]">
        {title}
      </h2>

      <p className="mt-3 max-w-[320px] text-[16px] leading-[1.55] text-[#6f7685]">
        {description}
      </p>

      <Link
        href={buttonHref}
        className={`mt-8 inline-flex h-14 min-w-[180px] items-center justify-center rounded-full px-8 text-[17px] font-semibold shadow-[0_14px_24px_rgba(82,76,229,0.18)] transition-transform duration-200 hover:-translate-y-0.5 ${
          buttonTone === "primary"
            ? "bg-[#4f45e0] text-white"
            : "bg-[#d7dbe1] text-[#33363d] shadow-none"
        }`}
      >
        <span className="inline-flex items-center gap-2">
          {buttonLabel}
          {buttonTone === "primary" ? <ArrowRight className="h-4 w-4" /> : null}
        </span>
      </Link>
    </article>
  );
}

function RoundIcon({ iconSrc, label }: { iconSrc: string; label: string }) {
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e8ebef] shadow-[0_8px_20px_rgba(15,23,42,0.08)]">
      <Image
        src={iconSrc}
        alt={label}
        width={18}
        height={18}
        className="h-[18px] w-[18px]"
      />
    </div>
  );
}
