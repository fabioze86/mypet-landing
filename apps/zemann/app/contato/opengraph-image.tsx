import { OG_SIZE, renderOg } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Fale com a Zemann";

export default function Image() {
  return renderOg("Fale com a Zemann");
}
