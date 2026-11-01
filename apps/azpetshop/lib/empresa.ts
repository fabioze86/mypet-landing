import type { RetailConfig } from "@mypet/core/retail";

export type Empresa = {
  razaoSocial: string;
  nomeFantasia: string;
  /** Só dígitos. */
  cnpj: string;
  endereco: {
    logradouro: string;
    numero: string;
    complemento: string;
    bairro: string;
    cidade: string;
    uf: string;
    /** Só dígitos. */
    cep: string;
  };
  email: string;
  /** Só dígitos, com DDI 55. */
  whatsapp: string;
  horario: string;
};

// DADOS GENÉRICOS DE EXEMPLO (decisão do usuário em 2026-11-01) — trocar pelos reais antes do deploy de produção e do cadastro no Merchant Center. Vendedor oficial = mesmo CNPJ da My Pet / Grupo AZ. Fonte única para rodapé, políticas e JSON-LD.
export const EMPRESA: Empresa = {
  razaoSocial: "Empresa Exemplo Ltda",
  nomeFantasia: "AZ Pet Shop",
  cnpj: "11222333000181",
  endereco: {
    logradouro: "Rua Exemplo",
    numero: "100",
    complemento: "",
    bairro: "Centro",
    cidade: "São Paulo",
    uf: "SP",
    cep: "01001000",
  },
  email: "contato@azpetshop.com.br",
  whatsapp: "5511900000000",
  horario: "Segunda a sexta, das 9h às 18h",
};

export function enderecoEmLinha(e: Empresa["endereco"]): string {
  const rua = [e.logradouro, e.numero, e.complemento].filter(Boolean).join(", ");
  return `${rua} — ${e.bairro}, ${e.cidade}/${e.uf} — CEP ${e.cep.slice(0, 5)}-${e.cep.slice(5)}`;
}

export const RETAIL: RetailConfig = {
  installments: { max: 6, minInstallment: 30 },
  consultWhatsApp: EMPRESA.whatsapp,
};
