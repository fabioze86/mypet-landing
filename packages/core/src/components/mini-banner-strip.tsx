import { getBanners } from "../banners";
import type { Channel } from "../channels";

export async function MiniBannerStrip({ channel }: { channel: Channel }) {
  const banners = await getBanners(channel, "mini");
  if (banners.length === 0) return null;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 24px 0", display: "flex", gap: 16, overflowX: "auto" }}>
      {banners.map((b) => {
        const image = (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={b.imageUrl} alt={b.title ?? ""} style={{ width: 280, height: 140, objectFit: "cover", borderRadius: 12, display: "block" }} />
        );
        return b.linkUrl ? (
          <a key={b.id} href={b.linkUrl}>{image}</a>
        ) : (
          <span key={b.id}>{image}</span>
        );
      })}
    </div>
  );
}
