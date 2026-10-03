"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { pageScroll } from "@/lib/scroll";

gsap.registerPlugin(ScrollTrigger);

/**
 * Smooth scrolling. Lenis is driven from GSAP's ticker so the scroll position,
 * ScrollTrigger and the lanyard physics all advance on the same frame.
 *
 * It also reports to `pageScroll`, so a section can place the page, and can
 * tell a visitor arriving from a link passing through. And it keeps the
 * visitor's place across a reload, which the browser cannot do on this page.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({
      // The page's one scroll engine (see src/lib/pace.ts). A step of the wheel
      // is 90px, small enough to be precise, and it is under way in the very
      // next frame and nine tenths done in a third of a second: answered at
      // once, never abrupt. Nothing else on the page smooths the scroll again.
      // `wheelMultiplier` is the speed of the whole page: every section slows
      // or quickens with it together.
      lerp: 0.12,
      wheelMultiplier: 0.9,
      autoRaf: false,
      anchors: {
        onStart: () => {
          pageScroll.travelling = true;
        },
        onComplete: () => {
          pageScroll.travelling = false;
        },
      },
    });
    pageScroll.attach(lenis);
    lenis.on("scroll", ScrollTrigger.update);

    // First thing every frame: the page moves, ScrollTrigger hears of it, and
    // everything tied to the scroll is set before anything else on the ticker
    // runs. Page and animation are never a frame apart.
    const update = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(update, false, true);
    gsap.ticker.lagSmoothing(0);

    // A link's journey ends the moment the visitor takes the scroll back.
    const arrive = () => {
      pageScroll.travelling = false;
    };
    window.addEventListener("wheel", arrive, { passive: true });
    window.addEventListener("touchstart", arrive, { passive: true });

    return () => {
      window.removeEventListener("wheel", arrive);
      window.removeEventListener("touchstart", arrive);
      gsap.ticker.remove(update);
      pageScroll.detach(lenis);
      lenis.destroy();
    };
  }, []);

  // Where the page opens. The pinned sections add their scroll distance to the
  // page only once their scripts have run, so the browser works against a page
  // thousands of pixels too short: on a reload it puts the scroll back in the
  // wrong place, and on a link to a section (`/#work`) it goes to where that
  // section was before the page grew. Both are done here instead, once the
  // page has its full height: a reload comes back to where the visitor was,
  // and a link to a section lands on that section.
  useEffect(() => {
    const key = `scroll:${window.location.pathname}`;
    const before = history.scrollRestoration;
    history.scrollRestoration = "manual";

    const remember = () => {
      try {
        sessionStorage.setItem(key, String(Math.round(window.scrollY)));
      } catch {
        // No storage (private mode): the page simply starts at the top.
      }
    };
    window.addEventListener("pagehide", remember);

    let saved = 0;
    try {
      saved = Number(sessionStorage.getItem(key)) || 0;
    } catch {
      saved = 0;
    }
    const [arrival] = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
    const returning = arrival?.type === "reload" || arrival?.type === "back_forward";

    let named: HTMLElement | null = null;
    try {
      const id = decodeURIComponent(window.location.hash.slice(1));
      named = id ? document.getElementById(id) : null;
    } catch {
      named = null;
    }
    /** Where an element starts in the page. A pinned one is measured by the space kept for it. */
    const topOf = (element: HTMLElement) => {
      const parent = element.parentElement;
      const box = parent?.classList.contains("pin-spacer") ? parent : element;
      return Math.round(box.getBoundingClientRect().top + window.scrollY);
    };
    const where = returning && saved > 0 ? () => saved : named ? () => topOf(named) : null;

    let settle = () => {};
    if (where) {
      // Sections measure themselves more than once while the page settles.
      // Keep putting the page there until it has, or until the visitor moves it.
      const put = () => window.scrollTo(0, where());
      const timer = window.setTimeout(() => settle(), 1500);
      settle = () => {
        window.clearTimeout(timer);
        ScrollTrigger.removeEventListener("refresh", put);
        window.removeEventListener("wheel", settle);
        window.removeEventListener("touchstart", settle);
        window.removeEventListener("keydown", settle);
      };
      put();
      ScrollTrigger.addEventListener("refresh", put);
      window.addEventListener("wheel", settle, { passive: true });
      window.addEventListener("touchstart", settle, { passive: true });
      window.addEventListener("keydown", settle);
    }

    return () => {
      settle();
      window.removeEventListener("pagehide", remember);
      history.scrollRestoration = before;
    };
  }, []);

  return null;
}
