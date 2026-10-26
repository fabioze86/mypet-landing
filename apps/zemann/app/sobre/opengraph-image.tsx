import { OG_SIZE, renderOg } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Sobre a Zemann";

export default function Image() {
  return renderOg("Sobre a Zemann", "Agência de crescimento para e-commerce");
}
