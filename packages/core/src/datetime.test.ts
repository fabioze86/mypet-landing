import { describe, it, expect } from "vitest";
import { localDateTimeToIsoUtc } from "./datetime";

describe("localDateTimeToIsoUtc", () => {
  it("retorna null para string vazia", () => {
    expect(localDateTimeToIsoUtc("")).toBeNull();
  });

  it("retorna null para string em branco", () => {
    expect(localDateTimeToIsoUtc("   ")).toBeNull();
  });

  it("retorna null para string inválida", () => {
    expect(localDateTimeToIsoUtc("não é uma data")).toBeNull();
  });

  it("converte um datetime-local (sem fuso) para o ISO UTC equivalente em -03:00", () => {
    expect(localDateTimeToIsoUtc("2026-09-20T18:00")).toBe("2026-09-20T21:00:00.000Z");
  });

  it("aceita datetime-local com segundos", () => {
    expect(localDateTimeToIsoUtc("2026-09-20T18:00:30")).toBe("2026-09-20T21:00:30.000Z");
  });

  it("repassa uma string ISO já em UTC (Z) sem dobrar a conversão", () => {
    expect(localDateTimeToIsoUtc("2026-09-20T21:00:00.000Z")).toBe("2026-09-20T21:00:00.000Z");
  });

  it("repassa uma string ISO já com offset explícito sem dobrar a conversão", () => {
    expect(localDateTimeToIsoUtc("2026-09-20T18:00:00-03:00")).toBe("2026-09-20T21:00:00.000Z");
  });

  it("aceita um offset customizado", () => {
    expect(localDateTimeToIsoUtc("2026-09-20T18:00", "+00:00")).toBe("2026-09-20T18:00:00.000Z");
  });
});
