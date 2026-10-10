"use client";

import { Suspense, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useClientConfig } from "@mypet/core/theme";
import { cartTotals } from "@mypet/core/cart";
import { useCart } from "@mypet/core/components/cart-provider";
import { formatCnpj, formatWhatsapp, validateIdentity, type Identity, type IdentityField } from "@mypet/core/br-validation";
import { saveIdentity, useIdentity } from "./identity-store";
import { submitIdentityLead } from "./submit-identity-lead";

type IdentityGateValue = { openIdentityGate: () => void };
const IdentityGateContext = createContext<IdentityGateValue | null>(null);

export function useIdentityGate(): IdentityGateValue {
  const ctx = useContext(IdentityGateContext);
  if (!ctx) throw new Error("useIdentityGate deve ser usado dentro de IdentityGateProvider");
  return ctx;
}

// Pop-up obrigatório no 1º "Adicionar" (sem identidade e carrinho com itens): sem
// intersticial ao entrar, que o Google veria sempre. Reabre por "Alterar dados".
export function IdentityGateProvider({ children }: { children: React.ReactNode }) {
  const [editing, setEditing] = useState(false);
  const openIdentityGate = useCallback(() => setEditing(true), []);
  const value = useMemo(() => ({ openIdentityGate }), [openIdentityGate]);

  // O contexto fica fora do Suspense: usePathname não pode suspender os children.
  return (
    <IdentityGateContext.Provider value={value}>
      {children}
      <Suspense fallback={null}>
        <IdentityGateHost editing={editing} onDone={() => setEditing(false)} />
      </Suspense>
    </IdentityGateContext.Provider>
  );
}

// Páginas de conta/pedidos não recebem o pop-up obrigatório.
const EXEMPT_PREFIXES = ["/entrar", "/completar-cadastro", "/pedidos"];

function isExempt(pathname: string | null): boolean {
  if (!pathname) return false;
  return EXEMPT_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function IdentityGateHost({ editing, onDone }: { editing: boolean; onDone: () => void }) {
  const identity = useIdentity();
  const { cart } = useCart();
  const pathname = usePathname();
  const required = identity === null && cartTotals(cart.items).totalUnits > 0 && !isExempt(pathname);
  if (!required && !editing) return null;
  return <IdentityDialog initial={identity ?? null} dismissible={!required} onDone={onDone} />;
}

function sameIdentity(a: Identity, b: Identity): boolean {
  return a.nome === b.nome && a.whatsapp === b.whatsapp && (a.cnpj ?? null) === (b.cnpj ?? null);
}

function IdentityDialog({
  initial,
  dismissible,
  onDone,
}: {
  initial: Identity | null;
  dismissible: boolean;
  onDone: () => void;
}) {
  const { palette } = useClientConfig();
  const [form, setForm] = useState({
    nome: initial?.nome ?? "",
    whatsapp: initial ? formatWhatsapp(initial.whatsapp) : "",
    cnpj: initial?.cnpj ? formatCnpj(initial.cnpj) : "",
  });
  const [errors, setErrors] = useState<Partial<Record<IdentityField, string>>>({});
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // Guarda síncrona contra duplo envio: o disabled só vale após o render.
  const inFlight = useRef(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current || sending) return;
    const parsed = validateIdentity(form);
    if (!parsed.ok) {
      setErrors({ [parsed.field]: parsed.error });
      return;
    }
    setErrors({});
    // "Alterar dados" sem mudança: só fecha, sem gravar outro lead.
    if (initial && sameIdentity(initial, parsed.value)) {
      onDone();
      return;
    }
    inFlight.current = true;
    setSending(true);
    try {
      const result = await submitIdentityLead(parsed.value);
      if (result.kind === "invalid") {
        setErrors(result.field ? { [result.field]: result.error } : { nome: result.error });
        return;
      }
      saveIdentity(parsed.value);
      onDone();
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  };

  const update = (field: IdentityField, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));
  };

  const a11y = (field: IdentityField) =>
    errors[field] ? { "aria-invalid": true as const, "aria-describedby": `identity-${field}-error` } : {};

  const input: React.CSSProperties = {
    width: "100%",
    padding: "12px 14px",
    border: `1.5px solid ${palette.gray200}`,
    borderRadius: 10,
    fontSize: 16,
    color: palette.gray800,
    outline: "none",
  };
  const label: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 700, color: palette.navy, marginBottom: 6 };
  const errorStyle: React.CSSProperties = { color: palette.orange, fontSize: 12, marginTop: 4 };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(15,31,69,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="identity-gate-title"
        style={{ background: palette.white, borderRadius: 20, padding: "28px 22px", width: "100%", maxWidth: 420, fontFamily: "var(--font-nunito), sans-serif" }}
      >
        <h2 id="identity-gate-title" style={{ fontSize: 22, fontWeight: 900, color: palette.navy, marginBottom: 6 }}>
          Quase lá!
        </h2>
        <p style={{ fontSize: 14, color: palette.gray600, marginBottom: 20 }}>
          Informe seus dados para montar o pedido e fechar pelo WhatsApp.
        </p>
        <form onSubmit={handleSubmit} noValidate>
          <div style={{ marginBottom: 14 }}>
            <label htmlFor="identity-nome" style={label}>Seu nome</label>
            <input
              id="identity-nome"
              autoFocus
              autoComplete="name"
              value={form.nome}
              onChange={(event) => update("nome", event.target.value)}
              {...a11y("nome")}
              style={input}
            />
            {errors.nome && <p id="identity-nome-error" role="alert" style={errorStyle}>{errors.nome}</p>}
          </div>
          <div style={{ marginBottom: 14 }}>
            <label htmlFor="identity-whatsapp" style={label}>WhatsApp com DDD</label>
            <input
              id="identity-whatsapp"
              inputMode="tel"
              autoComplete="tel-national"
              value={form.whatsapp}
              onChange={(event) => update("whatsapp", formatWhatsapp(event.target.value))}
              {...a11y("whatsapp")}
              style={input}
            />
            {errors.whatsapp && <p id="identity-whatsapp-error" role="alert" style={errorStyle}>{errors.whatsapp}</p>}
          </div>
          <div style={{ marginBottom: 20 }}>
            <label htmlFor="identity-cnpj" style={label}>CNPJ (opcional)</label>
            <input
              id="identity-cnpj"
              inputMode="numeric"
              value={form.cnpj}
              onChange={(event) => update("cnpj", formatCnpj(event.target.value))}
              {...a11y("cnpj")}
              style={input}
            />
            {errors.cnpj && <p id="identity-cnpj-error" role="alert" style={errorStyle}>{errors.cnpj}</p>}
          </div>
          <button
            type="submit"
            disabled={sending}
            style={{
              width: "100%",
              padding: 14,
              background: palette.pink,
              color: palette.white,
              border: "none",
              borderRadius: 10,
              fontFamily: "inherit",
              fontSize: 16,
              fontWeight: 800,
              cursor: sending ? "default" : "pointer",
              opacity: sending ? 0.7 : 1,
            }}
          >
            {sending ? "Salvando…" : "Continuar"}
          </button>
        </form>
        {dismissible && (
          <button
            type="button"
            onClick={onDone}
            style={{ display: "block", margin: "14px auto 0", background: "none", border: "none", color: palette.gray400, fontSize: 13, cursor: "pointer" }}
          >
            Fechar
          </button>
        )}
      </div>
    </div>
  );
}
