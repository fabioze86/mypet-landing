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
    <div className="bc-fallback-wrap">
      <style>{`
        .bc-fallback-wrap { max-width: 1200px; margin: 0 auto; padding: 0 16px; }
        .bc-fallback {
          height: 150px;
          border-radius: 14px;
          background: linear-gradient(135deg, ${palette.navyDark} 0%, ${palette.navy} 60%, #1e4d8a 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 24px;
        }
        .bc-fallback p {
          color: ${palette.white};
          font-size: 15px;
          font-weight: 800;
          text-align: center;
          line-height: 1.4;
        }
        @media (min-width: 641px) {
          .bc-fallback-wrap { padding: 0 24px; }
          .bc-fallback {
            height: clamp(380px, 42vw, 520px);
            border-radius: 20px;
            box-shadow: 0 16px 48px rgba(0,0,0,0.14);
          }
          .bc-fallback p { font-size: 22px; }
        }
      `}</style>
      <div className="bc-fallback">
        <p>Atacado exclusivo para pet shops. Preços sob consulta.</p>
      </div>
    </div>
  );
}
