"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";

/** A deliberately quiet entrance: it is disabled for reduced-motion users. */
export function HeroMotion() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      const context = gsap.context(() => {
        gsap.from("[data-hero-reveal]", {
          autoAlpha: 0,
          y: 20,
          duration: 0.62,
          stagger: 0.08,
          ease: "power3.out",
          clearProps: "transform,visibility",
        });
        gsap.to("[data-hero-orbit]", {
          rotation: 360,
          duration: 32,
          repeat: -1,
          ease: "none",
          transformOrigin: "50% 50%",
        });
      }, root);
      return () => context.revert();
    });
    return () => media.revert();
  }, []);

  return <div className="hero-motion" ref={root} aria-hidden="true"><i data-hero-orbit /><i data-hero-orbit /></div>;
}
