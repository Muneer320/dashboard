import Image from "next/image";
import Link from "next/link";

import { SiteFooter, SiteHeader } from "@/components/layout";
import { ArrowRight } from "@/components/landing/icons";

export function AuthChoicePage() {
  return (
    <main className="flex min-h-screen flex-col bg-[#F5F7F9] text-slate-900">
      <div className="relative z-10 w-full bg-[#F5F7F9]">
        <div className="mx-auto w-full max-w-[1280px] px-5 sm:px-8 lg:px-10">
          <SiteHeader className="!bg-transparent" />
        </div>
      </div>

      <section className="relative isolate flex flex-1 flex-col overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(99,102,241,0.12),transparent_32%),radial-gradient(circle_at_100%_70%,rgba(168,85,247,0.12),transparent_30%),radial-gradient(circle_at_50%_45%,rgba(255,255,255,0.9),transparent_48%)]" />

        <div className="relative mx-auto flex w-full max-w-[1280px] flex-1 flex-col px-5 sm:px-8 lg:px-10">
          <div className="flex flex-1 items-center justify-center py-4 sm:py-8">
            <div className="w-full max-w-[1024px] overflow-hidden rounded-[12px] bg-white shadow-[0_24px_60px_rgba(15,23,42,0.08)] ring-1 ring-black/5">
              <div className="grid md:h-[410px] md:grid-cols-2">
                <AuthChoiceCard
                  iconSrc="/images/auth/add-user-icon.svg"
                  iconLabel="Sign up"
                  title="New here?"
                  description="Join the next generation of innovators. Create your account to access curated tech experiences."
                  buttonLabel="Sign Up"
                  buttonHref="/signup"
                  buttonTone="primary"
                />

                <AuthChoiceCard
                  iconSrc="/images/auth/enter-icon.svg"
                  iconLabel="Log in"
                  title="Already registered?"
                  description="Welcome back. Log in to your curator dashboard and continue your journey."
                  buttonLabel="Log In"
                  buttonHref="/login"
                  buttonTone="secondary"
                  isSecondary
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter variant="auth-choice" />
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
      className={`flex flex-col items-center justify-center px-8 py-10 text-center md:min-h-full sm:px-10 ${
        isSecondary
          ? "bg-[rgba(171,173,175,0.10)]"
          : "bg-[rgba(238,241,243,0.30)]"
      }`}
    >
      <div
        className={`flex h-14 w-14 items-center justify-center rounded-full ${
          isSecondary
            ? "bg-[rgba(218,226,253,0.50)]"
            : "bg-[rgba(151,149,255,0.30)]"
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
