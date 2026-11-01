import Link from "next/link";
import { formatCnpj, formatWhatsapp } from "@mypet/core/br-validation";
import { clientConfig } from "@/client.config";
import { EMPRESA, enderecoEmLinha } from "@/lib/empresa";
import { POLITICAS } from "@/lib/politicas";

const { palette: PALETTE } = clientConfig;
const muted = "rgba(255,255,255,0.72)";
// Ano fixo: `new Date()` no render estático quebra o build do Next 16. Atualizar ao virar o ano.
const ANO_COPYRIGHT = 2026;

export function SiteFooter() {
  return (
    <footer style={{ background: PALETTE.navy, color: PALETTE.white, borderRadius: "28px 28px 0 0", marginTop: 10 }}>
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "36px 24px 24px",
          display: "grid",
          gap: 28,
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        }}
      >
        <div>
          <b style={{ fontFamily: "var(--font-baloo)", fontSize: 20 }}>{EMPRESA.nomeFantasia}</b>
          <p style={{ color: muted, fontSize: 13, lineHeight: 1.6, marginTop: 8 }}>
            {EMPRESA.razaoSocial}
            <br />
            CNPJ {formatCnpj(EMPRESA.cnpj)}
            <br />
            {enderecoEmLinha(EMPRESA.endereco)}
          </p>
        </div>
        <div>
          <b style={{ fontSize: 14 }}>Atendimento</b>
          <p style={{ color: muted, fontSize: 13, lineHeight: 1.8, marginTop: 8 }}>
            <a href={`mailto:${EMPRESA.email}`} style={{ color: PALETTE.white }}>{EMPRESA.email}</a>
            <br />
            WhatsApp {formatWhatsapp(EMPRESA.whatsapp)}
            <br />
            {EMPRESA.horario}
          </p>
        </div>
        <nav aria-label="Políticas da loja">
          <b style={{ fontSize: 14 }}>Políticas</b>
          <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0", fontSize: 13, lineHeight: 1.9 }}>
            {POLITICAS.map((p) => (
              <li key={p.slug}>
                <Link href={`/politicas/${p.slug}`} style={{ color: muted }}>{p.titulo}</Link>
              </li>
            ))}
          </ul>
        </nav>
        <div>
          <b style={{ fontSize: 14 }}>Pagamento</b>
          <p style={{ color: muted, fontSize: 13, lineHeight: 1.6, marginTop: 8 }}>
            Pix e cartão de crédito em até {clientConfig.retail?.installments.max ?? 1}x sem juros, em ambiente seguro.
          </p>
        </div>
      </div>
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.12)", padding: "14px 24px", textAlign: "center" }}>
        <span style={{ color: muted, fontSize: 12 }}>
          © {ANO_COPYRIGHT} {EMPRESA.nomeFantasia}. Todos os direitos reservados.
        </span>
      </div>
    </footer>
  );
}
