import { describe, it, expect } from "vitest";
import { CHANNELS, isChannel } from "./channels";

describe("CHANNELS", () => {
  it("contém exatamente os três canais de site", () => {
    expect(CHANNELS).toEqual(["mypetbrasil", "distribuidora", "azpetshop"]);
  });
});

describe("isChannel", () => {
  it("aceita os canais válidos", () => {
    expect(isChannel("mypetbrasil")).toBe(true);
    expect(isChannel("distribuidora")).toBe(true);
    expect(isChannel("azpetshop")).toBe(true);
  });

  it("rejeita valores inválidos", () => {
    expect(isChannel("amazon")).toBe(false);
    expect(isChannel("")).toBe(false);
    expect(isChannel(undefined)).toBe(false);
  });
});
