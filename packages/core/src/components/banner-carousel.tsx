"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Banner } from "../banners";

const CARD_WIDTH_DESKTOP = 320;
const CARD_GAP = 10;

export function computeArrowState({
  scrollLeft,
  clientWidth,
  scrollWidth,
}: {
  scrollLeft: number;
  clientWidth: number;
  scrollWidth: number;
}): { canScrollPrev: boolean; canScrollNext: boolean } {
  return {
    canScrollPrev: scrollLeft > 0,
    canScrollNext: scrollLeft + clientWidth < scrollWidth - 1,
  };
}

export function BannerCarousel({ banners }: { banners: Banner[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const updateArrows = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const state = computeArrowState({
      scrollLeft: el.scrollLeft,
      clientWidth: el.clientWidth,
      scrollWidth: el.scrollWidth,
    });
    setCanScrollPrev(state.canScrollPrev);
    setCanScrollNext(state.canScrollNext);
  }, []);

  const handleScroll = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      updateArrows();
    });
  }, [updateArrows]);

  useEffect(() => {
    updateArrows();
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", updateArrows);
    return () => {
      el.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", updateArrows);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [updateArrows, handleScroll, banners.length]);

  const scrollByCard = (direction: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({
      left: direction * (CARD_WIDTH_DESKTOP + CARD_GAP),
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  };

  return (
    <div className="bc-wrap">
      <style>{`
        .bc-wrap { position: relative; max-width: 1200px; margin: 0 auto; }
        .bc-track {
          display: flex;
          gap: ${CARD_GAP}px;
          overflow-x: auto;
          padding: 0 16px;
          scroll-snap-type: x mandatory;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }
        .bc-track::-webkit-scrollbar { display: none; }
        .bc-item {
          scroll-snap-align: start;
          flex: 0 0 auto;
          width: 85vw;
          max-width: ${CARD_WIDTH_DESKTOP}px;
        }
        .bc-item img { width: 100%; height: 150px; object-fit: cover; border-radius: 14px; display: block; }
        @media (min-width: 641px) {
          .bc-item { width: ${CARD_WIDTH_DESKTOP}px; }
        }
        .bc-arrow {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: none;
          background: rgba(0,0,0,0.45);
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0,0,0,0.25);
          opacity: 0;
          transition: opacity 0.2s, background 0.2s, transform 0.2s;
          z-index: 2;
        }
        .bc-arrow-prev { left: 8px; }
        .bc-arrow-next { right: 8px; }
        @media (hover: hover) and (pointer: fine) {
          .bc-wrap:hover .bc-arrow { opacity: 1; }
          .bc-arrow:hover { background: rgba(0,0,0,0.65); transform: translateY(-50%) scale(1.06); }
        }
        .bc-arrow:focus-visible { opacity: 1; outline: 2px solid #fff; outline-offset: 2px; }
        .bc-arrow-hidden { opacity: 0 !important; pointer-events: none; }
        @media (hover: none), (pointer: coarse) {
          .bc-arrow { display: none; }
        }
      `}</style>

      <button
        type="button"
        aria-label="Banner anterior"
        aria-disabled={!canScrollPrev}
        tabIndex={canScrollPrev ? 0 : -1}
        className={`bc-arrow bc-arrow-prev${canScrollPrev ? "" : " bc-arrow-hidden"}`}
        onClick={() => canScrollPrev && scrollByCard(-1)}
      >
        <ChevronIcon direction="left" />
      </button>

      <div className="bc-track" ref={trackRef}>
        {banners.map((b) => {
          const image = (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={b.imageUrl} alt={b.title ?? ""} />
          );
          return (
            <div key={b.id} className="bc-item">
              {b.linkUrl ? <a href={b.linkUrl}>{image}</a> : image}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        aria-label="Próximo banner"
        aria-disabled={!canScrollNext}
        tabIndex={canScrollNext ? 0 : -1}
        className={`bc-arrow bc-arrow-next${canScrollNext ? "" : " bc-arrow-hidden"}`}
        onClick={() => canScrollNext && scrollByCard(1)}
      >
        <ChevronIcon direction="right" />
      </button>
    </div>
  );
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  const points = direction === "left" ? "15 6 9 12 15 18" : "9 6 15 12 9 18";
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <polyline points={points} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
