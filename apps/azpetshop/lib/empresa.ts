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

// Trava de publicação: enquanto true, o build de produção na Vercel é bloqueado (ver next.config.ts). Trocar para false junto com os dados reais da empresa e o checkout da fase 2.
export const DADOS_DE_EXEMPLO = true;

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

export function cepFormatado(cep: string): string {
  return `${cep.slice(0, 5)}-${cep.slice(5)}`;
}

export function ruaEmLinha(e: Empresa["endereco"]): string {
  return [e.logradouro, e.numero, e.complemento].filter(Boolean).join(", ");
}

export function enderecoEmLinha(e: Empresa["endereco"]): string {
  return `${ruaEmLinha(e)} — ${e.bairro}, ${e.cidade}/${e.uf} — CEP ${cepFormatado(e.cep)}`;
}

export const RETAIL: RetailConfig = {
  installments: { max: 6, minInstallment: 30 },
  consultWhatsApp: EMPRESA.whatsapp,
};
