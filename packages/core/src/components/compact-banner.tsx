import { getBanners } from "../banners";
import type { Palette } from "../theme";
import type { Channel } from "../channels";
import { BannerCarousel } from "./banner-carousel";

export async function CompactBanner({ channel, palette }: { channel: Channel; palette: Palette }) {
  const banners = await getBanners(channel, "principal");

  if (banners.length === 0) {
    return <FallbackBanner palette={palette} />;
  }

  return <BannerCarousel banners={banners} />;
}

function FallbackBanner({ palette }: { palette: Palette }) {
  return (
    <div className="banner-row">
      <div
        className="banner-row-item"
        style={{
          height: 150,
          minWidth: 280,
          borderRadius: 14,
          background: `linear-gradient(135deg, ${palette.navyDark} 0%, ${palette.navy} 60%, #1e4d8a 100%)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 24px",
        }}
      >
        <p style={{ color: palette.white, fontSize: 15, fontWeight: 800, textAlign: "center", lineHeight: 1.4 }}>
          Atacado exclusivo para pet shops. Preços sob consulta.
        </p>
      </div>
    </div>
  );
}
