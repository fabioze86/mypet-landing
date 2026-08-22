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
    // scrollLeft + clientWidth = 1999.5: sem a guarda de -1px isso leria
    // canScrollNext=true (1999.5 < 2000); com a guarda, false (1999.5 < 1999 é falso).
    const state = computeArrowState({ scrollLeft: 799.5, clientWidth: 1200, scrollWidth: 2000 });
    expect(state.canScrollNext).toBe(false);
  });
});
