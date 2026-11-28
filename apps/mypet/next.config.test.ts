import { describe, it, expect } from "vitest";
import nextConfig from "./next.config";

describe("next.config rewrites", () => {
  it("/jornal-ofertas abre a edição estática publicada em public/", async () => {
    const rewrites = await nextConfig.rewrites!();
    expect(rewrites).toContainEqual({ source: "/jornal-ofertas", destination: "/jornal-ofertas/index.html" });
  });
});
