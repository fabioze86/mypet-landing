const ROWS: [string, string, string, string][] = [
  ["Executa junto com o seu time", "Sim", "Às vezes", "Não"],
  ["Ferramentas conectadas à API da Amazon", "Sim, próprias", "Raramente", "Não"],
  ["Margem por SKU, com tarifas reais", "Sim", "Raramente", "Não"],
  ["Atende vendor e seller", "Sim", "Depende", "Em geral só seller"],
  ["Prévia validada e aprovação antes de publicar", "Sim", "Depende", "Não se aplica"],
  ["Opera a própria marca na Amazon", "Sim", "Raramente", "Raramente"],
];

export function ComparisonTable() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">Comparativo entre Zemann, agência e curso ou mentoria</caption>
        <thead>
          <tr>
            <th scope="col" className="border-b-2 border-line px-3 py-3 font-semibold">Critério</th>
            <th scope="col" className="border-b-2 border-accent bg-accent-soft px-3 py-3 font-semibold">Zemann</th>
            <th scope="col" className="border-b-2 border-line px-3 py-3 font-semibold">Agência</th>
            <th scope="col" className="border-b-2 border-line px-3 py-3 font-semibold">Curso ou mentoria</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map(([criterion, zemann, agency, course]) => (
            <tr key={criterion}>
              <th scope="row" className="border-b border-line px-3 py-3 font-medium text-ink">{criterion}</th>
              <td className="border-b border-line bg-accent-soft/40 px-3 py-3 font-semibold text-accent-dark">{zemann}</td>
              <td className="border-b border-line px-3 py-3 text-ink-soft">{agency}</td>
              <td className="border-b border-line px-3 py-3 text-ink-soft">{course}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
