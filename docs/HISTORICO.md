# Histórico de sessões

Uma entrada curta por sessão de trabalho, a mais recente no topo. Registra o que
foi feito, onde ficou (commits) e o que ficou pendente. Detalhe técnico fica no
código, nos commits e no `ARCHITECTURE.md`; aqui fica só a narrativa.

Para adicionar uma entrada ao fim de uma sessão: diga "sessão concluída" ou use
`/encerrar-sessao`.

<!-- Novas entradas logo abaixo desta linha. -->

## 2026-10-16 — IA de atendimento: cota, Vertex e fallback OpenAI → Gemini
**Resumo:** aplicada no Supabase (hub_catalogo) a migration `ai_usage_limits` (tabela `ai_usage_events` + `consume_ai_quota`, só service role). Corrigido o erro do provedor `google-vertex` na Vercel: o JSON da service account estava em `GOOGLE_APPLICATION_CREDENTIALS`, que espera um caminho de arquivo; agora o JSON vai em `GOOGLE_VERTEX_CREDENTIALS`. Na Vercel, `AI_PROVIDER` foi removido para usar a cadeia padrão: OpenAI principal, Gemini (AI Studio) como fallback. Criado este histórico, com a regra no `CLAUDE.md` e o comando `/encerrar-sessao`.
**Commits/branch:** main @872dfa8 (correção do Vertex); commit deste histórico.
**Pendências:** revogar no Google Cloud a chave `55d3a884…` da service account `app-marketingos@apps-fabio`, que vazou num log.
