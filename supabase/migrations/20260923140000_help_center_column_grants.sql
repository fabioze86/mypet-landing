-- ============================================================================
-- Central de Ajuda — restringe colunas de artigos_ajuda visíveis ao anon
-- mypet-landing · projeto Supabase hub_catalogo
--
-- A policy de RLS "artigos_ajuda_leitura_publicada" já filtra LINHAS (só
-- status = 'publicado'), mas o grant de tabela do Supabase para o role
-- `anon` é table-wide por padrão, então `nota_interna` (nunca deve chegar
-- ao público) e `atualizado_por` ficam legíveis via REST assim que existe
-- ao menos um artigo publicado. Este migration restringe o SELECT do
-- `anon` em artigos_ajuda às colunas que o site público realmente usa.
--
-- Não mexe em categorias_ajuda (sem colunas sensíveis) nem nas policies de
-- escrita (authenticated + admin_users).
-- ============================================================================

revoke select on table public.artigos_ajuda from anon;

grant select (
  id,
  categoria_id,
  slug,
  titulo,
  resumo,
  corpo_markdown,
  palavras_chave,
  status,
  ordem,
  atualizado_em
) on public.artigos_ajuda to anon;
