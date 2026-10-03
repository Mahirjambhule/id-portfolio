"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { STAGE_LAYOUT, direction } from "@/components/hero/direction";
import { Foliage, type BranchShape } from "@/components/hero/foliage";
import { GLIDE, anticipatePin, registerGlide, scrollFor } from "@/lib/pace";
import { penStroke, pressure } from "@/lib/pen";
import { site } from "@/lib/site";
import "./contact.css";

gsap.registerPlugin(ScrollTrigger, useGSAP);

// The film, in seconds. The scroll is its playhead: one second of it is worth
// `scrollFor(1)` of scroll, like every other pinned section, and nothing in it
// waits. Whatever the visitor scrolls, something moves.
/** The badge sets off just before the section pins, so the first step after it pins already moves it. */
const LEAD = 0.3;
/** Let down from the top of the viewport on its cord, the camera coming in as it arrives. */
const DROP = 1.1;
const NEAR = 1.5;
/** The sun comes in as it settles. */
const SUN_AT = 0.6;
const SUN = 0.9;
/** Turned over: about two seconds at an unhurried scroll, once the badge's own weight is counted in. */
const TURN_AT = 1.25;
const TURN = 1.7;
/** The back is read out line by line as it comes round. */
const REVEAL_AT = TURN_AT + TURN * 0.66;
const ROW = 0.5;
const STAGGER = 0.12;
/** The closing words follow the last line. */
const WORDS_AT = REVEAL_AT + STAGGER * 4 + 0.15;
/** The last word is underlined by hand as it lands. */
const PEN_AT = WORDS_AT + 0.3;
const PEN = 0.55;
/** The badge is given one last push, and the sun begins to go. */
const REST_AT = WORDS_AT + 0.5;
const END = REST_AT + 0.4;

/** The last push, in design pixels per second. */
const SWING = 64;

/**
 * The olive branch from the hero's window, in this room's late sun. The sun is
 * low and on the right, so the shadow comes in at the top right corner and is
 * drawn out long across the wall. Positions are fractions of its canvas.
 */
const LATE_BRANCH: BranchShape = {
  rootX: 1.04,
  rootY: 0.02,
  heading: Math.PI - 0.62,
  reach: 0.74,
  bow: -0.3,
  shade: "rgb(88 84 78)",
  seed: 20261001,
};

/**
 * The underline, one stroke of the same pen that signed the name at the top of
 * the page: it touches down, runs on almost level, and lifts away rising.
 */
const UNDERLINE = penStroke([[[3, 12], [60, 16.5], [150, 15], [237, 5]]], pressure(0.45, 3.2, 0.36));

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

// The room: a vault behind the badge and a great curve either side of it, each
// drawn twice, a lit edge and a shaded one, a little apart.
const arcs = (cx: number, cy: number, radii: number[]) =>
  radii.map((r) => `<circle cx="${cx}" cy="${cy}" r="${r}"/>`).join("");
const CURVES = arcs(800, 1330, [1010, 1240]) + arcs(2050, 420, [900]) + arcs(-450, 420, [900]);
const BACKDROP = `
  <div class="contact-backdrop__sun"></div>
  <div class="contact-backdrop__rays"></div>
  <svg class="contact-backdrop__curves" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" fill="none" stroke-width="1.6" aria-hidden="true">
    <g class="shade" transform="translate(-1.5 1.5)">${CURVES}</g>
    <g class="lit" transform="translate(1.2 -1.2)">${CURVES}</g>
  </svg>
  <canvas class="contact-backdrop__leaves"></canvas>
  <div class="contact-backdrop__ground"></div>`;

/**
 * The closing chapter. Not a form and not a footer: the badge the page opened
 * with is let down again in the middle of the room, turned over, and its back
 * is a business card. The visitor leaves holding it.
 *
 * It must come last, after the `[data-hero]` section. The badge stays in the
 * hero's stage: this section only tells it what to do (through
 * `direction.closing`), brings the lines on its back to life, and sets the
 * closing words under it.
 *
 * Like every pinned section it is one film with the scroll as its playhead:
 * set from a ScrollTrigger, in the frame the page moves, and pinned for
 * exactly the scroll its seconds are worth.
 */
