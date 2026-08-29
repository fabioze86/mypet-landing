import type { Metadata } from "next";
import { canonicalUrl } from "@mypet/core/seo";
import { clientConfig } from "@/client.config";
import { Hero } from "./_components/pre-access/hero";
import { AccessForm } from "./_components/pre-access/access-form";

export function generateMetadata(): Metadata {
  return {
    alternates: { canonical: canonicalUrl(clientConfig.domain, "/") },
  };
}

export default function LandingPage() {
  return (
    <main>
      <Hero />
      <section
        id="condicoes"
        aria-labelledby="condicoes-title"
        style={{ padding: "24px", maxWidth: 960, margin: "0 auto" }}
      >
        <h2 id="condicoes-title">Condições de compra</h2>
        <p>
          Pedido mínimo, desconto por volume e prazos ficam visíveis aqui antes de você entrar na
          loja.
        </p>
      </section>
      <section
        id="acesso"
        aria-labelledby="acesso-title"
        style={{ padding: "48px 24px", maxWidth: 480, margin: "0 auto" }}
      >
        <h2 id="acesso-title">Criar acesso à loja</h2>
        <AccessForm />
      </section>
    </main>
  );
}
