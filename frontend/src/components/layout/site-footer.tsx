import Image from "next/image";
import Link from "next/link";

type SiteFooterVariant = "landing" | "auth-choice" | "signup" | "login";

export function SiteFooter({
  variant = "landing",
}: {
  variant?: SiteFooterVariant;
}) {
  if (variant === "auth-choice") {
    return (
      <footer className="relative z-10 w-full border-t border-black/5 bg-[#F5F7F9]">
        <div className="mx-auto flex w-full max-w-[1280px] flex-col items-center justify-between gap-6 px-5 py-6 text-[#7f8797] sm:flex-row sm:px-8 lg:px-10">
          <div className="flex flex-col items-center sm:items-start">
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

          <div className="flex items-center gap-3">
            <RoundIcon iconSrc="/images/auth/world-icon.svg" label="Global" />
            <RoundIcon iconSrc="/images/auth/share-icon.svg" label="Share" />
          </div>
        </div>
      </footer>
    );
  }

  if (variant === "signup") {
    return (
      <footer className="w-full bg-[#F5F7F9]">
        <div className="mx-auto flex w-full max-w-[1280px] items-center justify-between gap-4 px-5 pb-8 pt-6 text-[13px] text-[#8f96a5] sm:px-8 lg:px-10">
          <div>
            <div className="font-[family-name:var(--font-space-grotesk)] text-[28px] font-[900] tracking-[-0.03em] text-[#1f2430]">
              TechFest Curator
            </div>
          </div>

          <div className="hidden items-center gap-8 sm:flex">
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

          <div className="text-right">© 2024 TechFest Curator</div>
        </div>
      </footer>
    );
  }

  if (variant === "login") {
    return (
      <footer className="w-full bg-[#F5F7F9]">
        <div className="mx-auto flex w-full max-w-[1280px] items-end justify-between gap-4 px-5 pb-4 pt-2 text-[13px] text-[#8f96a5] sm:px-8 lg:px-10">
          <div>
            <div className="font-[family-name:var(--font-space-grotesk)] text-[18px] font-[900] tracking-[-0.04em] text-[#1f2430]">
              TechFest Curator
            </div>
            <p className="mt-0.5 text-[12px] text-[#8d95a4]">
              © 2024 TechFest Curator
            </p>
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
        </div>
      </footer>
    );
  }

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
