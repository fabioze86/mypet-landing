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
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
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
