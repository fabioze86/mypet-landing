import { AccessForm } from "../_components/pre-access/access-form";

export function AccessPanel({
  reason,
  open,
  onClose,
}: {
  reason: string | null;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <aside className={open ? "ag-access pa-panel is-open" : "ag-access pa-panel"} aria-labelledby="ag-access-title">
      <button type="button" className="ag-access-close" onClick={onClose} aria-label="Fechar">
        ×
      </button>
      <p className="pa-eyebrow">Tabela de Preços My Pet Brasil</p>
      <h2 id="ag-access-title">Acesso completo ao agente</h2>
      {reason && (
        <p className="ag-access-reason" role="status">
          {reason}
        </p>
      )}
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
