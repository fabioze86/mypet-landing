import type { Metadata } from "next";
import { madPetPalette as palette } from "@/client-theme";
import { AnnouncementBar } from "@/components/v2/announcement-bar";

export const metadata: Metadata = {
  title: "MAD PET | Catálogo de fabricação própria para revenda em pet shop",
  description:
    "Mosaico de linhas, vantagens de revenda, depoimentos de lojistas e pedido pelo WhatsApp. Bandanas, laços, peitorais e coleiras MAD PET de fabricação própria.",
};

export default function HomeV2() {
  return (
    <div id="topo" style={{ background: palette.white, minHeight: "100vh" }}>
      <AnnouncementBar />
    </div>
  );
}
