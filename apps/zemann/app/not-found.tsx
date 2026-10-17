import { CtaLink } from "./_components/cta-link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-24 text-center">
      <h1 className="text-3xl font-bold">Página não encontrada</h1>
      <p className="mt-4 text-ink-soft">O endereço pode ter mudado. Comece pela página inicial ou pelos guias.</p>
      <div className="mt-8 flex justify-center gap-3">
        <CtaLink href="/" cta="404_home">Página inicial</CtaLink>
        <CtaLink href="/guias" cta="404_guias" variant="secondary">Guias</CtaLink>
      </div>
    </main>
  );
}
