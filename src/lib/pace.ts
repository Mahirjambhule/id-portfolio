import gsap from "gsap";
import { CustomEase } from "gsap/CustomEase";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/**
 * One scroll engine for the whole page.
 *
 * The visitor should never notice the scroll changing character between one
 * section and the next. That only holds if every section keeps the same five
 * rules:
 *
 * 1. Lenis (src/components/smooth-scroll.tsx) is the only thing that smooths.
 *    A step of the wheel is one small, fixed distance, eased once.
 * 2. Anything driven by the scroll is a pure function of the scroll position,
 *    set from a ScrollTrigger `onUpdate` or a `scrub: true`, in the same frame
 *    the page moves. No second smoothing, no numeric scrub, no follower on a
 *    ticker, nothing that plays on a clock, nothing that holds the page.
 * 3. A pin is `start: "top top"`, `end: "+=" + scrollFor(seconds inside it)`,
 *    `pin: true`, default pin spacing, `anticipatePin: anticipatePin()`, and
 *    nothing else.
 * 4. No dead scroll. Inside a pin every stretch of scroll moves something: no
 *    waits, and the main movement uses a near-linear ease (one that does not
 *    start or end at a standstill), so each step shows about the same amount.
 * 5. A pin's length comes from `scrollFor`, from the seconds of animation in
 *    it, never from a hand-picked distance.
 */

/**
 * How much scroll one second of animation is worth, in viewport heights.
 *
 * At 0.35, with movement that is close to linear, things inside a pin travel
 * at about 1.3 times the speed the page itself scrolls: a step of the wheel
 * moves them much as it moves everything else. Lower and they race past while
 * the page seems to crawl; higher and the pin drags.
 */
export const VIEWPORTS_PER_SECOND = 0.35;

/** The scroll distance, in pixels, that `seconds` of animation should take up. */
export const scrollFor = (seconds: number): number =>
  Math.round(window.innerHeight * VIEWPORTS_PER_SECOND * seconds);

/**
 * The near-linear ease of rule 4, for the main movement of anything the scroll
 * drives. It never runs slower than 0.4 of its average speed or faster than
 * 1.35, so a step of the wheel shows about the same amount of movement at the
 * start, the middle and the end, with only a slight easing in and out.
 *
 * It is a GSAP ease name. Call `registerGlide()` once, in an effect, before
 * using it.
 */
export const GLIDE = "glide";

/**
 * The `anticipatePin` every pin uses. With the wheel the smooth scroll moves
 * the page and pins it in the same frame, so a pin must not be anticipated: at
 * speed that snaps the section into place a hundred pixels or more early, which
 * is a jump. Only a touch screen scrolls ahead of the script, and only there is
 * pinning a little early the lesser evil.
 */
export const anticipatePin = (): number => (ScrollTrigger.isTouch === 1 ? 1 : 0);

let remeasuring = 0;

/**
 * Has ScrollTrigger measure the whole page again in the next frame, before it
 * is drawn: for a pin that moves what was measured before it was made. Every
 * request until then is answered by the one refresh.
 *
 * Ask just before making the pin. Making a pin queues a refresh of its own for
 * the next frame, and one asked for first runs first and makes that one
 * unnecessary, so the page is measured once rather than twice. On a phone each
 * measure of the whole page is a long task.
 */
export const remeasure = (): void => {
  if (remeasuring) return;
  remeasuring = requestAnimationFrame(() => {
    remeasuring = 0;
    ScrollTrigger.refresh();
  });
};

export const registerGlide = (): void => {
  gsap.registerPlugin(CustomEase);
  CustomEase.create(GLIDE, "0.25, 0.1, 0.75, 0.9");
};
