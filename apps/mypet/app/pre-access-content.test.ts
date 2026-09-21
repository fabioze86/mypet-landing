import { describe, it, expect } from "vitest";
import {
  commercialConditions,
  quickAccessSteps,
  whyBuyPoints,
  steps,
  testimonials,
} from "./pre-access-content";

describe("pre-access-content", () => {
  it("cada condição comercial tem um ícone", () => {
    expect(commercialConditions).toHaveLength(3);
    for (const c of commercialConditions) {
      expect(typeof c.icon).toBe("string");
      expect(c.icon.length).toBeGreaterThan(0);
    }
  });

  it("tem exatamente 3 passos de consulta rápida", () => {
    expect(quickAccessSteps).toHaveLength(3);
    for (const s of quickAccessSteps) {
      expect(s.title.trim()).not.toBe("");
      expect(s.body.trim()).not.toBe("");
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

  it("tem 3 depoimentos com nome, cidade e loja", () => {
    expect(testimonials).toHaveLength(3);
    for (const t of testimonials) {
      expect(t.quote.trim()).not.toBe("");
      expect(t.name.trim()).not.toBe("");
      expect(t.city.trim()).not.toBe("");
      expect(t.store.trim()).not.toBe("");
    }
  });

  it("nenhum texto de conteúdo usa em-dash ou en-dash", () => {
    const blob = JSON.stringify({
      commercialConditions,
      quickAccessSteps,
      whyBuyPoints,
      steps,
      testimonials,
    });
    expect(blob).not.toMatch(/[–—]/);
  });
});
