import { PaIcon } from "./icon";

export function InstitutionalTrust({ categoryCount }: { categoryCount: number }) {
  const items = [
    {
      id: "cnpj",
      icon: "Storefront",
      heading: "Compra por CNPJ",
      body: "Distribuição para o ramo pet. A loja é exclusiva para pessoa jurídica.",
    },
    {
      id: "catalogo",
      icon: "Stack",
      heading: categoryCount > 0 ? `${categoryCount} categorias em destaque` : "Catálogo por categoria",
      body: "O catálogo completo com preço abre depois do acesso.",
    },
    {
      id: "suporte",
      icon: "Headset",
      heading: "Suporte pós-acesso",
      body: "O WhatsApp fica para dúvida de pedido, não para liberar preço.",
    },
  ];

  return (
    <section className="pa-section pa-inst" aria-labelledby="institucional-title">
      <div className="pa-wrap">
        <h2 id="institucional-title" className="pa-h2">Como a My Pet opera</h2>
        <div className="pa-inst-grid">
          {items.map((item) => (
            <div key={item.id} className="pa-inst-item">
              <span className="pa-inst-icon"><PaIcon name={item.icon} size={22} /></span>
              <strong>{item.heading}</strong>
              <p>{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
