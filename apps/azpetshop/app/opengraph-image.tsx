import { ImageResponse } from "next/og";
import { clientConfig } from "@/client.config";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const { name, tagline, palette } = clientConfig;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: palette.navyDark,
          color: palette.white,
        }}
      >
        <div style={{ fontSize: 72, fontWeight: 900, color: palette.pink, display: "flex" }}>{name}</div>
        <div style={{ fontSize: 32, marginTop: 16, color: "rgba(255,255,255,0.85)", display: "flex" }}>{tagline}</div>
      </div>
    ),
    size,
  );
}
