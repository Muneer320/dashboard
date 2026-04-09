import Image from "next/image";

export function VerificationSection() {
  return (
    <section
      id="verification"
      className="bg-[#F5F7F9] px-5 py-24 sm:px-8 lg:px-10"
    >
      <div className="mx-auto max-w-[1280px]">
        <div className="relative overflow-hidden rounded-[14px] bg-[#0B0F10] px-6 py-10 text-white shadow-[0_28px_70px_rgba(11,15,20,0.34)] sm:px-8 lg:px-10 lg:py-12">
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
                <VerificationStep iconSrc="/Mail.svg" label="EDU EMAIL" />
                <div className="h-px w-12 bg-white/15 sm:w-16" />
                <VerificationStep iconSrc="/ID.svg" label="STUDENT ID" />
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
  iconSrc,
  label,
}: {
  iconSrc: string;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2b2a7d] text-[#7367ff]">
        <Image
          src={iconSrc}
          alt={label}
          width={16}
          height={16}
          className="h-4 w-4"
        />
      </div>
      <span className="text-[9px] font-bold tracking-[0.24em] text-white/68">
        {label}
      </span>
    </div>
  );
}
