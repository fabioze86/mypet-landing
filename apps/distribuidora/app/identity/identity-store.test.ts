import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { __resetIdentityForTests, readIdentity, saveIdentity, useIdentity } from "./identity-store";

const ana = { nome: "Ana", whatsapp: "5511999998888", cnpj: null };

beforeEach(() => {
  localStorage.clear();
  __resetIdentityForTests();
});

describe("identity-store", () => {
  it("começa vazio e persiste ao salvar", () => {
    expect(readIdentity()).toBeNull();
    saveIdentity(ana);
    expect(readIdentity()).toEqual(ana);
    expect(JSON.parse(localStorage.getItem("mypet_identity") ?? "null")).toEqual(ana);
  });

  it("ignora conteúdo corrompido", () => {
    localStorage.setItem("mypet_identity", "{lixo");
    expect(readIdentity()).toBeNull();
  });

  it("useIdentity reage ao salvar", () => {
    const { result } = renderHook(() => useIdentity());
    expect(result.current).toBeNull();
    act(() => saveIdentity(ana));
    expect(result.current).toEqual(ana);
  });

  it("sem localStorage ainda guarda em memória", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    saveIdentity(ana);
    expect(readIdentity()).toEqual(ana);
    setItem.mockRestore();
  });
});
