import Link from "next/link";

export function SiteHeader({ className = "" }: { className?: string }) {
  return (
    <header
      className={`grid items-center gap-3 bg-[#F5F7F9] px-0 py-3 sm:grid-cols-[1fr_auto_1fr] ${className}`}
    >
      <div className="flex items-center justify-start">
        <Link
          href="/"
          className="font-[family-name:var(--font-space-grotesk)] text-[24px] font-[900] leading-[32px] tracking-[-0.4px] text-slate-900"
        >
          TechFest
        </Link>
      </div>

      <nav className="hidden items-center justify-center gap-8 text-[13px] font-medium text-slate-500 sm:flex">
        <Link href="#events" className="transition-colors hover:text-slate-900">
          Events
        </Link>
        <Link
          href="#schedule"
          className="transition-colors hover:text-slate-900"
        >
          Schedule
        </Link>
        <Link href="#faq" className="transition-colors hover:text-slate-900">
          FAQ
        </Link>
      </nav>

      <div className="flex justify-start sm:justify-end">
        <Link
          href="/auth-choice"
          className="inline-flex h-9 items-center justify-center rounded-full bg-[linear-gradient(180deg,#5f55ee_0%,#4f45e0_100%)] px-5 text-[13px] font-semibold text-white shadow-[0_8px_22px_rgba(79,69,224,0.35)] transition-transform duration-200 hover:-translate-y-0.5"
        >
          Get Access
        </Link>
      </div>
    </header>
  );
}
