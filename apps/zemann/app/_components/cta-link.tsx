import Link from "next/link";

const VARIANTS = {
  primary: "bg-accent text-white hover:bg-accent-dark",
  secondary: "border border-line bg-white text-ink hover:border-accent hover:text-accent",
};

export function CtaLink({
  href,
  cta,
  variant = "primary",
  className = "",
  children,
}: {
  href: string;
  cta: string;
  variant?: keyof typeof VARIANTS;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      data-cta={cta}
      className={`inline-flex items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold transition-colors ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </Link>
  );
}
