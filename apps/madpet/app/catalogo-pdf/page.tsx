import { madPetPalette as palette, madPetLogo, theme } from "@/client-theme";
import { Logo } from "@/components/logo";

/**
 * Protótipo de página de catálogo A4 (impressão), linha Tapete Higiênico.
 * Dados FICTÍCIOS — servem só para validar diagramação/estilo antes de
 * plugar na fonte real (packages/core/src/catalog.ts).
 */
type MockProduct = {
  sku: string;
  name: string;
  brand: string;
  tags: string[];
  sizes: { label: string; qty: string; price: string }[];
};

const PRODUCTS: MockProduct[] = [
  {
    sku: "TH-3005",
    name: "Tapete Higiênico Super Absorvente",
    brand: "MAD PET",
    tags: ["Super absorção", "8 camadas"],
    sizes: [
      { label: "P 30x30cm", qty: "30un", price: "R$ 39,90" },
      { label: "M 60x60cm", qty: "30un", price: "R$ 64,90" },
      { label: "G 80x60cm", qty: "20un", price: "R$ 79,90" },
    ],
  },
  {
    sku: "TH-3012",
    name: "Tapete Higiênico com Gel Neutralizante",
    brand: "MAD PET",
    tags: ["Antiodor", "Gel"],
    sizes: [
      { label: "M 60x60cm", qty: "30un", price: "R$ 69,90" },
      { label: "G 80x60cm", qty: "20un", price: "R$ 84,90" },
    ],
  },
  {
    sku: "TH-3020",
    name: "Tapete Higiênico Perfumado Talco",
    brand: "MAD PET",
    tags: ["Perfumado", "Secagem rápida"],
    sizes: [
      { label: "P 30x30cm", qty: "50un", price: "R$ 54,90" },
      { label: "M 60x60cm", qty: "30un", price: "R$ 59,90" },
    ],
  },
  {
    sku: "TH-3033",
    name: "Tapete Higiênico Filhotes Atrativo",
    brand: "MAD PET",
    tags: ["Atrativo", "Filhotes"],
    sizes: [
      { label: "P 30x30cm", qty: "30un", price: "R$ 44,90" },
      { label: "M 60x60cm", qty: "20un", price: "R$ 59,90" },
    ],
  },
  {
    sku: "TH-3041",
    name: "Tapete Higiênico Reforçado Premium",
    brand: "MAD PET",
    tags: ["Reforçado", "Não vaza"],
    sizes: [
      { label: "M 60x60cm", qty: "30un", price: "R$ 74,90" },
      { label: "G 80x60cm", qty: "15un", price: "R$ 69,90" },
    ],
  },
  {
    sku: "TH-3050",
    name: "Tapete Higiênico Ecológico Biodegradável",
    brand: "MAD PET",
    tags: ["Biodegradável", "Eco"],
    sizes: [
      { label: "P 30x30cm", qty: "30un", price: "R$ 49,90" },
      { label: "M 60x60cm", qty: "30un", price: "R$ 67,90" },
    ],
  },
];

function ProductPlate({ name }: { name: string }) {
  return (
    <div
      style={{
        position: "relative",
        aspectRatio: "1 / 1",
        background: `linear-gradient(160deg, ${palette.purpleLight} 0%, #fff 100%)`,
        borderRadius: theme.radiusCard,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `radial-gradient(${palette.purple}22 1.5px, transparent 1.5px)`,
          backgroundSize: "14px 14px",
        }}
      />
      <span
        style={{
          position: "relative",
          fontFamily: "var(--font-fredoka)",
          fontSize: 12,
          fontWeight: 600,
          color: palette.purple,
          textAlign: "center",
          padding: "0 10px",
          textTransform: "uppercase",
          letterSpacing: "0.02em",
        }}
      >
        foto do produto
      </span>
    </div>
  );
}

