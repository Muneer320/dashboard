import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="bg-[#F5F7F9] px-5 pb-8 sm:px-8 lg:px-10">
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
