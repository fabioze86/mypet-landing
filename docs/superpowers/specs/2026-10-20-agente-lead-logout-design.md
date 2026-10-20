# Agente /agente: nome e WhatsApp do visitante, identificação e logout, sem "ração"

Data: 2026-10-20 · App: `apps/mypet` · Núcleo: `packages/core`

Três melhorias no agente /agente (que substituiu o antigo support-assistant e a rota
`/api/duvidas`, já removidos).

## 1. Nome e WhatsApp do visitante (roteiro fixo, sem IA)

Vale só no modo `visitante`. Cliente logado (cookie `mypet_acesso`) nunca vê o roteiro.

### Fluxo na tela

1. Visitante abre o /agente sem perfil salvo no navegador.
2. O chat mostra uma mensagem do agente:
   "Antes de prosseguir, preciso de duas informações: 1 - Qual é o seu nome?"
3. O visitante responde no campo de texto normal. A resposta aparece como mensagem dele.
4. O agente mostra: "2 - Deseja informar um WhatsApp?"
5. O visitante responde (número, "não" ou qualquer texto).
6. O agente mostra: "Obrigado, [nome]! Como posso te ajudar hoje?" e os botões de intenção
   (normais e com cadeado) aparecem.

Regras:
- Nome: obrigatório; trim; 1 a 80 caracteres. Vazio não avança (o botão de enviar já
  fica desabilitado com campo vazio).
- WhatsApp: qualquer texto não vazio; trim; até 40 caracteres. Grava a resposta como foi
  digitada, inclusive "não". Não valida formato de telefone.
- Durante o roteiro os botões de intenção ficam escondidos e nada é enviado à IA.
- `?pergunta=` vindo da home fica pendente e é enviada automaticamente quando o roteiro
  termina.
- As mensagens do roteiro não vão para `agent_messages` nem contam na cota de IA: são
  só da tela.

### Persistência no navegador

- Perfil `{ nome, whatsapp }` salvo em `localStorage` (chave `mypet_agente_lead`), com
  leitura/escrita em try/catch. Sem storage disponível, o roteiro roda a cada visita e o
  perfil vive só na memória da página.
- Com perfil salvo, conversas novas e visitas seguintes pulam o roteiro; a tela de
  boas-vindas diz "Olá, [nome]! Como posso te ajudar hoje?".

### Envio ao servidor

- `useAgentChat` passa a mandar `lead: { nome, whatsapp }` no corpo de cada POST a
  `/api/agente` quando houver perfil.
- `parseAgentRequest` aceita `lead` opcional: objeto com `nome` (string, 1 a 80 após
  trim) e `whatsapp` (string, até 40 após trim). Fora disso, ignora o `lead` (não
  recusa a mensagem).
- Só no modo `visitante` o servidor usa o `lead`; no modo `cliente` ele é ignorado.

### Banco

Migration nova em `supabase/migrations/`:

```sql
alter table public.agent_conversations
  add column if not exists lead_nome text null,
  add column if not exists lead_whatsapp text null;
```

`ensureConversation` recebe o `lead` e grava `lead_nome`/`lead_whatsapp` na criação da
conversa; numa conversa já existente, preenche só se as colunas ainda estiverem nulas.
Falha ao gravar o lead não derruba a resposta (registra no console).

### Prompt

`buildAgentInstructions` recebe `leadNome: string | null`. No modo visitante, quando
houver nome, a linha de público vira
"Você atende visitantes que ainda não fizeram cadastro. Nome do visitante: X."
O nome passa pela mesma limpeza de `formatEmpresa` (uma linha, curto).

### Admin

A página de detalhe da conversa (`apps/admin/app/(dashboard)/agente/[id]`) mostra
"Nome" e "WhatsApp informado" quando preenchidos.

## 2. Identificação e logout do cliente (só no /agente)

- `AgentePageBody` passa ao `AgentShell` o nome de exibição: `buyer.nome`, senão
  `buyer.empresa`, senão `null`.
- Cabeçalho do modo cliente: "Olá, [nome]" (ou "Olá!" sem nome), "Tabela de preços",
  "Meus pedidos" e o botão **Sair**.
- Boas-vindas do chat no modo cliente: "Olá, [nome]! Como posso te ajudar hoje?"
  (sem nome: "Como posso te ajudar hoje?").
- Rota nova `POST /api/sair` (`apps/mypet/app/api/sair/route.ts`): responde 200 com
  `Set-Cookie` que expira `mypet_acesso` (`Max-Age=0`, mesmos `Path`/`SameSite`/
  `HttpOnly`/`Secure` de `ACCESS_COOKIE_OPTS`). Passa por `rejectForeignRequest` como as
  outras rotas POST.
- Botão Sair no navegador: chama a rota, limpa o carrinho (`useCart`) e a conversa
  guardada (`useAgentConversation`), e vai para `/` com `window.location.assign`. Se a
  rota falhar, mostra "Não foi possível sair agora. Tente de novo." e não limpa nada.

## 3. Sem "ração" nos exemplos

- `agent-catalog-tool.ts`: o exemplo da descrição de `query` troca `'ração filhote'` por
  um exemplo de kit (`'kit banho'`).
- `agent-prompt.ts`, regra 7, acrescenta: "A ${siteName} não trabalha com ração. Ao dar
  exemplos de produtos, use kits, shampoo, camas ou brinquedos. Se pedirem ração, diga
  que a ${siteName} não trabalha com ração."

## Testes

- `agent-chat.test.tsx`: roteiro completo; nome vazio não avança; "não" é aceito;
  perfil salvo pula o roteiro; `?pergunta=` só sai depois do roteiro; cliente não vê
  o roteiro.
- `agent-shell.test.tsx`: "Olá, [nome]" e Sair no modo cliente; fallback para empresa;
  falha do Sair mostra erro.
- `apps/mypet/app/api/sair/route.test.ts`: cookie expirado; requisição de outra origem
  recusada.
- `agent-request.test.ts`: `lead` válido, ausente e inválido.
- `agent-conversations.test.ts` / `agent-server.test.ts`: lead gravado no visitante,
  ignorado no cliente, não sobrescreve valor existente.
- `agent-prompt.test.ts`: nome do visitante no prompt; regra da ração.
- `agent-catalog-tool.test.ts`: descrição sem "ração", se houver asserção sobre ela.

## Fora do escopo

- Busca por categoria em `buscar_produtos` (ex.: "brinquedo" achar a categoria
  Brinquedos). Proposta separada.
- Logout em outras telas (/pedido-rapido etc.).
