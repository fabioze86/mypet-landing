import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClientConfigProvider } from "@mypet/core/theme";
import { CartProvider, useCart } from "@mypet/core/components/cart-provider";
import { clientConfig } from "@/client.config";
import { __resetIdentityForTests, readIdentity, saveIdentity } from "./identity-store";
import { IdentityGateProvider, useIdentityGate } from "./identity-gate";

const nav = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));

const fetchMock = vi.fn();

function Reopen() {
  const { openIdentityGate } = useIdentityGate();
  return <button onClick={openIdentityGate}>Alterar dados</button>;
}

function AddToCart() {
  const { addItem } = useCart();
  return (
    <button onClick={() => addItem({ id: "p1", name: "Coleira", sku: "COL-1", brand: null, img: "/c.jpg", unitPrice: 10 }, 1)}>
      Adicionar
    </button>
  );
}

function seedCart() {
  localStorage.setItem(
    "mypet_cart",
    JSON.stringify({ items: [{ id: "p1", name: "Coleira", sku: "COL-1", brand: null, img: "/c.jpg", qty: 1, unitPrice: 10 }] }),
  );
}

function renderGate() {
  return render(
    <ClientConfigProvider config={clientConfig}>
      <CartProvider>
        <IdentityGateProvider>
          <p>conteúdo</p>
          <Reopen />
          <AddToCart />
        </IdentityGateProvider>
      </CartProvider>
    </ClientConfigProvider>,
  );
}

function fill(nome: string, whatsapp: string, cnpj = "") {
  fireEvent.change(screen.getByLabelText("Seu nome"), { target: { value: nome } });
  fireEvent.change(screen.getByLabelText("WhatsApp com DDD"), { target: { value: whatsapp } });
  fireEvent.change(screen.getByLabelText("CNPJ (opcional)"), { target: { value: cnpj } });
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
}

beforeEach(() => {
  nav.pathname = "/";
  localStorage.clear();
  __resetIdentityForTests();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("IdentityGateProvider", () => {
  it("sem identidade e carrinho vazio: navegação livre, sem pop-up", () => {
    renderGate();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("sem identidade e com item no carrinho: abre obrigatório, sem botão de fechar", () => {
    seedCart();
    renderGate();
    expect(screen.getByRole("dialog", { name: "Quase lá!" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Fechar" })).toBeNull();
  });

  it("abre no primeiro Adicionar depois de montado", () => {
    renderGate();
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    expect(screen.getByRole("dialog", { name: "Quase lá!" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Fechar" })).toBeNull();
  });

  it.each(["/entrar", "/completar-cadastro", "/pedidos", "/pedidos/123"])("não abre em %s mesmo com carrinho cheio", (path) => {
    nav.pathname = path;
    seedCart();
    renderGate();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Alterar dados funciona em página isenta", () => {
    nav.pathname = "/entrar";
    seedCart();
    renderGate();
    fireEvent.click(screen.getByRole("button", { name: "Alterar dados" }));
    expect(screen.getByRole("dialog", { name: "Quase lá!" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fechar" })).toBeInTheDocument();
  });

  it("não abre quando já identificado", () => {
    saveIdentity({ nome: "Ana", whatsapp: "5511999998888", cnpj: null });
    seedCart();
    renderGate();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("mascara os campos ao digitar", () => {
    seedCart();
    renderGate();
    fireEvent.change(screen.getByLabelText("WhatsApp com DDD"), { target: { value: "11999998888" } });
    fireEvent.change(screen.getByLabelText("CNPJ (opcional)"), { target: { value: "11222333000181" } });
    expect(screen.getByLabelText("WhatsApp com DDD")).toHaveValue("(11) 99999-8888");
    expect(screen.getByLabelText("CNPJ (opcional)")).toHaveValue("11.222.333/0001-81");
  });

  it("valida no cliente sem chamar a API", () => {
    seedCart();
    renderGate();
    fill("Ana", "123");
    expect(screen.getByText("Informe o WhatsApp com DDD.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("grava o lead, salva a identidade e fecha", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) });
    seedCart();
    renderGate();
    await act(async () => fill("Ana", "(11) 99999-8888", "11.222.333/0001-81"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ nome: "Ana", whatsapp: "5511999998888", cnpj: "11222333000181" });
    expect(readIdentity()).toEqual({ nome: "Ana", whatsapp: "5511999998888", cnpj: "11222333000181" });
  });

  it("libera o site quando a API falha", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockRejectedValue(new Error("offline"));
    seedCart();
    renderGate();
    await act(async () => fill("Ana", "11999998888"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(readIdentity()?.nome).toBe("Ana");
  });

  it("400 do servidor mostra o erro e mantém aberto", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 400, json: async () => ({ field: "cnpj", error: "CNPJ inválido." }) });
    seedCart();
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

  it("erro marca o campo (aria) e some ao editar o campo", () => {
    seedCart();
    renderGate();
    fill("Ana", "123");
    const whatsapp = screen.getByLabelText("WhatsApp com DDD");
    expect(whatsapp).toHaveAttribute("aria-invalid", "true");
    expect(whatsapp).toHaveAccessibleDescription("Informe o WhatsApp com DDD.");
    fireEvent.change(whatsapp, { target: { value: "1199" } });
    expect(screen.queryByText("Informe o WhatsApp com DDD.")).toBeNull();
    expect(whatsapp).not.toHaveAttribute("aria-invalid");
  });

  it("duplo envio grava um lead só", async () => {
    let resolve!: (v: unknown) => void;
    fetchMock.mockReturnValue(new Promise((r) => { resolve = r; }));
    seedCart();
    renderGate();
    fireEvent.change(screen.getByLabelText("Seu nome"), { target: { value: "Ana" } });
    fireEvent.change(screen.getByLabelText("WhatsApp com DDD"), { target: { value: "11999998888" } });
    const form = screen.getByRole("button", { name: "Continuar" }).closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    await act(async () => resolve({ ok: true, status: 200, json: async () => ({ ok: true }) }));
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("Alterar dados sem mudança só fecha, sem chamar /api/leads", async () => {
    saveIdentity({ nome: "Ana", whatsapp: "5511999998888", cnpj: null });
    renderGate();
    fireEvent.click(screen.getByRole("button", { name: "Alterar dados" }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Continuar" })));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("Alterar dados com mudança grava o lead novo", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) });
    saveIdentity({ nome: "Ana", whatsapp: "5511999998888", cnpj: null });
    renderGate();
    fireEvent.click(screen.getByRole("button", { name: "Alterar dados" }));
    await act(async () => fill("Ana Souza", "(11) 99999-8888"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(readIdentity()?.nome).toBe("Ana Souza");
  });
});
