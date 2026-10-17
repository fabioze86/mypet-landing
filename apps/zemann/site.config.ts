// Dados da empresa. Campos null são preenchidos quando o Fábio fornecer
// (ver seção 6 do spec); a interface e o JSON-LD omitem o que for null.
export const siteConfig = {
  name: "Zemann",
  domain: "www.zemann.com.br",
  url: "https://www.zemann.com.br",
  tagline: "Consultoria de Amazon mão na massa para marcas e sellers",
  email: "contato@zemann.com.br",
  legalName: "DPZ COMMERCE",
  cnpj: "67.145.989/0001-00",
  linkedinUrl: null as string | null,
  founder: {
    name: "Fábio Zemann",
    jobTitle: "Consultor de Amazon e AI Product Manager",
  },
  diagnostic: {
    priceFrom: null as number | null,
    deliveryText: "até 10 dias úteis",
  },
};
