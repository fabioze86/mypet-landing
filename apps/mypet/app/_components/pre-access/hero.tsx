import Image from "next/image";
import { AccessForm } from "./access-form";

export function Hero() {
  return (
    <section className="pa-hero" aria-labelledby="hero-title">
      {/* TODO: trocar por foto real do CD/operação (1600x1000, WebP). */}
      <Image
        className="pa-hero-media"
        src="https://picsum.photos/seed/mypet-cd-operacao/1600/1000"
        alt=""
        fill
        priority
        sizes="100vw"
      />
      <div className="pa-hero-overlay" aria-hidden />

      <div className="pa-wrap pa-hero-grid">
        <div>
          <p className="pa-eyebrow">Atacado para pet shops</p>
          <h1 id="hero-title">
            Abasteça sua loja com condições de atacado{" "}
            <span className="pa-hl">claras</span>
          </h1>
          <p className="pa-hero-lead">
            Pedido mínimo, pagamento e prazo à vista antes de você entrar.
            Cadastro com CNPJ e WhatsApp, acesso imediato.
          </p>
          <div className="pa-hero-actions">
            <a href="#condicoes" className="pa-btn pa-btn-primary">Ver condições</a>
            <a href="#categorias" className="pa-btn pa-btn-hero-ghost">Ver categorias</a>
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
