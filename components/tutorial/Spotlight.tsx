"use client";

import { useEffect, useState } from "react";

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Dims the screen except for the element carrying the given `data-tour` value,
 * drawing an attention ring around it. Visual-only (pointer-events: none) so
 * the dashboard stays fully usable — the user clicks the real element to move
 * on. Re-measures on an interval so it tracks layout/route changes.
 */
export function Spotlight({ target, padding = 8 }: { target: string; padding?: number }) {
  const [rect, setRect] = useState<Rect | null>(null);

  useEffect(() => {
    let raf = 0;
    function measure() {
      const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
      if (el) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
          return;
        }
      }
      setRect(null);
    }
    measure();
    const interval = setInterval(measure, 250);
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      clearInterval(interval);
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [target]);

  if (!rect) return null;
  const t = Math.max(0, rect.top - padding);
  const l = Math.max(0, rect.left - padding);
  const w = rect.width + padding * 2;
  const h = rect.height + padding * 2;

  return (
    <div className="pointer-events-none fixed inset-0 z-30">
      {/* Dim everything + a bright gold glow ring around the target so it pops
          even on the dark sidebar. */}
      <div
        className="absolute rounded-lg transition-all duration-200"
        style={{
          top: t,
          left: l,
          width: w,
          height: h,
          boxShadow:
            "0 0 0 3px rgba(255,255,255,0.9), 0 0 0 6px rgba(199,154,59,1), 0 0 28px 10px rgba(199,154,59,0.85), 0 0 0 9999px rgba(10,15,13,0.68)",
        }}
      />
      {/* Pulsing outline for extra motion. */}
      <div
        className="absolute rounded-lg border-2 border-brand-gold animate-pulse"
        style={{ top: t - 4, left: l - 4, width: w + 8, height: h + 8 }}
      />
    </div>
  );
}
