"use client";

import { useState } from "react";
import { madPetPalette as palette, theme } from "@/client-theme";
import { Logo } from "@/components/logo";

const NAV_LINKS = [
  { href: "#mosaico", label: "Catálogo" },
  { href: "#vantagens", label: "Vantagens" },
  { href: "#sobre", label: "Sobre" },
  { href: "#depoimentos", label: "Depoimentos" },
];

export function SiteHeader({ whatsappLink }: { whatsappLink: string }) {
  const [open, setOpen] = useState(false);

  return (
    <header
      style={{
        background: palette.white,
        borderBottom: `1px solid ${palette.purpleLight}`,
        position: "sticky",
        top: 0,
        zIndex: 50,
        boxShadow: theme.shadowCard,
      }}
    >
      <div
        style={{
          maxWidth: theme.maxWidth,
          margin: "0 auto",
          padding: "14px 24px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div
          style={{
            width: "100%",
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <a href="#topo" aria-label="MAD PET, ir para o início" style={{ display: "inline-flex" }}>
            <Logo size={22} />
          </a>
          <button
            type="button"
            className="mpv2-nav-toggle"
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            style={{
              width: 40,
              height: 40,
              alignItems: "center",
              justifyContent: "center",
              border: `1px solid ${palette.purpleLight}`,
              borderRadius: theme.radiusInput,
              background: palette.white,
              cursor: "pointer",
              position: "absolute",
              right: 0,
              top: "50%",
              transform: "translateY(-50%)",
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke={palette.gray800}
              strokeWidth="2"
              aria-hidden="true"
            >
              {open ? (
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>

        <nav aria-label="Seções da página" className={`mpv2-nav${open ? " mpv2-nav-open" : ""}`}>
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="mp-link"
              onClick={() => setOpen(false)}
              style={{ color: palette.gray800, fontWeight: 700, fontSize: 14, textDecoration: "none" }}
            >
              {l.label}
            </a>
          ))}
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="mp-btn mp-btn-green"
            style={{
              background: palette.greenDark,
              color: palette.white,
              fontWeight: 800,
              fontSize: 14,
              padding: "9px 18px",
              borderRadius: theme.radiusPill,
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            Quero revender
          </a>
        </nav>
      </div>
    </header>
  );
}
