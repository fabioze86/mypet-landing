-- Aperta a policy de leitura pública de offer_campaigns/offer_campaign_items.
--
-- As policies originais ("anon reads offer campaigns"/"anon reads offer
-- campaign items", em 20260913120000_offer_campaigns.sql) liberavam SELECT
-- de QUALQUER linha para o papel anon (using (true)), incluindo campanhas em
-- rascunho (active = false) ou agendadas para o futuro — expondo cupom,
-- preço promocional e datas antes de a campanha ser publicada de verdade.
--
-- A partir daqui, só é lido o que é realmente publicável: active = true e
-- dentro da janela de vigência (starts_at/ends_at). offer_campaign_items
-- checa a mesma condição na campanha relacionada via exists(...).
--
-- Também estende a leitura para o papel authenticated (além de anon) — o
-- comprador logado (buyers, plano 2) precisa conseguir ler campanhas
-- publicadas do mesmo jeito que um visitante anônimo.

drop policy "anon reads offer campaigns" on public.offer_campaigns;
drop policy "anon reads offer campaign items" on public.offer_campaign_items;

create policy "public reads publishable offer campaigns" on public.offer_campaigns
  for select to anon, authenticated
  using (
    active = true
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now())
  );

create policy "public reads publishable offer campaign items" on public.offer_campaign_items
  for select to anon, authenticated
  using (
    exists (
      select 1
      from public.offer_campaigns c
      where c.id = offer_campaign_items.campaign_id
        and c.active
        and (c.starts_at is null or c.starts_at <= now())
        and (c.ends_at is null or c.ends_at >= now())
    )
  );
