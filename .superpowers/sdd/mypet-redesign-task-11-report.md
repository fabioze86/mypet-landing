# Task 11: Institucional

## Status

Implementação validada e commitada. A faixa institucional agora apresenta três pontos enxutos, cada um com ícone Phosphor SSR, mantendo `categoryCount` e o heading acessível `Como a My Pet opera`.

## Alterações

- `institutional-trust.tsx`: adicionados `Storefront`, `Stack` e `Headset` via `PaIcon`; copy reduzida para uma frase por ponto; wrapper e grid ajustados.
- `styles.ts`: bloco institucional atualizado para três colunas, ícones verdes, espaçamento consistente e empilhamento abaixo de 900px.
- `institutional-trust.test.tsx`: teste de três pontos, conteúdo e presença dos três SVGs.

## TDD e verificação

- RED: o teste fornecido pela task descreve o comportamento ausente no estado-base (o componente anterior não renderizava SVGs e não tinha `PaIcon`); o diff pré-existente já continha o ciclo RED preparado antes desta validação.
- GREEN: `pnpm --filter mypet test pre-access/institutional-trust --pool=threads --maxWorkers=1` — 1 arquivo e 1 teste passaram.
- Suíte: `pnpm --filter mypet test` — 19 arquivos e 45 testes passaram.
- `git diff --check` sem erros.

## Self-review

O componente continua Server Component, sem `use client`, e importa apenas o helper SSR existente. Não foram alterados arquivos fora do escopo da task; arquivos não relacionados em `.github/skills/` ficaram fora do commit.

## Fix round 1

Revisão identificou que o bloco institucional não aplicava nenhum token de raio. O teste foi ampliado para exigir `border-radius: var(--pa-r-pill)` no bloco `.pa-inst-icon` (RED: falhou com 1 de 2 testes). A correção mínima transformou o wrapper visual do ícone em um contêiner 40×40 com fundo verde suave e raio pill, sem adicionar raio aos itens ou convertê-los em cards.

Comando GREEN: `pnpm --filter mypet test pre-access/institutional-trust --pool=threads --maxWorkers=1` — 1 arquivo e 2 testes passaram.
