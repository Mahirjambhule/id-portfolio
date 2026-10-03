"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { STAGE_LAYOUT, direction } from "@/components/hero/direction";
import { GLIDE, anticipatePin, registerGlide, remeasure, scrollFor } from "@/lib/pace";
import { site } from "@/lib/site";
import "./identity.css";

gsap.registerPlugin(ScrollTrigger, useGSAP);

// The film, in seconds. The scroll is its playhead: inside the pin one second of
// it is worth `scrollFor(1)` of scroll, the same rate as every other pinned section.
/**
 * The card's journey from where the hero hangs it to its mark. It plays as the
 * hero scrolls away, over the viewport that takes, so the card sets off with
 * the first turn of the wheel and arrives as the section pins.
 */
const CARRY = 1.8;
/** How much of the carry the pivot takes to get to its mark. The rest is the card settling under it. */
const ARRIVE = 0.82;
/** How long the read-out takes to lift away once the visitor scrolls on. */
const PANEL_OUT = 0.5;
/** The scanner fades in as the card arrives, and is fully there before the beam moves. */
const FRAME_AT = CARRY - 0.7;
// There is no stretch of the film in which nothing moves (see src/lib/pace.ts):
// each beat starts as the one before it ends, so the wheel never turns on nothing.
/**
 * The beam sets off as the section pins. The scan is the point of the section,
 * so it is given a great deal of scroll: about a viewport and three quarters,
 * eighteen or so steps of the wheel, each moving the beam only a little. Each
 * fact is seen being read off the card, one at a time, and scrolled back up,
 * each is seen to go again.
 */
const SCAN_AT = CARRY + 0.05;
const SCAN = 5;
/**
 * The card is carried on its cord, so a fast scroll can arrive at the scan
 * before the card has: the pivot is only hauled so fast, and the card swings
 * in behind it. The beam waits at the top of the scanner until the card hangs
 * still in it (the scene says when), however far the page has gone on, then
 * catches up with the page at this many seconds of film a second. Never
 * longer than `WAIT_MOST` ms, whatever the card is doing. At an ordinary
 * pace the card is in place long before the beam sets off, and the scan
 * simply follows the scroll.
 */
const CATCH_UP = 4;
const WAIT_MOST = 6000;
/** Everything has been read out. */
const READ = SCAN_AT + SCAN;
/** The verdict is in. */
const SHOWN = READ + 0.7;
/** The verdict is stamped on the read-out as it arrives: pressed down fast, then the tick is inked in. */
const STAMP_AT = READ + 0.24;
const STAMP = 0.22;
/** The room kept between the read-out and the foot of the screen, px. */
const CLEARANCE = 16;
/**
 * How the read-out gives way when a short phone has not room for all of it
 * under the card, each step adding to the last: the closing line goes, then
 * everything closes up and is set a little smaller, then the link on to the
 * work goes too, since scrolling on does the same.
 */
const CRAMPED = ["line", "tight", "bare"] as const;
/** Scrolling on, the read-out lifts away and the card is carried back where the hero had it. */
const LEAVE_AT = SHOWN + 0.05;
const RETURN = 1.3;
const END = LEAVE_AT + 0.05 + RETURN;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

// One path each, so an icon can draw itself in a single stroke.
const ICONS = {
  name: "M8 8.2a2.7 2.7 0 1 0 0-5.4 2.7 2.7 0 0 0 0 5.4ZM2.8 13.6c.6-2.6 2.7-3.9 5.2-3.9s4.6 1.3 5.2 3.9",
  role: "M6 4.5 2.5 8 6 11.5M10 4.5 13.5 8 10 11.5",
  location:
    "M8 14s4.2-3.9 4.2-7.4a4.2 4.2 0 0 0-8.4 0C3.8 10.1 8 14 8 14ZM8 8.1a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2Z",
  experience: "M8 13.5a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11ZM8 5v3.2l2 1.3",
  speciality: "M8 2.5 9.4 6.6 13.5 8 9.4 9.4 8 13.5 6.6 9.4 2.5 8l4.1-1.4Z",
  currently: "M3 8h10M9.2 4.2 13 8l-3.8 3.8",
} as const;

