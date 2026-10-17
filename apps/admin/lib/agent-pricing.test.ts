import { describe, it, expect } from "vitest";
import { MODEL_PRICES_USD_PER_MILLION, estimateCostUsd, formatUsd, totalCostUsd } from "./agent-pricing";

describe("estimateCostUsd", () => {
  it("gpt-4o-mini: 1M de entrada e 1M de saída", () => {
    expect(estimateCostUsd("gpt-4o-mini", 1_000_000, 1_000_000)).toBeCloseTo(0.75, 6);
  });
  it("gemini-2.5-flash e claude-haiku-4-5 estão na tabela", () => {
    expect(estimateCostUsd("gemini-2.5-flash", 1_000_000, 0)).toBeCloseTo(MODEL_PRICES_USD_PER_MILLION["gemini-2.5-flash"].input, 6);
    expect(estimateCostUsd("claude-haiku-4-5", 0, 1_000_000)).toBeCloseTo(MODEL_PRICES_USD_PER_MILLION["claude-haiku-4-5"].output, 6);
  });
  it("tokens nulos contam como zero", () => {
    expect(estimateCostUsd("gpt-4o-mini", null, null)).toBe(0);
  });
  it("modelo desconhecido ou ausente → null", () => {
    expect(estimateCostUsd("modelo-x", 10, 10)).toBeNull();
    expect(estimateCostUsd(null, 10, 10)).toBeNull();
  });
});

describe("totalCostUsd", () => {
  it("soma os modelos com preço e lista os sem preço", () => {
    const result = totalCostUsd([
      { model: "gpt-4o-mini", input_tokens: 1_000_000, output_tokens: 0 },
      { model: "modelo-x", input_tokens: 500, output_tokens: 500 },
    ]);
    expect(result.costUsd).toBeCloseTo(0.15, 6);
    expect(result.unpricedModels).toEqual(["modelo-x"]);
  });
  it("lista vazia → zero", () => {
    expect(totalCostUsd([])).toEqual({ costUsd: 0, unpricedModels: [] });
  });
});

describe("formatUsd", () => {
  it("duas casas, padrão brasileiro", () => {
    expect(formatUsd(1.5)).toBe("US$ 1,50");
  });
  it("zero", () => {
    expect(formatUsd(0)).toBe("US$ 0,00");
  });
  it("valor positivo abaixo de 1 centavo", () => {
    expect(formatUsd(0.0004)).toBe("< US$ 0,01");
  });
});
