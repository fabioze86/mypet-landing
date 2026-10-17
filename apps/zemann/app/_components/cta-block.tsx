import { CtaLink } from "./cta-link";

export function CtaBlock({
  title,
  text,
  href,
  cta,
  label,
}: {
  title: string;
  text: string;
  href: string;
  cta: string;
  label: string;
}) {
  return (
    <section className="mx-auto mt-20 max-w-6xl px-4">
      <div className="rounded-xl bg-ink px-8 py-12 text-white md:px-12">
        <h2 className="text-2xl font-bold md:text-3xl">{title}</h2>
        <p className="mt-3 max-w-2xl text-white/80">{text}</p>
        <CtaLink href={href} cta={cta} className="mt-6">{label}</CtaLink>
      </div>
    </section>
  );
}
