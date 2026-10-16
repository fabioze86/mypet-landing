@AGENTS.md

## Histórico de sessões

Quando o usuário disser "sessão concluída" (ou "encerrar sessão"), use a skill
`encerrar-sessao`: ela faz o append do resumo no topo de `docs/HISTORICO.md` e
faz o commit. Esse histórico é versionado e compartilhado; não substitui a
memória automática do Claude, e uma não deve duplicar a outra.
