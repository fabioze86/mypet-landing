export type CommerceMode = "quote" | "cart";

/** Como o carrinho é finalizado: cotação no WhatsApp, pagamento online, ou os dois. */
export type CheckoutMode = "whatsapp" | "online" | "ambos";

export type Features = {
  commerce: CommerceMode;
  /** Ausente = "whatsapp" (comportamento anterior a esta feature). */
  checkout?: CheckoutMode;
};

/** No modo "cart" o preço aparece direto no card; no "quote" ele passa pelo PriceLockSlot (B2B). */
export function showsListPrice(features: Features): boolean {
  return features.commerce === "cart";
}

export function checkoutOptions(features: Features): { online: boolean; whatsapp: boolean } {
  const mode = features.checkout ?? "whatsapp";
  return { online: mode !== "whatsapp", whatsapp: mode !== "online" };
}

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
      { value: "cart", label: "Preço + carrinho (loja de consumidor)" },
    ],
  },
  {
    id: "checkout",
    label: "Finalização do pedido",
    description: "Como o cliente fecha o carrinho: cotação no WhatsApp, pagamento online, ou os dois.",
    options: [
      { value: "whatsapp", label: "WhatsApp (cotação)" },
      { value: "online", label: "Pagamento online (Asaas)" },
      { value: "ambos", label: "Os dois" },
    ],
  },
];

export type SiteId = "mypet" | "distribuidora" | "madpet" | "azpetshop" | "distribuidoraInstagram";

export const SITES: Record<SiteId, { name: string; features: Features }> = {
  mypet: {
    name: "My Pet Brasil",
    features: { commerce: "quote", checkout: "whatsapp" },
  },
  distribuidora: {
    name: "Distribuidora Petshop",
    features: { commerce: "quote", checkout: "whatsapp" },
  },
  madpet: {
    name: "MAD PET",
    features: { commerce: "quote", checkout: "whatsapp" },
  },
  azpetshop: {
    name: "AZ Pet Shop",
    features: { commerce: "cart", checkout: "ambos" },
  },
  distribuidoraInstagram: {
    name: "Distribuidora Pet Shop",
    features: { commerce: "cart", checkout: "whatsapp" },
  },
};
