export function InstitutionalTrust({ categoryCount }: { categoryCount: number }) {
  const items = [
    {
      id: "cnpj",
      heading: "Compra por CNPJ",
      body: "Operação de distribuição para o ramo pet. A loja é exclusiva para pessoa jurídica.",
    },
    {
      id: "catalogo",
      heading:
        categoryCount > 0 ? `${categoryCount} categorias em destaque` : "Catálogo por categoria",
      body: "As categorias listadas nesta página; o catálogo completo com preço abre depois do acesso.",
    },
    {
      id: "suporte",
      heading: "Suporte pós-acesso",
      body: "Depois de criar o acesso, o WhatsApp fica para dúvidas de pedido, não para liberar preço.",
    },
  ];

  return (
    <section className="pa-section pa-section--soft" aria-labelledby="institucional-title">
      <div className="pa-wrap">
        <h2 id="institucional-title" className="pa-h2">Como a My Pet opera</h2>
        <div className="pa-inst-grid">
          {items.map((item) => (
            <div key={item.id} className="pa-inst-item">
              <strong>{item.heading}</strong>
              <p>{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
