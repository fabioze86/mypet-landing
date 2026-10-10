-- Lead da distribuidora (pop-up de identificação) não pede empresa.
alter table public.leads alter column empresa drop not null;
