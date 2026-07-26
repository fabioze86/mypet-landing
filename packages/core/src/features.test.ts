import { describe, it, expect } from "vitest";
import { SITES, FEATURE_REGISTRY, type SiteId, type Features } from "./features";

describe("features registry", () => {
  it("declara os 3 sites esperados", () => {
    const ids = Object.keys(SITES).sort();
    expect(ids).toEqual(["azpetshop", "distribuidora", "mypet"]);
  });

  it("cada site preenche todas as chaves de Features", () => {
    const featureKeys = FEATURE_REGISTRY.map((f) => f.id).sort();
    for (const siteId of Object.keys(SITES) as SiteId[]) {
      const site = SITES[siteId];
      const siteKeys = Object.keys(site.features).sort();
      expect(siteKeys).toEqual(featureKeys);
    }
  });

  it("cada valor ativo em SITES existe nas opções do FEATURE_REGISTRY", () => {
    for (const siteId of Object.keys(SITES) as SiteId[]) {
      const site = SITES[siteId];
      for (const [featureId, value] of Object.entries(site.features) as [keyof Features, string][]) {
        const def = FEATURE_REGISTRY.find((f) => f.id === featureId);
        expect(def, `sem FeatureDefinition para "${featureId}"`).toBeTruthy();
        const valid = def!.options.some((o) => o.value === value);
        expect(valid, `valor "${value}" inválido para "${featureId}"`).toBe(true);
      }
    }
  });

  it("todos os sites começam em modo cotação", () => {
    expect(SITES.mypet.features.commerce).toBe("quote");
    expect(SITES.distribuidora.features.commerce).toBe("quote");
    expect(SITES.azpetshop.features.commerce).toBe("quote");
  });
});
