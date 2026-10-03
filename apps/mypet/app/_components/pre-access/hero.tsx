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
          <p className="pa-eyebrow">Tabela de Preços My Pet Brasil</p>
          <h1 id="hero-title">
            Todos os preços da My Pet numa tela e seu pedido{" "}
            <span className="pa-hl">direto no WhatsApp</span>
          </h1>
          <p className="pa-hero-lead">
            Os mesmos produtos e preços do site mypetbrasil.com, numa tabela feita para
            reposição: busque por SKU, marca ou categoria e informe as quantidades.
          </p>
          <p className="pa-hero-lead">
            Seu pedido chega pronto para o nosso time no WhatsApp. Cadastro rápido com CNPJ
            para liberar a tabela.
          </p>
          <div className="pa-hero-actions">
            <a href="/cadastro" className="pa-btn pa-btn-primary">Abrir tabela de preços</a>
          </div>
        </div>
      </div>
    </section>
  );
}
