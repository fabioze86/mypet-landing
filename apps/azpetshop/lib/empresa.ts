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

// Trava de publicação: enquanto true, o build de produção na Vercel é bloqueado (ver next.config.ts).
// Liberada em 2026-11-09 com os dados reais da DPZ Commerce.
export const DADOS_DE_EXEMPLO = false;

// Dados reais (informados pelo usuário em 2026-11-09). Bairro e CEP conferidos no ViaCEP.
// Fonte única para rodapé, políticas e JSON-LD.
export const EMPRESA: Empresa = {
  razaoSocial: "DPZ Commerce Ltda",
  nomeFantasia: "AZ Pet Shop",
  cnpj: "67145989000100",
  endereco: {
    logradouro: "Rua Alencar Araripe",
    numero: "212",
    complemento: "Andar 3",
    bairro: "Sacomã",
    cidade: "São Paulo",
    uf: "SP",
    cep: "04253000",
  },
  email: "contato@azpetshop.com.br",
  whatsapp: "5511940091284",
  horario: "Segunda a sexta, das 8h às 17h",
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
