import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

async function source(relativePath: string): Promise<string> {
  return readFile(path.join(process.cwd(), relativePath), "utf8");
}

async function main(): Promise<void> {
  const [intro, layout, page, css] = await Promise.all([
    source("src/components/landing/LandingIntro.tsx"),
    source("src/app/layout.tsx"),
    source("src/app/page.tsx"),
    source("src/app/globals.css"),
  ]);

  assert(intro.includes("INTRO_DURATION_MS = 8_000"));
  assert(intro.includes("kleinlogic.landing-intro.seen.v1"));
  assert(intro.includes("window.sessionStorage.getItem"));
  assert(intro.includes("window.sessionStorage.setItem"));
  assert(intro.includes('event.key === "Escape"'));
  assert(intro.includes('event.key === "Tab"'));
  assert(intro.includes('document.body.style.overflow = "hidden"'));
  assert(intro.includes('aria-modal="true"'));
  assert(intro.includes("enterButton.current?.focus()"));
  assert(intro.includes('getElementById("landing-primary-action")?.focus()'));
  assert(intro.includes('matchMedia("(prefers-reduced-motion: reduce)")'));
  assert(intro.includes("useLayoutEffect"));
  assert(!layout.includes("kleinlogic-intro-session"));
  assert(page.includes('id="landing-primary-action"'));
  assert(css.includes("landing-intro-exit 800ms") && css.includes("7.2s forwards"));
  assert(css.includes('html[data-landing-intro="seen"] .landing-intro'));
  assert(css.includes("prefers-reduced-motion: reduce"));

  console.log(
    JSON.stringify(
      {
        eightSecondDuration: true,
        sessionOnly: true,
        prePaintRepeatSuppression: true,
        immediateEnterControl: true,
        escapeSupported: true,
        focusManaged: true,
        reducedMotionSafe: true,
      },
      null,
      2,
    ),
  );
}

void main();
