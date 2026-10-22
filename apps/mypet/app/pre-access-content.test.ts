import { describe, it, expect } from "vitest";
import {
  commercialConditions,
  whyBuyPoints,
  steps,
} from "./pre-access-content";

describe("pre-access-content", () => {
  it("cada condição comercial tem um ícone", () => {
    expect(commercialConditions).toHaveLength(3);
    for (const c of commercialConditions) {
      expect(typeof c.icon).toBe("string");
      expect(c.icon.length).toBeGreaterThan(0);
    }
  });

  it("tem exatamente 4 pontos de confiança", () => {
    expect(whyBuyPoints).toHaveLength(4);
    for (const p of whyBuyPoints) {
      expect(p.heading.trim()).not.toBe("");
      expect(p.body.trim()).not.toBe("");
    }
  });

  it("tem exatamente 4 passos", () => {
    expect(steps).toHaveLength(4);
  });

  it("nenhum texto de conteúdo usa em-dash ou en-dash", () => {
    const blob = JSON.stringify({
      commercialConditions,
      whyBuyPoints,
      steps,
    });
    expect(blob).not.toMatch(/[–—]/);
  });
});
