import { describe, it, expect } from "vitest";
import { ALL_CHANNEL_KINDS, CHANNELS, CHANNEL_LABELS, isChannel } from "./channels";

describe("CHANNELS", () => {
  it("contém todos os canais de site", () => {
    expect(CHANNELS).toEqual(["mypetbrasil", "distribuidora", "azpetshop", "ffa_fabrica"]);
  });

  it("mantém todos os tipos de canal", () => {
    expect(ALL_CHANNEL_KINDS).toEqual(["mypetbrasil", "distribuidora", "azpetshop", "ffa_fabrica"]);
  });
});

describe("isChannel", () => {
  it("aceita os canais válidos", () => {
    expect(isChannel("mypetbrasil")).toBe(true);
    expect(isChannel("distribuidora")).toBe(true);
    expect(isChannel("azpetshop")).toBe(true);
    expect(isChannel("ffa_fabrica")).toBe(true);
  });

  it("rejeita valores inválidos", () => {
    expect(isChannel("amazon")).toBe(false);
    expect(isChannel("")).toBe(false);
    expect(isChannel(undefined)).toBe(false);
  });
});

describe("CHANNEL_LABELS", () => {
  it("expõe o label da fábrica", () => {
    expect(CHANNEL_LABELS.ffa_fabrica).toBe("FFA Fábrica");
  });
});
