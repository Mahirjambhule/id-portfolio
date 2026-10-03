/**
 * The shadow of an olive branch outside the window, laid on the wall by the
 * light that comes in through it: a stem, the twigs along it and the narrow
 * leaves they carry, in pairs. Nothing is an image. The branch is grown once
 * from a seed, so it is the same branch on every visit, and posed afresh every
 * frame.
 *
 * Each part answers the air at its own pace. The stem gives most towards its
 * tip, the twigs rock a little quicker on it, and every leaf flutters on its
 * stalk and turns about its length, so its shadow narrows and widens. A gust
 * stirs all of it at once.
 *
 * It is drawn in one flat colour and every leaf goes into one fill, so where
 * two leaves overlap their shadows do not darken each other, as shadows do
 * not. CSS makes it faint and soft, and lays it on the wall at the angle the
 * light comes in.
 */

/** How a branch grows into the light. Positions are fractions of the canvas it is drawn on. */
export interface BranchShape {
  /** Where it comes in from, 0..1 across and down. It may start outside the canvas. */
  rootX: number;
  rootY: number;
  /** Which way it grows, radians: 0 is to the right, π/2 straight down. */
  heading: number;
  /** How far the stem reaches, in canvas widths. */
  reach: number;
  /** How much the stem bows along its length, radians in all. Negative bows it anticlockwise. */
  bow: number;
  /** The colour of its shadow. */
  shade: string;
  seed: number;
}

interface Limb {
  /** The limb it grows from (-1 for the stem), and the joint on that limb it springs from. */
  parent: number;
  joint: number;
  /** Its heading where it springs, relative to the parent's there. */
  angle: number;
  /** Each segment's length, in stem lengths, and the turn the limb takes at its start. */
  lengths: number[];
  turns: number[];
  /** Its thickness at the base and at the tip, in stem lengths. */
  base: number;
  tip: number;
  /** Its own rocking: how far, how quickly, and from where in the cycle. */
  sway: number;
  rate: number;
  phase: number;
}

interface Leaf {
  /** The limb it grows on, and the joint it hangs from. */
  limb: number;
  joint: number;
  /** Its heading, relative to the limb's at that joint. */
  angle: number;
  /** Stem lengths. `width` is half the leaf's width. */
  length: number;
  width: number;
  /** How far its tip curls to one side, in leaf lengths. */
  curl: number;
  flutter: number;
  rate: number;
  phase: number;
  /** How quickly it turns about its length, and from where in that cycle. */
  spin: number;
  spinPhase: number;
}

const STEM_SEGMENTS = 8;
const TWIG_SEGMENTS = 3;
/** The joints of the stem twigs spring from, alternating sides. */
const SPRINGS = [1, 2, 4, 5, 7] as const;
/** The share of leaves the branch has lost. Every tip keeps its own. */
const BARE = 0.18;
/** How far a leaf's own weight turns it towards the ground. */
const SAG = 0.2;

/** How far the breeze leans every limb, and how much more it gives at its tip than at its base. */
const AIR_LEAN = 0.05;
const GIVE = 0.4;
/** How far the breeze turns every leaf, and how much a gust stirs them. */
const AIR_LEAF = 0.1;
const STIR = 0.55;
/** How narrow a leaf's shadow gets as it turns edge on to the light, at most. */
const TURN = 0.42;
/** The stalk between a leaf and its twig, in stem lengths. */
const STALK = 0.012;
/** A shadow is soft, so it is drawn at a fraction of the screen's resolution. */
const RESOLUTION = 0.5;
/** It moves slowly, too: thirty frames a second show all there is to see. */
const RATE = 30;

