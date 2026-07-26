import type { Channel } from "@mypet/core/channels";
import { SITES } from "@mypet/core/features";

export const clientConfig = {
  name: "MAD PET",
  tagline: "Acessórios de fabricação própria para cães e gatos",
  catalogChannel: "azpetshop" satisfies Channel,
  brand: "MAD PET",
  whatsappNumber: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "5511982053694",
  mainSiteUrl: "https://www.mypetbrasil.com.br",
  distribuidoraUrl: "https://www.distribuidorapetshop.com.br",
  marketplaceUrl: "",
  features: SITES.azpetshop.features,
};
