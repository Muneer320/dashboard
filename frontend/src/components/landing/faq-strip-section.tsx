import { faqItems } from "@/features/landing/data";

export function FaqStripSection() {
  return (
    <section id="faq" className="bg-[#EEF1F3] px-5 pb-8 pt-10 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[1280px]">
        <div className="grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-3">
          {faqItems.map((faq) => (
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
