"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const STATEMENT =
  "I work where design and engineering meet, shaping motion, material and detail until a website stops feeling like a page and starts feeling like a place.";

const NOTES = [
  {
    title: "Practice",
    body: "Creative development, interaction design and motion systems for the web.",
  },
  {
    title: "Approach",
    body: "Small teams, direct conversation and early prototypes, so decisions get made by feel rather than by slide.",
  },
  {
    title: "Availability",
    body: "Taking on a limited number of projects. If it should feel considered, let’s talk.",
  },
];

/**
 * The section the hero hands over to. It shares the hero's wall, so there is no
 * edge between them: as the badge is pulled away, this statement comes into focus
 * word by word with the scroll.
 */
export function About() {
  const rootRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const media = gsap.matchMedia();
      media.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          "[data-word]",
          { opacity: 0.13 },
          {
            opacity: 1,
            ease: "none",
            stagger: 0.12,
            scrollTrigger: { trigger: "[data-statement]", start: "top 84%", end: "bottom 52%", scrub: true },
          },
        );
        gsap.from("[data-note]", {
          opacity: 0,
          y: 26,
          duration: 1.1,
          ease: "expo.out",
          stagger: 0.1,
          scrollTrigger: { trigger: "[data-notes]", start: "top 86%" },
        });
      });
    },
    { scope: rootRef },
  );

  return (
    <section ref={rootRef} id="about" className="relative z-20 scroll-mt-10">
      <div className="mx-auto max-w-[1680px] px-6 pb-36 pt-[16vh] sm:px-10 lg:px-12 lg:pb-52 lg:pt-[24vh]">
        <div className="grid gap-y-8 lg:grid-cols-12 lg:gap-x-6">
          <p className="flex h-fit items-center gap-3 font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-ink-faint lg:col-span-3 lg:pt-4">
            <span aria-hidden className="h-px w-8 bg-ink/25" />
            About
          </p>
          <h2
            data-statement
            className="font-display text-[clamp(1.75rem,3.7vw,3.6rem)] font-light leading-[1.16] tracking-[-0.02em] lg:col-span-9"
          >
            {STATEMENT.split(" ").map((word, index) => (
              <span key={index} data-word>
                {word}{" "}
              </span>
            ))}
          </h2>
        </div>

        <div data-notes className="mt-20 grid gap-y-10 lg:mt-28 lg:grid-cols-12 lg:gap-x-6">
          <div className="grid gap-x-6 gap-y-10 border-t border-line pt-9 sm:grid-cols-3 lg:col-span-9 lg:col-start-4">
            {NOTES.map((note) => (
              <div key={note.title} data-note>
                <h3 className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-ink-faint">{note.title}</h3>
                <p className="mt-4 max-w-[19rem] text-pretty text-[1.0625rem] leading-[1.55] text-ink-soft">{note.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
