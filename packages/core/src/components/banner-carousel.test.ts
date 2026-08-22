import { describe, it, expect } from "vitest";
import { computeArrowState } from "./banner-carousel";

describe("computeArrowState", () => {
  it("desabilita as duas setas quando o conteudo cabe inteiro (sem overflow)", () => {
    const state = computeArrowState({ scrollLeft: 0, clientWidth: 1200, scrollWidth: 1200 });
    expect(state).toEqual({ canScrollPrev: false, canScrollNext: false });
  });

  it("habilita so a seta 'proximo' no inicio do scroll, quando ha mais conteudo a frente", () => {
    const state = computeArrowState({ scrollLeft: 0, clientWidth: 1200, scrollWidth: 2000 });
    expect(state).toEqual({ canScrollPrev: false, canScrollNext: true });
  });

  it("habilita as duas setas no meio do scroll", () => {
    const state = computeArrowState({ scrollLeft: 400, clientWidth: 1200, scrollWidth: 2000 });
    expect(state).toEqual({ canScrollPrev: true, canScrollNext: true });
  });

  it("habilita so a seta 'anterior' no fim do scroll", () => {
    const state = computeArrowState({ scrollLeft: 800, clientWidth: 1200, scrollWidth: 2000 });
    expect(state).toEqual({ canScrollPrev: true, canScrollNext: false });
  });

  it("tolera erro de arredondamento no fim do scroll (guarda de 1px)", () => {
    const state = computeArrowState({ scrollLeft: 799.6, clientWidth: 1200.4, scrollWidth: 2000 });
    expect(state.canScrollNext).toBe(false);
  });
});
