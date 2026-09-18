import Link from "next/link";
import type { Palette } from "@mypet/core/theme";

export function PedidoRapidoCta({ palette: P }: { palette: Palette }) {
  return (
    <section style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px 8px" }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
          justifyContent: "space-between",
          background: P.navy,
          borderRadius: 16,
          padding: "16px 20px",
        }}
      >
        <p style={{ color: P.white, fontWeight: 800, fontSize: 14, margin: 0 }}>
          Já sabe o que vai comprar? Monte seu pedido em minutos.
        </p>
        <Link
          href="/pedido-rapido"
          className="cta-primary"
          style={{ textDecoration: "none", display: "inline-block" }}
        >
          ⚡ Pedido rápido
        </Link>
      </div>
    </section>
  );
}
