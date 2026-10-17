const PILLARS = [
  {
    title: "Operador, não teórico",
    text: "Vendemos nossa própria marca na Amazon todos os dias. O que recomendamos já foi testado na nossa operação.",
  },
  {
    title: "Tecnologia própria conectada à API oficial da Amazon",
    text: "Cadastro, correção e publicação de anúncios em escala pela SP-API, sem planilha manual e sem retrabalho.",
  },
  {
    title: "Margem, não só faturamento",
    text: "Cada SKU com lucro estimado no preço atual e lucro real do período, já descontadas as tarifas da Amazon.",
  },
  {
    title: "Nada vai ao ar sem a sua aprovação",
    text: "A Amazon valida a prévia, você aprova, e só então publicamos. Toda alteração fica registrada.",
  },
];

export function Pillars() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {PILLARS.map((pillar) => (
        <div key={pillar.title} className="rounded-lg border border-line p-6">
          <h3 className="text-lg font-semibold text-ink">{pillar.title}</h3>
          <p className="mt-2 leading-relaxed text-ink-soft">{pillar.text}</p>
        </div>
      ))}
    </div>
  );
}
