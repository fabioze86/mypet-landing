# Hub de desenvolvimento local

**Data:** 2026-07-26
**Status:** Aprovado — pronto para plano de implementação

## Contexto e problema

O monorepo tem hoje 4 apps (`mypet`, `distribuidora`, `azpetshop`, `admin`), todos usando
`next dev` sem porta fixa (todos sobem na 3000 por padrão, a porta default do Next.js) — rodar mais de um ao mesmo
tempo já causa conflito de porta. Para trabalhar em qualquer site, o usuário precisa abrir
um terminal por app e rodar `npm run dev`/`pnpm dev:<app>` manualmente, um de cada vez. Não
existe hoje nenhuma página que liste os sites do monorepo; e o root `package.json` nem tem
um script `dev:admin` (só `dev:mypet`, `dev:distribuidora`, `dev:azpetshop`).

Esta entrega resolve dois problemas: (1) um comando único que sobe todos os apps de uma vez,
sem conflito de porta; (2) uma página local que lista os 3 sites públicos + o admin, cada um
com link para acessar.

**Fora do escopo:** verificação de status "online/offline" de cada site no hub (decisão
explícita do usuário — só links fixos, sem lógica de checagem no client). Deploy do hub em
produção — é uma ferramenta de conveniência para desenvolvimento local, não um produto
publicado. Adoção do Turborepo como orquestrador — avaliado e descartado nesta v1 em favor
de `concurrently` (mais simples, sem introduzir um pipeline novo só para "rodar tudo
junto").

## Arquitetura

### Portas fixas por app

Cada `apps/*/package.json` ganha uma porta fixa no script `dev`, eliminando o conflito de
rodar múltiplos apps ao mesmo tempo:

| App | Porta |
| --- | --- |
| `mypet` | 4100 |
| `distribuidora` | 4101 |
| `azpetshop` | 4102 |
| `admin` | 4103 |
| `hub` (novo) | 4104 |

```json
"dev": "next dev -p 4100"
```

(a porta muda por app, conforme a tabela acima)

### Novo app `apps/hub`

App Next.js mínimo (App Router), sem Supabase, sem autenticação, sem `client.config.ts` —
é uma ferramenta de desenvolvimento local, não um site publicado. Uma única página
(`apps/hub/app/page.tsx`) renderiza uma lista fixa (array local, hardcoded no próprio
arquivo — não reaproveita `SITES` de `packages/core/src/features.ts`, que é um registro de
funcionalidades por site, não de URLs/portas; misturar as duas coisas acopla conceitos
não relacionados) com 4 cards: nome, descrição curta, e link para a URL local de cada app
(`http://localhost:4100`, `:4101`, `:4102`, `:4103`).

Sem lógica de status ao vivo: cada card é um `<a>` simples. Se o app de destino ainda não
subiu, o clique resulta no erro de conexão padrão do navegador — comportamento aceito
nesta v1.

### Comando único (`pnpm dev:all`)

- Adiciona `concurrently` como `devDependency` do root `package.json`.
- Adiciona o script que falta hoje: `"dev:admin": "pnpm --filter admin dev"`.
- Adiciona `"dev:hub": "pnpm --filter hub dev"`.
- Adiciona `"dev:all"`, que roda os 5 scripts (`dev:mypet`, `dev:distribuidora`,
  `dev:azpetshop`, `dev:admin`, `dev:hub`) simultaneamente num único terminal, com nomes e
  cores por processo (recurso nativo do `concurrently`), permitindo interromper tudo com um
  só `Ctrl+C`.

## Testes mínimos

Este trabalho é infraestrutura de desenvolvimento local (scripts e uma página estática) —
sem lógica de negócio para testar com Vitest. A verificação é funcional:

- Rodar `pnpm dev:all` e confirmar que os 5 processos sobem sem erro de porta ocupada.
- Abrir `http://localhost:4104` e confirmar que os 4 cards apontam para as portas corretas.
- Clicar em cada link e confirmar que abre o site/admin correspondente.
- `pnpm build` (build de todos os apps) continua passando — a mudança de porta é só para
  `next dev`, não afeta `next build`/`next start`.

## Decisões e trade-offs

| Decisão | Motivo |
| --- | --- |
| `concurrently` em vez de Turborepo | Resolve exatamente o problema pedido (rodar tudo com um comando) sem adotar um orquestrador novo com pipeline/cache que este monorepo não usa hoje |
| Hub é um app Next.js dedicado, não um HTML estático solto | Decisão explícita do usuário — consistência com o padrão do resto do monorepo (mesma stack, sobe com o mesmo `pnpm dev:hub`) |
| Hub sem status ao vivo | Decisão explícita do usuário — evita lógica de polling/checagem no client nesta v1 |
| Hub não reaproveita `SITES` de `packages/core/src/features.ts` | Esse registro é sobre funcionalidades ativas por site, não sobre URLs/portas de desenvolvimento local — são preocupações diferentes; lista de URLs fica hardcoded no próprio `apps/hub` |
| Portas fixas via flag `-p` no script `dev` de cada app | Forma mais simples de eliminar o conflito de porta sem introduzir variável de ambiente nova |

## Próximos passos

1. Revisão deste spec pelo usuário.
2. Plano de implementação (`writing-plans`): (a) portas fixas nos 4 apps existentes +
   scripts `dev:admin`/`dev:all` no root, (b) criação do `apps/hub` com a página de links.
