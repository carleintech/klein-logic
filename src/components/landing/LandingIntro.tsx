"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";

const INTRO_STORAGE_KEY = "kleinlogic.landing-intro.seen.v1";
const INTRO_DURATION_MS = 8_000;

export default function LandingIntro() {
  const [visible, setVisible] = useState(true);
  const enterButton = useRef<HTMLButtonElement | null>(null);

  const finishIntro = useCallback(() => {
    document.documentElement.dataset.landingIntro = "seen";
    setVisible(false);

    window.requestAnimationFrame(() => {
      document.getElementById("landing-primary-action")?.focus();
    });
  }, []);

  useLayoutEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    try {
      if (window.sessionStorage.getItem(INTRO_STORAGE_KEY) || reducedMotion) {
        document.documentElement.dataset.landingIntro = "seen";
        return;
      }

      window.sessionStorage.setItem(INTRO_STORAGE_KEY, "true");
    } catch {
      // The intro remains usable when session storage is unavailable.
    }

    document.documentElement.dataset.landingIntro = "playing";
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    enterButton.current?.focus();

    const timer = window.setTimeout(finishIntro, INTRO_DURATION_MS);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        finishIntro();
      } else if (event.key === "Tab") {
        event.preventDefault();
        enterButton.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [finishIntro]);

  if (!visible) {
    return null;
  }

  return (
    <div
      className="landing-intro"
      role="dialog"
      aria-label="KleinLogic introduction"
      aria-modal="true"
    >
      <div className="landing-intro__grid" aria-hidden="true" />
      <div className="landing-intro__content">
        <div className="landing-intro__mark" aria-hidden="true"><span /><span /><span /></div>
        <p className="landing-intro__eyebrow">TechKlein presents</p>
        <h2 className="landing-intro__title">KLEIN<span>LOGIC</span></h2>
        <p className="landing-intro__tagline">Challenge your mind.</p>
        <div className="landing-intro__rule" aria-hidden="true"><span /></div>
        <button
          ref={enterButton}
          type="button"
          className="landing-intro__skip"
          onClick={finishIntro}
        >
          Enter experience <span aria-hidden="true">→</span>
        </button>
      </div>
      <p className="landing-intro__index" aria-hidden="true">KL / 001</p>
    </div>
  );
}
