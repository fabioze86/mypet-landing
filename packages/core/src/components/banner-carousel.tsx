"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Banner } from "../banners";

const CARD_MAX_WIDTH_MOBILE = 320;
const CARD_GAP_MOBILE = 10;
const AUTOPLAY_MS = 6000;

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

/** Largura de um "passo" do carrossel (card + gap), medida no DOM real. */
function getStep(track: HTMLElement): number {
  const items = track.querySelectorAll<HTMLElement>(".bc-item");
  if (items.length === 0) return track.clientWidth;
  if (items.length >= 2) {
    const delta = items[1].offsetLeft - items[0].offsetLeft;
    if (delta > 0) return delta;
  }
  return items[0].getBoundingClientRect().width;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function BannerCarousel({ banners }: { banners: Banner[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const autoplayRef = useRef<number | null>(null);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

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
    const step = getStep(el);
    const idx = step > 0 ? Math.round(el.scrollLeft / step) : 0;
    setActiveIndex(Math.min(Math.max(idx, 0), Math.max(banners.length - 1, 0)));
  }, [banners.length]);

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

  const scrollByCard = useCallback((direction: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({
      left: direction * getStep(el),
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }, []);

  const goTo = useCallback((index: number) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({
      left: getStep(el) * index,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }, []);

  const advance = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const state = computeArrowState({
      scrollLeft: el.scrollLeft,
      clientWidth: el.clientWidth,
      scrollWidth: el.scrollWidth,
    });
    if (state.canScrollNext) {
      scrollByCard(1);
    } else {
      el.scrollTo({ left: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
    }
  }, [scrollByCard]);

  // Autoplay: liga por padrão; pausa em hover/foco/aba oculta e respeita reduced-motion.
  useEffect(() => {
    if (banners.length < 2) return;
    if (prefersReducedMotion()) return;

    const stop = () => {
      if (autoplayRef.current !== null) {
        clearInterval(autoplayRef.current);
        autoplayRef.current = null;
      }
    };
    const start = () => {
      stop();
      autoplayRef.current = window.setInterval(advance, AUTOPLAY_MS);
    };

    start();

    const el = trackRef.current;
    const wrap = el?.closest(".bc-wrap") as HTMLElement | null;
    const onVisibility = () => (document.hidden ? stop() : start());

    wrap?.addEventListener("pointerenter", stop);
    wrap?.addEventListener("pointerleave", start);
    wrap?.addEventListener("focusin", stop);
    wrap?.addEventListener("focusout", start);
    el?.addEventListener("touchstart", stop, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      wrap?.removeEventListener("pointerenter", stop);
      wrap?.removeEventListener("pointerleave", start);
      wrap?.removeEventListener("focusin", stop);
      wrap?.removeEventListener("focusout", start);
      el?.removeEventListener("touchstart", stop);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [banners.length, advance]);

  return (
    <div className="bc-wrap">
      <style>{`
        .bc-wrap { position: relative; max-width: 1200px; margin: 0 auto; }
        .bc-track {
          display: flex;
          gap: ${CARD_GAP_MOBILE}px;
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
          max-width: ${CARD_MAX_WIDTH_MOBILE}px;
        }
        .bc-item img { width: 100%; height: 150px; object-fit: cover; border-radius: 14px; display: block; }

        /* Desktop: um slide full-width com cara de hero de ecommerce */
        @media (min-width: 641px) {
          .bc-track { padding: 0 24px; gap: 0; }
          .bc-item { width: 100%; max-width: none; }
          .bc-item img {
            height: clamp(380px, 42vw, 520px);
            border-radius: 20px;
            box-shadow: 0 16px 48px rgba(0,0,0,0.14);
          }
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
        @media (min-width: 641px) {
          .bc-arrow { width: 48px; height: 48px; }
          .bc-arrow-prev { left: 40px; }
          .bc-arrow-next { right: 40px; }
        }
        @media (hover: hover) and (pointer: fine) {
          .bc-wrap:hover .bc-arrow { opacity: 1; }
          .bc-arrow:hover { background: rgba(0,0,0,0.65); transform: translateY(-50%) scale(1.06); }
        }
        .bc-arrow:focus-visible { opacity: 1; outline: 2px solid #fff; outline-offset: 2px; }
        .bc-arrow-hidden { opacity: 0 !important; pointer-events: none; }
        @media (hover: none), (pointer: coarse) {
          .bc-arrow { display: none; }
        }

        /* Dots: apenas desktop */
        .bc-dots { display: none; }
        @media (min-width: 641px) {
          .bc-dots {
            display: flex;
            justify-content: center;
            gap: 8px;
            margin-top: 16px;
          }
          .bc-dot {
            width: 8px;
            height: 8px;
            padding: 0;
            border: none;
            border-radius: 50%;
            background: rgba(0,0,0,0.18);
            cursor: pointer;
            transition: background 0.2s, width 0.2s, border-radius 0.2s;
          }
          .bc-dot:hover { background: rgba(0,0,0,0.35); }
          .bc-dot-active { background: rgba(0,0,0,0.6); width: 22px; border-radius: 4px; }
          .bc-dot:focus-visible { outline: 2px solid #000; outline-offset: 2px; }
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

      {banners.length > 1 && (
        <div className="bc-dots" role="tablist" aria-label="Selecionar banner">
          {banners.map((b, i) => (
            <button
              key={b.id}
              type="button"
              role="tab"
              aria-selected={i === activeIndex}
              aria-label={`Ir para o banner ${i + 1}`}
              className={`bc-dot${i === activeIndex ? " bc-dot-active" : ""}`}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
      )}
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
