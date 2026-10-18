import { listCases, listGuides } from "@/lib/content";
import { buildSiteIndex, renderLlmsTxt } from "@/lib/site-index";

export const dynamic = "force-static";

export function GET() {
  return new Response(renderLlmsTxt(buildSiteIndex(listGuides(), listCases())), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
