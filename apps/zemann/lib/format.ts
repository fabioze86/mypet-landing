const brl = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

export function formatPriceFrom(value: number | null): string {
  if (value === null) return "valor informado no agendamento";
  return `a partir de R$ ${brl.format(value)}`;
}

const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export function formatDateBR(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return `${day} de ${MONTHS[month - 1]} de ${year}`;
}
