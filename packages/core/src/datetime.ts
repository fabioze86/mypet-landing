/**
 * Datetime — conversão de datas/horas locais (sem fuso) para ISO UTC.
 *
 * Motivação: `<input type="datetime-local">` produz uma string sem fuso
 * (ex: "2026-09-20T18:00"). Gravar esse valor cru numa coluna `timestamptz`
 * faz o Postgres/PostgREST interpretá-lo como UTC — um operador em Brasília
 * que agenda "20/09 às 18:00" acaba agendando 15:00 no horário local dele,
 * sem perceber.
 *
 * O Brasil não tem horário de verão desde 2019, então o fuso de referência
 * do negócio (America/Sao_Paulo) é sempre UTC-3 — não há necessidade de
 * calcular o offset dinamicamente por data.
 */

const HAS_TIMEZONE = /Z$|[+-]\d{2}:\d{2}$/;

export function localDateTimeToIsoUtc(value: string, offset = "-03:00"): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  // Já vem com fuso (ISO "Z" ou offset explícito) — não dobra a conversão,
  // só normaliza para o formato ISO UTC.
  if (HAS_TIMEZONE.test(trimmed)) {
    const date = new Date(trimmed);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
  }

  // Formato de datetime-local ("YYYY-MM-DDTHH:mm" ou com segundos): aplica o
  // offset fixo do fuso de referência do negócio antes de converter.
  const date = new Date(`${trimmed}${offset}`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}
