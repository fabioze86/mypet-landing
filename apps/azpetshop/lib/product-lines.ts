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
    bannerTitle: "Bandanas MAD PET",
    bannerCopy: "Estampas divertidas pra deixar qualquer pet com aquele toque doidão.",
  },
  {
    slug: "lacos",
    label: "Laços",
    categoryId: "af0d7456-9a3b-52e0-a406-a9b3c3e268fd",
    bannerTitle: "Laços MAD PET",
    bannerCopy: "Pra ocasiões especiais — ou pra todo dia, sem julgamento.",
  },
  {
    slug: "peitorais",
    label: "Peitorais",
    categoryId: "cb601178-eeb2-53ff-8361-d9f673259e8d",
    bannerTitle: "Peitorais MAD PET",
    bannerCopy: "Conforto e resistência pros passeios mais doidos.",
  },
  {
    slug: "coleiras",
    label: "Coleiras",
    categoryId: "595fe241-fa35-5da6-8592-e49569d82a11",
    bannerTitle: "Coleiras MAD PET",
    bannerCopy: "Cores vibrantes que combinam com a personalidade mad do seu pet.",
  },
];