interface Fact {
  label: string;
  icon: keyof typeof ICONS;
  lines: readonly string[];
  /** How far down the card the beam has to be before this is read out, 0..1. */
  at: number;
}

/** Set round the stamp, between its rings: what was checked, on which pass. */
const STAMP_RING = `Identity verified · Studio pass № ${site.badge.serial} · ${site.badge.edition} · `.toUpperCase();
/** The circle the words run round, from nine o'clock over the top. Its length is 2π × 46.2. */
const STAMP_PATH = "M13.8 60a46.2 46.2 0 1 1 92.4 0a46.2 46.2 0 1 1-92.4 0";

const FACTS: Fact[] = [
  { label: "Name", icon: "name", lines: [site.name], at: 0.08 },
  { label: "Role", icon: "role", lines: [site.role], at: 0.24 },
  { label: "Location", icon: "location", lines: [site.identity.location], at: 0.4 },
  { label: "Experience", icon: "experience", lines: [site.identity.experience], at: 0.56 },
  { label: "Speciality", icon: "speciality", lines: site.identity.speciality, at: 0.72 },
  { label: "Currently", icon: "currently", lines: [site.identity.currently], at: 0.88 },
];

// The room: sunlight from the top right, and curves pressed into the plaster.
// Each curve is drawn twice, a lit edge and a shaded one, a little apart.
const arcs = (cx: number, cy: number, radii: number[]) =>
  radii.map((r) => `<circle cx="${cx}" cy="${cy}" r="${r}"/>`).join("");
const CURVES = arcs(1360, 1140, [430, 640, 850, 1060, 1270]) + arcs(-220, -300, [560, 800]);
const BACKDROP = `
  <div class="identity-backdrop__sun"></div>
  <svg class="identity-backdrop__curves" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" fill="none" stroke-width="1.6" aria-hidden="true">
    <g class="shade" transform="translate(-1.5 1.5)">${CURVES}</g>
    <g class="lit" transform="translate(1.2 -1.2)">${CURVES}</g>
  </svg>
  <div class="identity-backdrop__dim"></div>`;

/**
 * The hero's badge, read. Not a new scene: the same badge is carried from where
 * the hero hangs it to a scanner, and what the scan reads appears beside it.
 *
 * It must follow the `[data-hero]` section. The badge itself stays in the hero's
 * stage; this section only tells it where to hang (through `direction`) and
 * draws the scanner and the read-out over it.
 *
 * It is one film, moved on by the scroll. It starts as the hero scrolls away,
 * so there is no moment at which the page stops and a sequence begins, and the
 * section is pinned for exactly as much scroll as the rest of the film is worth.
 * What the scan reads stays until the visitor scrolls on past it.
 */
