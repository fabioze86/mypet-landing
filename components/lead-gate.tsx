"use client";

import { createContext, useContext, useState } from "react";
import { PALETTE } from "@/lib/theme";
import { submitLead } from "@/lib/leads";

type LeadGateValue = { openModal: () => void };
const LeadGateContext = createContext<LeadGateValue | null>(null);

export function useLeadGate(): LeadGateValue {
  const ctx = useContext(LeadGateContext);
  if (!ctx) throw new Error("useLeadGate deve ser usado dentro de LeadGateProvider");
  return ctx;
}

export function LeadGateProvider({ children }: { children: React.ReactNode }) {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ nome: "", empresa: "", whatsapp: "", cnpj: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const openModal = () => setShowModal(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError("");
    const error = await submitLead(form);
    if (error) {
      setSubmitError(error);
    } else {
      setShowModal(false);
    }
    setSubmitting(false);
  };

  return (
    <LeadGateContext.Provider value={{ openModal }}>
      {children}
      {showModal && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="modal">
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔓</div>
              <h2 style={{ fontSize: 22, fontWeight: 900, color: PALETTE.navy, marginBottom: 8 }}>
                Fale com a My Pet Brasil
              </h2>
              <p style={{ fontSize: 14, color: PALETTE.gray600, lineHeight: 1.5 }}>
                Cadastro gratuito e instantâneo. Só para pet shops e distribuidores.
              </p>
            </div>
            <form onSubmit={handleSubmit}>
              <input className="form-input" placeholder="Seu nome" required value={form.nome} onChange={(e) => setForm((prev) => ({ ...prev, nome: e.target.value }))} />
              <input className="form-input" placeholder="Nome do pet shop / empresa" required value={form.empresa} onChange={(e) => setForm((prev) => ({ ...prev, empresa: e.target.value }))} />
              <input className="form-input" placeholder="WhatsApp com DDD" required value={form.whatsapp} onChange={(e) => setForm((prev) => ({ ...prev, whatsapp: e.target.value }))} />
              <input className="form-input" placeholder="CNPJ (opcional)" value={form.cnpj} onChange={(e) => setForm((prev) => ({ ...prev, cnpj: e.target.value }))} />
              {submitError && (
                <p style={{ color: PALETTE.orange, fontSize: 13, marginBottom: 8, textAlign: "center" }}>{submitError}</p>
              )}
              <button type="submit" className="form-submit" disabled={submitting}>
                {submitting ? "Salvando..." : "Solicitar cotação →"}
              </button>
            </form>
            <button onClick={() => setShowModal(false)} style={{ display: "block", margin: "16px auto 0", background: "none", border: "none", color: PALETTE.gray400, fontSize: 13, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>
              Fechar
            </button>
          </div>
        </div>
      )}
    </LeadGateContext.Provider>
  );
}

export function UnlockButton({
  className,
  style,
  children,
}: {
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const { openModal } = useLeadGate();
  return (
    <button className={className} style={style} onClick={openModal}>
      {children}
    </button>
  );
}

export function PriceLockSlot() {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 10, color: PALETTE.gray400, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Atacado B2B</div>
      <div style={{ fontSize: 18, fontWeight: 900, color: PALETTE.pink }}>Preço sob consulta</div>
      <div style={{ fontSize: 11, color: PALETTE.gray400 }}>Solicite sua cotação</div>
    </div>
  );
}
