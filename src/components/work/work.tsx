"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { GLIDE, anticipatePin, registerGlide, remeasure, scrollFor } from "@/lib/pace";
import { pageScroll } from "@/lib/scroll";
import { projects } from "@/lib/work";
import "./work.css";

gsap.registerPlugin(ScrollTrigger, useGSAP);

// The orbit is one film, and the scroll is its playhead. These are its timings
// in seconds; `scrollFor` turns them into scroll distance at the pace the whole
// page keeps, so a turn here costs what a second costs anywhere.
/** The orbit settles into place while the stage rises into view, over this much of a viewport. */
const APPROACH = 0.9;
/** The arrival's length on the film. The approach plays it, not the pin. */
const ARRIVE = 1;
/** A quarter of the orbit: one project handing the centre to the next. */
const TURN = 1.7;
/** A last look at the final project before the page moves on. */
const LINGER = 0.3;
/** How long, in film seconds from the moment it locks into place, the stage's top takes to close over the wall behind it. */
const SEAL = 0.25;
/** The orbit's own motion: a near-linear ease, so every step of the wheel turns it about as far. */
const MOVE = GLIDE;
const SETTLE = "power3.out";

// The orbit. Every card rides the same ellipse, which is measured in card
// sizes, so it keeps its proportions on any screen. The card at the front
// faces the visitor square on; its neighbours wait behind it on either side,
// smaller, softer and a little higher, turned to follow the curve.
/** Half the ellipse's width, in card widths. Wide enough that two cards passing at one depth never touch. */
const ACROSS = 0.7;
/** How far the ellipse reaches back, in card widths. */
const DEPTH = 0.42;
/** How much higher the far side of the orbit sits, as it does seen from a little above: in card heights. */
const RISE = 0.07;
/** The lens: `perspective()` on the orbit, in card widths. */
const LENS = 2.3;
/** How far a card turns to follow the curve, at its widest, in degrees. */
const YAW = 16;
/** A card a quarter of the way round: its scale, opacity, blur (px) and the strength of its shadow. */
const SIDE = { scale: 0.82, opacity: 0.62, blur: 1.9, shadow: 0.24 } as const;
/** The widest a card is drawn, px: on a large display it still leaves the orbit room to turn. */
const CARD_MOST = 1160;
/** The blur's steps, and the most a card is ever blurred, in px. */
const BLUR_STEP = 0.5;
const BLUR_MAX = 4;
/** The turntable on the floor: how far below the orbit it lies, in card heights; its rim's two edges, as shares of the orbit's radius; and its marks round the rim. */
const FLOOR = { below: 0.62, outer: 1, inner: 0.93, ticks: 72 } as const;
/** Where the cards wait before the stage arrives: this far behind the orbit (px), and this far round it (in cards). */
const ARRIVAL = { depth: 520, turn: 0.28 } as const;

// What a card looks like at each point round the orbit, from `facing`: 1 at
// the front, 0.5 a quarter of the way round, 0 at the back.
const BACK_SCALE = 2 * SIDE.scale - 1;
/** Out of sight across the back of the orbit. */
const HIDDEN = 0.06;
const OPACITY_CURVE = Math.log(SIDE.opacity) / Math.log((0.5 - HIDDEN) / (1 - HIDDEN));
const SHADOW_CURVE = Math.log(SIDE.shadow) / Math.log(0.5);
const scaleAt = (facing: number) => BACK_SCALE + (1 - BACK_SCALE) * facing;
const opacityAt = (facing: number) => Math.max(0, (facing - HIDDEN) / (1 - HIDDEN)) ** OPACITY_CURVE;
const blurAt = (facing: number) => SIDE.blur * ((1 - facing) / 0.5) ** 1.4;
const shadowAt = (facing: number) => facing ** SHADOW_CURVE;

// Pointer: only the card at the front answers it.
/** The most it tilts, in degrees. */
const TILT = 3;
/** How near the front it must be to answer at all, in cards. */
const STEADY = 0.2;
/** How far the pointer slides each layer, px: the words towards it, the shadow and the reflection away. */
const SHIFT = { copy: 4, shadow: 16, gloss: 46 } as const;

/** How far the dust in the room drifts for every project the orbit turns past, px. */
const DRIFT = 70;
/** The dust drifts a few pixels a second, so it is drawn this many times a second. */
const DUST_RATE = 30;

const COUNT = projects.length;
const STEP = (Math.PI * 2) / COUNT;
/** The whole film: the arrival, a turn to each project after the first, and a last look. */
const LENGTH = ARRIVE + (COUNT - 1) * TURN + LINGER;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const clampUnit = (value: number) => Math.max(-1, Math.min(1, value));
/** An angle brought round into -π..π. */
const wrap = (angle: number) => angle - Math.PI * 2 * Math.round(angle / (Math.PI * 2));

