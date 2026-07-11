"use client";

import { useState } from "react";
import type { Palette } from "../theme";
import type { CatalogProduct } from "../catalog-utils";
import { askAssistant, type AssistantMessage, type AssistantProfileOption } from "../assistant-client";
import { ProductCard } from "./product-card";

const SUGESTOES_INICIAIS = [
  "Quero montar um pet shop do zero",
  "Preciso de produtos para banho e tosa",
  "Buscar ração para filhotes",
];

export function AssistantSearch({ channel, palette }: { channel: string; palette: Palette }) {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState<string | null>(null);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [profileOptions, setProfileOptions] = useState<AssistantProfileOption[]>([]);
  const [lastUserMessage, setLastUserMessage] = useState<string | null>(null);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const nextMessages: AssistantMessage[] = [...messages, { role: "user", content: trimmed }];
    setLastUserMessage(trimmed);
    setInput("");
    setError(null);
    setLoading(true);
    setProfileOptions([]);

    const result = await askAssistant(channel, nextMessages);

    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setReply(result.reply);
    setProducts(result.products);
    setProfileOptions(result.profileOptions ?? []);
    setMessages([...nextMessages, { role: "assistant", content: result.reply }]);
  }

  return (
    <section
      style={{
        maxWidth: 760,
        margin: "0 auto 56px",
        background: palette.white,
        borderRadius: 24,
        padding: "32px 28px",
        boxShadow: "0 24px 60px rgba(15,31,69,0.18)",
        position: "relative",
      }}
    >
      <h2 style={{ fontSize: 22, fontWeight: 900, color: palette.navy, marginBottom: 4, textAlign: "center" }}>
        O que você está procurando hoje?
      </h2>
      <p style={{ fontSize: 14, color: palette.gray600, marginBottom: 20, textAlign: "center" }}>
        Descreva o que precisa — a gente entende se você é pet shop ou banho e tosa e recomenda os produtos certos.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage(input);
        }}
        style={{ display: "flex", gap: 8, marginBottom: 16 }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Digite o que procura ou faça uma pergunta"
          aria-label="Mensagem para o assistente de compras"
          style={{
            flex: 1,
            padding: "14px 18px",
            borderRadius: 14,
            border: `1.5px solid ${palette.gray200}`,
            fontSize: 15,
          }}
        />
        <button type="submit" className="cta-primary" disabled={loading} style={{ padding: "0 24px" }}>
          {loading ? "..." : "➤"}
        </button>
      </form>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          justifyContent: "center",
          marginBottom: reply ? 24 : 0,
        }}
      >
        {SUGESTOES_INICIAIS.map((s) => (
          <button key={s} type="button" onClick={() => sendMessage(s)} className="cat-btn" disabled={loading}>
            {s}
          </button>
        ))}
      </div>

      {error && <p style={{ color: "#B42318", fontSize: 14, textAlign: "center", marginTop: 16 }}>{error}</p>}

      {reply && (
        <div style={{ marginTop: 8 }}>
          {lastUserMessage && (
            <p style={{ fontSize: 13, color: palette.gray400, marginBottom: 8 }}>Você: {lastUserMessage}</p>
          )}
          <p style={{ fontSize: 15, color: palette.gray800, lineHeight: 1.6, marginBottom: 16 }}>{reply}</p>

          {profileOptions.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
              {profileOptions.map((opt: AssistantProfileOption) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => sendMessage(opt.value)}
                  className="cat-btn"
                  disabled={loading}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {products.length > 0 && (
            <div
              className="products-grid"
              style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16 }}
            >
              {products.map((product: CatalogProduct) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
