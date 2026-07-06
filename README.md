# My Pet Landing

Landing page B2B da My Pet Brasil para apresentar o catálogo de atacado, captar
leads de lojistas e liberar a visualização de preços após o cadastro.

## Visão geral

O projeto oferece:

- landing page responsiva para pet shops e distribuidores;
- catálogo demonstrativo com filtro por categoria;
- bloqueio visual dos preços antes do cadastro;
- formulário de captação de nome, empresa, WhatsApp e CNPJ;
- persistência dos leads em uma planilha do Google Sheets;
- feedback de carregamento e erro durante o envio.

> O catálogo, os preços e o estado de desbloqueio são demonstrativos e vivem no
> navegador. Atualmente não há autenticação, sessão persistente, carrinho ou
> integração com estoque.

## Tecnologias

- Next.js 16 com App Router
- React 19
- TypeScript
- Tailwind CSS 4/PostCSS
- Google Sheets API via `googleapis`
- ESLint com regras do Next.js e TypeScript

Para decisões de estrutura, responsabilidades e evolução, consulte
[ARCHITECTURE.md](./ARCHITECTURE.md).

## Pré-requisitos

- Node.js compatível com Next.js 16
- npm
- projeto no Google Cloud com a Google Sheets API habilitada
- conta de serviço com acesso de edição à planilha de destino

## Configuração

1. Instale as dependências:

```bash
npm install
```

2. Crie o arquivo `.env.local` na raiz:

```dotenv
GOOGLE_CREDENTIALS={"type":"service_account","project_id":"..."}
GOOGLE_SHEET_ID=id_da_planilha
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua_chave_anonima
NEXT_PUBLIC_WHATSAPP_NUMBER=5511999999999
```

`GOOGLE_CREDENTIALS` deve conter o JSON completo da conta de serviço. A planilha
precisa ter uma aba chamada `Leads`, e o e-mail da conta de serviço deve ter
permissão para editá-la.

`NEXT_PUBLIC_WHATSAPP_NUMBER` é o número de WhatsApp (DDI+DDD+número, só dígitos)
para onde o link da cotação consolidada é enviado. É uma variável pública (com
prefixo `NEXT_PUBLIC_`) porque compõe o link `wa.me` no navegador.

Não adicione `.env.local` ou credenciais ao controle de versão. Como
`GOOGLE_CREDENTIALS`, `GOOGLE_SHEET_ID`, `SUPABASE_URL` e `SUPABASE_ANON_KEY`
não usam o prefixo `NEXT_PUBLIC_`, permanecem disponíveis apenas no ambiente do
servidor.

### Estrutura da planilha

O endpoint adiciona uma linha no intervalo `Leads!A:E`:

| Coluna | Conteúdo |
| --- | --- |
| A | Data e hora do cadastro |
| B | Nome |
| C | Empresa |
| D | WhatsApp |
| E | CNPJ, quando informado |

## Executando localmente

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

## Scripts

| Comando | Finalidade |
| --- | --- |
| `npm run dev` | Inicia o servidor de desenvolvimento |
| `npm run build` | Gera o build de produção |
| `npm run start` | Executa o build de produção |
| `npm run lint` | Executa a análise estática |

## Fluxo de captação

1. O visitante acessa a página inicial e navega pelo catálogo.
2. Ao solicitar um preço, o formulário de cadastro é aberto.
3. O navegador envia um `POST` JSON para `/api/leads`.
4. O servidor valida os campos obrigatórios.
5. A API autentica no Google e adiciona o lead à planilha.
6. Após a resposta de sucesso, a interface libera os preços durante a sessão
   atual da página.

Exemplo de requisição:

```json
{
  "nome": "Maria",
  "empresa": "Pet Shop Exemplo",
  "whatsapp": "11999999999",
  "cnpj": "00.000.000/0001-00"
}
```

Respostas atuais:

- `200`: `{ "ok": true }`
- `400`: campos obrigatórios ausentes
- `500`: falha não tratada de configuração ou comunicação com o Google Sheets

## Estrutura principal

```text
app/
├── api/
│   └── leads/
│       └── route.ts     # POST /api/leads e integração com Google Sheets
├── globals.css          # estilos globais e configuração do Tailwind
├── layout.tsx           # layout raiz, fontes e metadados
└── page.tsx             # landing, catálogo, modal e estado da interface
public/                  # arquivos estáticos
next.config.ts           # configuração do Next.js
```

## Deploy

O projeto pode ser publicado em qualquer ambiente com suporte ao runtime do
Next.js. No provedor escolhido:

1. configure `GOOGLE_CREDENTIALS` e `GOOGLE_SHEET_ID`;
2. confirme o compartilhamento da planilha com a conta de serviço;
3. execute `npm run build`;
4. valide um cadastro real no ambiente publicado.

## Cuidados antes de produção

- adicionar validação de formato e limites de tamanho no servidor;
- tratar erros da Google Sheets API sem devolver detalhes sensíveis;
- implementar proteção contra spam e limitação de requisições;
- definir consentimento e política de privacidade para os dados pessoais;
- substituir catálogo e preços estáticos por uma fonte de dados confiável;
- persistir a liberação de preços com autenticação ou sessão segura, se ela
  representar uma regra comercial real.
