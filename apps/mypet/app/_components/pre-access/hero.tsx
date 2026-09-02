import { AccessForm } from "./access-form";

export function Hero() {
  return (
    <section className="pa-hero" aria-labelledby="hero-title">
      <div className="pa-wrap pa-hero-grid">
        <div>
          <p className="pa-eyebrow">Atacado para pet shops</p>
          <h1 id="hero-title">Abasteça sua loja com condições de atacado claras</h1>
          <p className="pa-hero-lead">
            Pedido mínimo, formas de pagamento e prazos de entrega ficam à vista antes de você
            entrar. Cadastro com CNPJ e WhatsApp, acesso imediato.
          </p>
          <div className="pa-hero-actions">
            <a href="#condicoes" className="pa-btn pa-btn-primary">Ver condições</a>
            <a href="#categorias" className="pa-btn pa-btn-ghost">Ver categorias</a>
          </div>
        </div>

        <div className="pa-panel" id="acesso">
          <h2>Criar acesso à loja</h2>
          <p className="pa-panel-sub">CNPJ e WhatsApp. Liberação na hora, sem cotação por WhatsApp.</p>
          <AccessForm />
        </div>
      </div>
    </section>
  );
}
