import Image from "next/image";
import Link from "next/link";

import { SiteFooter, SiteHeader } from "@/components/layout";

export function SignUpPage() {
  return (
    <main className="flex min-h-screen flex-col bg-[#F5F7F9] text-slate-900">
      <div className="relative z-10 w-full bg-[#F5F7F9]">
        <div className="mx-auto w-full max-w-[1280px] px-5 sm:px-8 lg:px-10">
          <SiteHeader className="!bg-transparent" />
        </div>
      </div>

      <section className="relative isolate flex flex-1 overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_8%,rgba(99,102,241,0.09),transparent_34%),radial-gradient(circle_at_100%_68%,rgba(168,85,247,0.10),transparent_32%),radial-gradient(circle_at_52%_46%,rgba(255,255,255,0.92),transparent_52%)]" />

        <div className="relative mx-auto flex w-full max-w-[1280px] flex-1 flex-col items-center px-5 pb-6 pt-4 sm:px-8 lg:px-10">
          <div className="w-full max-w-[560px]">
            <div className="mb-3 flex items-start justify-between">
              <div>
                <p className="font-[family-name:var(--font-space-grotesk)] text-[14px] font-[700] tracking-[0.04em] text-[#625ae9]">
                  STEP 1 OF 3
                </p>
                <h1 className="mt-0.5 font-[family-name:var(--font-space-grotesk)] text-[50px] font-[900] leading-[1] tracking-[-0.045em] text-[#2a2f38]">
                  Profile
                </h1>
              </div>

              <div className="mt-6 flex items-center gap-2.5">
                <span className="h-[4px] w-[44px] rounded-full bg-[#4f45e0]" />
                <span className="h-[4px] w-[44px] rounded-full bg-[#dde1e8]" />
                <span className="h-[4px] w-[44px] rounded-full bg-[#dde1e8]" />
              </div>
            </div>

            <form className="rounded-[10px] border border-[#e4e7ed] bg-white shadow-[0_16px_34px_rgba(15,23,42,0.08)]">
              <div className="h-[4px] rounded-t-[10px] bg-[#4f45e0]" />

              <div className="space-y-5 px-6 pb-7 pt-6">
                <Field label="Full Name" placeholder="Johnathan Doe" />
                <Field label="College Email" placeholder="archived-bcc53232da@example.invalid" />
                <Field
                  label="College Name"
                  placeholder="Search your institution..."
                  endIconSrc="/images/icons/hatIcon.svg"
                  endIconAlt="College icon"
                />
                <Field
                  label="Phone Number"
                  placeholder="+1 (555) 000-0000"
                  rightLabel="OPTIONAL"
                />

                <label className="flex items-start gap-3 pt-1 text-[13px] leading-[1.35] text-[#6f7685]">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border border-[#ced4de] bg-[#f7f8fb]"
                  />
                  <span>
                    I agree to the <Link href="#" className="font-semibold text-[#5f55ee]">Terms of Service</Link> and <Link href="#" className="font-semibold text-[#5f55ee]">Privacy Policy</Link> regarding my student data.
                  </span>
                </label>

                <button
                  type="button"
                  className="mt-1 inline-flex h-[58px] w-full items-center justify-center rounded-full bg-[linear-gradient(180deg,#5f55ee_0%,#4f45e0_100%)] text-[22px] font-semibold text-white shadow-[0_10px_22px_rgba(79,69,224,0.35)]"
                >
                  Continue
                </button>

                <p className="pt-1 text-center text-[14px] text-[#70788a]">
                  Already have an account?{" "}
                  <Link href="/login" className="font-semibold text-[#5f55ee]">
                    Log In
                  </Link>
                </p>
              </div>
            </form>

            <p className="mx-auto mt-8 max-w-[360px] text-center text-[11px] leading-[1.35] text-[#98a0ae]">
              TechFest is a community-first initiative. If your college isn&apos;t listed, please contact our curators for manual verification.
            </p>
          </div>
        </div>
      </section>

      <SiteFooter variant="signup" />
    </main>
  );
}

function Field({
  label,
  placeholder,
  rightLabel,
  endIconSrc,
  endIconAlt,
}: {
  label: string;
  placeholder: string;
  rightLabel?: string;
  endIconSrc?: string;
  endIconAlt?: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-end justify-between">
        <label className="text-[14px] font-medium text-[#7d8493]">{label}</label>
        {rightLabel ? (
          <span className="text-[10px] font-semibold tracking-[0.03em] text-[#a9afbc]">
            {rightLabel}
          </span>
        ) : null}
      </div>

      <div className="relative">
        <input
          type="text"
          placeholder={placeholder}
          className="h-[56px] w-full rounded-[10px] border border-[#edf0f4] bg-[#f2f5f8] px-4 text-[16px] text-[#4a5160] placeholder:text-[#b2b8c3] focus:border-[#d8dbe2] focus:outline-none"
        />

        {endIconSrc ? (
          <span className="pointer-events-none absolute inset-y-0 right-4 inline-flex items-center">
            <Image src={endIconSrc} alt={endIconAlt ?? "Input icon"} width={20} height={20} />
          </span>
        ) : null}
      </div>
    </div>
  );
}