function Arrow() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M2.5 8h11M9 3.5 13.5 8 9 12.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A little dust in the room's light. It drifts sideways as the orbit turns. */
function makeDust() {
  let seed = 9;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const motes = Array.from({ length: 28 }, () => ({
    x: random(),
    y: random(),
    depth: 0.3 + random() * 0.7,
    size: 0.8 + random() * 1.6,
    drift: (random() - 0.5) * 0.012,
    rise: 0.006 + random() * 0.014,
    phase: random() * Math.PI * 2,
  }));
  return (ctx: CanvasRenderingContext2D, width: number, height: number, time: number, dt: number, shift: number) => {
    ctx.clearRect(0, 0, width, height);
    for (const mote of motes) {
      mote.x = (mote.x + mote.drift * dt + 1) % 1;
      mote.y = (mote.y - mote.rise * dt + 1) % 1;
      // Near motes slide further as the orbit turns.
      const x = (((mote.x * width + shift * mote.depth + Math.sin(time * 0.3 + mote.phase) * 10) % width) + width) % width;
      ctx.fillStyle = `rgba(128, 124, 118, ${(0.1 + mote.depth * 0.2) * (0.7 + 0.3 * Math.sin(time * 0.8 + mote.phase))})`;
      ctx.beginPath();
      ctx.arc(x, mote.y * height, mote.size * (0.6 + mote.depth * 0.7), 0, Math.PI * 2);
      ctx.fill();
    }
  };
}

/** One card's moving parts, and what was last written to them. */
interface Card {
  slot: HTMLElement;
  tilt: HTMLElement;
  /** The slab: its back and its face, which fade together. Only the face is softened. */
  layers: HTMLElement[];
  face: HTMLElement;
  shadow: HTMLElement;
  shadowShift: HTMLElement;
  track: HTMLElement;
  gloss: HTMLElement;
  spot: HTMLElement;
  copy: HTMLElement;
  written: { shown: boolean; transform: string; opacity: string; filter: string; shadow: string; stack: string };
}

/**
 * Selected work, as an orbit. The projects ride one ellipse round a point
 * behind the middle of the stage, like pieces on a turntable in a gallery: the
 * one at the front faces the visitor, its neighbours wait behind it on either
 * side, and the last is out of sight across the back.
 *
 * The stage pins, and from there the wheel turns the orbit instead of moving
 * the page: every step turns it a little, so the next project swings round to
 * the front while the last is carried away behind. It is one GSAP timeline
 * with the scroll as its playhead, so it runs at the visitor's own speed, in
 * both directions, never snaps and never moves by itself.
 *
 * Every card is a slab with real thickness in one 3D space (`perspective()` on
 * the orbit, `preserve-3d` down to each layer). All motion is GSAP; React
 * renders the markup once.
 */
