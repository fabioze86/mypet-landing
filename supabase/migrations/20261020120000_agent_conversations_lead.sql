-- Nome e WhatsApp que o visitante informa no roteiro do /agente antes da
-- primeira pergunta. lead_whatsapp guarda o texto digitado, inclusive "não".
-- Acesso continua só pelo service role (e leitura do admin pelas políticas já
-- existentes em agent_conversations).

alter table public.agent_conversations
  add column if not exists lead_nome text null,
  add column if not exists lead_whatsapp text null;