/** Small deterministic generator, so the branch grows the same way on every visit. */
function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Foliage {
  private limbs: Limb[] = [];
  private leaves: Leaf[] = [];
  /** Where each limb's joints are this frame, and which way it is heading at each. */
  private xs: Float32Array[] = [];
  private ys: Float32Array[] = [];
  private headings: Float32Array[] = [];
  /** Each leaf's stalk this frame: from x, from y, to x, to y. */
  private stalks = new Float32Array(0);
  /** The canvas's size in CSS pixels, and how many of its pixels there are to each. */
  private width = 0;
  private height = 0;
  private ratio = 1;
  /** The stem's length, px. */
  private size = 0;
  /** When, on the caller's clock, the shadow was last drawn. */
  private drawnAt = -Infinity;

  constructor(private readonly shape: BranchShape) {
    this.grow();
  }

  /**
   * Size `canvas`, and the branch with it, to the box CSS gives the canvas.
   * Returns whether anything changed, and so whether it needs drawing again.
   */
  fit(canvas: HTMLCanvasElement): boolean {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, 2) * RESOLUTION;
    if (width === this.width && height === this.height && ratio === this.ratio) return false;
    this.width = width;
    this.height = height;
    this.ratio = ratio;
    this.size = this.shape.reach * width;
    // Resizing a canvas clears it, so the next frame draws whatever the time.
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    this.drawnAt = -Infinity;
    return true;
  }

  /**
   * Pose the branch in the air at `time`, in seconds, and draw its shadow
   * afresh, unless it was drawn less than a frame of its own ago. `air` is
   * the breeze, -1..1.
   */
  draw(ctx: CanvasRenderingContext2D, time: number, air: number): void {
    if (!this.size || time - this.drawnAt < 1 / RATE - 0.001) return;
    this.drawnAt = time;
    this.pose(time, air);
    const { limbs, leaves, xs, ys, headings, stalks, size } = this;

    ctx.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.fillStyle = ctx.strokeStyle = this.shape.shade;
    ctx.lineCap = "round";

    // The wood, tapering from base to tip, one segment at a time.
    limbs.forEach((limb, l) => {
      const count = limb.lengths.length;
      for (let i = 0; i < count; i++) {
        ctx.lineWidth = Math.max(0.6, (limb.base + (limb.tip - limb.base) * (i / (count - 1))) * size);
        ctx.beginPath();
        ctx.moveTo(xs[l][i], ys[l][i]);
        ctx.lineTo(xs[l][i + 1], ys[l][i + 1]);
        ctx.stroke();
      }
    });

    // Every blade in one fill. A blade is long and narrow, widest a third of
    // the way along, and bent towards its curled tip.
    const stir = 1 - STIR + STIR * Math.abs(air);
    const reach = STALK * size;
    ctx.beginPath();
    leaves.forEach((leaf, k) => {
      const l = leaf.limb;
      const j = leaf.joint;
      const held = headings[l][j] + leaf.angle;
      const angle =
        held + SAG * Math.cos(held) - air * AIR_LEAF + Math.sin(time * leaf.rate + leaf.phase) * leaf.flutter * stir;
      const turned = 1 - TURN * stir * (0.5 - 0.5 * Math.cos(time * leaf.spin + leaf.spinPhase));
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      const x = xs[l][j] + dx * reach;
      const y = ys[l][j] + dy * reach;
      stalks[k * 4] = xs[l][j];
      stalks[k * 4 + 1] = ys[l][j];
      stalks[k * 4 + 2] = x;
      stalks[k * 4 + 3] = y;

      const length = leaf.length * size;
      const width = leaf.width * size * turned;
      const curl = leaf.curl * length;
      // The handles of each edge, at 0.15 and 0.62 of the length. They stand
      // out further than the edge goes, so that at its widest the blade
      // reaches `width` either side of its middle, and they follow the curl,
      // which grows towards the tip.
      const near = width * 1.45 + curl * 0.02;
      const nearBack = curl * 0.02 - width * 1.45;
      const far = width * 1.2 + curl * 0.38;
      const farBack = curl * 0.38 - width * 1.2;
      const tipX = x + dx * length - dy * curl;
      const tipY = y + dy * length + dx * curl;
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(
        x + dx * length * 0.15 - dy * near,
        y + dy * length * 0.15 + dx * near,
        x + dx * length * 0.62 - dy * far,
        y + dy * length * 0.62 + dx * far,
        tipX,
        tipY,
      );
      ctx.bezierCurveTo(
        x + dx * length * 0.62 - dy * farBack,
        y + dy * length * 0.62 + dx * farBack,
        x + dx * length * 0.15 - dy * nearBack,
        y + dy * length * 0.15 + dx * nearBack,
        x,
        y,
      );
      ctx.closePath();
    });
    ctx.fill();

    // The stalks they hang by.
    ctx.lineWidth = Math.max(0.6, 0.004 * size);
    ctx.beginPath();
    for (let k = 0; k < stalks.length; k += 4) {
      ctx.moveTo(stalks[k], stalks[k + 1]);
      ctx.lineTo(stalks[k + 2], stalks[k + 3]);
    }
    ctx.stroke();
  }

  /** Grow the branch: the stem, the twigs along it, and their leaves. */
  private grow(): void {
    const random = mulberry(this.shape.seed);
    const between = (from: number, to: number) => from + (to - from) * random();

    const segments = (count: number, length: number, bow: number) => ({
      lengths: Array.from({ length: count }, () => (length / count) * between(0.82, 1.18)),
      // Olive wood kinks a little at every node.
      turns: Array.from({ length: count }, () => bow / count + between(-0.07, 0.07)),
    });

    this.limbs.push({
      parent: -1,
      joint: 0,
      angle: 0,
      ...segments(STEM_SEGMENTS, 1, this.shape.bow),
      base: 0.016,
      tip: 0.005,
      sway: 0.012,
      rate: between(0.25, 0.35),
      phase: between(0, Math.PI * 2),
    });

    SPRINGS.forEach((joint, index) => {
      const side = index % 2 ? 1 : -1;
      const along = joint / STEM_SEGMENTS;
      this.limbs.push({
        parent: 0,
        joint,
        angle: side * between(0.5, 0.82),
        // Twigs are shorter towards the tip, and bow back the way the stem is going.
        ...segments(TWIG_SEGMENTS, (0.36 - along * 0.17) * between(0.8, 1.15), -side * between(0.1, 0.35)),
        base: 0.0075,
        tip: 0.0035,
        sway: between(0.018, 0.032),
        rate: between(0.45, 0.8),
        phase: between(0, Math.PI * 2),
      });
    });

    this.limbs.forEach((limb, index) => {
      const count = limb.lengths.length;
      for (let joint = 1; joint <= count; joint++) {
        // A pair at every node, one leaf at the tip, and only the outer leaf
        // where a twig takes the inner side.
        const twig = index === 0 ? (SPRINGS as readonly number[]).indexOf(joint) : -1;
        const sides = joint === count ? [0] : twig >= 0 ? [twig % 2 ? -1 : 1] : [-1, 1];
        // The leaves get smaller towards the end of every limb.
        const scale = (index === 0 ? 1 : 0.88) * (1 - 0.3 * (joint / count));
        for (const side of sides) {
          if (side !== 0 && random() < BARE) continue;
          const length = (side === 0 ? 0.13 : between(0.12, 0.16)) * scale;
          this.leaves.push({
            limb: index,
            joint,
            // Pointing on along the limb, the way olive leaves do.
            angle: side === 0 ? between(-0.12, 0.12) : side * between(0.42, 0.8),
            length,
            width: length * between(0.1, 0.13),
            curl: between(-0.07, 0.07),
            flutter: between(0.05, 0.11),
            rate: between(1.1, 2.3),
            phase: between(0, Math.PI * 2),
            spin: between(0.4, 1.1),
            spinPhase: between(0, Math.PI * 2),
          });
        }
      }
    });

    this.xs = this.limbs.map((limb) => new Float32Array(limb.lengths.length + 1));
    this.ys = this.limbs.map((limb) => new Float32Array(limb.lengths.length + 1));
    this.headings = this.limbs.map((limb) => new Float32Array(limb.lengths.length + 1));
    this.stalks = new Float32Array(this.leaves.length * 4);
  }

  /** Work out where every joint is: the stem first, then each twig from where it springs. */
  private pose(time: number, air: number): void {
    const { limbs, xs, ys, headings, size } = this;
    limbs.forEach((limb, l) => {
      let x: number;
      let y: number;
      let heading: number;
      if (limb.parent < 0) {
        x = this.shape.rootX * this.width;
        y = this.shape.rootY * this.height;
        heading = this.shape.heading;
      } else {
        x = xs[limb.parent][limb.joint];
        y = ys[limb.parent][limb.joint];
        heading = headings[limb.parent][limb.joint] + limb.angle;
      }
      // The breeze leans it one way, and it rocks on its own as well.
      const lean = -air * AIR_LEAN + Math.sin(time * limb.rate + limb.phase) * limb.sway;
      const count = limb.lengths.length;
      xs[l][0] = x;
      ys[l][0] = y;
      headings[l][0] = heading;
      for (let i = 0; i < count; i++) {
        heading += limb.turns[i] + lean * GIVE * ((i + 1) / count);
        x += Math.cos(heading) * limb.lengths[i] * size;
        y += Math.sin(heading) * limb.lengths[i] * size;
        xs[l][i + 1] = x;
        ys[l][i + 1] = y;
        headings[l][i + 1] = heading;
      }
    });
  }
}
