type SiteLink = {
  name: string;
  description: string;
  url: string;
};

const SITES: SiteLink[] = [
  {
    name: "My Pet Brasil",
    description: "Site público — atacado B2B (porta 4100)",
    url: "http://localhost:4100",
  },
  {
    name: "Distribuidora Petshop",
    description: "Site público — atacado B2B (porta 4101)",
    url: "http://localhost:4101",
  },
  {
    name: "MAD PET (azpetshop)",
    description: "Site público — acessórios (porta 4102)",
    url: "http://localhost:4102",
  },
  {
    name: "Admin",
    description: "Painel administrativo (porta 4103)",
    url: "http://localhost:4103",
  },
];

export default function HubPage() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px" }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, color: "#1A1A2E" }}>
        Hub de desenvolvimento
      </h1>
      <p style={{ color: "#555", marginBottom: 32 }}>
        Acesso rápido aos apps do monorepo rodando localmente.
      </p>

      <div style={{ display: "grid", gap: 16 }}>
        {SITES.map((site) => (
          <a
            key={site.url}
            href={site.url}
            style={{
              display: "block",
              padding: "20px 24px",
              borderRadius: 12,
              border: "1px solid #E0E0E0",
              background: "#FFFFFF",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <p style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{site.name}</p>
            <p style={{ fontSize: 14, color: "#666" }}>{site.description}</p>
            <p style={{ fontSize: 13, color: "#999", marginTop: 8 }}>{site.url}</p>
          </a>
        ))}
      </div>
    </main>
  );
}
