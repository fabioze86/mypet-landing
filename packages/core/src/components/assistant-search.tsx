"use client";

import { useEffect, useRef, useState } from "react";
import type { Palette } from "../theme";
import type { CatalogProduct } from "../catalog-utils";
import { askAssistant, type AssistantMessage, type AssistantProfileOption } from "../assistant-client";
import { SELECTABLE_MODELS, type AssistantProvider } from "../ai-models";
import { ProductCard } from "./product-card";

const SUGESTOES_INICIAIS = [
  "Quero montar um pet shop do zero",
  "Preciso de produtos para banho e tosa",
  "Buscar ração para filhotes",
];

const ADMIN_KEY_STORAGE = "mypet-assistant-admin-key";

export function AssistantSearch({ channel, palette }: { channel: string; palette: Palette }) {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [profileOptions, setProfileOptions] = useState<AssistantProfileOption[]>([]);
  const [usedProvider, setUsedProvider] = useState<string | null>(null);
  const [adminKey, setAdminKey] = useState<string | null>(null);
  const [adminProvider, setAdminProvider] = useState<AssistantProvider>("openai");
  const [adminModel, setAdminModel] = useState(SELECTABLE_MODELS.openai[0]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const hasConversation = messages.length > 0;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  useEffect(() => {
    const publicKey = process.env.NEXT_PUBLIC_ASSISTANT_ADMIN_KEY;
    if (!publicKey) return;

    const fromUrl = new URLSearchParams(window.location.search).get("assistantAdmin");
    if (fromUrl && fromUrl === publicKey) {
      window.localStorage.setItem(ADMIN_KEY_STORAGE, fromUrl);
      setAdminKey(fromUrl);
      return;
    }

    const stored = window.localStorage.getItem(ADMIN_KEY_STORAGE);
    if (stored === publicKey) {
      setAdminKey(stored);
    }
  }, []);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const nextMessages: AssistantMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setError(null);
    setLoading(true);
    setProfileOptions([]);

    const result = await askAssistant(
      channel,
      nextMessages,
      adminKey ? { provider: adminProvider, model: adminModel, adminKey } : undefined,
    );

    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setProducts(result.products);
    setProfileOptions(result.profileOptions ?? []);
    setUsedProvider(result.usedProvider ?? null);
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

      {hasConversation && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            maxHeight: 360,
            overflowY: "auto",
            padding: "4px 4px 12px",
            marginBottom: 12,
          }}
        >
          {messages.map((message, index) => (
            <div
              key={index}
              style={{
                alignSelf: message.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "80%",
                background: message.role === "user" ? palette.navy : palette.gray100,
                color: message.role === "user" ? palette.white : palette.gray800,
                borderRadius: 14,
                padding: "10px 14px",
                fontSize: 15,
                lineHeight: 1.5,
              }}
            >
              {message.content}
            </div>
          ))}
          {loading && (
            <div
              style={{
                alignSelf: "flex-start",
                maxWidth: "80%",
                background: palette.gray100,
                color: palette.gray600,
                borderRadius: 14,
                padding: "10px 14px",
                fontSize: 15,
              }}
            >
              Digitando…
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {profileOptions.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
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

      {adminKey && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, fontSize: 12 }}>
          <select
            value={adminProvider}
            onChange={(e) => {
              const provider = e.target.value as AssistantProvider;
              setAdminProvider(provider);
              setAdminModel(SELECTABLE_MODELS[provider][0]);
            }}
            style={{ fontSize: 12, padding: "4px 6px", borderRadius: 8, border: `1px solid ${palette.gray200}` }}
          >
            {Object.keys(SELECTABLE_MODELS).map((provider) => (
              <option key={provider} value={provider}>
                {provider}
              </option>
            ))}
          </select>
          <select
            value={adminModel}
            onChange={(e) => setAdminModel(e.target.value)}
            style={{ fontSize: 12, padding: "4px 6px", borderRadius: 8, border: `1px solid ${palette.gray200}` }}
          >
            {SELECTABLE_MODELS[adminProvider].map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
          {usedProvider && <span style={{ color: palette.gray600 }}>respondeu: {usedProvider}</span>}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage(input);
        }}
        style={{ display: "flex", gap: 8, marginBottom: hasConversation ? 0 : 16 }}
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

      {!hasConversation && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 16 }}>
          {SUGESTOES_INICIAIS.map((s) => (
            <button key={s} type="button" onClick={() => sendMessage(s)} className="cat-btn" disabled={loading}>
              {s}
            </button>
          ))}
        </div>
      )}

      {error && <p style={{ color: "#B42318", fontSize: 14, textAlign: "center", marginTop: 16 }}>{error}</p>}

      {products.length > 0 && (
        <div
          className="products-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            gap: 16,
            marginTop: 24,
          }}
        >
          {products.map((product: CatalogProduct) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </section>
  );
}
