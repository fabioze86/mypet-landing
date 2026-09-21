import Image from "next/image";

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
            Produtos para pet shop direto de fábrica e{" "}
            <span className="pa-hl">no atacado</span>
          </h1>
          <p className="pa-hero-lead">
            A My Pet Brasil atende lojistas, banho e tosa, clínicas veterinárias e outros
            negócios do mercado pet.
          </p>
          <p className="pa-hero-lead">
            Consulte nossos preços e monte seu pedido de forma rápida. Faça um cadastro simples
            com seu CNPJ para liberar os preços.
          </p>
          <div className="pa-hero-actions">
            <a href="/cadastro" className="pa-btn pa-btn-primary">Consultar preços</a>
          </div>
        </div>
      </div>
    </section>
  );
}
