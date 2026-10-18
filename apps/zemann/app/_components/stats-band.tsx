// Só números verificáveis da operação e da oferta.
const STATS = [
  ["3.000+", "produtos no catálogo da marca que operamos na Amazon"],
  ["30–90 dias", "para uma implantação completa"],
  ["100%", "das publicações com prévia validada pela Amazon e aprovação"],
  ["1 dia útil", "para responder ao seu contato"],
];

export function StatsBand() {
  return (
    <section className="bg-surface py-16">
      <ul className="mx-auto grid max-w-7xl gap-10 px-4 sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map(([value, label]) => (
          <li key={value}>
            <p className="text-4xl font-extrabold tracking-tight text-accent md:text-5xl">{value}</p>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{label}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
