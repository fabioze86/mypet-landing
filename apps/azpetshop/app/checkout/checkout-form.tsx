"use client";

import { useState } from "react";
import { useCart } from "@mypet/core/components/cart-provider";
import { formatBRL } from "@mypet/core/catalog-utils";
import { formatCep, formatCpf, formatWhatsapp, onlyDigits } from "@mypet/core/br-validation";
import type { ShippingOption } from "@mypet/core/melhor-envio";
import { clientConfig } from "@/client.config";
import { cotarFrete, iniciarPagamento } from "./actions";

const { palette: P } = clientConfig;
const field = { display: "flex", flexDirection: "column" as const, gap: 4, fontSize: 13, fontWeight: 700, color: P.navy };
const input = { padding: "10px 12px", border: `1.5px solid ${P.gray200}`, borderRadius: 10, fontSize: 15, fontWeight: 400 };

export function CheckoutForm() {
  const { cart } = useCart();
  const items = cart.items.map((i) => ({ id: i.id, qty: i.qty }));
  const [customer, setCustomer] = useState({ nome: "", cpf: "", email: "", whatsapp: "" });
  const [address, setAddress] = useState({ cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "" });
  const [subtotal, setSubtotal] = useState<number | null>(null);
  const [options, setOptions] = useState<ShippingOption[]>([]);
  const [serviceId, setServiceId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const shipping = options.find((o) => o.serviceId === serviceId) ?? null;
  const total = subtotal !== null && shipping ? Math.round((subtotal + shipping.price) * 100) / 100 : null;

  async function calcularFrete() {
    setError("");
    setBusy(true);
    setOptions([]);
    setServiceId(null);
    const cep = onlyDigits(address.cep);
    try {
      const via = await fetch(`https://viacep.com.br/ws/${cep}/json/`).then((r) => r.json());
      if (via && !via.erro) {
        setAddress((a) => ({ ...a, logradouro: via.logradouro || a.logradouro, bairro: via.bairro || a.bairro, cidade: via.localidade || a.cidade, uf: via.uf || a.uf }));
      }
    } catch {
      // Sem ViaCEP o cliente preenche o endereço à mão.
    }
    const r = await cotarFrete({ items, cep });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setSubtotal(r.subtotal);
    setOptions(r.options);
  }

  async function pagar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const r = await iniciarPagamento({ items, customer, address, shippingServiceId: serviceId });
    if (!r.ok) {
      setBusy(false);
      return setError(r.error);
    }
    window.location.assign(r.paymentUrl);
  }

  if (cart.items.length === 0) return <p>Seu carrinho está vazio.</p>;

  return (
    <form onSubmit={pagar} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <fieldset style={{ border: "none", display: "grid", gap: 12 }}>
        <legend style={{ fontWeight: 900, fontSize: 18, color: P.navy, marginBottom: 8 }}>Seus dados</legend>
        <label style={field}>Nome completo<input style={input} value={customer.nome} onChange={(e) => setCustomer({ ...customer, nome: e.target.value })} autoComplete="name" required /></label>
        <label style={field}>CPF<input style={input} value={customer.cpf} onChange={(e) => setCustomer({ ...customer, cpf: formatCpf(e.target.value) || e.target.value })} inputMode="numeric" required /></label>
        <label style={field}>E-mail<input style={input} type="email" value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} autoComplete="email" required /></label>
        <label style={field}>WhatsApp<input style={input} value={customer.whatsapp} onChange={(e) => setCustomer({ ...customer, whatsapp: formatWhatsapp(e.target.value) })} inputMode="tel" autoComplete="tel" required /></label>
      </fieldset>

      <fieldset style={{ border: "none", display: "grid", gap: 12 }}>
        <legend style={{ fontWeight: 900, fontSize: 18, color: P.navy, marginBottom: 8 }}>Entrega</legend>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <label style={{ ...field, flex: 1 }}>CEP<input style={input} value={address.cep} onChange={(e) => setAddress({ ...address, cep: formatCep(e.target.value) || e.target.value })} inputMode="numeric" autoComplete="postal-code" required /></label>
          <button type="button" onClick={calcularFrete} disabled={busy} className="cta-primary">Calcular frete</button>
        </div>
        <label style={field}>Rua<input style={input} value={address.logradouro} onChange={(e) => setAddress({ ...address, logradouro: e.target.value })} required /></label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>
          <label style={field}>Número<input style={input} value={address.numero} onChange={(e) => setAddress({ ...address, numero: e.target.value })} required /></label>
          <label style={field}>Complemento<input style={input} value={address.complemento} onChange={(e) => setAddress({ ...address, complemento: e.target.value })} /></label>
        </div>
        <label style={field}>Bairro<input style={input} value={address.bairro} onChange={(e) => setAddress({ ...address, bairro: e.target.value })} required /></label>
        <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr", gap: 8 }}>
          <label style={field}>Cidade<input style={input} value={address.cidade} onChange={(e) => setAddress({ ...address, cidade: e.target.value })} required /></label>
          <label style={field}>UF<input style={input} value={address.uf} maxLength={2} onChange={(e) => setAddress({ ...address, uf: e.target.value.toUpperCase() })} required /></label>
        </div>

        {options.length > 0 && (
          <div role="radiogroup" aria-label="Opções de frete" style={{ display: "grid", gap: 8 }}>
            {options.map((o) => (
              <label key={o.serviceId} style={{ display: "flex", gap: 10, alignItems: "center", padding: 12, border: `1.5px solid ${serviceId === o.serviceId ? P.pink : P.gray200}`, borderRadius: 10 }}>
                <input type="radio" name="frete" checked={serviceId === o.serviceId} onChange={() => setServiceId(o.serviceId)} />
                <span style={{ flex: 1 }}>{`${o.company} ${o.name}`.trim()}{o.deliveryDays ? ` — até ${o.deliveryDays} dias úteis` : ""}</span>
                <b>{formatBRL(o.price)}</b>
              </label>
            ))}
          </div>
        )}
      </fieldset>

      {subtotal !== null && (
        <div style={{ background: P.white, border: `1px solid ${P.gray200}`, borderRadius: 12, padding: 16, display: "grid", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span>Produtos</span><span>{formatBRL(subtotal)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span>Frete</span><span>{shipping ? formatBRL(shipping.price) : "—"}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 900, fontSize: 18 }}><span>Total</span><span>{total !== null ? formatBRL(total) : "—"}</span></div>
          <p style={{ fontSize: 12, color: P.gray600 }}>Os valores são conferidos de novo antes do pagamento.</p>
        </div>
      )}

      {error && <p role="alert" style={{ color: P.pinkDark, fontWeight: 700 }}>{error}</p>}

      <button type="submit" className="cta-primary" disabled={busy || !shipping} style={{ padding: "14px 22px", fontSize: 16 }}>
        {busy ? "Aguarde…" : "Ir para o pagamento"}
      </button>
      <p style={{ fontSize: 12, color: P.gray600 }}>Você será levado à página segura do Asaas para pagar com Pix ou cartão.</p>
    </form>
  );
}
