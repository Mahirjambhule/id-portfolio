/**
 * Strokes of a pointed pen, for the few marks on the page that are made by
 * hand rather than set.
 *
 * A stroke follows a chain of cubic Béziers, and the nib spreads as it is
 * pressed: a hairline where the pen touches down and where it lifts, fuller
 * through the middle. It comes back twice: as the way the nib travels, for a
 * mask to draw the stroke on along, and as the outline of the ink it leaves.
 */

type Point = readonly [number, number];

/** One cubic Bézier: where it starts, its two handles, where it ends. */
export type Curve = readonly [Point, Point, Point, Point];

export interface PenStroke {
  /** The way the nib travels, as SVG path data. */
  path: string;
  /** The ink it leaves, as SVG path data. */
  ink: string;
}

const round = (value: number) => Math.round(value * 100) / 100;

/**
 * A nib that is `thin` where it touches down and where it lifts, and `full`
 * where it is pressed hardest, `peak` of the way along.
 */
export const pressure =
  (thin: number, full: number, peak = 0.4) =>
  (t: number): number =>
    thin + (full - thin) * Math.sin(Math.PI * t ** (Math.log(0.5) / Math.log(peak)));

/**
 * The stroke a pen leaves along `curves`, one after another. `weight(t)` is
 * its width `t` of the way along, 0..1, in the curves' own units.
 */
export function penStroke(curves: readonly Curve[], weight: (t: number) => number, samples = 72): PenStroke {
  const left: string[] = [];
  const right: string[] = [];

  for (let i = 0; i <= samples; i++) {
    const along = (i / samples) * curves.length;
    const k = Math.min(curves.length - 1, Math.floor(along));
    const t = along - k;
    const u = 1 - t;
    const [p0, p1, p2, p3] = curves[k];
    const x = u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0];
    const y = u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1];
    const dx = 3 * u * u * (p1[0] - p0[0]) + 6 * u * t * (p2[0] - p1[0]) + 3 * t * t * (p3[0] - p2[0]);
    const dy = 3 * u * u * (p1[1] - p0[1]) + 6 * u * t * (p2[1] - p1[1]) + 3 * t * t * (p3[1] - p2[1]);
    const half = weight(i / samples) / 2 / (Math.hypot(dx, dy) || 1);
    left.push(`${round(x - dy * half)} ${round(y + dx * half)}`);
    right.push(`${round(x + dy * half)} ${round(y - dx * half)}`);
  }

  const path =
    `M${curves[0][0].join(" ")}` +
    curves.map(([, a, b, end]) => `C${a.join(" ")} ${b.join(" ")} ${end.join(" ")}`).join("");
  const ink = `M${left.join("L")}L${right.reverse().join("L")}Z`;
  return { path, ink };
}
