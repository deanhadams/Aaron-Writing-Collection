"use client";

import { useRef } from "react";
import type { PointerEvent, ReactNode } from "react";

const GLOW_RADIUS = 240;

export function HeroGlow({ children }: { children: ReactNode }) {
  const glow = useRef<HTMLDivElement>(null);

  function follow(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse" || !glow.current) return;

    const { left, top } = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - left - GLOW_RADIUS;
    const y = event.clientY - top - GLOW_RADIUS;
    glow.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    glow.current.style.opacity = "1";
  }

  function hide() {
    if (glow.current) glow.current.style.opacity = "0";
  }

  return (
    <div
      onPointerMove={follow}
      onPointerLeave={hide}
      className="relative mb-10 py-8 sm:py-12"
    >
      <div ref={glow} aria-hidden className="hero-glow" />
      <div className="relative">{children}</div>
    </div>
  );
}
