---
name: encerrar-sessao
description: Registra o resumo da sessão em docs/HISTORICO.md e faz commit. Use quando o usuário disser "sessão concluída", "encerrar sessão" ou chamar /encerrar-sessao.
---

# Encerrar sessão

1. Levante o que a sessão fez: a conversa, `git log` dos commits desta sessão e
   `git status` (o que ficou sem commit).
2. Escreva uma entrada no formato abaixo e insira logo após a linha
   `<!-- Novas entradas logo abaixo desta linha. -->` em `docs/HISTORICO.md`
   (mais recente no topo; nunca edite entradas antigas):

   ```
   ## AAAA-MM-DD — <título curto do tema>
   **Resumo:** <2 a 4 frases: o que mudou e por quê, em linguagem de negócio>
   **Commits/branch:** <branch> @<hash curto> (<o que é>); …
   **Pendências:** <o que ficou por fazer, ou "nenhuma">
   ```

   - Data de hoje, em português, sem segredos (chaves, tokens, senhas).
   - Mencione mudanças sem commit de outras sessões só se forem relevantes;
     não as inclua no commit.
3. Faça commit só de `docs/HISTORICO.md`:
   `docs(historico): sessão <AAAA-MM-DD> — <tema>`. Faça push apenas se o
   usuário pedir.
4. Responda com a entrada adicionada e o hash do commit.