function ProductCard({ product }: { product: MockProduct }) {
  return (
    <div
      style={{
        breakInside: "avoid",
        border: `1px solid ${palette.purpleLight}`,
        borderRadius: theme.radiusCard,
        padding: 10,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        background: palette.white,
      }}
    >
      <ProductPlate name={product.name} />

      <div>
        <p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: palette.purple, letterSpacing: "0.03em" }}>
          {product.brand} · REF {product.sku}
        </p>
        <h3
          style={{
            margin: "2px 0 0",
            fontFamily: "var(--font-fredoka)",
            fontSize: 12.5,
            fontWeight: 600,
            color: palette.gray800,
            lineHeight: 1.25,
            minHeight: 30,
          }}
        >
          {product.name}
        </h3>
      </div>

      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {product.tags.map((tag) => (
          <span
            key={tag}
            style={{
              fontSize: 8,
              fontWeight: 700,
              color: palette.greenDark,
              background: palette.greenLight,
              borderRadius: theme.radiusPill,
              padding: "2px 8px",
            }}
          >
            {tag}
          </span>
        ))}
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "auto" }}>
        <tbody>
          {product.sizes.map((size, i) => (
            <tr key={size.label} style={{ borderTop: i === 0 ? `1px solid ${palette.purpleLight}` : "none" }}>
              <td style={{ padding: "3px 0", fontSize: 9, color: palette.gray600 }}>{size.label}</td>
              <td style={{ padding: "3px 0", fontSize: 9, color: palette.gray600, textAlign: "center" }}>
                {size.qty}
              </td>
              <td
                style={{
                  padding: "3px 0",
                  fontSize: 10.5,
                  fontWeight: 800,
                  color: palette.gray800,
                  textAlign: "right",
                }}
              >
                {size.price}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function CatalogoPdfPrototype() {
  return (
    <div
      style={{
        background: "#e8e8ec",
        minHeight: "100vh",
        padding: "24px 0",
        fontFamily: "var(--font-nunito), sans-serif",
      }}
    >
      <style>{`
        @page { size: A4; margin: 0; }
        @media print {
          body { background: #fff !important; }
          .a4-page { box-shadow: none !important; margin: 0 !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      <p className="no-print" style={{ textAlign: "center", fontSize: 12, color: "#666", marginBottom: 16 }}>
        Protótipo — dados fictícios de exemplo. Página em tamanho A4 (210 × 297mm).
      </p>

      <div
        className="a4-page"
        style={{
          width: "210mm",
          minHeight: "297mm",
          margin: "0 auto",
          background: palette.white,
          boxShadow: "0 10px 40px rgba(0,0,0,0.15)",
          padding: "12mm 12mm 14mm",
          display: "flex",
          flexDirection: "column",
          boxSizing: "border-box",
        }}
      >
        {/* Cabeçalho */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <Logo size={22} />
          <div style={{ textAlign: "right" }}>
            <p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: palette.gray600, letterSpacing: "0.08em" }}>
              CATÁLOGO DE REVENDA
            </p>
            <p style={{ margin: 0, fontSize: 9, color: palette.gray600 }}>2026 · pág. 01/12</p>
          </div>
        </div>

        {/* Faixa de categoria */}
        <div
          style={{
            background: palette.purpleDark,
            borderRadius: theme.radiusCard,
            padding: "14px 20px",
            marginBottom: 14,
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
          }}
        >
          <h1
            style={{
              margin: 0,
              fontFamily: "var(--font-fredoka)",
              fontWeight: 700,
              fontSize: 22,
              color: palette.white,
              letterSpacing: "0.01em",
            }}
          >
            Tapete Higiênico
          </h1>
          <span style={{ fontSize: 11, color: palette.purpleLight, fontWeight: 600 }}>
            Absorção · Antiodor · Secagem rápida
          </span>
        </div>

        {/* Grade de produtos */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 10,
          }}
        >
          {PRODUCTS.map((product) => (
            <ProductCard key={product.sku} product={product} />
          ))}
        </div>

        {/* Rodapé */}
        <div
          style={{
            marginTop: "auto",
            paddingTop: 14,
            borderTop: `1px solid ${palette.purpleLight}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 8.5, color: palette.gray600 }}>
            Preços sujeitos a alteração sem aviso prévio · Peça pelo WhatsApp
          </span>
          <span style={{ fontSize: 8.5, fontWeight: 700, color: palette.purple }}>madpet.com.br</span>
        </div>
      </div>
    </div>
  );
}
