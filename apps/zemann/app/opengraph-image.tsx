import { OG_SIZE, renderOg } from "@/lib/og";
import { PAGES } from "@/lib/pages";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = PAGES.home.title;

export default function Image() {
  return renderOg("Mais vendas online, com um time que executa junto com o seu", "Agência de crescimento para e-commerce");
}
