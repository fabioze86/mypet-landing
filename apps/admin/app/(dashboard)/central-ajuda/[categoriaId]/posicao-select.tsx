"use client";

export function PosicaoSelect({ atual, total }: { atual: number; total: number }) {
  return (
    <select
      name="posicao"
      defaultValue={atual}
      aria-label="Posição do artigo"
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
      className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
    >
      {Array.from({ length: total }, (_, i) => (
        <option key={i + 1} value={i + 1}>
          {i + 1}º
        </option>
      ))}
    </select>
  );
}
