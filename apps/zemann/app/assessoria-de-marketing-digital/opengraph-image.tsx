import { OG_SIZE, renderOg } from "@/lib/og";
import { SERVICES } from "@/lib/services";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = SERVICES["assessoria"].title;

export default function Image() {
  return renderOg(SERVICES["assessoria"].title, "Agência de crescimento para e-commerce");
}
