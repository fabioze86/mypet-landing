import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClientConfigProvider } from "@mypet/core/theme";
import { clientConfig } from "@/client.config";
import { __resetIdentityForTests, readIdentity, saveIdentity } from "./identity-store";
import { IdentityGateProvider, useIdentityGate } from "./identity-gate";

const fetchMock = vi.fn();

function Reopen() {
  const { openIdentityGate } = useIdentityGate();
  return <button onClick={openIdentityGate}>Alterar dados</button>;
}

function renderGate() {
  return render(
    <ClientConfigProvider config={clientConfig}>
      <IdentityGateProvider>
        <p>conteúdo</p>
        <Reopen />
      </IdentityGateProvider>
    </ClientConfigProvider>,
  );
}

function fill(nome: string, whatsapp: string, cnpj = "") {
  fireEvent.change(screen.getByLabelText("Seu nome"), { target: { value: nome } });
  fireEvent.change(screen.getByLabelText("WhatsApp com DDD"), { target: { value: whatsapp } });
  fireEvent.change(screen.getByLabelText("CNPJ (opcional)"), { target: { value: cnpj } });
  fireEvent.click(screen.getByRole("button", { name: "Acessar catálogo" }));
}

beforeEach(() => {
  localStorage.clear();
  __resetIdentityForTests();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("IdentityGateProvider", () => {
  it("abre sem identidade e não tem botão de fechar", () => {
    renderGate();
    expect(screen.getByRole("dialog", { name: "Acesse o catálogo" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Fechar" })).toBeNull();
  });

  it("não abre quando já identificado", () => {
    saveIdentity({ nome: "Ana", whatsapp: "5511999998888", cnpj: null });
    renderGate();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("mascara os campos ao digitar", () => {
    renderGate();
    fireEvent.change(screen.getByLabelText("WhatsApp com DDD"), { target: { value: "11999998888" } });
    fireEvent.change(screen.getByLabelText("CNPJ (opcional)"), { target: { value: "11222333000181" } });
    expect(screen.getByLabelText("WhatsApp com DDD")).toHaveValue("(11) 99999-8888");
    expect(screen.getByLabelText("CNPJ (opcional)")).toHaveValue("11.222.333/0001-81");
  });

  it("valida no cliente sem chamar a API", () => {
    renderGate();
    fill("Ana", "123");
    expect(screen.getByText("Informe o WhatsApp com DDD.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("grava o lead, salva a identidade e fecha", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) });
    renderGate();
    await act(async () => fill("Ana", "(11) 99999-8888", "11.222.333/0001-81"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ nome: "Ana", whatsapp: "5511999998888", cnpj: "11222333000181" });
    expect(readIdentity()).toEqual({ nome: "Ana", whatsapp: "5511999998888", cnpj: "11222333000181" });
  });

  it("libera o site quando a API falha", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockRejectedValue(new Error("offline"));
    renderGate();
    await act(async () => fill("Ana", "11999998888"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(readIdentity()?.nome).toBe("Ana");
  });

  it("400 do servidor mostra o erro e mantém aberto", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 400, json: async () => ({ field: "cnpj", error: "CNPJ inválido." }) });
    renderGate();
    await act(async () => fill("Ana", "11999998888"));
    expect(await screen.findByText("CNPJ inválido.")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("Alterar dados reabre com os dados atuais e pode fechar", () => {
    saveIdentity({ nome: "Ana", whatsapp: "5511999998888", cnpj: null });
    renderGate();
    fireEvent.click(screen.getByRole("button", { name: "Alterar dados" }));
    expect(screen.getByLabelText("Seu nome")).toHaveValue("Ana");
    expect(screen.getByLabelText("WhatsApp com DDD")).toHaveValue("(11) 99999-8888");
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
