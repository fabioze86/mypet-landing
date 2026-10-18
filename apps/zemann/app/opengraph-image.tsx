import { OG_SIZE, renderOg } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Zemann — Consultoria de Amazon para marcas e sellers";

export default function Image() {
  return renderOg("Venda mais na Amazon com quem opera uma marca lá todos os dias");
}
