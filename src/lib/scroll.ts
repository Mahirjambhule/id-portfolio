import type Lenis from "lenis";

/**
 * A handle on the page's scroll, shared between the smooth-scroll provider and
 * anything that needs to place the page itself. Works with or without Lenis
 * running.
 */

let lenis: Lenis | null = null;
let frozen = false;
let travelling = false;

const easeOut = (t: number) => 1 - (1 - t) ** 3;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

export const pageScroll = {
  attach(instance: Lenis): void {
    lenis = instance;
  },

  detach(instance: Lenis): void {
    if (lenis === instance) lenis = null;
  },

  /** While frozen, the wheel, touch, keys and the scrollbar no longer move the page. */
  get frozen(): boolean {
    return frozen;
  },

  /** True while an anchor link is carrying the page somewhere. */
  get travelling(): boolean {
    return travelling;
  },

  set travelling(value: boolean) {
    travelling = value;
  },

  /** Put the page at `y`, at once, cancelling any scroll in flight. */
  jump(y: number): void {
    if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
    // Lenis takes a jump to where it believes the page already is as done,
    // and the page can have been moved without its knowing (a flick of the
    // thumb while it is stopped). Make sure the page really is at `y`.
    if (Math.abs(window.scrollY - y) > 1) window.scrollTo(0, y);
  },

  /** Carry the page to `y` over `duration` seconds, as if the visitor had scrolled there. */
  glide(y: number, duration = 1.3): void {
    if (lenis) lenis.scrollTo(y, { duration, easing: easeInOut });
    else window.scrollTo({ top: y, behavior: "smooth" });
  },

  /**
   * Park the page at `y` and stop input from moving it, a scroll in flight
   * included. Lenis, stopped, cancels the wheel and touch and clips the page,
   * which takes care of keys and the scrollbar; without Lenis the clip alone does.
   */
  freeze(y: number): void {
    frozen = true;
    this.jump(y);
    if (lenis) lenis.stop();
    else document.documentElement.style.overflow = "hidden";
  },

  /**
   * Hand the scroll back at `y`, then let the page drift on by `glide` px. The
   * page is put at `y` first, so that nothing hears of the place it was held.
   */
  thaw(y: number, glide = 0): void {
    frozen = false;
    this.jump(y);
    if (lenis) lenis.start();
    else document.documentElement.style.removeProperty("overflow");
    if (!glide) return;
    if (lenis) lenis.scrollTo(y + glide, { duration: 1.4, easing: easeOut });
    else window.scrollTo({ top: y + glide, behavior: "smooth" });
  },
};
