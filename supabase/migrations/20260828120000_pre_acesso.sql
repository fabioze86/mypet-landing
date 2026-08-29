-- Identidade do comprador passa a ser o CNPJ; id deixa de depender de auth.users
alter table public.buyers drop constraint if exists buyers_id_fkey;
alter table public.buyers alter column id set default gen_random_uuid();

-- Campos que o formulário aprovado não coleta
alter table public.buyers alter column nome drop not null;
alter table public.buyers alter column empresa drop not null;
alter table public.buyers alter column email drop not null;
alter table public.buyers drop constraint if exists buyers_email_key;

-- CNPJ como identificador de retorno
alter table public.buyers add constraint buyers_cnpj_key unique (cnpj);

-- Origem do cadastro (preparação para a ponte futura com o Hub Clientes)
alter table public.buyers add column if not exists source text not null default 'landing';

-- Limite de reenvio (antiabuso), sem PII crua além do CNPJ normalizado
create table if not exists public.pre_access_attempts (
  id bigint generated always as identity primary key,
  cnpj text not null,
  ip_hash text,
  created_at timestamptz not null default now()
);
create index if not exists pre_access_attempts_lookup
  on public.pre_access_attempts (cnpj, created_at desc);

alter table public.pre_access_attempts enable row level security;
