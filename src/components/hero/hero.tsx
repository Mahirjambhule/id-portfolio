"use client";

import { useCallback, useRef, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { scrollFor } from "@/lib/pace";
import { site } from "@/lib/site";
import { HeroScene } from "./hero-scene";

gsap.registerPlugin(ScrollTrigger, useGSAP);

// The copy arrives once the badge has settled. Each part is rendered as it
// will arrive, so it is hidden from the first paint, and is marked with how:
//   rise  comes up into focus
//   lift  comes up
//   fade  fades in
//   sign  is written in by the pen, left to right
// The name's clip reaches past its box so the pen's tall strokes are never cut off.
const UNSIGNED = "inset(-40% 100% -60% -10%)";
const SIGNED = "inset(-40% -15% -60% -10%)";
const HIDDEN = {
  rise: { opacity: 0, transform: "translateY(30px)", filter: "blur(8px)" },
  lift: { opacity: 0, transform: "translateY(18px)" },
  fade: { opacity: 0 },
  sign: { opacity: 0, clipPath: UNSIGNED },
} as const;
type Arrival = keyof typeof HIDDEN;

// The copy comes in reading order, a tenth of a second apart, while the header
// and the scroll cue fade in around it. The name is written once the greeting
// above it has landed. In ms from the moment the badge settles.
const FIRST = 50;
const STAGGER = 100;
const SIGN_AT = 450;

// Coming to rest, slowing right down into place; the pen, gathering speed and
// slowing again; and a plain fade.
const REST = "cubic-bezier(0.16, 1, 0.3, 1)";
const PEN = "cubic-bezier(0.65, 0, 0.35, 1)";
const FADE = "ease-out";

interface Movement {
  from: Keyframe;
  to: Keyframe;
  /** In ms. */
  duration: number;
  easing: string;
  /** When it starts, if not at the part's turn. */
  at?: number;
}

const MOVEMENTS: Record<Arrival, Movement[]> = {
  rise: [{ from: HIDDEN.rise, to: { opacity: 1, transform: "none", filter: "none" }, duration: 1250, easing: REST }],
  lift: [{ from: HIDDEN.lift, to: { opacity: 1, transform: "none" }, duration: 1050, easing: REST }],
  fade: [{ from: HIDDEN.fade, to: { opacity: 1 }, duration: 1700, easing: FADE }],
  sign: [
    { from: { opacity: 0 }, to: { opacity: 1 }, duration: 250, easing: FADE, at: SIGN_AT },
    { from: { clipPath: UNSIGNED }, to: { clipPath: SIGNED }, duration: 1200, easing: PEN, at: SIGN_AT },
  ],
};

// The main button is drawn towards a pointer that comes near it: how close the
// pointer has to come, in px beyond its edge, how far the button follows it,
// and how much further again the disc with the arrow goes.
const REACH = 90;
const PULL = { x: 0.1, y: 0.22 } as const;
const LEAD = 0.5;

const underline =
  "relative after:absolute after:inset-x-0 after:-bottom-1 after:h-px after:origin-right after:scale-x-0 " +
  "after:bg-current after:transition-transform after:duration-500 after:ease-out-expo " +
  "hover:after:origin-left hover:after:scale-x-100";

function Arrow() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M2.5 8h11M9 3.5 13.5 8 9 12.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface HeroProps {
  /** The badge markup, rendered on the server and handed to the scene. */
  badge: ReactNode;
  /** The wordmark for the header, also rendered on the server. */
  logo: ReactNode;
}

export function Hero({ badge, logo }: HeroProps) {
  const heroRef = useRef<HTMLElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const cueRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLAnchorElement>(null);

  // The scene says when the badge has settled, from its own ticker. The copy is
  // played in by the browser (the Web Animations API) rather than on that
  // ticker: it needs no frame-by-frame help, so the browser can run it off the
  // main thread, which is busy with the scene.
  const revealedRef = useRef(false);
  const handleSettled = useCallback(() => {
    const hero = heroRef.current;
    if (!hero || revealedRef.current) return;
    revealedRef.current = true;

    // With reduced motion nothing travels: each part fades, comes into focus
    // or is written in where it rests.
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const still = (frame: Keyframe) => {
      const kept = { ...frame };
      if (reduced) delete kept.transform;
      return kept;
    };

    const parts = [...hero.querySelectorAll<HTMLElement>("[data-reveal]")];
    const copy = parts.filter((part) => copyRef.current?.contains(part));
    for (const part of parts) {
      const place = copy.indexOf(part);
      const turn = place < 0 ? 0 : FIRST + STAGGER * place;
      for (const { from, to, duration, easing, at = turn } of MOVEMENTS[part.dataset.reveal as Arrival]) {
        // Left where it ends and played from where it starts, so nothing is
        // left to do once it has arrived.
        Object.assign(part.style, to);
        part.animate([still(from), still(to)], { duration, easing, delay: at, fill: "backwards" });
      }
    }
  }, []);

  useGSAP(
    () => {
      // Beside the badge, the copy drifts up and out as the page begins to move.
      // Stacked under it, it simply scrolls. Measured at the page's pace, like
      // everything else that scroll drives: the copy is gone in the time the badge
      // takes to be carried as far as the column it stood in.
      const media = gsap.matchMedia();
      media.add("(min-width: 1024px) and (prefers-reduced-motion: no-preference)", () => {
        gsap.to(copyRef.current, {
          y: -72,
          opacity: 0,
          ease: "none",
          scrollTrigger: {
            trigger: heroRef.current,
            start: "top top",
            end: () => `+=${scrollFor(0.7)}`,
            scrub: true,
          },
        });
        gsap.to(cueRef.current, {
          opacity: 0,
          ease: "none",
          scrollTrigger: { trigger: heroRef.current, start: "top top", end: () => `+=${scrollFor(0.3)}`, scrub: true },
        });
      });

      // The main button leans towards a hand that comes near it, the disc
      // further than the rest, and lets go when it moves away. It moves on
      // `translate`, so its reveal (on `transform`) and the disc's turn on
      // hover (`rotate`) are left as they are.
      media.add("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)", () => {
        const cta = ctaRef.current;
        const knob = cta?.querySelector<HTMLElement>("[data-knob]");
        if (!cta || !knob) return;

        const pull = { x: 0, y: 0 };
        const write = () => {
          cta.style.translate = `${pull.x.toFixed(2)}px ${pull.y.toFixed(2)}px`;
          knob.style.translate = `${(pull.x * LEAD).toFixed(2)}px ${(pull.y * LEAD).toFixed(2)}px`;
        };
        const toX = gsap.quickTo(pull, "x", { duration: 0.7, ease: "power3.out", onUpdate: write });
        const toY = gsap.quickTo(pull, "y", { duration: 0.7, ease: "power3.out", onUpdate: write });

        const onMove = (event: PointerEvent) => {
          const box = cta.getBoundingClientRect();
          // Measured from where the button rests, not from where it has been drawn to.
          const dx = event.clientX - (box.left + box.width / 2 - pull.x);
          const dy = event.clientY - (box.top + box.height / 2 - pull.y);
          const gap = Math.max(Math.abs(dx) - box.width / 2, Math.abs(dy) - box.height / 2, 0);
          const near = Math.max(0, 1 - gap / REACH);
          toX(dx * PULL.x * near);
          toY(dy * PULL.y * near);
        };
        const release = () => {
          toX(0);
          toY(0);
        };
        window.addEventListener("pointermove", onMove, { passive: true });
        document.documentElement.addEventListener("pointerleave", release);

        return () => {
          window.removeEventListener("pointermove", onMove);
          document.documentElement.removeEventListener("pointerleave", release);
          gsap.killTweensOf(pull);
          cta.style.translate = "";
          knob.style.translate = "";
        };
      });
    },
    { scope: heroRef },
  );

  return (
    <section ref={heroRef} id="top" data-hero className="relative isolate">
      <HeroScene onSettled={handleSettled}>{badge}</HeroScene>

      <header data-reveal="fade" style={HIDDEN.fade} className="absolute inset-x-0 top-0 z-30">
        <div className="mx-auto flex h-20 max-w-[1680px] items-center justify-between px-6 sm:px-10 lg:h-24 lg:px-12">
          <a
            href="#top"
            aria-label={`${site.name}, back to top`}
            className="block origin-left scale-[0.86] sm:scale-100"
          >
            {logo}
          </a>
          <nav
            aria-label="Primary"
            className="flex items-center gap-5 font-mono text-[0.6875rem] uppercase tracking-[0.14em] sm:gap-7 lg:gap-10"
          >
            <a href="#identity" className={underline}>
              About
            </a>
            <a href="#contact" className={underline}>
              Contact
            </a>
          </nav>
        </div>
      </header>

      <div className="relative z-20 mx-auto flex min-h-svh max-w-[1680px] flex-col px-6 sm:px-10 lg:grid lg:h-svh lg:min-h-[640px] lg:grid-cols-12 lg:gap-x-6 lg:px-12">
        {/* Where the badge hangs. The scene reads this box and fits the badge to it. */}
        <div
          data-badge-slot
          aria-hidden
          className="pointer-events-none h-[clamp(340px,52svh,520px)] shrink-0 md:h-[clamp(480px,60svh,760px)] lg:col-span-6 lg:col-start-7 lg:row-start-1 lg:h-full"
        />

        <div
          ref={copyRef}
          className="flex flex-1 flex-col pb-12 pt-1 md:pt-4 lg:col-span-6 lg:col-start-1 lg:row-start-1 lg:justify-center lg:pb-0 lg:pt-12"
        >
          <div>
            <p
              data-reveal="lift"
              style={HIDDEN.lift}
              className="flex items-center gap-3 whitespace-nowrap font-mono text-[0.625rem] uppercase tracking-[0.12em] text-ink-faint sm:text-[0.6875rem] sm:tracking-[0.18em]"
            >
              <span aria-hidden className="hidden h-px w-8 bg-ink/25 sm:block" />
              Portfolio
              <span aria-hidden className="text-ink/25">
                /
              </span>
              2026
            </p>

            <h1 className="mt-5 font-display text-[clamp(1.9rem,10.6vw,4.25rem)] font-light leading-[0.98] tracking-[-0.03em] md:mt-6 lg:mt-9 lg:text-[clamp(3.25rem,5.6vw,6rem)]">
              <span data-reveal="rise" style={HIDDEN.rise} className="block">
                Hello,
              </span>
              {/* The name is signed rather than set. */}
              <span
                data-reveal="sign"
                style={HIDDEN.sign}
                data-signature
                className="block w-fit origin-bottom-left rotate-[-4deg] whitespace-nowrap font-script text-[1.62em] font-normal leading-[0.86] tracking-normal text-cobalt"
              >
                I&rsquo;m {site.name}
                <span className="sr-only">,</span>
              </span>
              <span data-reveal="rise" style={HIDDEN.rise} className="block italic">
                a {site.role.toLowerCase()}.
              </span>
            </h1>

            <p
              data-reveal="fade"
              style={HIDDEN.fade}
              className="mt-6 max-w-[29rem] text-pretty text-[1.0625rem] leading-[1.5] text-ink-soft md:mt-7 lg:mt-10 lg:text-[1.1875rem] lg:leading-[1.55]"
            >
              I design and build tactile, motion-led websites for studios and brands that care how things feel,
              not only how they look.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-x-8 gap-y-4 md:mt-9 lg:mt-12">
              <a
                ref={ctaRef}
                data-reveal="lift"
                style={HIDDEN.lift}
                href={`mailto:${site.email}`}
                className="group inline-flex h-13 items-center gap-4 rounded-full bg-cobalt pl-7 pr-2 font-mono text-[0.71875rem] uppercase tracking-[0.12em] text-paper transition-colors duration-500 hover:bg-cobalt-deep"
              >
                Start a project
                <span
                  data-knob
                  className="grid size-9 place-items-center rounded-full bg-paper text-cobalt transition-[rotate] duration-500 ease-out-expo group-hover:-rotate-45"
                >
                  <Arrow />
                </span>
              </a>
              <a
                data-reveal="lift"
                style={HIDDEN.lift}
                href="#identity"
                className={`inline-flex h-13 items-center font-mono text-[0.71875rem] uppercase tracking-[0.12em] ${underline} after:bottom-3`}
              >
                About {site.name}
              </a>
            </div>
          </div>
        </div>
      </div>

      <div
        data-reveal="fade"
        style={HIDDEN.fade}
        className="pointer-events-none absolute inset-x-0 bottom-0 z-20 hidden lg:tall:block"
      >
        <div className="mx-auto max-w-[1680px] px-12 pb-10">
          <div
            ref={cueRef}
            className="flex items-center gap-4 font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-ink-faint"
          >
            <span aria-hidden className="scroll-cue__line h-10 w-px bg-ink/15" />
            Scroll
          </div>
        </div>
      </div>
    </section>
  );
}
