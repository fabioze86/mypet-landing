export type ProductLine = {
  slug: string;
  label: string;
  categoryId: string;
  bannerTitle: string;
  bannerCopy: string;
};

export const PRODUCT_LINES: ProductLine[] = [
  {
    slug: "bandanas",
    label: "Bandanas",
    categoryId: "6044f664-4c8b-58d6-9de3-a9114ea50819",
    bannerTitle: "Bandanas para revenda",
    bannerCopy:
      "Ticket baixo, compra por impulso e troca de estampa constante. O item que sai da vitrine sem esforço de venda.",
  },
  {
    slug: "lacos",
    label: "Laços",
    categoryId: "af0d7456-9a3b-52e0-a406-a9b3c3e268fd",
    bannerTitle: "Laços para revenda",
    bannerCopy:
      "Complemento de venda com boa saída em banho e tosa e em datas comemorativas. Fácil de expor perto do caixa.",
  },
  {
    slug: "peitorais",
    label: "Peitorais",
    categoryId: "cb601178-eeb2-53ff-8361-d9f673259e8d",
    bannerTitle: "Peitorais para revenda",
    bannerCopy:
      "Maior valor agregado da linha de passeio, com argumento técnico de conforto e ajuste. Grade do mini ao extra grande.",
  },
  {
    slug: "coleiras",
    label: "Coleiras",
    categoryId: "595fe241-fa35-5da6-8592-e49569d82a11",
    bannerTitle: "Coleiras para revenda",
    bannerCopy:
      "Item de recompra que combina com guia e peitoral. Poucos SKUs cobrem qualquer porte e puxam a venda casada.",
  },
];
