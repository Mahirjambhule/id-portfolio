"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { process } from "@/lib/process";
import "./process.css";

gsap.registerPlugin(ScrollTrigger, useGSAP);

// Each card is a panel that pivots onto the wall as the scroll brings its row
// in. It starts turned away on its upright axis, held out in front of the wall
// and a little low, and swings round to face the visitor as it is laid flat:
// the first in a row first, the two halves of a row turning in from either
// side like a pair of doors. All of them are seen from one eye at the middle
// of the row, so each is foreshortened as it really would be. As a panel turns
// the light moves on it: it is shaded while it faces away from the window,
// a sheen crosses it, and its shadow on the wall closes up and sharpens as it
// lands. Then its hairlines are ruled and its words stand up onto it, line by
// line. Like everything the scroll drives on this page, it is a pure function
// of where the page is (see src/lib/pace.ts), so it goes back the way it came.
/** Where a row starts and finishes coming in: its top this far down the viewport, in %. */
const SET = { from: 86, to: 30 };
/** Each card in a row starts this share of the row's way in after the one before it. */
const STAGGER = 0.16;
/**
 * Where a card comes in from: turned away this far on its upright axis (deg),
 * this far out in front of the wall and this far below its place (px).
 */
const FROM = { yaw: 62, lift: 170, below: 60 } as const;
/** The lens, px, and how far above a card's middle the eye is, as a share of its height. */
const LENS = 1300;
const EYE_ABOVE = 0.2;
/** The window's light: how far it comes from the left, against straight on, and how dark a panel turned from it goes. */
const LIGHT = { across: 0.5, shade: 0.22 } as const;
/** Where a card's shadow falls for every px it is held out from the wall. */
const CAST = { x: 0.3, y: 0.24 } as const;
/**
 * When each part plays, as shares of a card's own way in: the turn, the card
 * fading in, its two hairlines (the second this much after the first) and its
 * words (each this much after the one before).
 */
const PARTS = {
  turn: { at: 0, length: 0.7 },
  fade: { at: 0, length: 0.12 },
  rule: { at: 0.54, length: 0.3, step: 0.16 },
  words: { at: 0.56, length: 0.26, step: 0.045 },
} as const;
/** Each line of words stands up onto the card: from leaning back this far (deg), and this far below (px). */
const WORD = { tilt: 62, rise: 12, lens: 520 } as const;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
/** How far through a part that starts at `at` and lasts `length` a card `progress` of the way in is. */
const through = (progress: number, at: number, length: number) => clamp01((progress - at) / length);
const RAD = Math.PI / 180;

/**
 * "How I work": four steps, each a card on the gallery wall with nothing on
 * it but words, between the selected work and the closing section.
 */