export function Contact() {
  const rootRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const root = rootRef.current;
      const wall = document.querySelector<HTMLElement>(".wall");
      const back = document.querySelector<HTMLElement>("[data-badge-back]");
      const stage = back?.closest<HTMLElement>(".stage");
      const said = root?.querySelector<HTMLElement>("[data-said]");
      // No badge to turn over: the words and the links stay as they are.
      if (!root || !wall || !back || !stage || !said) return;

      const find = (key: string) => back.querySelector<HTMLElement>(`[data-contact="${key}"]`);
      const email = find("email");
      const github = find("github");
      const linkedin = find("linkedin");
      const resume = find("resume");
      const code = find("qr");
      if (!email || !github || !linkedin || !resume || !code) return;

      const rows = [email, github, linkedin, resume, code];
      const words = Array.from(root.querySelectorAll<HTMLElement>("[data-word]"));
      const pen = root.querySelector<SVGPathElement>("[data-pen]");
      const glance = stage.querySelector<HTMLElement>("[data-badge-glance]");
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const closing = direction.closing;

      const undo: Array<() => void> = [];
      const listen = <K extends keyof HTMLElementEventMap>(
        target: HTMLElement,
        type: K,
        handler: (event: HTMLElementEventMap[K]) => void,
      ) => {
        target.addEventListener(type, handler);
        undo.push(() => target.removeEventListener(type, handler));
      };

      root.dataset.live = "true";

      // The room goes into the hero's wall, under the stage, so the badge hangs
      // in front of it; and under the grain, so it is printed on the same paper.
      const backdrop = document.createElement("div");
      backdrop.className = "contact-backdrop";
      backdrop.innerHTML = BACKDROP;
      wall.insertBefore(backdrop, wall.querySelector(".wall__grain"));
      const curves = backdrop.querySelector<SVGElement>(".contact-backdrop__curves");

      // The branch from the hero's window, in this room's sun. It stirs in the
      // room's air, which the scene keeps, on a clock of its own.
      const leavesCanvas = backdrop.querySelector<HTMLCanvasElement>(".contact-backdrop__leaves");
      const leavesCtx = leavesCanvas?.getContext("2d") ?? null;
      const foliage = new Foliage(LATE_BRANCH);
      let leavesClock = 0;
      const drawLeaves = () => {
        if (leavesCtx) foliage.draw(leavesCtx, leavesClock, direction.air);
      };
      const fit = () => {
        if (leavesCanvas && foliage.fit(leavesCanvas)) drawLeaves();
      };
      fit();
      window.addEventListener("resize", fit);

      // The words are set under wherever the scene says the card will end, in
      // the room it leaves them.
      const place = () => {
        const { y, height } = closing.frame;
        const floor = closing.floor || window.innerHeight;
        root.style.setProperty("--card-bottom", `${Math.round(y + height)}px`);
        root.style.setProperty("--floor", `${Math.round(Math.max(0, window.innerHeight - floor))}px`);
      };
      place();
      window.addEventListener(STAGE_LAYOUT, place);

      /* ---------------------------------------------------------------- */
      /* The film                                                          */
      /* ---------------------------------------------------------------- */

      registerGlide();
      const live = { lower: 0, zoom: 0, turn: 0, sun: 0, steady: 0 };

      // Hidden here rather than in CSS: without script everything is simply there.
      gsap.set([...rows, ...words], { autoAlpha: 0, y: 24, filter: "blur(8px)" });
      if (pen) gsap.set(pen, { strokeDashoffset: 1 });

      const film = gsap.timeline({ paused: true, defaults: { ease: GLIDE } });

      // Let down on its cord as the scroll pays it out, the camera coming in.
      // It arrives swinging, and is steadied as the sun reaches it.
      film
        .to(live, { lower: 1, duration: DROP }, 0)
        .to(live, { zoom: 1, duration: NEAR }, 0)
        .to(live, { sun: 1, duration: SUN }, SUN_AT)
        .to(live, { steady: 1, duration: 0.45, ease: "none" }, DROP - 0.15);

      // Turned over. How heavily is the scene's business: this only says how far.
      film.to(live, { turn: 1, duration: TURN }, TURN_AT);

      // The back, line by line, as it comes round.
      rows.forEach((row, index) => {
        film.to(
          row,
          { autoAlpha: 1, y: 0, filter: "blur(0px)", duration: ROW, ease: "power2.out" },
          REVEAL_AT + index * STAGGER,
        );
      });

      // The closing words, and then the light begins to go.
      film
        .to(words, { autoAlpha: 1, y: 0, filter: "blur(0px)", duration: 0.5, stagger: STAGGER, ease: "power2.out" }, WORDS_AT)
        .to(live, { sun: 0.58, duration: END - REST_AT }, REST_AT)
        .to(live, { steady: 0.5, duration: END - REST_AT, ease: "none" }, REST_AT);
      // The last word is underlined as it lands, at the pace of a hand.
      if (pen) film.to(pen, { strokeDashoffset: 0, duration: PEN, ease: "power1.inOut" }, PEN_AT);

      /* ---------------------------------------------------------------- */
      /* Pinned for as much scroll as the film after the lead is worth     */
      /* ---------------------------------------------------------------- */

      const pin = ScrollTrigger.create({
        id: "contact",
        trigger: root,
        start: "top top",
        end: () => `+=${scrollFor(END - LEAD)}`,
        pin: true,
        anticipatePin: anticipatePin(),
      });

      // Film time and scroll position are the same thing at two scales.
      const timeAt = (scroll: number) => clamp(LEAD + (scroll - pin.start) / scrollFor(1), 0, END);

      let head = -1;
      let here = -1;
      let side = 1;

      const seek = () => {
        const y = window.scrollY;
        const view = window.innerHeight;

        // The room takes over from the hero's wall while the section above is
        // leaving: it is faded in as that section's last screen starts to
        // scroll away, so the wall never changes in one step under it.
        const present = clamp((y - (pin.start - view * 1.3)) / (view * 0.35), 0, 1);
        if (present !== here) {
          here = present;
          backdrop.dataset.here = String(present > 0);
          backdrop.style.setProperty("--present", present.toFixed(3));
        }
        backdrop.style.setProperty("--arrive", clamp(1 - (pin.start - y) / view, 0, 1).toFixed(3));

        const time = timeAt(y);
        if (time === head) return;
        // Coming to rest, the badge is given one more gentle push.
        if (!reduced && head >= 0 && head < REST_AT && time >= REST_AT) {
          direction.push = SWING * side;
          side = -side;
        }
        head = time;
        film.time(head, true);

        closing.lower = live.lower;
        closing.zoom = live.zoom;
        closing.sun = live.sun;
        closing.steady = live.steady;
        // With reduced motion the card is not seen turning: it is one side or the other.
        closing.turn = reduced ? Math.round(live.turn) : live.turn;
        backdrop.style.setProperty("--sun", live.sun.toFixed(3));
      };

      // The scroll is the playhead, over the whole page, so the film is right
      // wherever the page is put and however it got there.
      ScrollTrigger.create({ start: 0, end: "max", onUpdate: seek, onRefresh: seek });
      seek();

      // The branch is not on the film: it moves on the clock, whatever the
      // scroll is doing, while the room is there and the sun is in it.
      const rustle = (_time: number, deltaMs: number) => {
        if (reduced || here <= 0 || live.sun < 0.01) return;
        leavesClock += Math.min(deltaMs / 1000, 0.05);
        drawLeaves();
      };
      gsap.ticker.add(rustle);

      /* ---------------------------------------------------------------- */
      /* The card, once it is in the hand                                  */
      /* ---------------------------------------------------------------- */

      /** Send a reflection across the card, left to right as the visitor sees it. */
      const sweep = (strength: number, seconds: number) => {
        if (!glance || reduced) return;
        glance.animate(
          [
            { transform: "translateX(372%) skewX(-16deg)", opacity: 0 },
            { opacity: strength, offset: 0.22 },
            { opacity: strength, offset: 0.7 },
            { transform: "translateX(0%) skewX(-16deg)", opacity: 0 },
          ],
          { duration: seconds * 1000, easing: "cubic-bezier(0.4, 0, 0.2, 1)" },
        );
      };

      /** Show a line's note ("Copied ✓") in place of its text for a moment. */
      const timers = new Map<HTMLElement, number>();
      const flash = (row: HTMLElement, ms: number) => {
        row.dataset.state = "done";
        window.clearTimeout(timers.get(row));
        timers.set(
          row,
          window.setTimeout(() => delete row.dataset.state, ms),
        );
      };

      // Email: a reflection crosses the card, and a click copies the address.
      listen(email, "pointerenter", () => sweep(0.95, 1.1));
      listen(email, "click", (event) => {
        if (!navigator.clipboard) return; // No clipboard here: the link writes an email instead.
        event.preventDefault();
        navigator.clipboard.writeText(site.email).then(
          () => {
            flash(email, 1900);
            said.textContent = "Email address copied.";
          },
          () => {
            window.location.href = `mailto:${site.email}`;
          },
        );
      });

      // GitHub: the card's shadow deepens. LinkedIn: a slower, fainter light.
      const deepen = (value: number) => gsap.to(stage, { "--deep": value, duration: 0.7, ease: "power2.out", overwrite: true });
      listen(github, "pointerenter", () => deepen(1));
      listen(github, "pointerleave", () => deepen(0));
      listen(linkedin, "pointerenter", () => sweep(0.5, 1.7));

      // Both lead away: the page fades to paper, then goes.
      const veil = document.createElement("div");
      veil.className = "contact-veil";
      document.body.appendChild(veil);
      let leaving = 0;
      const leave = (event: MouseEvent) => {
        const link = event.currentTarget as HTMLAnchorElement;
        const plain = event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
        if (!plain || reduced) return;
        event.preventDefault();
        veil.dataset.on = "true";
        window.clearTimeout(leaving);
        leaving = window.setTimeout(() => {
          window.location.href = link.href;
        }, 560);
      };
      listen(github, "click", leave);
      listen(linkedin, "click", leave);
      // Back again, the page is as it was left.
      const onPageShow = () => delete veil.dataset.on;
      window.addEventListener("pageshow", onPageShow);

      // Resume: the file is on its way. The code: pressed, it comes a little closer.
      listen(resume, "click", () => flash(resume, 1700));
      listen(code, "click", () => {
        code.dataset.open = String(code.dataset.open !== "true");
      });

      // The same links, for the keyboard. Where it is, the card shows.
      root.querySelectorAll<HTMLAnchorElement>("[data-for]").forEach((link) => {
        const row = find(link.dataset.for ?? "");
        if (!row) return;
        listen(link, "focus", () => {
          if (!link.matches(":focus-visible")) return;
          row.dataset.focus = "true";
          if (window.scrollY < pin.end - 2) window.scrollTo(0, pin.end);
        });
        listen(link, "blur", () => delete row.dataset.focus);
      });

      // The room drifts a little against the badge as the visitor moves, while it can be seen.
      const driftX = curves && !reduced ? gsap.quickTo(curves, "x", { duration: 1.4, ease: "power3.out" }) : null;
      const driftY = curves && !reduced ? gsap.quickTo(curves, "y", { duration: 1.4, ease: "power3.out" }) : null;
      const onPointerMove = (event: PointerEvent) => {
        if (event.pointerType === "touch" || here <= 0) return;
        driftX?.((event.clientX / window.innerWidth - 0.5) * -18);
        driftY?.((event.clientY / window.innerHeight - 0.5) * -12);
      };
      window.addEventListener("pointermove", onPointerMove, { passive: true });

      return () => {
        undo.forEach((off) => off());
        timers.forEach((timer) => window.clearTimeout(timer));
        window.clearTimeout(leaving);
        gsap.ticker.remove(rustle);
        window.removeEventListener("resize", fit);
        window.removeEventListener(STAGE_LAYOUT, place);
        window.removeEventListener("pageshow", onPageShow);
        window.removeEventListener("pointermove", onPointerMove);
        backdrop.remove();
        veil.remove();
        delete root.dataset.live;
        rows.forEach((row) => {
          delete row.dataset.state;
          delete row.dataset.focus;
        });
        delete code.dataset.open;
        closing.lower = 0;
        closing.zoom = 0;
        closing.turn = 0;
        closing.sun = 0;
        closing.steady = 0;
      };
    },
    { scope: rootRef },
  );

  const { heading, invitation, signOff } = site.closing;

  return (
    <>
      <section ref={rootRef} aria-labelledby="contact-title" className="contact">
        <div className="contact__words">
          <h2 id="contact-title" className="contact__heading" data-word>
            {heading[0]}{" "}
            <em className="contact__last">
              {heading[1]}
              <svg className="contact__underline" viewBox="0 0 240 22" aria-hidden>
                <mask id="contact-underline" maskUnits="userSpaceOnUse" x="-10" y="-10" width="260" height="42">
                  <path d={UNDERLINE.path} pathLength={1} data-pen />
                </mask>
                <path d={UNDERLINE.ink} mask="url(#contact-underline)" />
              </svg>
            </em>
          </h2>
          <p className="contact__invitation" data-word>
            {invitation}
          </p>
          <p className="contact__sign-off" data-word>
            {signOff}
          </p>
        </div>

        {/* The links on the back of the badge, for keyboards, screen readers and pages without script. */}
        <ul className="contact__links" aria-label="Contact">
          <li>
            <a href={`mailto:${site.email}`} data-for="email">
              <span>Email</span> {site.email}
            </a>
          </li>
          <li>
            <a href={site.contact.github.href} rel="noreferrer" data-for="github">
              <span>GitHub</span> {site.contact.github.label}
            </a>
          </li>
          <li>
            <a href={site.contact.linkedin.href} rel="noreferrer" data-for="linkedin">
              <span>LinkedIn</span> {site.contact.linkedin.label}
            </a>
          </li>
          <li>
            <a href={site.contact.resume.href} download={site.contact.resume.file} data-for="resume">
              <span>Resume</span> {site.contact.resume.label}
            </a>
          </li>
        </ul>
        <p className="sr-only" aria-live="polite" data-said />
      </section>

      {/* Where a link to #contact lands: the end of the page, with the card turned over. */}
      <div id="contact" aria-hidden />
    </>
  );
}
