# Assistente de busca: layout de chat contínuo

**Data:** 2026-07-11
**Status:** Aprovado — pronto para plano de implementação

## Contexto e problema

O componente `AssistantSearch` (`packages/core/src/components/assistant-search.tsx`)
já processa o histórico completo da conversa em `messages`, mas só renderiza a
última troca (`lastUserMessage` + `reply`), com o campo de texto fixo no topo,
acima da resposta. Depois da primeira mensagem, os chips de sugestão inicial
continuam visíveis, competindo visualmente com a resposta.

Feedback do usuário ao testar: depois de receber uma resposta, não fica óbvio
que dá para continuar digitando no mesmo campo lá em cima — a caixa parece uma
busca de uma pergunta só, não uma conversa.

## Decisões tomadas

| Tema | Decisão |
|------|---------|
| Formato da conversa | Vira um chat de verdade: histórico completo em bolhas (usuário à direita, assistente à esquerda), área rolável com auto-scroll para o final a cada mensagem nova |
| Posição do input | Fixo logo abaixo da área de conversa (como WhatsApp), não mais acima dela |
| Chips de sugestão inicial | Somem assim que a primeira mensagem é enviada; só aparecem no estado vazio, antes de qualquer interação |
| Chips de confirmação de perfil (`profileOptions`) | Continuam aparecendo entre a conversa e o input quando a IA pede confirmação de perfil (comportamento já existente, só reposicionado) |
| Grid de produtos recomendados | Fica fixo abaixo de tudo (conversa + input), mostrando os produtos da última busca — não vira parte de cada bolha |
| Indicador de carregamento | Uma bolha "Digitando..." no lugar da resposta enquanto `loading` é `true` |
| Estado da conversa | Sem persistência entre reloads (sem localStorage) — mantém-se em memória do componente, como hoje |
| Estrutura de código | Refatoração dentro do próprio `assistant-search.tsx`, sem novos arquivos/subcomponentes — o componente continua pequeno o bastante para não justificar divisão |

## Escopo

### Nesta entrega

- Remover os estados `lastUserMessage` e `reply` (redundantes com `messages`,
  que já guarda o histórico completo); a UI passa a renderizar diretamente a
  partir de `messages`.
- Nova área de conversa rolável (bolhas de chat), renderizada quando
  `messages.length > 0`, com auto-scroll ao final a cada mensagem nova ou
  mudança de `loading`.
- Bolha de "Digitando..." enquanto `loading === true`.
- Mover o formulário de input para baixo da área de conversa; ele continua
  existindo também no estado vazio (antes da 1ª mensagem), na mesma posição
  relativa de hoje.
- Esconder os chips de sugestão inicial (`SUGESTOES_INICIAIS`) assim que
  `messages.length > 0`.
- Manter chips de `profileOptions` entre a conversa e o input, exatamente como
  hoje (só reposicionados no novo layout).
- Manter grid de produtos (`ProductCard`) fixo abaixo de tudo, atualizando com
  a última lista de `products` recebida — comportamento já existente, sem
  mudança de dados.
- Manter exibição de erro (`error`) abaixo do input, como hoje.

### Fora de escopo

- Persistência da conversa entre reloads (localStorage/sessão no servidor).
- Testes automatizados de componente (o projeto não usa React Testing Library
  em nenhum outro componente; validação será manual).
- Qualquer mudança no contrato de `POST /api/assistant` ou em
  `assistant-client.ts` — a mudança é só de apresentação.
- Mover produtos para dentro de cada bolha de resposta.

## Arquitetura

Mudança contida em `packages/core/src/components/assistant-search.tsx`:

```
AssistantSearch
  estado: messages, input, loading, error, products, profileOptions
           (lastUserMessage e reply removidos)

  render:
    título + subtítulo
    se messages.length === 0:
        input (form) + chips de sugestão inicial
    senão:
        área de conversa rolável
          para cada mensagem em `messages`: bolha (alinhamento por role)
          se loading: bolha "Digitando..."
          <div ref={bottomRef} />  (alvo do auto-scroll)
        chips de profileOptions (se houver)
        input (form)
    erro (se houver)
    grid de produtos (se products.length > 0)
```

`sendMessage` continua igual na lógica de rede (chama `askAssistant`, atualiza
`messages`/`products`/`profileOptions`/`error`); só perde as duas linhas que
setavam `lastUserMessage`/`reply`.

Auto-scroll: `useEffect` que observa `[messages, loading]` e chama
`bottomRef.current?.scrollIntoView({ behavior: "smooth" })`.

## Tratamento de erros e casos de borda

- **Erro de requisição:** continua exibido como texto abaixo do input, sem
  virar bolha de chat — é um erro de transporte, não uma resposta da IA.
- **Conversa longa:** a área de conversa tem `max-height` com `overflow-y:
  auto`; o auto-scroll garante que a mensagem mais recente fique visível sem
  crescer o card indefinidamente.
- **Clique em chip de sugestão/perfil durante `loading`:** já bloqueado hoje
  (`disabled={loading}` nos botões) — mantido.

## Estratégia de testes

- Sem testes automatizados novos (mudança é só de apresentação em componente
  sem cobertura de testes de UI hoje).
- Validação manual via `/run`: abrir a home, enviar uma pergunta, confirmar
  que (a) os chips iniciais somem, (b) a bolha do usuário e a da IA aparecem
  corretas, (c) o campo de input continua funcional logo abaixo da conversa,
  (d) enviar uma segunda mensagem soma uma nova bolha sem perder a primeira,
  (e) o grid de produtos aparece/atualiza corretamente, (f) testar o caso de
  `profileOptions` (mensagem ambígua) e o caso de erro (ex.: canal inválido).