export function Process() {
  const rootRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const root = rootRef.current;
      // Under reduced motion the cards are simply there.
      if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      const steps = Array.from(root.querySelectorAll<HTMLElement>("[data-step]"));
      /** The cards in the same row as `step`, as laid out now. */
      const rowOf = (step: HTMLElement) => steps.filter((other) => Math.abs(other.offsetTop - step.offsetTop) < 4);

      const ease = {
        turn: gsap.parseEase("power1.out"),
        fade: gsap.parseEase("power1.out"),
        rule: gsap.parseEase("power2.inOut"),
        word: gsap.parseEase("power3.out"),
      };
      /** A style is only written when it changes. */
      const written = new WeakMap<HTMLElement, Record<string, string>>();
      const write = (element: HTMLElement, property: "opacity" | "transform", value: string) => {
        const last = written.get(element) ?? {};
        if (last[property] === value) return;
        last[property] = value;
        written.set(element, last);
        element.style[property] = value;
      };

      /** Everything a style is written to, to be cleared again. */
      const touched = steps.flatMap((step, index) => {
        const one = (selector: string) => step.querySelector<HTMLElement>(selector);
        const sheet = one("[data-sheet]");
        const shade = one("[data-shade]");
        const glint = one("[data-glint]");
        const shadow = one("[data-shadow]");
        const near = one("[data-shadow-near]");
        const far = one("[data-shadow-far]");
        if (!sheet || !shade || !glint || !shadow || !near || !far) return [];
        const rules = Array.from(step.querySelectorAll<HTMLElement>("[data-rule]"));
        const words = Array.from(step.querySelectorAll<HTMLElement>("[data-words]"));

        // Where the card is in its row, measured whenever the page is: which
        // way it turns in from, where the eye is from its middle, and its share
        // of the row's way in.
        const place = { side: -1, eyeX: 0, eyeY: 0, start: 0, span: 1 };
        const measure = () => {
          const row = rowOf(step);
          const column = Math.max(0, row.indexOf(step));
          const first = row[0];
          const last = row[row.length - 1];
          const middle = first && last ? (first.offsetLeft + last.offsetLeft + last.offsetWidth) / 2 : 0;
          const off = row.length > 1 ? step.offsetLeft + step.offsetWidth / 2 - middle : 0;
          // A card alone in its row turns in from alternate sides as the page goes down.
          place.side = Math.abs(off) < 1 ? (index % 2 ? 1 : -1) : Math.sign(off);
          place.eyeX = -off;
          place.eyeY = -step.offsetHeight * EYE_ABOVE;
          place.start = column * STAGGER;
          place.span = 1 - (row.length - 1) * STAGGER;
        };

        /** Put the card, its light, its shadow and its words where the row is `progress` of the way in. */
        const draw = (progress: number) => {
          const own = clamp01((progress - place.start) / place.span);
          const turned = ease.turn(through(own, PARTS.turn.at, PARTS.turn.length));
          const left = 1 - turned;
          const yaw = place.side * FROM.yaw * left;
          const lift = FROM.lift * left;
          const shown = ease.fade(through(own, PARTS.fade.at, PARTS.fade.length));

          // The panel, seen from the eye at the middle of its row. In place it
          // has no transform at all, so it is not kept on a layer of its own
          // and its words are as sharp as the rest of the page.
          const { eyeX, eyeY } = place;
          write(
            sheet,
            "transform",
            left < 0.0005
              ? ""
              : `translate(${eyeX.toFixed(1)}px, ${eyeY.toFixed(1)}px) perspective(${LENS}px) ` +
                  `translate(${(-eyeX).toFixed(1)}px, ${(-eyeY).toFixed(1)}px) ` +
                  `translate3d(0, ${(FROM.below * left).toFixed(2)}px, ${lift.toFixed(2)}px) rotateY(${yaw.toFixed(3)}deg)`,
          );
          write(sheet, "opacity", shown > 0.999 ? "" : shown.toFixed(3));

          // Its light. The window is up to the left: turned towards it the
          // panel is lit as it is in place, turned away it is in shade. A
          // sheen crosses it as it turns, the way the turn carries it.
          const facing = Math.cos(yaw * RAD) - LIGHT.across * Math.sin(yaw * RAD);
          write(shade, "opacity", left < 0.0005 ? "0" : (clamp01(1 - facing) * LIGHT.shade).toFixed(3));
          const sheen = Math.sin(Math.PI * turned) ** 2;
          const across = place.side < 0 ? 1 - turned : turned;
          write(glint, "opacity", sheen < 0.001 ? "0" : (sheen * 0.85).toFixed(3));
          write(glint, "transform", `translate3d(${(-100 + across * 282).toFixed(1)}%, 0, 0)`);

          // Its shadow on the wall: held out, the card throws a wide, soft
          // shadow well to the lower right, narrowed by the turn; laid flat,
          // the shadow closes up under it and sharpens.
          const height = lift / FROM.lift;
          write(
            shadow,
            "transform",
            left < 0.0005
              ? ""
              : `translate3d(${(lift * CAST.x).toFixed(2)}px, ${(lift * CAST.y).toFixed(2)}px, 0) ` +
                  `scaleX(${(Math.cos(yaw * RAD) * (1 + lift / LENS)).toFixed(4)})`,
          );
          write(shadow, "opacity", shown > 0.999 ? "" : shown.toFixed(3));
          write(near, "opacity", height < 0.001 ? "" : (1 - height).toFixed(3));
          write(far, "opacity", height < 0.001 ? "0" : (height * 0.9).toFixed(3));

          rules.forEach((rule, i) => {
            const ruled = ease.rule(through(own, PARTS.rule.at + i * PARTS.rule.step, PARTS.rule.length));
            write(rule, "transform", ruled > 0.999 ? "" : `scaleX(${ruled.toFixed(4)})`);
          });
          words.forEach((word, i) => {
            const up = ease.word(through(own, PARTS.words.at + i * PARTS.words.step, PARTS.words.length));
            write(word, "opacity", up > 0.999 ? "" : up.toFixed(3));
            write(
              word,
              "transform",
              up > 0.999
                ? ""
                : `perspective(${WORD.lens}px) translate3d(0, ${(WORD.rise * (1 - up)).toFixed(2)}px, 0) rotateX(${(WORD.tilt * (1 - up)).toFixed(2)}deg)`,
            );
          });
        };

        measure();
        const trigger = ScrollTrigger.create({
          trigger: step,
          start: `top ${SET.from}%`,
          end: `top ${SET.to}%`,
          onUpdate: (self) => draw(self.progress),
          // Where a card is in its row changes with the layout.
          onRefresh: (self) => {
            measure();
            draw(self.progress);
          },
        });
        draw(trigger.progress);
        return [sheet, shade, glint, shadow, near, far, ...rules, ...words];
      });

      return () => {
        // The triggers are undone for us; what was written by hand is not.
        for (const part of touched) part.removeAttribute("style");
      };
    },
    { scope: rootRef },
  );

  return (
    <section ref={rootRef} id="process" aria-labelledby="process-title" className="process">
      <header className="process__head">
        <p className="process__eyebrow">
          <span aria-hidden className="process__rule" />
          <span>{process.eyebrow}</span>
          <span aria-hidden className="process__rule" />
        </p>
        <h2 id="process-title" className="process__title">
          {process.title} <em>{process.emphasis}</em>
        </h2>
      </header>

      <ol className="process__steps">
        {process.steps.map((step) => (
          <li key={step.name} data-step className="process__step">
            {/* Its shadow on the wall: close and crisp when the card is in place, wide and soft while it is held out. */}
            <span data-shadow aria-hidden className="process__shadow">
              <span data-shadow-near className="process__shadow-near" />
              <span data-shadow-far className="process__shadow-far" />
            </span>
            {/* A card on the wall: where the step comes, its name, a few words, and what comes of it. */}
            <div data-sheet className="process__sheet">
              <p className="process__when">
                <span data-words>{step.when}</span>
                <span data-rule aria-hidden className="process__hairline" />
              </p>
              <h3 className="process__name">
                <span data-words>{step.name}</span> <em data-words>{step.emphasis}</em>
              </h3>
              <p data-words className="process__text">
                {step.text}
              </p>
              <div className="process__foot">
                <span data-rule aria-hidden className="process__hairline" />
                <ul data-words className="process__yields" aria-label="What comes of it">
                  {step.yields.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              {/* The light on it as it turns: shade, and a sheen crossing it. */}
              <span data-shade aria-hidden className="process__shade" />
              <span data-glint aria-hidden className="process__glint" />
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
