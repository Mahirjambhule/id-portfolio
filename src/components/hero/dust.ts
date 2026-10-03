/**
 * Dust motes hanging in the window light: a few dozen soft specks drifting on
 * slow, rising air. Near ones are larger, fainter and out of focus, and shift
 * more with the viewer.
 */

const FIELDS = 9;
const X = 0;
const Y = 1;
const DEPTH = 2;
const RADIUS = 3;
const ALPHA = 4;
const PHASE = 5;
const VX = 6;
const VY = 7;
const WANDER = 8;

const MARGIN = 28;

/** Small deterministic generator, so the field looks the same on every visit. */
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

function makeSprite(): HTMLCanvasElement {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, "rgba(128, 124, 118, 1)");
    gradient.addColorStop(0.35, "rgba(128, 124, 118, 0.6)");
    gradient.addColorStop(1, "rgba(128, 124, 118, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }
  return canvas;
}

export class DustField {
  private motes = new Float32Array(0);
  private sprite: HTMLCanvasElement | null = null;
  private width = 0;
  private height = 0;

  /** (Re)scatter the motes across a viewport. */
  scatter(width: number, height: number): void {
    this.width = width;
    this.height = height;
    const count = Math.round(Math.min(56, Math.max(18, (width * height) / 26000)));
    const random = mulberry(20260930);
    this.motes = new Float32Array(count * FIELDS);

    for (let i = 0; i < count; i++) {
      const o = i * FIELDS;
      const depth = random();
      const near = depth > 0.86;
      this.motes[o + X] = random() * width;
      this.motes[o + Y] = random() * height;
      this.motes[o + DEPTH] = depth;
      this.motes[o + RADIUS] = near ? 5 + random() * 6 : 1.1 + random() * random() * 1.9;
      this.motes[o + ALPHA] = near ? 0.035 + random() * 0.03 : 0.1 + random() * 0.16;
      this.motes[o + PHASE] = random() * Math.PI * 2;
      this.motes[o + VX] = (random() - 0.5) * 8 * (0.4 + depth);
      this.motes[o + VY] = -(1.5 + random() * 6) * (0.4 + depth);
      this.motes[o + WANDER] = 0.14 + random() * 0.26;
    }
  }

  draw(
    ctx: CanvasRenderingContext2D,
    time: number,
    dt: number,
    opacity: number,
    shiftX: number,
    shiftY: number,
  ): void {
    if (!this.sprite) this.sprite = makeSprite();
    const { motes, sprite, width, height } = this;

    for (let o = 0; o < motes.length; o += FIELDS) {
      let x = motes[o + X] + motes[o + VX] * dt;
      let y = motes[o + Y] + motes[o + VY] * dt;
      if (y < -MARGIN) y = height + MARGIN;
      if (x < -MARGIN) x = width + MARGIN;
      else if (x > width + MARGIN) x = -MARGIN;
      motes[o + X] = x;
      motes[o + Y] = y;

      const depth = motes[o + DEPTH];
      const phase = motes[o + PHASE];
      const wander = motes[o + WANDER];
      const radius = motes[o + RADIUS];
      const drawX = x + Math.sin(time * wander + phase) * 12 + shiftX * (0.3 + depth);
      const drawY = y + Math.cos(time * wander * 0.8 + phase * 1.7) * 7 + shiftY * (0.3 + depth);
      const twinkle = 0.78 + 0.22 * Math.sin(time * 0.7 + phase * 3);

      ctx.globalAlpha = motes[o + ALPHA] * twinkle * opacity;
      ctx.drawImage(sprite, drawX - radius, drawY - radius, radius * 2, radius * 2);
    }
    ctx.globalAlpha = 1;
  }
}