export function Work() {
  const rootRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const root = rootRef.current;
      const stage = root?.querySelector<HTMLElement>("[data-stage]");
      const orbitBox = root?.querySelector<HTMLElement>("[data-orbit]");
      const ring = root?.querySelector<HTMLElement>("[data-ring]");
      const dustCanvas = root?.querySelector<HTMLCanvasElement>("[data-room-dust]");
      if (!root || !stage || !orbitBox || !ring || !dustCanvas) return;

      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const teardown: Array<() => void> = [];

      const cards: Card[] = [];
      root.querySelectorAll<HTMLElement>("[data-card]").forEach((slot) => {
        const one = (selector: string) => slot.querySelector(selector) as HTMLElement;
        cards.push({
          slot,
          tilt: one("[data-tilt]"),
          layers: Array.from(slot.querySelectorAll<HTMLElement>("[data-layer]")),
          face: one("[data-face]"),
          shadow: one("[data-shadow]"),
          shadowShift: one("[data-shadow-shift]"),
          track: one("[data-gloss-track]"),
          gloss: one("[data-gloss]"),
          spot: one("[data-spot]"),
          copy: one("[data-copy]"),
          written: { shown: true, transform: "", opacity: "", filter: "", shadow: "", stack: "" },
        });
      });
      if (!cards.length) return;

      /** Whether the stage can be seen, and how far the orbit has carried the room's dust. */
      const room = { live: false, shift: 0, width: 0, height: 0, ratio: 1, clock: 0, due: 0 };
      const dustCtx = dustCanvas.getContext("2d");
      const drawDust = makeDust();
      if (!reduced) {
        const tick = (_time: number, deltaMs: number) => {
          if (!room.live || !dustCtx || !room.width) return;
          const dt = Math.min(deltaMs / 1000, 0.05);
          room.clock += dt;
          room.due += dt;
          if (room.due < 1 / DUST_RATE - 0.001) return;
          dustCtx.setTransform(room.ratio, 0, 0, room.ratio, 0, 0);
          drawDust(dustCtx, room.width, room.height, room.clock, room.due, room.shift);
          room.due = 0;
        };
        gsap.ticker.add(tick);
        teardown.push(() => gsap.ticker.remove(tick));
      }

      const media = gsap.matchMedia();

      /* ---------------------------------------------------------------- */
      /* The orbit                                                        */
      /* ---------------------------------------------------------------- */

      media.add("(prefers-reduced-motion: no-preference) and (min-height: 560px)", () => {
        const hoverable = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
        const hint = root.querySelector<HTMLElement>("[data-hint]");
        const minis = gsap.utils.toArray<HTMLElement>("[data-mini]", root);
        const lights = gsap.utils.toArray<HTMLElement>("[data-room-light]", root);
        const roomLayer = root.querySelector<HTMLElement>(".work__room");

        root.dataset.presenting = "true";
        ScrollTrigger.config({ ignoreMobileResize: true });
        registerGlide();

        /** The orbit's size, px, measured from the cards in `place`. */
        const radius = { x: 0, y: 0, z: 0 };

        // Two states the slabs are painted differently in (see work.css): while
        // the orbit turns, and while the pointer tilts the card at the front.
        // Each holds for a moment after it was last asked for.
        const holding = (attribute: string, onChange?: () => void) => {
          let until = 0;
          let timer = 0;
          const end = () => {
            until = 0;
            root.removeAttribute(attribute);
            onChange?.();
          };
          return {
            get on() {
              return until > 0;
            },
            hold(ms: number) {
              const next = performance.now() + ms;
              if (next <= until) return;
              const starting = !until;
              until = next;
              window.clearTimeout(timer);
              timer = window.setTimeout(end, ms);
              if (starting) {
                root.setAttribute(attribute, "");
                onChange?.();
              }
            },
            clear() {
              window.clearTimeout(timer);
              until = 0;
              root.removeAttribute(attribute);
            },
          };
        };
        const turning = holding("data-turning");
        const tilting = holding("data-tilting");
        /** The project at the front, and whether the pointer has tilted it. */
        let active = -1;
        let tilted = false;

        // What the film moves: how far the orbit has turned, counted in cards
        // (it starts a little short of the first), and how far the cards have
        // come in out of the depth as the stage arrives.
        const orbit = { at: -ARRIVAL.turn };
        const arrival = { done: 0 };

        /* ---- The card at the front ------------------------------------ */

        // It is never quite still: it rides a few pixels, its shadow spreads
        // and pales as it rises, and the long reflection on it drifts. None of
        // this is on the film: it runs on the clock, and only while the stage
        // can be seen.
        const forever = { ease: "sine.inOut", repeat: -1, yoyo: true, paused: true };
        const idles = cards.map((card, index) => [
          gsap.fromTo(card.tilt, { y: 2.5 }, { y: -2.5, duration: 6.2 + index * 0.35, ...forever }),
          gsap.fromTo(
            card.shadowShift,
            { opacity: 1, scale: 1 },
            { opacity: 0.84, scale: 1.025, duration: 6.2 + index * 0.35, ...forever },
          ),
          gsap.fromTo(card.gloss, { xPercent: -5 }, { xPercent: 6, duration: 10.5 + index * 0.6, ...forever }),
        ]);
        const breathe = () => {
          idles.forEach((tweens, i) => {
            const on = room.live && i === active;
            for (const tween of tweens) {
              if (on) tween.play();
              else tween.pause();
            }
          });
        };

        // Pointer. Everything follows through `quickTo`, so the card has weight.
        const follow = (target: Element, property: string, duration: number) =>
          gsap.quickTo(target, property, { duration, ease: SETTLE });
        const followers = cards.map((card) => ({
          tiltX: follow(card.tilt, "rotationX", 0.9),
          tiltY: follow(card.tilt, "rotationY", 0.9),
          shadowX: follow(card.shadowShift, "x", 1.1),
          shadowY: follow(card.shadowShift, "y", 1.1),
          glossX: follow(card.track, "x", 1),
          spotX: follow(card.spot, "x", 0.55),
          spotY: follow(card.spot, "y", 0.55),
          spotOpacity: follow(card.spot, "opacity", 0.7),
          copyX: follow(card.copy, "x", 1),
          copyY: follow(card.copy, "y", 1),
        }));
        const glossSlide = cards.map((card) => gsap.quickSetter(card.track, "xPercent"));

        /** Let go of card `index`: it settles back to level. */
        const level = (index: number) => {
          const to = followers[index];
          for (const settle of [to.tiltX, to.tiltY, to.shadowX, to.shadowY, to.glossX, to.copyX, to.copyY]) {
            settle(0);
          }
          to.spotOpacity(0);
        };

        /** Make `index` the project at the front. */
        const activate = (index: number) => {
          if (active >= 0 && tilted) level(active);
          tilted = false;
          active = index;
          stage.dataset.active = String(index);
          cards.forEach((card, i) => {
            card.slot.toggleAttribute("data-active", i === index);
            // Its neighbours on the film can be clicked to bring them round.
            card.slot.toggleAttribute("data-near", Math.abs(i - index) === 1);
          });
          breathe();
        };

        /* ---- The film -------------------------------------------------- */

        const veilLayer = root.querySelector<HTMLElement>("[data-veil]");
        const floor = root.querySelector<SVGSVGElement>("[data-floor]");
        const floorRims = floor ? Array.from(floor.querySelectorAll<SVGPathElement>("[data-floor-rim]")) : [];
        const floorTicks = floor ? Array.from(floor.querySelectorAll<SVGPathElement>("[data-floor-ticks]")) : [];
        const floorStations = floor ? Array.from(floor.querySelectorAll<SVGCircleElement>("[data-floor-station]")) : [];
        /** Where the turntable is seen from: the orbit's centre on the screen, the lens, and the floor's depth below it, px. */
        const plate = { cx: 0, cy: 0, lens: 1, below: 0 };
        /**
         * A point on the turntable, `share` of the way out from its hub, at
         * `angle` round it (0 at the front), seen through the orbit's lens.
         * The turntable lies under the orbit and is tilted with it, so every
         * card stands over its own mark.
         */
        const onFloor = (share: number, angle: number) => {
          const x = radius.x * share * Math.sin(angle);
          const y = plate.below - radius.y + radius.y * share * Math.cos(angle);
          const z = -radius.z + radius.z * share * Math.cos(angle);
          const seen = plate.lens / (plate.lens - z);
          return { x: plate.cx + x * seen, y: plate.cy + y * seen, seen };
        };
        const xy = ({ x, y }: { x: number; y: number }) => `${x.toFixed(1)} ${y.toFixed(1)}`;
        /** Draw the turntable's marks where the orbit has turned them. */
        const drawFloor = (at: number) => {
          if (!floor) return;
          // The marks on the near half of the rim are darker than those beyond.
          let near = "";
          let far = "";
          for (let k = 0; k < FLOOR.ticks; k++) {
            const angle = wrap((k / FLOOR.ticks) * Math.PI * 2 - at * STEP);
            const long = k % (FLOOR.ticks / 8) === 0;
            const from = onFloor(long ? FLOOR.inner - 0.02 : FLOOR.inner + 0.012, angle);
            const to = onFloor(FLOOR.outer - 0.008, angle);
            const tick = `M${xy(from)}L${xy(to)}`;
            if (Math.cos(angle) > 0) near += tick;
            else far += tick;
          }
          floorTicks[0]?.setAttribute("d", near);
          floorTicks[1]?.setAttribute("d", far);
          // A mark under each card, the one at the front filled in.
          floorStations.forEach((station, i) => {
            const angle = wrap((i - at) * STEP);
            const point = onFloor((FLOOR.outer + FLOOR.inner) / 2, angle);
            station.setAttribute("cx", point.x.toFixed(1));
            station.setAttribute("cy", point.y.toFixed(1));
            station.setAttribute("r", (3.4 * point.seen).toFixed(2));
            station.toggleAttribute("data-front", Math.cos(angle) > Math.cos(STEP / 2));
          });
        };
        const sealing = { veil: "", sealed: false };
        /** A style is only written when it changes: every write has to be worked through again. */
        const written = new WeakMap<Element, Record<string, string>>();
        const write = (element: HTMLElement | SVGElement, property: "opacity" | "transform", value: string) => {
          const last = written.get(element) ?? {};
          if (last[property] === value) return;
          last[property] = value;
          written.set(element, last);
          element.style[property] = value;
        };

        /** How near each card is (1 at the front), and the cards from the farthest to the nearest. */
        const depth = cards.map(() => 0);
        const byDepth = cards.map((_, i) => i);

        /** Put every card where the orbit now has it, and the room with it. */
        const apply = () => {
          const at = orbit.at;
          const come = arrival.done;

          // Once the stage has locked into place its top closes over the wall
          // (pinned, the veil's edge is the top of the screen, so it never
          // shows), and it is then sealed: opaque, so the page behind it is
          // not drawn at all while the orbit turns. It is sealed only while it
          // is pinned and covers the whole screen; as it is let go the veil
          // keeps it looking the same.
          const time = master.time();
          const veil = clamp01((time - ARRIVE) / SEAL).toFixed(3);
          if (veil !== sealing.veil) {
            sealing.veil = veil;
            if (veilLayer) veilLayer.style.opacity = veil;
          }
          const sealed = time >= ARRIVE + SEAL - 0.0005 && time < LENGTH - 0.0005;
          if (sealed !== sealing.sealed) {
            sealing.sealed = sealed;
            stage.toggleAttribute("data-sealed", sealed);
          }

          // The room's light belongs to the project at the front, and crosses
          // to the next as it comes round; the dust in it drifts by.
          lights.forEach((light, i) => write(light, "opacity", (come * clamp01(1 - Math.abs(at - i))).toFixed(3)));
          room.shift = -at * DRIFT;

          let moved = false;
          cards.forEach((card, i) => {
            const angle = wrap((i - at) * STEP);
            const cos = Math.cos(angle);
            const facing = (1 + cos) / 2;
            depth[i] = facing;
            const seen = come * opacityAt(facing);
            const { written } = card;

            const shown = seen > 0.004;
            if (shown !== written.shown) {
              written.shown = shown;
              card.slot.style.visibility = shown ? "" : "hidden";
            }
            if (!shown) return;

            const scale = scaleAt(facing).toFixed(4);
            const transform =
              `translate3d(${(radius.x * Math.sin(angle)).toFixed(2)}px, ${(-radius.y * (1 - cos)).toFixed(2)}px, ` +
              `${(-radius.z * (1 - cos) - (1 - come) * ARRIVAL.depth).toFixed(2)}px) ` +
              `rotateY(${(YAW * Math.sin(angle)).toFixed(3)}deg) scale3d(${scale}, ${scale}, ${scale})`;
            if (transform !== written.transform) {
              written.transform = transform;
              card.slot.style.transform = transform;
              moved = true;
            }

            const opacity = seen > 0.999 ? "" : seen.toFixed(3);
            if (opacity !== written.opacity) {
              written.opacity = opacity;
              for (const layer of card.layers) layer.style.opacity = opacity;
            }
            // Out of focus away from the front. Only the face is softened: the
            // back shows as no more than an edge. No filter at all at the
            // front, where even a blur of nothing costs a pass. And the blur
            // goes in steps of half a pixel, too fine to see on a moving card:
            // a blur that changes every frame is worked out afresh every frame,
            // where one that holds can be kept.
            const blur = Math.round(Math.min(BLUR_MAX, blurAt(facing) + (1 - come) * 6) / BLUR_STEP) * BLUR_STEP;
            const filter = blur === 0 ? "" : `blur(${blur}px)`;
            if (filter !== written.filter) {
              written.filter = filter;
              card.face.style.filter = filter;
            }
            const shadow = (come * shadowAt(facing)).toFixed(3);
            if (shadow !== written.shadow) {
              written.shadow = shadow;
              card.shadow.style.opacity = shadow;
            }

            // The room is reflected in the glass, so the long highlight slides
            // across it as the card turns.
            glossSlide[i](((-angle * 180) / Math.PI) * 0.28);
          });
          if (moved) {
            turning.hold(180);
            drawFloor(at);
          }
          if (floor) write(floor, "opacity", come.toFixed(3));

          // The orbit is one 3D space, so the browser draws the nearer cards
          // over the farther ones. Each card is also stacked by how near it
          // is, so they still are where a browser draws the space flat. The
          // stack only changes when two cards pass each other in depth.
          byDepth.sort((a, b) => depth[a] - depth[b]);
          byDepth.forEach((i, place) => {
            const stack = String(place + 1);
            if (cards[i].written.stack !== stack) {
              cards[i].written.stack = stack;
              cards[i].slot.style.zIndex = stack;
            }
          });

          // The little orbit under the stage turns with the big one.
          minis.forEach((dot, i) => {
            const angle = wrap((i - at) * STEP);
            const facing = (1 + Math.cos(angle)) / 2;
            write(
              dot,
              "transform",
              `translate(${(Math.sin(angle) * 15).toFixed(2)}px, ${(Math.cos(angle) * 4.5).toFixed(2)}px) ` +
                `scale(${(0.55 + 0.45 * facing).toFixed(3)})`,
            );
            write(dot, "opacity", (0.2 + 0.8 * facing ** 3).toFixed(3));
          });
          if (hint) write(hint, "opacity", (come * clamp01(1 - at / 0.35)).toFixed(3));

          // The front changes hands half way through a turn. The pointer lets
          // go of a card as soon as it leaves the front.
          const front = gsap.utils.clamp(0, COUNT - 1, Math.round(at));
          if (front !== active) activate(front);
          else if (tilted && Math.abs(at - active) > STEADY) {
            level(active);
            tilted = false;
          }
        };

        const master = gsap.timeline({
          paused: true,
          defaults: { ease: MOVE, immediateRender: false },
          onUpdate: apply,
        });
        // The arrival: the cards come in out of the depth and the orbit turns
        // the last little way round, so the first project lands at the front
        // as the stage locks into place.
        master
          .fromTo(arrival, { done: 0 }, { done: 1, duration: ARRIVE, ease: "sine.out" }, 0)
          .fromTo(orbit, { at: -ARRIVAL.turn }, { at: 0, duration: ARRIVE, ease: "sine.out" }, 0);
        // Then a quarter turn for every project after the first.
        for (let k = 1; k < COUNT; k++) {
          master.fromTo(orbit, { at: k - 1 }, { at: k, duration: TURN }, ARRIVE + (k - 1) * TURN);
        }
        // The film runs to the end of the last look, whatever its last tween is.
        master.to({}, { duration: LENGTH, ease: "none" }, 0);

        /** Measure the stage and fit the cards and the orbit to it. */
        const place = () => {
          const width = orbitBox.clientWidth;
          const height = orbitBox.clientHeight;
          // A wide stage takes a landscape card, a narrow one a portrait card.
          // The narrower the stage, the more of it the card takes: its
          // neighbours only need to show at the edges.
          const share = 0.56 + 0.22 * clamp01((1280 - width) / 640);
          const wideW = Math.min(width * share, height * 0.9 * 1.58, CARD_MOST);
          const wide = width >= 720 && wideW >= 560;
          const cardW = wide ? wideW : Math.min(width * 0.84, 440);
          const cardH = wide ? cardW / 1.58 : Math.min(height * 0.92, cardW * 1.62);
          stage.dataset.shape = wide ? "wide" : "tall";
          stage.style.setProperty("--card-w", `${Math.round(cardW)}px`);
          stage.style.setProperty("--card-h", `${Math.round(cardH)}px`);

          // Two cards passing each other at one depth must not touch.
          radius.x = cardW * Math.max(ACROSS, 0.49 / Math.sin(STEP / 2));
          radius.z = cardW * DEPTH;
          radius.y = cardH * RISE;
          ring.style.transform = `perspective(${Math.round(cardW * LENS)}px)`;

          // The turntable's rim never changes shape: it is drawn once for the size.
          plate.cx = width / 2;
          plate.cy = height / 2;
          plate.lens = Math.round(cardW * LENS);
          plate.below = cardH * FLOOR.below;

          floorRims.forEach((rim, k) => {
            const share = k === 0 ? FLOOR.outer : FLOOR.inner;
            let d = "";
            for (let j = 0; j <= 120; j++) d += `${j ? "L" : "M"}${xy(onFloor(share, (j / 120) * Math.PI * 2))}`;
            rim.setAttribute("d", `${d}Z`);
          });

          room.width = stage.clientWidth;
          room.height = stage.clientHeight;
          // Soft motes: half the resolution shows all there is to see.
          room.ratio = Math.min(window.devicePixelRatio || 1, 1.25) / 2;
          dustCanvas.width = Math.round(room.width * room.ratio);
          dustCanvas.height = Math.round(room.height * room.ratio);

          for (const card of cards) card.written.transform = "";
          apply();
        };
        place();

        /* ---- The scroll is the playhead ------------------------------- */

        // Set up again at a new size, the pin moves later sections that have
        // already been measured.
        remeasure();

        // The stage holds while the turns play, measured at the page's pace.
        // Nothing is parked and nothing is let go: the visitor scrolls into
        // it, through it and out of it themselves.
        const pin = ScrollTrigger.create({
          trigger: stage,
          start: "top top",
          end: () => `+=${scrollFor(LENGTH - ARRIVE)}`,
          pin: true,
          anticipatePin: anticipatePin(),
        });

        // The arrival plays before the pin, while the stage is still rising
        // into view. That stretch is ordinary scrolling, so it takes the
        // distance it takes; only what plays inside the pin is measured.
        const timeAt = (y: number) =>
          y < pin.start
            ? ARRIVE * clamp01(1 - (pin.start - y) / (window.innerHeight * APPROACH))
            : Math.min(LENGTH, ARRIVE + (y - pin.start) / scrollFor(1));
        /** Where the page is when project `index` is at the front. */
        const scrollOf = (index: number) => Math.round(pin.start + index * TURN * scrollFor(1));

        /** Put the film where the page is. */
        const seek = () => {
          // However suddenly the page got here, the room is there for it.
          if (roomLayer?.style.visibility) roomLayer.style.visibility = "";
          const time = timeAt(window.scrollY);
          if (master.time() !== time) master.time(time);
        };
        // The smooth scroll moves the page and tells ScrollTrigger in the same
        // frame, and this runs then: the orbit is never a frame behind the
        // wheel, and nothing smooths it but what smooths the whole page.
        ScrollTrigger.create({
          trigger: stage,
          start: () => `top ${Math.round(window.innerHeight * APPROACH)}px`,
          end: () => pin.end,
          onUpdate: seek,
        });

        // Nothing is painted, and nothing breathes, while the stage cannot be seen.
        const sight = new IntersectionObserver(([entry]) => {
          room.live = entry.isIntersecting;
          breathe();
        });
        sight.observe(stage);
        // The room is not drawn at all while the stage is more than a screen
        // away, and is put back a screen before it can come into view (and by
        // `seek`, should the page jump straight to it).
        const nearby = new IntersectionObserver(
          ([entry]) => {
            if (roomLayer) roomLayer.style.visibility = entry.isIntersecting ? "" : "hidden";
          },
          { rootMargin: "100% 0px" },
        );
        nearby.observe(stage);

        // Whenever the layout is measured again (on load, on resize), fit the
        // orbit again too, and put the film wherever the scroll now says.
        const onRefresh = () => {
          place();
          seek();
        };
        ScrollTrigger.addEventListener("refresh", onRefresh);

        // A neighbour can be brought round by clicking it, and a project the
        // keyboard reaches is brought round to meet it.
        const bringRound = (index: number) => {
          if (index !== active) pageScroll.glide(scrollOf(index));
        };
        const listeners = cards.map((card, index) => {
          const onClick = (event: MouseEvent) => {
            if (!card.slot.hasAttribute("data-near")) return;
            event.preventDefault();
            bringRound(index);
          };
          const onFocus = () => bringRound(index);
          card.slot.addEventListener("click", onClick);
          card.slot.addEventListener("focusin", onFocus);
          return () => {
            card.slot.removeEventListener("click", onClick);
            card.slot.removeEventListener("focusin", onFocus);
          };
        });

        // Pointer over the stage. The card at the front tilts away from it,
        // its reflection follows it, its shadow moves the other way, and its
        // words lift a little towards it, off the face they are printed on.
        const onMove = (event: PointerEvent) => {
          if (active < 0 || event.pointerType === "touch") return;
          if (Math.abs(orbit.at - active) > STEADY) return;
          const card = cards[active];
          const to = followers[active];
          const rect = card.face.getBoundingClientRect();
          const nx = clampUnit(((event.clientX - rect.left) / rect.width) * 2 - 1);
          const ny = clampUnit(((event.clientY - rect.top) / rect.height) * 2 - 1);
          to.tiltX(-ny * TILT);
          to.tiltY(nx * TILT);
          to.shadowX(-nx * SHIFT.shadow);
          to.shadowY(-ny * SHIFT.shadow * 0.6);
          to.glossX(nx * SHIFT.gloss);
          to.copyX(nx * SHIFT.copy);
          to.copyY(ny * SHIFT.copy * 0.8);
          to.spotX(event.clientX - rect.left);
          to.spotY(event.clientY - rect.top);
          const over =
            event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
          to.spotOpacity(over ? 1 : 0);
          tilted = true;
          // The tilt settles for about a second after the pointer stops.
          tilting.hold(1100);
        };
        const onLeave = () => {
          if (active >= 0) level(active);
          tilted = false;
        };
        if (hoverable) {
          stage.addEventListener("pointermove", onMove);
          stage.addEventListener("pointerleave", onLeave);
        }

        return () => {
          turning.clear();
          tilting.clear();
          sight.disconnect();
          nearby.disconnect();
          room.live = false;
          ScrollTrigger.removeEventListener("refresh", onRefresh);
          stage.removeEventListener("pointermove", onMove);
          stage.removeEventListener("pointerleave", onLeave);
          for (const undo of listeners) undo();
          // The film and its triggers are undone for us. What was written to
          // the page by hand, or by tweens made later, is not.
          for (const card of cards) {
            for (const element of [card.slot, card.shadow, ...card.layers]) element.removeAttribute("style");
            card.slot.removeAttribute("data-active");
            card.slot.removeAttribute("data-near");
          }
          const touched: Element[] = [
            ...cards.flatMap((card) => [
              card.tilt,
              card.shadowShift,
              card.track,
              card.gloss,
              card.spot,
              card.copy,
            ]),
          ];
          gsap.killTweensOf(touched);
          gsap.set(touched, { clearProps: "all" });
          for (const element of [...lights, ...minis, ring]) element.removeAttribute("style");
          if (hint) hint.removeAttribute("style");
          if (veilLayer) veilLayer.removeAttribute("style");
          floor?.removeAttribute("style");
          stage.removeAttribute("data-sealed");
          if (roomLayer) roomLayer.style.visibility = "";
          stage.removeAttribute("style");
          delete stage.dataset.shape;
          delete stage.dataset.active;
          delete root.dataset.presenting;
        };
      });

      return () => {
        for (const undo of teardown) undo();
      };
    },
    { scope: rootRef },
  );

  return (
    <section ref={rootRef} id="work" aria-labelledby="work-title" className="work">
      <div data-stage className="work__stage">
        {/* What closes the top of the stage over the wall as it locks into place. */}
        <div data-veil className="work__veil" aria-hidden />

        {/* The room: drawn behind the orbit, its light following the project at the front. */}
        <div className="work__room" aria-hidden>
          {/* The room's walls and the tooth of its plaster never move, so they are
              painted with the stage itself, under everything that does. */}
          <div className="work__curve work__curve--vault" />
          <div className="work__curve work__curve--east" />
          <div className="work__curve work__curve--west" />
          <div className="work__paper" />
          <div className="absolute inset-0">
            {projects.map((project) => (
              <div key={project.name} data-room-light className={`work__light work__light--${project.light}`} />
            ))}
          </div>
          <canvas data-room-dust className="work__dust" />
        </div>
        {/* Once the stage is sealed, these soften the room's top and bottom in place of its mask. */}
        <div className="work__fade work__fade--top" aria-hidden />
        <div className="work__fade work__fade--bottom" aria-hidden />

        {/* The section's title. It stays over the orbit the whole way round. */}
        <header className="work__head">
          <p className="work__eyebrow">
            <span aria-hidden className="work__rule" />
            <span>Case studies</span>
            <span aria-hidden className="work__rule" />
          </p>
          <h2 id="work-title" className="work__title">
            Selected <em>work</em>
          </h2>
        </header>

        <div data-orbit className="orbit">
          {/* The turntable the cards ride over, drawn on the floor under the orbit. */}
          <svg data-floor className="orbit__floor" aria-hidden>
            <path data-floor-rim className="orbit__rim" />
            <path data-floor-rim className="orbit__rim orbit__rim--inner" />
            <path data-floor-ticks className="orbit__ticks" />
            <path data-floor-ticks className="orbit__ticks orbit__ticks--far" />
            {projects.map((project) => (
              <circle key={project.name} data-floor-station className="orbit__station" />
            ))}
          </svg>
          <ol data-ring className="orbit__ring">
            {projects.map((project) => {
              const id = `work-${project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
              const action = (
                <>
                  View project
                  <span className="card__knob">
                    <span className="card__arrow">
                      <Arrow />
                    </span>
                  </span>
                </>
              );

              return (
                <li key={project.name} data-card data-light={project.light} data-accent={project.accent} className="orbit__slot">
                  {/* Its shadow, on a plane of its own behind the slab. */}
                  <div data-shadow className="slab__shadow" aria-hidden>
                    <div data-shadow-shift className="slab__shadow-shift">
                      <div className="slab__shadow-far" />
                      <div className="slab__shadow-near" />
                    </div>
                  </div>

                  {/* The slab: a back and a face, a little apart, so it shows an edge as it turns. */}
                  <div data-tilt className="slab">
                    <div data-layer className="slab__back" aria-hidden />
                    <article data-layer data-face className="card" aria-labelledby={id}>
                      {/* Only words on the face, printed on the acrylic, set like a page
                          of a catalogue: the reflections pass under them. */}
                      <div data-copy className="card__copy">
                        <p className="card__kicker">
                          <span aria-hidden className="card__dot" />
                          {project.category}
                        </p>
                        <div className="card__lead">
                          <h3 id={id} className="card__title">
                            {project.name}
                          </h3>
                          <p className="card__line">
                            {project.line} <em>{project.emphasis}</em>
                          </p>
                        </div>
                        <div className="card__foot">
                          <p className="card__text">{project.description}</p>
                          <div className="card__stack">
                            <p id={`${id}-stack`} className="card__label">
                              Built with
                            </p>
                            <ul className="card__tags" aria-labelledby={`${id}-stack`}>
                              {project.stack.map((item) => (
                                <li key={item} className="card__tag">
                                  {item}
                                </li>
                              ))}
                            </ul>
                          </div>
                          {project.href ? (
                            <a href={project.href} className="card__cta" aria-label={`View project: ${project.name}`}>
                              {action}
                            </a>
                          ) : (
                            <span className="card__cta">{action}</span>
                          )}
                        </div>
                      </div>

                      {/* What the glass reflects: the room's long highlight, and the light at the pointer. */}
                      <div data-gloss-track className="card__gloss-track" aria-hidden>
                        <div data-gloss className="card__gloss" />
                      </div>
                      <div data-spot className="card__spot" aria-hidden />
                    </article>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        {/* The orbit in miniature: which project is at the front, and which way round they go. */}
        <div className="work__rail" aria-hidden>
          <span className="work__mini">
            {projects.map((project) => (
              <i key={project.name} data-mini />
            ))}
          </span>
          <span data-hint className="work__hint">
            Scroll to turn
          </span>
        </div>
      </div>

      <div className="work__tail" aria-hidden />
    </section>
  );
}
