// packages/core/src/components/quick-nav-icons.tsx
import type { Palette } from "../theme";

const ITEMS = [
  { icon: "📦", label: "Kits" },
  { icon: "🏷️", label: "Ofertas" },
  { icon: "🎟️", label: "Cupons" },
  { icon: "🏭", label: "Fabricação Própria" },
];

export function QuickNavIcons({ palette }: { palette: Palette }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-around", padding: "12px 16px 4px" }}>
      {ITEMS.map((item) => (
        <div
          key={item.label}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, opacity: 0.55, maxWidth: 76 }}
        >
          <span style={{ fontSize: 24 }}>{item.icon}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: palette.gray600, textAlign: "center", lineHeight: 1.2 }}>
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}
