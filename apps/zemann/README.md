# Zemann — site da agência de crescimento para e-commerce

App Next.js (porta 4106). Amazon é o carro-chefe; os outros 7 serviços vêm do catálogo `lib/services.ts`
(uma página por serviço, modelo único em `app/_components/service-page.tsx`).
Specs: `docs/superpowers/specs/2026-10-17-zemann-site-amazon-design.md` e
`docs/superpowers/specs/2026-10-25-zemann-agencia-servicos-design.md`.

## Rodar

    pnpm dev:zemann

Copie `.env.example` para `.env.local`. Sem SMTP, o formulário mostra erro de envio (esperado no dev).

## Publicar um guia ou case

1. Crie `content/guias/<slug>.mdx` (ou `content/cases/<slug>.mdx`) copiando o frontmatter de um existente.
2. Escreva com `draft: true` e confira com `ZEMANN_SHOW_DRAFTS=1 pnpm dev:zemann`.
3. Regras de todo guia: resposta direta no campo `answer` (2–3 frases), tabela ou passo a passo quando couber,
   pelo menos um dado real da operação, FAQ no frontmatter, `updatedAt` atualizado a cada revisão.
4. Remova todo comentário `REVISÃO` (o teste falha se um conteúdo publicado contiver essa marca).
5. Troque para `draft: false` (case: também `authorized: true`, só com autorização por escrito do cliente) e faça o commit.

## Dados da empresa

`site.config.ts`: e-mail, CNPJ, LinkedIn, nome do fundador e preço do diagnóstico. Campos `null` ficam ocultos.
