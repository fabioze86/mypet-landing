export const LEAD_STATUSES = ["novo", "contatado", "convertido", "descartado"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export type LeadRow = {
  id: string;
  nome: string;
  empresa: string;
  whatsapp: string;
  cnpj: string | null;
  channel: string;
  status: LeadStatus;
  created_at: string;
};

function csvField(value: string): string {
  // Campos vêm de formulário público não confiável e o CSV é aberto no Excel:
  // um valor começando com =, +, - ou @ executaria como fórmula. O apóstrofo
  // inicial é a neutralização padrão (Excel o trata como marcador de texto).
  let safe = value;
  if (/^[=+\-@]/.test(safe)) {
    safe = `'${safe}`;
  }
  if (safe.includes(",") || safe.includes('"') || safe.includes("\n")) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export function leadsToCsv(leads: LeadRow[]): string {
  const header = "data,nome,empresa,whatsapp,cnpj,canal,status";
  const rows = leads.map((l) =>
    [l.created_at, l.nome, l.empresa, l.whatsapp, l.cnpj ?? "", l.channel, l.status]
      .map(csvField)
      .join(","),
  );
  return [header, ...rows].join("\n") + "\n";
}
