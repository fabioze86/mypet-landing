import { useEffect, type RefObject } from "react";
import { AccessForm } from "../_components/pre-access/access-form";

export function AccessPanel({
  reason,
  open,
  modal,
  onClose,
  headingRef,
}: {
  reason: string | null;
  open: boolean;
  modal: boolean;
  onClose: () => void;
  headingRef: RefObject<HTMLHeadingElement | null>;
}) {
  useEffect(() => {
    if (!modal) return;
    headingRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKey);
    };
  }, [modal, onClose, headingRef]);

  return (
    <aside
      className={open ? "ag-access pa-panel is-open" : "ag-access pa-panel"}
      aria-labelledby="ag-access-title"
      {...(modal ? { role: "dialog", "aria-modal": true } : {})}
    >
      <button type="button" className="ag-access-close" onClick={onClose} aria-label="Fechar">
        ×
      </button>
      <p className="pa-eyebrow">Tabela de Preços My Pet Brasil</p>
      <h2 id="ag-access-title" ref={headingRef} tabIndex={-1}>
        Acesso completo ao agente
      </h2>
      <p className="ag-access-reason" role="status" aria-live="polite">
        {reason}
      </p>
      <p className="ag-access-lead">
        Informe o CNPJ e o WhatsApp da sua empresa e o agente passa a trabalhar com os preços da tabela.
      </p>
      <ul className="ag-benefits">
        <li>Preços da tabela, os mesmos do mypetbrasil.com</li>
        <li>Monta seu pedido conversando</li>
        <li>Sugere o que repor</li>
        <li>Acompanha seus pedidos</li>
      </ul>
      <AccessForm submitLabel="Liberar acesso completo" redirectTo="/agente" />
    </aside>
  );
}
