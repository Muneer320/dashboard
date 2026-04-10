"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { SiteFooter, SiteHeader } from "@/components/layout";
import { ArrowRight } from "@/components/landing/icons";

export function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <main className="flex min-h-screen flex-col bg-[#F5F7F9] text-slate-900">
      <div className="relative z-10 w-full bg-[#F5F7F9]">
        <div className="mx-auto w-full max-w-[1280px] px-5 sm:px-8 lg:px-10">
          <SiteHeader className="!bg-transparent" />
        </div>
      </div>

      <section className="relative isolate flex flex-1 overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_8%,rgba(99,102,241,0.08),transparent_34%),radial-gradient(circle_at_95%_68%,rgba(168,85,247,0.10),transparent_35%),radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.92),transparent_52%)]" />

        <div className="relative mx-auto flex w-full max-w-[1280px] flex-1 items-center justify-center px-5 pb-2 pt-1 sm:px-8 lg:px-10">
          <div className="relative w-full max-w-[420px]">
            <div className="rounded-[10px] border border-[#e6e9ef] bg-white px-8 py-7 shadow-[0_16px_34px_rgba(15,23,42,0.08)]">
              <h1 className="font-[family-name:var(--font-space-grotesk)] align-middle text-[36px] font-normal leading-[40px] tracking-[-0.9px] text-[#2a2f38]">
                Welcome back.
              </h1>
              <p className="mt-2 text-[16px] leading-[1.45] text-[#666d7b]">
                Sign in to your curator dashboard.
              </p>

              <form className="mt-5 space-y-3.5">
                <FormField
                  label="EMAIL ADDRESS"
                  placeholder="archived-47e7262f45@example.invalid"
                />

                <div>
                  <div className="mb-1.5 flex items-end justify-between">
                    <label className="text-[14px] font-bold tracking-[0.08em] text-[#7f8694]">
                      PASSWORD
                    </label>
                    <Link
                      href="#"
                      className="text-[12px] font-semibold text-[#5f55ee]"
                    >
                      Forgot password
                    </Link>
                  </div>

                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="h-[clamp(42px,5.2vh,52px)] w-full rounded-[8px] border border-[#edf0f4] bg-[#cfd3da] px-4 pr-11 text-[16px] tracking-[0.12em] text-[#4a5160] placeholder:text-[#8e95a4] focus:border-[#d8dbe2] focus:outline-none"
                    />

                    <button
                      type="button"
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                      onClick={() => setShowPassword((previous) => !previous)}
                      className="absolute inset-y-0 right-4 inline-flex items-center text-[#737b89]"
                    >
                      <EyeIcon />
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  className="inline-flex h-[clamp(44px,5.4vh,54px)] w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(180deg,#5f55ee_0%,#4f45e0_100%)] text-[17px] font-semibold text-white shadow-[0_10px_22px_rgba(79,69,224,0.35)]"
                >
                  Log In
                  <ArrowRight className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  className="inline-flex h-[clamp(42px,5vh,50px)] w-full items-center justify-center rounded-full bg-[#c1c9e3] text-[17px] font-medium text-[#4f5868]"
                >
                  Use OTP instead
                </button>
              </form>

              <div className="my-5 h-px w-full bg-[#eceff3]" />

              <p className="text-center text-[13px] text-[#7a8290]">
                Don&apos;t have an account yet?
              </p>
              <p className="mt-1.5 text-center">
                <Link
                  href="/signup"
                  className="text-[15px] font-bold text-[#2c313b] underline"
                >
                  Create account
                </Link>
              </p>
            </div>

            <aside className="absolute left-[calc(100%+30px)] top-1/2 hidden h-[340px] w-[332px] -translate-y-1/2 rounded-r-[8px] bg-[#f0f3f8] lg:block">
              <div className="absolute left-0 top-0 h-full w-[4px] rounded-full bg-[#acaaf9]" />

              <div className="px-7 pt-7">
                <div className="mb-5 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#d9d9fa]">
                  <Image
                    src="/images/icons/sparkleIcon.svg"
                    alt="Sparkle"
                    width={16}
                    height={16}
                    className="h-4 w-4"
                  />
                </div>

                <div className="space-y-3.5">
                  <div className="h-3 w-[170px] rounded-full bg-[#e7eaf1]" />
                  <div className="h-3 w-[114px] rounded-full bg-[#e7eaf1]" />
                </div>

                <div className="mt-[150px] space-y-2.5">
                  <div className="h-2.5 w-[196px] rounded-full bg-[#eceff5]" />
                  <div className="h-2.5 w-[140px] rounded-full bg-[#eceff5]" />
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <SiteFooter variant="login" />
    </main>
  );
}

function FormField({
  label,
  placeholder,
}: {
  label: string;
  placeholder: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[12px] font-bold tracking-[0.11em] text-[#7f8694]">
        {label}
      </label>
      <input
        type="text"
        placeholder={placeholder}
        className="h-[clamp(42px,5.2vh,52px)] w-full rounded-[8px] border border-[#edf0f4] bg-[#cfd3da] px-4 text-[15px] tracking-[-0.02em] text-[#4a5160] placeholder:text-[#a5acb8] focus:border-[#d8dbe2] focus:outline-none"
      />
    </div>
  );
}

function EyeIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M1.5 12s3.9-6 10.5-6 10.5 6 10.5 6-3.9 6-10.5 6S1.5 12 1.5 12Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="12" r="3.1" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