export function Identity() {
  const rootRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const root = rootRef.current;
      const wall = document.querySelector<HTMLElement>(".wall");
      const frame = root?.querySelector<HTMLElement>("[data-frame]");
      const beam = root?.querySelector<HTMLElement>("[data-beam]");
      const status = root?.querySelector<HTMLElement>("[data-status]");
      const count = root?.querySelector<HTMLElement>("[data-count]");
      const panel = root?.querySelector<HTMLElement>("[data-panel]");
      if (!root || !wall || !frame || !beam || !status || !count || !panel) return;

      const facts = Array.from(root.querySelectorAll<HTMLElement>("[data-fact]"));
      const verdict = Array.from(root.querySelectorAll<HTMLElement>("[data-verdict] > :not([data-stamp])"));
      const stamp = root.querySelector<SVGSVGElement>("[data-stamp]");
      const tick = stamp?.querySelector<SVGPathElement>("[data-stamp-tick]");
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      // The room goes into the hero's wall, under the stage, so the badge hangs
      // in front of it; and under the grain, so it is printed on the same paper.
      const backdrop = document.createElement("div");
      backdrop.className = "identity-backdrop";
      backdrop.innerHTML = BACKDROP;
      wall.insertBefore(backdrop, wall.querySelector(".wall__grain"));
      const curves = backdrop.querySelector<SVGElement>(".identity-backdrop__curves");

      // The scanner is drawn around wherever the scene says the card will hang.
      // Under it, on a phone, the read-out has whatever height is left, in a
      // section that cannot be scrolled: nothing may be lost off its foot. Where
      // there is not room for all of it, it gives way a step at a time, only as
      // far as it has to (see CRAMPED).
      const overflows = () => panel.offsetTop + panel.offsetHeight > root.clientHeight - CLEARANCE;
      const place = () => {
        const { x, y, width, height } = direction.frame;
        root.style.setProperty("--fx", `${x}px`);
        root.style.setProperty("--fy", `${y}px`);
        root.style.setProperty("--fw", `${width}px`);
        root.style.setProperty("--fh", `${height}px`);
        delete root.dataset.cramped;
        if (window.innerWidth >= 1024) return;
        for (const step of CRAMPED) {
          if (!overflows()) break;
          root.dataset.cramped = step;
        }
      };
      place();
      window.addEventListener(STAGE_LAYOUT, place);
      // The words wrap differently once the fonts are in.
      let gone = false;
      document.fonts.ready.then(() => {
        if (!gone) place();
      });

      /* ---------------------------------------------------------------- */
      /* The film                                                          */
      /* ---------------------------------------------------------------- */

      // `enter` carries the badge to its mark and `exit` carries it back;
      // `live` is what the scanner is doing.
      const flow = { enter: 0, exit: 0 };
      const live = { scan: 0, light: 0, room: 0, steady: 0 };

      // Hidden here rather than in CSS: without script everything is simply there.
      gsap.set(frame, { autoAlpha: 0, scale: 1.035 });
      gsap.set(beam, { autoAlpha: 0 });
      gsap.set(facts, { "--rule": 0 });
      gsap.set(root.querySelectorAll("[data-fact] path"), { strokeDashoffset: 1 });
      gsap.set(root.querySelectorAll("[data-fact] dt, [data-fact] dd"), { autoAlpha: 0, y: 14 });
      gsap.set(verdict, { autoAlpha: 0, y: 16 });
      // The stamp is held above the page, turned, until it is pressed.
      if (stamp) gsap.set(stamp, reduced ? { autoAlpha: 0 } : { autoAlpha: 0, scale: 1.55, rotation: -16 });
      if (tick) gsap.set(tick, { strokeDashoffset: 1 });

      registerGlide();
      const film = gsap.timeline({ paused: true, defaults: { ease: "power3.out" } });

      // Out of the hero's position and into the mark at an even pace, so every
      // step of the wheel carries the card about as far. The pivot is what
      // moves; the badge follows on its cord, and is steadied as it arrives so
      // that it hangs still for the scanner. The pivot is there a little before
      // the section pins: the card swings in behind it and needs that moment.
      film
        .to(flow, { enter: 1, duration: CARRY * ARRIVE, ease: GLIDE }, 0)
        .to(live, { steady: 1, duration: CARRY * 0.36, ease: "sine.inOut" }, CARRY * 0.5);

      // The scanner arrives as the card does, and the room falls back.
      film
        .to(frame, { autoAlpha: 1, scale: 1, duration: 0.6, ease: "power2.out" }, FRAME_AT)
        .to(live, { light: 1, room: 1, duration: 0.6, ease: "power1.inOut" }, FRAME_AT)
        // The beam is lit before it sets off, so the whole scan is seen.
        .to(beam, { autoAlpha: 1, duration: 0.25, ease: "power1.out" }, SCAN_AT - 0.3);

      // The beam travels the card at one speed.
      film
        .fromTo(frame, { "--scan": 0 }, { "--scan": 1, duration: SCAN, ease: "none" }, SCAN_AT)
        .fromTo(live, { scan: 0 }, { scan: 1, duration: SCAN, ease: "none" }, SCAN_AT);

      // Each fact is read out as the beam reaches its part of the card.
      facts.forEach((fact, index) => {
        const at = SCAN_AT + SCAN * FACTS[index].at;
        film
          .to(fact, { "--rule": 1, duration: 0.55, ease: "power2.inOut" }, at)
          .to(fact.querySelectorAll("path"), { strokeDashoffset: 0, duration: 0.55, ease: "power2.inOut" }, at + 0.03)
          .to(fact.querySelector("dt"), { autoAlpha: 1, y: 0, duration: 0.45 }, at + 0.03)
          .to(fact.querySelector("dd"), { autoAlpha: 1, y: 0, duration: 0.55 }, at + 0.08);
      });

      // Read. The scanner leaves, what it read stays, and the verdict arrives.
      // The card is held still for it, and only let go by degrees as it is
      // carried away (`show` eases the hold off with the carry), so brought
      // back up the page it is caught as it comes into the scanner, as it is
      // on the way down.
      film
        .to(beam, { autoAlpha: 0, duration: 0.35, ease: "power1.out" }, READ)
        .to(live, { light: 0.4, room: 0.45, duration: 0.55, ease: "power1.inOut" }, READ + 0.05)
        .to(frame, { autoAlpha: 0, scale: 1.02, duration: 0.5, ease: "power1.inOut" }, READ + 0.1)
        .to(verdict, { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.08 }, READ + 0.06);

      // And stamped. It comes down faster and faster, and stops dead on the page.
      if (stamp) film.to(stamp, { autoAlpha: 1, scale: 1, rotation: 0, duration: STAMP, ease: "power2.in" }, STAMP_AT);
      if (tick) film.to(tick, { strokeDashoffset: 0, duration: 0.3, ease: "power2.out" }, STAMP_AT + STAMP * 0.7);

      // Scrolled on: the read-out lifts away and the card is carried back to
      // where the hero had it, ready to be drawn up as the work arrives.
      film
        .to(panel, { autoAlpha: 0, y: -26, duration: PANEL_OUT, ease: "power2.in" }, LEAVE_AT)
        .to(flow, { exit: 1, duration: RETURN, ease: GLIDE }, LEAVE_AT + 0.05);

      /* ---------------------------------------------------------------- */
      /* Pinned for as much scroll as the film after the carry is worth    */
      /* ---------------------------------------------------------------- */

      // The hero's retraction, made before this, is measured from the end of
      // this pin.
      remeasure();
      const pin = ScrollTrigger.create({
        id: "identity",
        trigger: root,
        start: "top top",
        end: () => `+=${scrollFor(END - CARRY)}`,
        pin: true,
        anticipatePin: anticipatePin(),
        refreshPriority: 1,
      });

      // Film time and scroll position are the same thing at two scales. The
      // carry is the hero's exit: ordinary scrolling, so it takes the viewport
      // the hero takes to leave, and the card sets off with the first turn of
      // the wheel. Only what plays inside the pin is measured at the page's pace.
      const carry = () => Math.max(1, Math.min(pin.start, window.innerHeight));
      const timeAt = (scroll: number) =>
        scroll < pin.start
          ? clamp(CARRY * (1 - (pin.start - scroll) / carry()), 0, CARRY)
          : clamp(CARRY + (scroll - pin.start) / scrollFor(1), CARRY, END);

      /** Where the scroll has brought the film. */
      let head = timeAt(window.scrollY);
      /**
       * The beam and the card. While the beam waits for the card, or catches
       * up with the page once it is in place, `lead` is how far into the scan
       * it may go, in seconds of film; `free` is when it follows the scroll.
       */
      const gate = { lead: 0, free: false, since: 0, ticking: false };
      /** Where the film is: what is on screen. The scroll's place in it, unless the beam is waiting for the card. */
      const now = () => (gate.free || head <= SCAN_AT ? head : Math.min(head, SCAN_AT + gate.lead));
      let shown = -1;
      let said = "";
      /** How much of the room can be seen, 0..1. */
      let presence = 0;

      const show = () => {
        // The scanner says what it is doing: lining the card up, reading it, done.
        const time = now();
        const say = time >= READ ? "Verified" : !gate.free && head > SCAN_AT && gate.lead === 0 ? "Aligning" : "Reading";
        if (say !== said) {
          said = say;
          status.textContent = say;
        }
        if (time === shown) return;
        shown = time;
        film.time(time, true);
        count.textContent = String(Math.round(live.scan * 100)).padStart(3, "0");

        const here = flow.enter * (1 - flow.exit);
        presence = here;
        direction.shift = here;
        direction.zoom = here;
        direction.scan = live.scan;
        direction.light = live.light * (1 - flow.exit);
        direction.steady = live.steady * (1 - flow.exit);
        backdrop.style.setProperty("--here", here.toFixed(3));
        // Out of sight it is not drawn at all, rather than drawn and not seen.
        backdrop.dataset.here = String(here > 0);
        backdrop.style.setProperty("--dim", (live.room * (1 - flow.exit)).toFixed(3));
      };

      // The beam waits for the card, a frame at a time, and once the card hangs
      // still in the scanner it catches up with the page.
      const stopWaiting = () => {
        if (!gate.ticking) return;
        gate.ticking = false;
        gsap.ticker.remove(wait);
      };
      const wait = (_time: number, deltaMs: number) => {
        if (gate.free || head <= SCAN_AT) {
          stopWaiting();
          return;
        }
        if (direction.placed || gate.lead > 0 || performance.now() - gate.since > WAIT_MOST) {
          gate.lead += (Math.min(deltaMs, 50) / 1000) * CATCH_UP;
          if (SCAN_AT + gate.lead >= head) gate.free = true;
        }
        show();
        if (gate.free) stopWaiting();
      };
      /** Let the beam follow the scroll, or hold it at the top of the scanner until the card is there. */
      const govern = () => {
        if (head >= LEAVE_AT) {
          // Gone on past the read-out: there is nothing left to wait for.
          gate.free = true;
        } else if (head <= SCAN_AT) {
          // Back before the scan: the next one waits for the card again, if it has to.
          gate.free = false;
          gate.lead = 0;
        } else if (!gate.free && !gate.ticking) {
          if (direction.placed && gate.lead === 0) {
            // The card is there already, as it is at an ordinary pace.
            gate.free = true;
          } else {
            gate.since = performance.now();
            gate.ticking = true;
            gsap.ticker.add(wait);
          }
        }
      };

      // Otherwise the film is wherever the scroll has brought it, and nowhere
      // else. The smooth scroll moves the page and tells ScrollTrigger in the
      // same frame, and the film is set then, straight from the scroll
      // position: the card's journey, the beam, the count and each fact it
      // reads move with the wheel, forwards and back, stop when it stops, and
      // are never a frame behind the page. Nothing holds the page; the scan is
      // slow because it is given a great deal of scroll (`SCAN`).
      const seek = () => {
        head = timeAt(window.scrollY);
        govern();
        show();
      };
      seek();
      ScrollTrigger.create({
        start: () => pin.start - carry(),
        end: () => pin.end,
        onUpdate: seek,
      });

      // Whenever the layout is measured again (on load, on resize), the film is
      // put wherever the scroll now says.
      const onRefresh = seek;
      ScrollTrigger.addEventListener("refresh", onRefresh);

      // The room drifts a little against the badge as the visitor moves.
      const driftX = curves && !reduced ? gsap.quickTo(curves, "x", { duration: 1.4, ease: "power3.out" }) : null;
      const driftY = curves && !reduced ? gsap.quickTo(curves, "y", { duration: 1.4, ease: "power3.out" }) : null;
      // Only while it can be seen: a room nobody is in need not move.
      const onPointerMove = (event: PointerEvent) => {
        if (event.pointerType === "touch" || presence <= 0) return;
        driftX?.((event.clientX / window.innerWidth - 0.5) * -22);
        driftY?.((event.clientY / window.innerHeight - 0.5) * -14);
      };
      window.addEventListener("pointermove", onPointerMove, { passive: true });

      return () => {
        gone = true;
        stopWaiting();
        ScrollTrigger.removeEventListener("refresh", onRefresh);
        window.removeEventListener(STAGE_LAYOUT, place);
        window.removeEventListener("pointermove", onPointerMove);
        backdrop.remove();
        delete root.dataset.cramped;
        direction.shift = 0;
        direction.zoom = 0;
        direction.scan = 0;
        direction.light = 0;
        direction.steady = 0;
      };
    },
    { scope: rootRef },
  );

  return (
    <section ref={rootRef} id="identity" data-identity aria-labelledby="identity-title" className="identity">
      <div className="identity__frame" data-frame aria-hidden>
        <i className="identity__corner identity__corner--tl" />
        <i className="identity__corner identity__corner--tr" />
        <i className="identity__corner identity__corner--bl" />
        <i className="identity__corner identity__corner--br" />
        <span className="identity__tag identity__tag--tl">Identity check</span>
        <span className="identity__tag identity__tag--tr">№ {site.badge.serial}</span>
        <span className="identity__tag identity__tag--bl" data-status>
          Reading
        </span>
        <span className="identity__tag identity__tag--br">
          <span data-count>000</span>%
        </span>
        <div className="identity__beam" data-beam />
      </div>

      <div className="identity__panel" data-panel>
        <dl className="identity__facts">
          {FACTS.map((fact) => (
            <div key={fact.label} className="identity__fact" data-fact>
              <dt>
                <svg className="identity__icon" viewBox="0 0 16 16" aria-hidden>
                  <path d={ICONS[fact.icon]} pathLength={1} />
                </svg>
                {fact.label}
              </dt>
              <dd>
                {fact.lines.map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </dd>
            </div>
          ))}
        </dl>

        <div className="identity__verdict" data-verdict>
          <h2 id="identity-title">
            <i className="identity__seal" aria-hidden />
            <span>
              Identity <em>Verified.</em>
            </span>
          </h2>
          <p>{site.identity.statement}</p>
          <a className="identity__cta" href="#work">
            Explore Selected Work <span aria-hidden>↓</span>
          </a>

          {/* A rubber stamp: two rings, what was checked set between them, and a tick. */}
          <svg className="identity__stamp" data-stamp viewBox="0 0 120 120" aria-hidden>
            <defs>
              <path id="identity-stamp-ring" d={STAMP_PATH} />
              {/* The ink takes unevenly, as it does from rubber. */}
              <filter id="identity-stamp-ink" x="-5%" y="-5%" width="110%" height="110%">
                <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="3" seed="4" />
                <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.3 1.95" />
                <feComposite in="SourceGraphic" operator="in" />
              </filter>
            </defs>
            <g filter="url(#identity-stamp-ink)">
              <circle cx="60" cy="60" r="56" strokeWidth="2.9" />
              <circle cx="60" cy="60" r="41.5" strokeWidth="1.25" />
              <text>
                <textPath href="#identity-stamp-ring" textLength="289">
                  {STAMP_RING}
                </textPath>
              </text>
              <path d="M43.5 61.5 54 72l22.5-24.5" pathLength={1} data-stamp-tick />
            </g>
          </svg>
        </div>
      </div>
    </section>
  );
}
