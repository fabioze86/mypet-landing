export function Hero() {
  return (
    <section aria-labelledby="hero-title" style={{ padding: "64px 24px", maxWidth: 960, margin: "0 auto" }}>
      <p style={{ textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>
        Atacado para pet shops
      </p>
      <h1 id="hero-title" style={{ fontSize: 40, fontWeight: 900, margin: "12px 0 16px" }}>
        Abasteça sua loja com condições claras
      </h1>
      <p style={{ fontSize: 18, maxWidth: 640 }}>
        Veja pedido mínimo, desconto por volume e prazos antes de entrar na loja. Sem cotação por
        WhatsApp para começar.
      </p>
      <div style={{ display: "flex", gap: 12, marginTop: 28, flexWrap: "wrap" }}>
        <a href="#condicoes" className="cta-primary">Ver condições</a>
        <a href="#acesso" className="cta-secondary">Já tenho acesso</a>
      </div>
    </section>
  );
}
