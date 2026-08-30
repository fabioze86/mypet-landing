import { madPetPalette as palette, theme } from "@/client-theme";
import { BonePattern } from "@/components/bone-pattern";
import { buildWhatsAppLink } from "@mypet/core/whatsapp";
import type { ProductLine } from "@/lib/product-lines";

type Tile =
  | { kind: "line"; label: string; href: string; seed: string }
  | { kind: "theme"; label: string; href: string; bg: string };

export function CategoryMosaic({
  lines,
  whatsappNumber,
}: {
  lines: ProductLine[];
  whatsappNumber: string;
}) {
  const tiles: Tile[] = [
    ...lines.map((l) => ({
      kind: "line" as const,
      label: l.label,
      href: `#${l.slug}`,
      seed: `madpet-mosaic-${l.slug}`,
    })),
    {
      kind: "theme" as const,
      label: "Novidades do mês",
      href: buildWhatsAppLink(
        whatsappNumber,
        "Olá! Quero ver as novidades MAD PET do mês para revenda."
      ),
      bg: palette.purple,
    },
    {
      kind: "theme" as const,
      label: "Kit vitrine para começar",
      href: buildWhatsAppLink(
        whatsappNumber,
        "Olá! Quero montar um kit inicial MAD PET para a vitrine da minha loja."
      ),
      bg: palette.purpleDark,
    },
  ];

  return (
    <section id="mosaico" style={{ background: palette.white, scrollMarginTop: 96 }}>
      <div style={{ maxWidth: theme.maxWidth, margin: "0 auto", padding: "56px 24px 32px" }}>
        <h1
          style={{
            fontFamily: "var(--font-fredoka)",
            fontSize: "clamp(28px, 4.4vw, 40px)",
            fontWeight: 700,
            color: palette.gray800,
            lineHeight: 1.12,
            marginBottom: 10,
          }}
        >
          O catálogo de fabricação própria
        </h1>
        <p
          style={{
            fontSize: 16,
            color: palette.gray600,
            lineHeight: 1.65,
            maxWidth: "58ch",
            marginBottom: 28,
          }}
        >
          Quatro linhas para revender, do mini ao extra grande. Toque numa linha para ver as peças
          ou fale no WhatsApp para novidades e kit de vitrine.
        </p>

        <div className="mpv2-mosaic">
          {tiles.map((tile) => {
            const external = tile.href.startsWith("http");
            return (
              <a
                key={tile.label}
                href={tile.href}
                {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className="mp-card"
                style={{
                  position: "relative",
                  overflow: "hidden",
                  aspectRatio: "3 / 4",
                  borderRadius: theme.radiusCard,
                  textDecoration: "none",
                  display: "block",
                  background: tile.kind === "theme" ? tile.bg : palette.purpleDark,
                }}
              >
                {tile.kind === "line" ? (
                  <>
                    {/* TODO: trocar por foto real da linha (pet usando o produto, luz clara),
                        600x800, e migrar para next/image quando a origem final existir. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://picsum.photos/seed/${tile.seed}/600/800`}
                      alt={`Linha de ${tile.label.toLowerCase()} MAD PET para revenda`}
                      width={600}
                      height={800}
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                  </>
                ) : (
                  <BonePattern color={palette.white} opacity={0.1} />
                )}

                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    inset: 0,
                    background:
                      "linear-gradient(180deg, rgba(38,16,60,0) 45%, rgba(38,16,60,0.72) 100%)",
                  }}
                />
                <span
                  style={{
                    position: "absolute",
                    left: 16,
                    right: 16,
                    bottom: 16,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-fredoka)",
                      fontSize: 20,
                      fontWeight: 700,
                      color: palette.white,
                    }}
                  >
                    {tile.label}
                  </span>
                  <span
                    style={{
                      alignSelf: "flex-start",
                      border: "1px solid rgba(255,255,255,0.7)",
                      borderRadius: theme.radiusPill,
                      padding: "5px 14px",
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: palette.white,
                    }}
                  >
                    Clique e confira
                  </span>
                </span>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
