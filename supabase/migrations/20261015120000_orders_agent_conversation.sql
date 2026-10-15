-- Pedido enviado a partir do agente /agente: liga o pedido à conversa para medir
-- quantos pedidos saem do agente. Nulo nos pedidos feitos pela tabela.
alter table public.orders
  add column if not exists agent_conversation_id uuid null
  references public.agent_conversations(id) on delete set null;

create index if not exists orders_agent_conversation
  on public.orders (agent_conversation_id)
  where agent_conversation_id is not null;
