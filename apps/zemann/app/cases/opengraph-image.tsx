import { OG_SIZE, renderOg } from "@/lib/og";
import { PAGES } from "@/lib/pages";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = PAGES.cases.title;

export default function Image() {
  return renderOg(PAGES.cases.title);
}
