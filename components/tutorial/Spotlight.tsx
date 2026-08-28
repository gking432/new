"use client";

import { useEffect, useState } from "react";

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Draws a delayed blue outline around the element carrying the given
 * `data-tour` value. Visual-only (pointer-events: none) so the dashboard stays
 * fully usable while the user explores it. Re-measures on an interval so it
 * tracks layout and route changes.
 */
export function Spotlight({
  target,
  padding = 8,
  wiggle = false,
}: {
  target: string;
  padding?: number;
  wiggle?: boolean;
}) {
  const [rect, setRect] = useState<Rect | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let raf = 0;
    setVisible(false);
    const revealTimer = window.setTimeout(() => setVisible(true), 1500);

    function measure() {
      const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
      if (el) {
        el.classList.toggle("tour-target-wiggle", wiggle);
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
      document
        .querySelector<HTMLElement>(`[data-tour="${target}"]`)
        ?.classList.remove("tour-target-wiggle");
      clearTimeout(revealTimer);
      clearInterval(interval);
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [target, wiggle]);

  if (!rect) return null;
  const t = Math.max(0, rect.top - padding);
  const l = Math.max(0, rect.left - padding);
  const w = rect.width + padding * 2;
  const h = rect.height + padding * 2;

  return (
    <div
      data-testid="tour-spotlight"
      className="pointer-events-none fixed inset-0 z-30 transition-opacity ease-out motion-reduce:transition-none"
      style={{ opacity: visible ? 1 : 0, transitionDuration: "1500ms" }}
    >
      <div
        className="absolute rounded-lg border-2 border-blue-500 transition-all duration-200"
        style={{
          top: t,
          left: l,
          width: w,
          height: h,
          boxShadow: "0 0 0 3px rgba(255,255,255,0.9), 0 0 22px 5px rgba(37,99,235,0.35)",
        }}
      />
    </div>
  );
}
