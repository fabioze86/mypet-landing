export type CommerceMode = "quote" | "cart";

export type Features = {
  commerce: CommerceMode;
};

export type FeatureDefinition = {
  id: keyof Features;
  label: string;
  description: string;
  options: { value: string; label: string }[];
};

export const FEATURE_REGISTRY: FeatureDefinition[] = [
  {
    id: "commerce",
    label: "Modelo comercial",
    description:
      "Como o site apresenta preço e converte o visitante em contato/venda.",
    options: [
      { value: "quote", label: "Cotação (preço fechado + WhatsApp)" },
      { value: "cart", label: "Preço + carrinho (não implementado ainda)" },
    ],
  },
];

export type SiteId = "mypet" | "distribuidora" | "azpetshop";

export const SITES: Record<SiteId, { name: string; features: Features }> = {
  mypet: {
    name: "My Pet Brasil",
    features: { commerce: "quote" },
  },
  distribuidora: {
    name: "Distribuidora Petshop",
    features: { commerce: "quote" },
  },
  azpetshop: {
    name: "MAD PET",
    features: { commerce: "quote" },
  },
};
