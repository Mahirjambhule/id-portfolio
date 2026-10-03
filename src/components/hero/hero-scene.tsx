"use client";

import { useEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { STAGE_LAYOUT, direction } from "./direction";
import { DustField } from "./dust";
import { Foliage, type BranchShape } from "./foliage";
import { Lanyard, type LanyardParams } from "./lanyard-physics";
import { CLASP, STEEL_STOPS, drawLanyard } from "./lanyard-render";

gsap.registerPlugin(ScrollTrigger, useGSAP);

// Badge geometry in design pixels. Mirrors `.badge` in globals.css.
const CARD_WIDTH = 300;
const CARD_HEIGHT = 478;
const HOLE_X = CARD_WIDTH / 2;
const HOLE_Y = 18.5;

/** The cord is held just above the top edge of the viewport. */
const PIVOT_ABOVE = 20;

// Physics. Gravity is about a tenth of real life at this scale, which puts the
// swing near two seconds: unhurried, a little slow-motion.
const GRAVITY = 5200;
const CARD_MASS = 1;
const CLASP_MASS = 0.1;
const STIFFNESS = 400;
const STRETCH_DAMPING_RATIO = 0.3;
/** Air drag on the card, 1/s, and how much more there is when the card is being held steady. */
const CARD_DRAG = 0.85;
const STEADY_DRAG = 4.4;

// The drop. The badge is lowered quickly and the cord runs out while it is still
// moving, so its weight stretches the cord and the lean becomes a swing.
const DROP_SECONDS = 1.15;
const DROP_CARRY = 0.42;
const DROP_LEAN = (13 * Math.PI) / 180;
const DROP_YAW = -0.34;
const DROP_PITCH = 0.12;
const dropEase = (t: number) => (1 - DROP_CARRY) * (1 - (1 - t) ** 3) + DROP_CARRY * t;

const WARMUP_FRAMES = 4;

/** The fastest scrolling can haul the pivot, in lengths of its travel per second. */
const RETRACT_SPEED = 3.2;

/** The copy is revealed once the swing has calmed to this, or after a ceiling. */
const SETTLE_AMPLITUDE = (5.5 * Math.PI) / 180;
const SETTLE_AFTER = 1.7;
const SETTLE_BY = 3;
/** The same ceiling in real time, from the moment the badge is released, in milliseconds. */
const SETTLE_WALL_MS = 4200;

// Pointer parallax.
const YAW_REACH = (8 * Math.PI) / 180;
const PITCH_REACH = (5 * Math.PI) / 180;

/** How far the camera pushes in once the badge has been carried to its mark. */
const MARK_ZOOM = 1.07;
/**
 * At its mark, the card counts as in place for the scanner once it hangs
 * within this share of its width of the mark and swings less than this.
 */
const PLACED = { off: 0.05, swing: (3 * Math.PI) / 180 } as const;
/** The fastest the pivot is carried there and back, in lengths of that way per second. */
const CARRY_SPEED = 1.25;

// The closing section lets the badge down again, in the middle of the room, and
// turns it over. The scroll asks and the object answers: it sets off on the
// frame it is asked, but a cord pays out only so fast, and a slab of acrylic is
// turned, not flicked.
const LOWER_SPEED = 1.5;
const CLOSE_LEAN = (8 * Math.PI) / 180;
const CLOSE_YAW = 0.28;
/**
 * How tall the card is drawn there: a share of the viewport, a ceiling, the
 * room kept either side of it, and the share of the viewport kept under it for
 * the closing words. It is the one place the card is read, so it is drawn as
 * large as those allow.
 */
const CLOSE_HEIGHT = 0.62;
const CLOSE_MAX = 700;
const CLOSE_MARGIN = 40;
const CLOSE_WORDS = 0.25;
/**
 * The most room the closing words are given under the card, as a share of the
 * viewport. On a screen tall enough to leave more than that, the card stops
 * growing before the room runs out: rather than leave the words adrift far
 * below it, the card is let down so that it and its words share the middle.
 */
const CLOSE_ROOM = 0.34;
/** The hand that turns it: how stiffly it follows, 1/s, and its top speed in half-turns per second. */
const TURN_RATE = 7;
const TURN_SPEED = 1.6;
/** How thick the slab is, seen edge on, and how far its side stops short of the rounded corners. */
const THICKNESS = 7;
const EDGE_INSET = 9;
/** The lens the badge is seen through, in design pixels. */
const PERSPECTIVE = 1150;
/** The dust drifts a few pixels a second: thirty frames of it a second show all there is to see. */
const DUST_RATE = 30;

/**
 * The olive branch outside the window, as its shadow falls in the upper half
 * of the window's light, which is the canvas it is drawn on. It comes in at
 * the top on the side the light comes from, and droops as it reaches across
 * towards the badge.
 */
const WINDOW_BRANCH: BranchShape = {
  rootX: -0.06,
  rootY: 0.2,
  heading: 0.5,
  reach: 0.92,
  bow: 0.3,
  shade: "rgb(88 70 48)",
  seed: 20261001,
};

const DEG = 180 / Math.PI;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const smoothstep = (from: number, to: number, value: number) => {
  const t = clamp((value - from) / (to - from), 0, 1);
  return t * t * (3 - 2 * t);
};
/** Move `from` towards `to`: at once, eased, and no faster than `speed` per second. */
const approach = (from: number, to: number, dt: number, speed: number) => {
  const gap = to - from;
  if (Math.abs(gap) < 1e-4) return to;
  return from + clamp(gap * (1 - Math.exp(-dt * 22)), -dt * speed, dt * speed);
};

function paramsFor(scale: number, ropeLength: number): LanyardParams {
  return {
    gravity: GRAVITY * scale,
    ropeLength,
    cardArm: 0.64 * (CARD_HEIGHT - HOLE_Y) * scale,
    cardMass: CARD_MASS,
    claspMass: CLASP_MASS,
    stiffness: STIFFNESS,
    stretchDamping: 2 * STRETCH_DAMPING_RATIO * Math.sqrt(STIFFNESS * (CARD_MASS + CLASP_MASS)),
    cardDrag: CARD_DRAG,
    claspDrag: 10,
    bendFrequency: 2 * Math.PI * 2,
    bendDamping: 0.35,
    bendGain: 1.6,
    yawFrequency: 2 * Math.PI * 0.5,
    yawDamping: 0.4,
    pitchFrequency: 2 * Math.PI * 0.55,
    pitchDamping: 0.5,
    yawFromSwing: 0.0003 / scale,
  };
}

interface HeroSceneProps {
  /** The badge markup. */
  children: ReactNode;
  /** Fired once, when the badge has dropped in and the swing has calmed. */
  onSettled: () => void;
}

/**
 * The physical half of the hero: a lit wall, a lanyard hanging from the top of
 * the viewport, the badge on the end of it, its shadow, and dust in the light.
 *
 * Render it inside the `[data-hero]` section, whose scroll retracts the lanyard.
 * That section must also contain an empty `[data-badge-slot]` box marking where
 * the badge should hang: the scene reads it and fits the badge to it.
 *
 * React renders the elements once. After that a single ticker steps the
 * simulation and writes transforms straight to the DOM.
 */
export function HeroScene({ children, onSettled }: HeroSceneProps) {
  const wallRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const ropeRef = useRef<HTMLCanvasElement>(null);
  const dustRef = useRef<HTMLCanvasElement>(null);
  const leavesRef = useRef<HTMLCanvasElement>(null);

  const settledRef = useRef(onSettled);
  useEffect(() => {
    settledRef.current = onSettled;
  });

  useGSAP(
    () => {
      const wall = wallRef.current;
      const stage = stageRef.current;
      const ropeCanvas = ropeRef.current;
      const dustCanvas = dustRef.current;
      // Found through the DOM rather than through refs: this runs as a layout
      // effect, before the parent's refs have been attached.
      const hero = stage?.closest<HTMLElement>("[data-hero]");
      const slot = hero?.querySelector<HTMLElement>("[data-badge-slot]");
      if (!wall || !stage || !hero || !slot || !ropeCanvas || !dustCanvas) return;

      const rope = ropeCanvas.getContext("2d");
      const dustCtx = dustCanvas.getContext("2d");
      // The branch's shadow belongs to the wall, not to the stage: without it the scene still runs.
      const leavesCanvas = leavesRef.current;
      const leavesCtx = leavesCanvas?.getContext("2d") ?? null;
      const badge = stage.querySelector<HTMLElement>("[data-badge]");
      const shadowFar = stage.querySelector<HTMLElement>("[data-shadow-far]");
      const shadowNear = stage.querySelector<HTMLElement>("[data-shadow-near]");
      const ring = stage.querySelector<SVGElement>("[data-ring]");
      const edge = stage.querySelector<HTMLElement>("[data-edge]");
      const sheen = stage.querySelector<HTMLElement>("[data-badge-sheen]");
      const glass = stage.querySelector<HTMLElement>("[data-badge-window]");
      const shade = stage.querySelector<HTMLElement>("[data-badge-shade]");
      const glintLeft = stage.querySelector<HTMLElement>("[data-badge-glint-left]");
      const glintRight = stage.querySelector<HTMLElement>("[data-badge-glint-right]");
      const portrait = stage.querySelector<HTMLImageElement>("[data-badge-portrait]");
      const wallScene = wall.querySelector<HTMLElement>("[data-wall-scene]");
      const wallLight = wall.querySelector<HTMLElement>("[data-wall-light]");
      if (
        !rope || !dustCtx || !badge || !shadowFar || !shadowNear || !ring || !edge || !sheen ||
        !glass || !shade || !glintLeft || !glintRight || !wallScene || !wallLight
      ) {
        return;
      }

      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      const lanyard = new Lanyard(paramsFor(1, 200));
      const dust = new DustField();
      const foliage = new Foliage(WINDOW_BRANCH);

      const geo = {
        vw: 0,
        vh: 0,
        scale: 1,
        anchorX: 0,
        restHoleY: 0,
        /** Where the pivot is carried when another section asks for the badge, and how far the camera pushes in there. */
        markX: 0,
        markZoom: 1,
        markOrigin: "",
        /** The closing section: where the pivot hangs, how far up the cord is drawn there, and how close the camera comes. */
        closeX: 0,
        closeLift: 0,
        closeZoom: 1,
        /** How far the pivot rises to pull the badge clear of the viewport. */
        travel: 0,
        /** Scroll distance over which that happens, and how it is eased. */
        retractDistance: 1,
        retractPower: 1.7,
        ropeLeft: 0,
        ropeWidth: 0,
        ropeHeight: 0,
        ropeRatio: 1,
        dustRatio: 1,
      };

      const state = {
        started: false,
        settled: false,
        asleep: false,
        /** 1 = held above the viewport, 0 = lowered. Advanced by the drop. */
        intro: 1,
        /** 0..1 across the retraction distance. Written by ScrollTrigger. */
        scroll: 0,
        /** How far the scroll has actually pulled the badge up, 0..1. Follows `scroll`. */
        retract: 0,
        clock: 0,
        sinceStart: 0,
        /** Frames left to hold still before the drop begins. */
        warmup: 0,
        hiddenFor: 0,
        dust: 0,
        dustDrawn: false,
        /** Seconds of drift since the dust was last drawn. */
        dustDue: 0,
        kick: 1,
        /** What another section has asked of the badge, as far as the badge has got with it. */
        shift: 0,
        lower: 0,
        turn: 0,
        turnSpeed: 0,
      };

      // What was last written to the DOM for the directions, so a still scene writes nothing.
      const view = {
        shiftX: 0,
        camera: "",
        lit: 0,
        sun: 0,
        closing: false,
        back: false,
        edge: false,
        broad: 1,
        shade: "",
        glintLeft: "",
        glintRight: "",
      };

      const pointer = { x: 0, y: 0, targetX: 0, targetY: 0, lastX: 0, lastTime: 0 };

      /** How far up the cord is drawn. The closing section lets it down again, to a height of its own. */
      const liftNow = () => {
        const lift = reduced ? state.retract : 1 - (1 - state.intro) * (1 - state.retract);
        return lift + (geo.closeLift - lift) * state.lower;
      };
      const pivotYAt = (lift: number) => -PIVOT_ABOVE - lift * geo.travel;
      /** The pivot is carried sideways; the physics makes the badge follow. */
      const pivotXNow = () =>
        view.closing ? geo.closeX : geo.anchorX + (geo.markX - geo.anchorX) * state.shift;

      const coarse = window.matchMedia("(pointer: coarse)").matches;

      // The work stage covers the whole screen, opaque, once it has locked into
      // place, and says so (`data-sealed`). The wall cannot be seen then.
      const sealer = document.querySelector<HTMLElement>("#work [data-stage]");

      /** The branch's shadow, as the air has it now, wherever the wall can be seen. */
      const drawLeaves = () => {
        if (leavesCtx && !sealer?.hasAttribute("data-sealed")) foliage.draw(leavesCtx, state.clock, direction.air);
      };

      /** Read the layout and size everything to it. */
      const layout = () => {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        // Phone browsers resize the viewport as their toolbars slide away. The
        // layout is built on the small viewport, so there is nothing to redo.
        if (coarse && geo.vw === vw && Math.abs(geo.vh - vh) < 160) return;

        const rect = slot.getBoundingClientRect();
        const slotTop = rect.top + window.scrollY;
        const wide = vw >= 1024;

        // Side by side with the copy, the badge sizes to the viewport. Stacked
        // above it, the badge sizes to the room the layout leaves.
        const gap = wide ? clamp(vh * 0.195, 120, 230) : clamp(rect.height * 0.2, 64, 120);
        const room = wide ? clamp(vh * 0.545, 340, 600) : rect.height - gap - 20;
        const fit = ((rect.width - (wide ? 40 : 56)) * CARD_HEIGHT) / CARD_WIDTH;
        const scale = Math.max(230, Math.min(room, fit)) / CARD_HEIGHT;
        const anchorX = rect.left + rect.width / 2;
        const restHoleY = slotTop + gap + HOLE_Y * scale;

        if (
          geo.vw === vw &&
          geo.vh === vh &&
          Math.abs(geo.scale - scale) < 1e-4 &&
          Math.abs(geo.anchorX - anchorX) < 0.25 &&
          Math.abs(geo.restHoleY - restHoleY) < 0.25
        ) {
          return;
        }

        const resized = geo.vw === 0 ? 1 : scale / geo.scale;
        geo.vw = vw;
        geo.vh = vh;
        geo.scale = scale;
        geo.anchorX = anchorX;
        geo.restHoleY = restHoleY;
        geo.travel = geo.restHoleY + (CARD_HEIGHT - HOLE_Y) * scale + 110;
        // Stacked, the copy follows the badge up the page, so the badge has to
        // outrun the scroll from the first pixel.
        geo.retractPower = wide ? 1.7 : 1.05;
        geo.retractDistance = wide ? vh * 0.62 : Math.min(vh * 0.5, geo.travel / 1.35);

        const restStretch = ((CARD_MASS + CLASP_MASS) * GRAVITY * scale) / STIFFNESS;
        lanyard.params = paramsFor(scale, geo.restHoleY + PIVOT_ABOVE - restStretch);
        stage.style.setProperty("--u", `${scale}px`);

        // The mark: centre-left when there is copy beside the badge, otherwise
        // where it already hangs. The camera pushes in about the card's centre
        // there, and the section that asked is told the box the card will fill.
        geo.markX = wide ? Math.max(vw * 0.3, CARD_WIDTH * scale * 0.5 + 64) : anchorX;
        geo.markZoom = wide ? MARK_ZOOM : 1;
        const markWidth = CARD_WIDTH * scale * geo.markZoom;
        const markHeight = CARD_HEIGHT * scale * geo.markZoom;
        const markCentreY = restHoleY - HOLE_Y * scale + (CARD_HEIGHT * scale) / 2;
        geo.markOrigin = `${geo.markX}px ${markCentreY}px`;
        direction.frame = {
          x: geo.markX - markWidth / 2,
          y: markCentreY - markHeight / 2,
          width: markWidth,
          height: markHeight,
        };

        // The closing section hangs it in the middle, high enough to leave room
        // beneath, and the camera comes in until the card is large enough to
        // read. There the camera scales about the top of the viewport, so the
        // cord still runs off the top edge.
        const closeTop = clamp(vh * 0.075, 44, 84);
        const closeHeight = Math.min(
          vh * CLOSE_HEIGHT,
          vh - closeTop - clamp(vh * CLOSE_WORDS, 150, 250),
          ((vw - CLOSE_MARGIN * 2) * CARD_HEIGHT) / CARD_WIDTH,
          CLOSE_MAX,
        );
        // Whatever is left over beyond the room the words need is shared above
        // the card and below the words.
        const spare = Math.max(0, vh - closeTop - closeHeight - clamp(vh * CLOSE_ROOM, 220, 400)) / 2;
        const cardTop = restHoleY - HOLE_Y * scale;
        geo.closeX = vw / 2;
        geo.closeZoom = clamp(closeHeight / (CARD_HEIGHT * scale), 1, 1.9);
        geo.closeLift = clamp((cardTop - (closeTop + spare) / geo.closeZoom) / geo.travel, 0, 0.9);
        const closeWidth = CARD_WIDTH * scale * geo.closeZoom;
        direction.closing.frame = {
          x: geo.closeX - closeWidth / 2,
          y: (cardTop - geo.closeLift * geo.travel) * geo.closeZoom,
          width: closeWidth,
          height: CARD_HEIGHT * scale * geo.closeZoom,
        };
        direction.closing.floor = vh - spare;
        stage.style.transformOrigin = view.closing ? `${geo.closeX}px 0px` : geo.markOrigin;
        window.dispatchEvent(new Event(STAGE_LAYOUT));

        // The cord only ever occupies a column above the badge.
        geo.ropeWidth = Math.min(vw, Math.max(360, CARD_WIDTH * scale * 1.9));
        geo.ropeLeft = clamp(geo.anchorX - geo.ropeWidth / 2, 0, Math.max(0, vw - geo.ropeWidth));
        geo.ropeHeight = Math.min(vh, geo.restHoleY + 110 * scale);
        geo.ropeRatio = Math.min(window.devicePixelRatio || 1, 2.5);
        ropeCanvas.style.left = `${geo.ropeLeft}px`;
        ropeCanvas.style.width = `${geo.ropeWidth}px`;
        ropeCanvas.style.height = `${geo.ropeHeight}px`;
        ropeCanvas.width = Math.round(geo.ropeWidth * geo.ropeRatio);
        ropeCanvas.height = Math.round(geo.ropeHeight * geo.ropeRatio);

        geo.dustRatio = Math.min(window.devicePixelRatio || 1, 1.5);
        dustCanvas.width = Math.round(vw * geo.dustRatio);
        dustCanvas.height = Math.round(vh * geo.dustRatio);
        dust.scatter(vw, vh);

        // The branch is drawn into the window's light, which CSS sizes.
        if (leavesCanvas && foliage.fit(leavesCanvas)) drawLeaves();

        if (state.started) lanyard.rescale(pivotXNow(), pivotYAt(liftNow()), resized);
      };

      const render = () => {
        const s = geo.scale;
        const angle = lanyard.angle;
        const pitchDeg = lanyard.pitch * DEG;
        const left = lanyard.holeX - HOLE_X * s;
        const top = lanyard.holeY - HOLE_Y * s;

        // The closing section turns the card over, about the cord. Past edge on
        // it is the back that is seen, and everything that depends on how the
        // card faces the viewer is worked out for the side that is showing.
        const yaw = lanyard.yaw + state.turn * Math.PI;
        const sinYaw = Math.sin(yaw);
        const cosYaw = Math.cos(yaw);
        const back = cosYaw < 0;
        if (back !== view.back) {
          view.back = back;
          badge.dataset.side = back ? "back" : "front";
        }
        const faceYaw = Math.atan2(back ? -sinYaw : sinYaw, Math.abs(cosYaw));
        const yawDeg = faceYaw * DEG;

        badge.style.transform =
          `translate3d(${left}px, ${top}px, 0) perspective(${PERSPECTIVE * s}px) ` +
          `rotateZ(${angle}rad) rotateX(${lanyard.pitch}rad) rotateY(${yaw}rad)`;

        // The shadow lands further away as the card tips towards the viewer, and
        // slides against the wall as the viewer moves. The closing section's sun
        // is low and on the other side, so there it falls the other way and
        // longer. A card turned edge on throws a narrower, fainter one.
        const sun = direction.closing.sun;
        const shadowX = (26 - 60 * sun + clamp(yawDeg, -24, 24) * 1.3 - pointer.x * 12) * s;
        const shadowY = (34 + 16 * sun + pitchDeg * 1.6 - pointer.y * 8) * s;
        const broad = Math.abs(cosYaw);
        const sliver = 0.34 + 0.66 * broad;
        shadowFar.style.transform =
          `translate3d(${left + shadowX}px, ${top + shadowY}px, 0) rotate(${angle}rad) scaleX(${sliver})`;
        shadowNear.style.transform =
          `translate3d(${left + shadowX * 0.46}px, ${top + shadowY * 0.46}px, 0) rotate(${angle}rad) scaleX(${sliver})`;
        if (broad !== view.broad) {
          view.broad = broad;
          shadowFar.style.opacity = shadowNear.style.opacity = (0.3 + 0.7 * broad).toFixed(3);
        }

        ring.style.transform = `translate3d(${lanyard.holeX}px, ${lanyard.holeY}px, 0) rotate(${lanyard.ropeAngle}rad)`;

        // Edge on, a slab has a side. It stands beside the face that is seen,
        // on the edge that has turned towards the viewer.
        const turning = smoothstep(0.015, 0.09, state.turn) * smoothstep(0.015, 0.09, 1 - state.turn);
        if (turning > 0.002) {
          const x0 = sinYaw >= 0 ? -HOLE_X : HOLE_X;
          const near = PERSPECTIVE / (PERSPECTIVE + x0 * sinYaw);
          const width = THICKNESS * Math.abs(sinYaw) * near;
          const x = x0 * cosYaw * near;
          // Beside the face, and tucked a little under it so no wall shows between.
          const centre = x + clamp(x / (width / 2 + 1e-6), -1, 1) * Math.max(0, width / 2 - 0.9);
          edge.style.transform =
            `translate3d(${lanyard.holeX}px, ${lanyard.holeY}px, 0) rotate(${angle}rad) ` +
            `translate3d(${(centre - width / 2) * s}px, ${(EDGE_INSET - HOLE_Y) * near * s}px, 0) scale(${width / THICKNESS}, ${near})`;
          edge.style.opacity = turning.toFixed(3);
          view.edge = true;
        } else if (view.edge) {
          view.edge = false;
          edge.style.opacity = "0";
        }

        // Reflections slide across the face as it turns. A scanner passing over
        // the card drags its own highlight across the acrylic, and so does the
        // sun as it comes in. Seen from behind, the face is mirrored.
        const lit = direction.light;
        const sweep = lit * (direction.scan - 0.5) * 320 + sun * 58;
        const drift = clamp(-yawDeg * 10 - angle * DEG * 4 + pitchDeg * 3 + sweep, -230, 230) * s;
        const slide = back ? -drift : drift;
        sheen.style.transform = `translate3d(${slide}px, 0, 0)`;
        glass.style.transform = `translate3d(${-slide * 0.32}px, ${-pitchDeg * 2.2 * s}px, 0) skewX(-14deg)`;
        // Lambert: light comes from the upper left, in front of the wall, until
        // the closing section's sun takes over from the upper right.
        const facing = (0.9 * sun - 0.45) * Math.sin(faceYaw) + 0.55 * Math.sin(lanyard.pitch);
        const shading = clamp(0.03 - facing * 1.05, 0, 0.17).toFixed(3);
        if (shading !== view.shade) {
          view.shade = shading;
          shade.style.opacity = shading;
        }
        // The polished edges flare as they turn to the light, and glow a little
        // in the sun. To the hundredth: a finer change is not seen, and a value
        // that has not changed is not written again.
        const flareLeft = clamp(yawDeg / 7 + lit * 0.45 + sun * 0.2, 0, 1).toFixed(2);
        const flareRight = clamp(-yawDeg / 9 + lit * 0.3 + sun * 0.26, 0, 0.8).toFixed(2);
        const leftEdge = back ? flareRight : flareLeft;
        const rightEdge = back ? flareLeft : flareRight;
        if (leftEdge !== view.glintLeft) {
          view.glintLeft = leftEdge;
          glintLeft.style.opacity = leftEdge;
        }
        if (rightEdge !== view.glintRight) {
          view.glintRight = rightEdge;
          glintRight.style.opacity = rightEdge;
        }

        // Carried to its mark, the scene is seen from a little closer, the card
        // is lit, and the cord's canvas (only a column wide) goes with the pivot.
        // In the closing section the camera comes in further and is never quite
        // still: it floats, and it breathes.
        const shiftX = lanyard.pivotX - geo.anchorX;
        let camera = "";
        if (view.closing) {
          const close = direction.closing.zoom;
          if (close > 0.0005) {
            const alive = reduced ? 0 : close;
            const zoom = (1 + (geo.closeZoom - 1) * close) * (1 + 0.003 * alive * Math.sin(state.clock * 0.47));
            const floatX = 2.4 * alive * Math.sin(state.clock * 0.21 + 1.3);
            const floatY = 1.8 * alive * Math.sin(state.clock * 0.29);
            camera = `translate3d(${floatX.toFixed(2)}px, ${floatY.toFixed(2)}px, 0) scale(${zoom.toFixed(5)})`;
          }
        } else {
          const zoom = 1 + (geo.markZoom - 1) * direction.zoom;
          if (zoom > 1.0004) camera = `scale(${zoom.toFixed(4)})`;
        }
        if (camera !== view.camera) {
          view.camera = camera;
          stage.style.transform = camera;
        }
        if (lit !== view.lit) {
          view.lit = lit;
          stage.style.setProperty("--lit", lit.toFixed(3));
        }
        if (sun !== view.sun) {
          view.sun = sun;
          stage.style.setProperty("--sun", sun.toFixed(3));
        }
        if (shiftX !== view.shiftX) {
          view.shiftX = shiftX;
          ropeCanvas.style.transform = shiftX ? `translate3d(${shiftX}px, 0, 0)` : "";
        }

        const ropeLeft = geo.ropeLeft + shiftX;
        rope.setTransform(geo.ropeRatio, 0, 0, geo.ropeRatio, -ropeLeft * geo.ropeRatio, 0);
        rope.clearRect(ropeLeft, 0, geo.ropeWidth, geo.ropeHeight);
        drawLanyard(rope, {
          pivotX: lanyard.pivotX,
          pivotY: lanyard.pivotY,
          holeX: lanyard.holeX,
          holeY: lanyard.holeY,
          bend1: lanyard.bend1,
          bend2: lanyard.bend2,
          slack: lanyard.slack,
          scale: s,
          shadowX: shadowX * 0.9,
          shadowY: shadowY * 0.9,
        });

        wallLight.style.transform = `translate3d(${-pointer.x * 10}px, ${-pointer.y * 6}px, 0)`;
      };

      /** Hang the badge afresh under the pivot, leaning a little: the way it comes back into view. */
      const rehang = (pivotX: number, pivotY: number) => {
        if (reduced) {
          lanyard.reset(pivotX, pivotY);
        } else if (view.closing) {
          // Let down for the closing section, it arrives turned and swinging.
          lanyard.reset(pivotX, pivotY, CLOSE_LEAN * state.kick);
          lanyard.setPose(CLOSE_YAW * state.kick, DROP_PITCH);
        } else {
          lanyard.reset(pivotX, pivotY, 0.06 * state.kick);
        }
      };

      let settleTimer = 0;
      const settle = () => {
        if (state.settled) return;
        window.clearTimeout(settleTimer);
        state.settled = true;
        wall.dataset.lit = "true";
        gsap.to(state, { dust: 1, duration: reduced ? 0.01 : 3, delay: reduced ? 0 : 0.6, ease: "power1.out" });
        settledRef.current();
      };

      const tick = (_time: number, deltaMs: number) => {
        if (!state.started) return;
        if (state.warmup > 0) {
          state.warmup -= 1;
          if (state.warmup === 0) drop();
          return;
        }
        const dt = Math.min(deltaMs / 1000, 0.05);
        state.clock += dt;
        state.sinceStart += dt;

        // The room is never perfectly still. The badge sways in this breeze,
        // and the branch outside the window stirs in it whether the badge is
        // there or not.
        direction.air =
          (Math.sin(state.clock * 0.37) + Math.sin(state.clock * 0.61 + 1.7) + Math.sin(state.clock * 0.23 + 4.1)) / 3;

        // Everything that moves the pivot runs on this clock, the same one the
        // physics uses. A dropped frame then slows the scene for a moment instead
        // of teleporting the pivot and whipping the badge around.
        if (!reduced) state.intro = Math.max(0, 1 - dropEase(Math.min(1, state.sinceStart / DROP_SECONDS)));
        const target = state.scroll ** geo.retractPower;
        if (reduced) {
          state.retract = target;
        } else {
          const eased = (target - state.retract) * (1 - Math.exp(-dt * 16));
          state.retract += clamp(eased, -dt * RETRACT_SPEED, dt * RETRACT_SPEED);
        }

        // What another section asks of the badge is carried out at the pace of
        // a thing being moved: it sets off at once, but it cannot be whipped.
        const closing = direction.closing;
        if (reduced) {
          state.shift = direction.shift;
          state.lower = closing.lower;
          state.turn = closing.turn;
        } else {
          state.shift = approach(state.shift, direction.shift, dt, CARRY_SPEED);
          state.lower = approach(state.lower, closing.lower, dt, LOWER_SPEED);
          // Turned by a firm hand: no bounce, and no faster than its weight allows.
          const pull = TURN_RATE * TURN_RATE * (closing.turn - state.turn) - 2 * TURN_RATE * state.turnSpeed;
          state.turnSpeed = clamp(state.turnSpeed + pull * dt, -TURN_SPEED, TURN_SPEED);
          state.turn = clamp(state.turn + state.turnSpeed * dt, 0, 1);
          if (Math.abs(closing.turn - state.turn) < 1e-4 && Math.abs(state.turnSpeed) < 1e-3) {
            state.turn = closing.turn;
            state.turnSpeed = 0;
          }
        }

        // The closing section hangs the badge elsewhere. It changes hands out of
        // sight, above the viewport, and is hung afresh where it now belongs.
        const away = state.lower > 0;
        if (away !== view.closing) {
          view.closing = away;
          stage.style.transformOrigin = away ? `${geo.closeX}px 0px` : geo.markOrigin;
          if (!state.asleep) rehang(pivotXNow(), pivotYAt(liftNow()));
        }

        const lift = liftNow();
        const pivotX = pivotXNow();
        const pivotY = pivotYAt(lift);

        // Pulled clear of the viewport: nothing to simulate or draw, but for
        // the branch, whose shadow is on the wall and still shows above the
        // sections that follow.
        if (state.settled && lift > 0.995) {
          state.hiddenFor += dt;
          if (state.hiddenFor > 0.6) {
            if (!state.asleep) {
              state.asleep = true;
              direction.placed = false;
              rope.setTransform(1, 0, 0, 1, 0, 0);
              rope.clearRect(0, 0, ropeCanvas.width, ropeCanvas.height);
              dustCtx.setTransform(1, 0, 0, 1, 0, 0);
              dustCtx.clearRect(0, 0, dustCanvas.width, dustCanvas.height);
              state.dustDrawn = false;
            }
            if (!reduced) drawLeaves();
            return;
          }
        } else {
          state.hiddenFor = 0;
          if (state.asleep) {
            state.asleep = false;
            rehang(pivotX, pivotY);
          }
        }

        const follow = 1 - Math.exp(-dt * 7);
        pointer.x += (pointer.targetX - pointer.x) * follow;
        pointer.y += (pointer.targetY - pointer.y) * follow;

        if (reduced) {
          lanyard.reset(pivotX, pivotY);
        } else {
          // A section may ask for the badge to be set swinging before it is moved,
          // or to be held steady while it is read: more drag, so a swing dies away.
          if (direction.push) {
            lanyard.push(direction.push * geo.scale);
            direction.push = 0;
          }
          lanyard.params.cardDrag = CARD_DRAG + Math.max(direction.steady, closing.steady) * STEADY_DRAG;
          lanyard.step(dt, {
            pivotX,
            pivotY,
            wind: (direction.air * 26 + pointer.x * 85) * geo.scale,
            bow: pointer.x * 5 * geo.scale,
            yaw: pointer.x * YAW_REACH,
            pitch: -pointer.y * PITCH_REACH,
          });
        }

        if (
          !state.settled &&
          state.sinceStart > SETTLE_AFTER &&
          (lanyard.amplitude < SETTLE_AMPLITUDE || state.sinceStart > SETTLE_BY)
        ) {
          settle();
        }

        // Whether the card hangs at its mark, still enough for the scanner to
        // read it. However fast the visitor scrolls, the scan waits for this.
        direction.placed =
          !view.closing &&
          direction.shift > 0.999 &&
          Math.abs(lanyard.pivotX - geo.markX) < 0.5 &&
          Math.abs(lanyard.holeX - geo.markX) < CARD_WIDTH * geo.scale * PLACED.off &&
          lanyard.amplitude < PLACED.swing;

        render();

        // More of the dust shows in the scanner's light, and it is back in the
        // closing section's sun. It drifts a few pixels a second, so it is
        // drawn at DUST_RATE, carried on by however long it has been.
        const dustOpacity =
          state.dust *
          Math.max(
            (1 - smoothstep(0.1, 0.85, state.scroll)) * (1 + direction.light * 1.3),
            state.lower * (0.5 + closing.sun * 0.9),
          );
        if (dustOpacity > 0.004 || state.dustDrawn) {
          state.dustDue += dt;
          if (state.dustDue >= 1 / DUST_RATE - 0.001) {
            dustCtx.setTransform(geo.dustRatio, 0, 0, geo.dustRatio, 0, 0);
            dustCtx.clearRect(0, 0, geo.vw, geo.vh);
            state.dustDrawn = dustOpacity > 0.004;
            if (state.dustDrawn) {
              dust.draw(dustCtx, state.clock, state.dustDue, dustOpacity, -pointer.x * 16, -pointer.y * 10);
            }
            state.dustDue = 0;
          }
        }

        // The branch moves wherever its shadow can be seen. The closing
        // section hangs the badge in a room of its own, in front of this wall.
        if (!reduced && !view.closing) drawLeaves();
      };

      /** Lower the badge into view. */
      const begin = () => {
        if (state.started) return;
        state.started = true;
        stage.dataset.ready = "true";

        if (reduced) {
          state.intro = 0;
          lanyard.reset(pivotXNow(), pivotYAt(liftNow()));
          render();
          settle();
          return;
        }

        // Warm-up: for a few frames, show the badge where it will hang but all
        // but transparent. The browser paints its layers now, out of sight,
        // instead of while they are dropping into view.
        stage.style.opacity = "0.01";
        lanyard.reset(pivotXNow(), pivotYAt(0));
        render();
        state.warmup = WARMUP_FRAMES;
        // The swing is timed in simulated seconds, and a run of long frames while
        // the page is still loading stretches those. The copy does not wait on
        // that: it is revealed by this time on the clock on the wall at the latest.
        settleTimer = window.setTimeout(settle, SETTLE_WALL_MS);
      };

      /** Release it: already falling at the speed the drop begins with, leaning, and turned. */
      const drop = () => {
        const startSpeed = ((3 * (1 - DROP_CARRY) + DROP_CARRY) * geo.travel) / DROP_SECONDS;
        state.sinceStart = 0;
        state.intro = 1;
        lanyard.reset(pivotXNow(), pivotYAt(1), DROP_LEAN, 0, startSpeed);
        lanyard.setPose(DROP_YAW, DROP_PITCH);
        render();
        stage.style.opacity = "";
      };

      layout();

      // Retraction: scroll progress raises the pivot. A section below may pin
      // itself to keep the badge (its ScrollTrigger has the id "identity"): the
      // badge then stays for it, and is raised once that pin lets go.
      const retraction = ScrollTrigger.create({
        trigger: hero,
        start: () => ScrollTrigger.getById("identity")?.end ?? "top top",
        end: () => `+=${geo.retractDistance}`,
        // Measured after the pin it may depend on.
        refreshPriority: -1,
        onUpdate: (self) => {
          state.scroll = self.progress;
        },
      });
      state.scroll = retraction.progress;

      // The first movement of the page sets the badge swinging.
      let moved = 0;
      ScrollTrigger.create({
        trigger: hero,
        start: "top top",
        end: "bottom top",
        onUpdate: (self) => {
          const previous = moved;
          moved = self.progress;
          if (!reduced && state.settled && previous <= 0.012 && moved > 0.012) {
            lanyard.push(205 * geo.scale * state.kick);
            lanyard.spin(1.1 * state.kick, 0.6);
            state.kick = -state.kick;
          }
        },
      });

      // The light on the wall dims as the next section arrives.
      gsap.to(wallScene, {
        opacity: 0.45,
        ease: "none",
        scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true },
      });

      // Hold the drop until the portrait is loaded and decoded and the fonts are
      // in, within reason. Decoding up front keeps that work out of the drop.
      let cancelled = false;
      const ready = () => {
        if (!cancelled) begin();
      };
      const portraitLoaded =
        portrait && !(portrait.complete && portrait.naturalWidth > 0)
          ? new Promise<void>((resolve) => {
              portrait.addEventListener("load", () => resolve(), { once: true });
              portrait.addEventListener("error", () => resolve(), { once: true });
            })
          : Promise.resolve();
      const portraitReady = portraitLoaded.then(() => portrait?.decode().catch(() => undefined));
      const patience = new Promise<void>((resolve) => window.setTimeout(resolve, 1600));
      Promise.race([Promise.all([portraitReady, document.fonts.ready]), patience]).then(() =>
        requestAnimationFrame(ready),
      );

      const onPointerMove = (event: PointerEvent) => {
        if (reduced || event.pointerType === "touch") return;
        pointer.targetX = clamp((event.clientX - pivotXNow()) / (geo.vw * 0.5), -1, 1);
        pointer.targetY = clamp((event.clientY - geo.vh * 0.5) / (geo.vh * 0.5), -1, 1);

        // A hand moving quickly past the badge drags a little air with it.
        const now = performance.now();
        const elapsed = (now - pointer.lastTime) / 1000;
        if (state.settled && elapsed > 0 && elapsed < 0.08) {
          const speed = clamp((event.clientX - pointer.lastX) / elapsed, -2400, 2400);
          const reach = CARD_WIDTH * geo.scale;
          const toCard = Math.hypot(event.clientX - lanyard.cardX, event.clientY - lanyard.cardY);
          // In the closing section the card is there to be touched: it barely stirs.
          const near = (1 - smoothstep(reach * 0.5, reach * 1.6, toCard)) * (view.closing ? 0.25 : 1);
          if (near > 0) {
            lanyard.push(speed * elapsed * 0.16 * near);
            lanyard.pluck(speed * elapsed * 0.5 * near);
          }
        }
        pointer.lastX = event.clientX;
        pointer.lastTime = now;
      };
      const onPointerLeave = () => {
        pointer.targetX = 0;
        pointer.targetY = 0;
      };

      const observer = new ResizeObserver(layout);
      observer.observe(slot);
      window.addEventListener("resize", layout);
      window.addEventListener("pointermove", onPointerMove, { passive: true });
      document.documentElement.addEventListener("pointerleave", onPointerLeave);
      gsap.ticker.add(tick);

      return () => {
        cancelled = true;
        observer.disconnect();
        window.removeEventListener("resize", layout);
        window.removeEventListener("pointermove", onPointerMove);
        document.documentElement.removeEventListener("pointerleave", onPointerLeave);
        gsap.ticker.remove(tick);
        window.clearTimeout(settleTimer);
        stage.style.opacity = "";
        stage.style.transform = "";
        delete badge.dataset.side;
        delete stage.dataset.ready;
        delete wall.dataset.lit;
      };
    },
    { dependencies: [] },
  );

  const ringTop = CLASP.ringTop;
  const ringBottom = CLASP.ringBottom;

  return (
    <>
      <div ref={wallRef} className="wall" aria-hidden>
        <div className="wall__scene" data-wall-scene>
          <div className="wall__wash" />
          <div className="wall__light" data-wall-light>
            <div className="wall__beam">
              <div className="wall__pane" />
              <div className="wall__pane" />
              <div className="wall__pane" />
              <div className="wall__pane" />
            </div>
            <canvas ref={leavesRef} className="wall__leaves" />
          </div>
        </div>
        <div className="wall__grain" />
      </div>

      <div ref={stageRef} className="stage">
        <div className="stage__shadow stage__shadow--far" data-shadow-far />
        <div className="stage__shadow stage__shadow--near" data-shadow-near />
        <canvas ref={ropeRef} className="stage__rope" aria-hidden />
        {/* The side of the slab, behind the card: seen only while it is turned over. */}
        <div className="stage__edge" data-edge />
        {children}
        {/* The front half of the ring, over the card. The canvas draws the rest. */}
        <svg className="stage__ring" data-ring viewBox="-8 -29 16 34" fill="none" aria-hidden>
          <defs>
            <linearGradient id="ring-steel" gradientUnits="userSpaceOnUse" x1="-6" y1={ringTop} x2="6" y2={ringBottom}>
              {STEEL_STOPS.map(([offset, colour]) => (
                <stop key={offset} offset={offset} stopColor={colour} />
              ))}
            </linearGradient>
          </defs>
          <path
            d={`M0 ${ringTop}A${CLASP.ringRadius} ${(ringBottom - ringTop) / 2} 0 0 0 0 ${ringBottom}`}
            stroke="rgb(52 44 34 / 0.5)"
            strokeWidth={CLASP.ringWeight + 0.9}
          />
          <path
            d={`M0 ${ringTop}A${CLASP.ringRadius} ${(ringBottom - ringTop) / 2} 0 0 0 0 ${ringBottom}`}
            stroke="url(#ring-steel)"
            strokeWidth={CLASP.ringWeight}
          />
        </svg>
        <canvas ref={dustRef} className="stage__dust" aria-hidden />
      </div>
    </>
  );
}
