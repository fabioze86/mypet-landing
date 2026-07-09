import Link from "next/link";
import { PALETTE } from "@/lib/theme";
import { UnlockButton } from "@/components/lead-gate";
import { CartBadge } from "@/components/cart-badge";

export function SiteNav() {
  return (
    <nav style={{ background: PALETTE.white, borderBottom: `1px solid ${PALETTE.gray200}`, position: "sticky", top: 0, zIndex: 100 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <div style={{ width: 34, height: 34, background: PALETTE.pink, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 18 }}>🐾</span>
          </div>
          <div>
            <div style={{ fontWeight: 900, fontSize: 15, color: PALETTE.navy, lineHeight: 1 }}>My Pet Brasil</div>
            <div style={{ fontSize: 10, fontWeight: 600, color: PALETTE.pink, letterSpacing: "0.12em", textTransform: "uppercase" }}>Atacado B2B</div>
          </div>
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13, color: PALETTE.gray600, fontWeight: 600 }}>Exclusivo para lojistas</span>
          <CartBadge />
          <UnlockButton className="cta-primary" style={{ padding: "10px 22px", fontSize: 14 }}>
            Solicitar cotação
          </UnlockButton>
        </div>
      </div>
    </nav>
  );
}
