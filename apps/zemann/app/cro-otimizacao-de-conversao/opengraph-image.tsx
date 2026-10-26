import { OG_SIZE, renderOg } from "@/lib/og";
import { SERVICES } from "@/lib/services";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = SERVICES["cro"].title;

export default function Image() {
  return renderOg(SERVICES["cro"].title, "Agência de crescimento para e-commerce");
}
