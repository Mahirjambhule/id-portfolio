/**
 * Draws the lanyard onto a 2D canvas: a braided white cord, the metal ferrule
 * that caps it, and the ring that threads through the card.
 *
 * Coordinates are CSS pixels in the same space the physics runs in. Hardware
 * dimensions are in design pixels and scale with the card.
 */

/** Hardware layout along the cord's axis, measured from the hole (negative = up the cord). */
export const CLASP = {
  /** Distance from the hole to where the cord ends inside the ferrule. */
  length: 43,
  ringTop: -26,
  ringBottom: 3,
  ringRadius: 5.2,
  ringWeight: 2.3,
  eyeletTop: -31.5,
  eyeletBottom: -22,
  eyeletWidth: 7,
  ferruleTop: -45,
  ferruleBottom: -28,
  ferruleWidth: 13,
} as const;

/** Cord thickness in design pixels. */
export const CORD_WIDTH = 8.4;

/** Brushed steel, top to bottom. Shared with the ring overlay in the DOM, and the empty lanyard of the missing page. */
export const STEEL_STOPS: ReadonlyArray<readonly [number, string]> = [
  [0, "#6f6a63"],
  [0.22, "#d9d5ce"],
  [0.4, "#ffffff"],
  [0.62, "#a8a39b"],
  [0.82, "#e6e2dc"],
  [1, "#7d7870"],
];

export interface LanyardFrame {
  pivotX: number;
  pivotY: number;
  holeX: number;
  holeY: number;
  /** Bending modes of the cord, px. */
  bend1: number;
  bend2: number;
  /** Spare cord when it is not pulled tight, px. */
  slack: number;
  /** Design-pixel scale. */
  scale: number;
  /** Where the shadow falls on the wall, relative to the object. */
  shadowX: number;
  shadowY: number;
}

const SAMPLES = 28;
const xs = new Float32Array(SAMPLES);
const ys = new Float32Array(SAMPLES);
const normalXs = new Float32Array(SAMPLES);
const normalYs = new Float32Array(SAMPLES);
/** Distance along the cord from each sample down to its end. */
const toEnd = new Float32Array(SAMPLES);

/** How far each column of braid strands leans off the cord's axis, radians. */
export const STRAND_LEAN = 0.56;

/**
 * Builds the cord's path, `offset` px to one side of its centre line. `lead`
 * continues it straight up past its first sample, for anything that has to run
 * off the top of the viewport.
 */
function trace(ctx: CanvasRenderingContext2D, offset: number, from: number, lead = 0): void {
  const startX = xs[from] + normalXs[from] * offset;
  const startY = ys[from] + normalYs[from] * offset;
  ctx.beginPath();
  if (lead > 0) {
    // The normal is (tangent.y, -tangent.x), so this steps back along the tangent.
    ctx.moveTo(startX + normalYs[from] * lead, startY - normalXs[from] * lead);
    ctx.lineTo(startX, startY);
  } else {
    ctx.moveTo(startX, startY);
  }
  for (let i = from + 1; i < SAMPLES - 1; i++) {
    const x = xs[i] + normalXs[i] * offset;
    const y = ys[i] + normalYs[i] * offset;
    const nextX = xs[i + 1] + normalXs[i + 1] * offset;
    const nextY = ys[i + 1] + normalYs[i + 1] * offset;
    ctx.quadraticCurveTo(x, y, (x + nextX) / 2, (y + nextY) / 2);
  }
  const last = SAMPLES - 1;
  ctx.lineTo(xs[last] + normalXs[last] * offset, ys[last] + normalYs[last] * offset);
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

/** One column of braid strands: overlapping slanted ovals running up the cord. */
function strands(
  ctx: CanvasRenderingContext2D,
  width: number,
  pitch: number,
  side: -1 | 1,
  start: number,
  topLimit: number,
): void {
  const long = width * 0.44;
  const short = width * 0.215;
  const total = toEnd[0];

  ctx.beginPath();
  let segment = SAMPLES - 1;
  for (let d = start; d < total; d += pitch) {
    while (segment > 1 && toEnd[segment - 1] < d) segment--;
    const span = toEnd[segment - 1] - toEnd[segment] || 1;
    const t = (d - toEnd[segment]) / span;
    const x = xs[segment] + (xs[segment - 1] - xs[segment]) * t;
    const y = ys[segment] + (ys[segment - 1] - ys[segment]) * t;
    if (y < topLimit) break;

    const tx = xs[segment] - xs[segment - 1];
    const ty = ys[segment] - ys[segment - 1];
    const length = Math.hypot(tx, ty) || 1;
    const normalX = ty / length;
    const normalY = -tx / length;
    const centreX = x + normalX * width * 0.2 * side;
    const centreY = y + normalY * width * 0.2 * side;
    const rotation = Math.atan2(ty, tx) + STRAND_LEAN * side;

    ctx.moveTo(centreX + Math.cos(rotation) * long, centreY + Math.sin(rotation) * long);
    ctx.ellipse(centreX, centreY, long, short, rotation, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.stroke();
}

function steel(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number): CanvasGradient {
  const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [stop, colour] of STEEL_STOPS) gradient.addColorStop(stop, colour);
  return gradient;
}

export function drawLanyard(ctx: CanvasRenderingContext2D, frame: LanyardFrame): void {
  const s = frame.scale;
  const width = CORD_WIDTH * s;

  let axisX = frame.holeX - frame.pivotX;
  let axisY = frame.holeY - frame.pivotY;
  const reach = Math.hypot(axisX, axisY) || 1;
  axisX /= reach;
  axisY /= reach;

  // The cord runs from the pivot to just inside the ferrule.
  const endX = frame.holeX - axisX * CLASP.length * s;
  const endY = frame.holeY - axisY * CLASP.length * s;
  const chord = Math.max(1, reach - CLASP.length * s);
  const sideX = axisY;
  const sideY = -axisX;

  // Spare cord has to go somewhere: it bows out.
  let bend1 = frame.bend1;
  if (frame.slack > 0.5) {
    const bow = Math.min(chord * 0.45, ((2 * chord) / Math.PI) * Math.sqrt(frame.slack / chord));
    bend1 += bend1 >= 0 ? bow : -bow;
  }

  for (let i = 0; i < SAMPLES; i++) {
    const t = i / (SAMPLES - 1);
    const offset = bend1 * Math.sin(Math.PI * t) + frame.bend2 * Math.sin(2 * Math.PI * t);
    xs[i] = frame.pivotX + (endX - frame.pivotX) * t + sideX * offset;
    ys[i] = frame.pivotY + (endY - frame.pivotY) * t + sideY * offset;
  }

  toEnd[SAMPLES - 1] = 0;
  for (let i = SAMPLES - 2; i >= 0; i--) {
    toEnd[i] = toEnd[i + 1] + Math.hypot(xs[i + 1] - xs[i], ys[i + 1] - ys[i]);
  }

  for (let i = 0; i < SAMPLES; i++) {
    const a = Math.max(0, i - 1);
    const b = Math.min(SAMPLES - 1, i + 1);
    const tx = xs[b] - xs[a];
    const ty = ys[b] - ys[a];
    const length = Math.hypot(tx, ty) || 1;
    normalXs[i] = ty / length;
    normalYs[i] = -tx / length;
  }

  // Nothing above the top of the canvas needs drawing.
  const topLimit = -width * 3;
  let from = 0;
  while (from < SAMPLES - 3 && ys[from + 1] < topLimit) from++;

  ctx.lineJoin = "round";

  // Shadow on the wall. A cord this thin, this far from the wall, casts almost
  // nothing but penumbra: wide and faint. A few stacked passes stand in for a blur.
  // The shadow is displaced downwards, so it is led upwards to leave the viewport
  // the way the cord itself does.
  ctx.save();
  ctx.translate(frame.shadowX, frame.shadowY);
  ctx.lineCap = "round";
  const lead = Math.abs(frame.shadowY) + 60 * s;
  const passes: ReadonlyArray<readonly [number, number]> = [
    [22, 0.011],
    [15, 0.014],
    [9, 0.018],
    [4, 0.022],
  ];
  for (const [spread, alpha] of passes) {
    ctx.strokeStyle = `rgba(74, 56, 34, ${alpha})`;
    ctx.lineWidth = width + spread * s;
    trace(ctx, 0, from, lead);
    ctx.stroke();
    // The ferrule is thicker than the cord, and so is its shadow.
    ctx.lineWidth = (CLASP.ferruleWidth + spread) * s;
    ctx.beginPath();
    ctx.moveTo(frame.holeX + axisX * CLASP.ferruleTop * s, frame.holeY + axisY * CLASP.ferruleTop * s);
    ctx.lineTo(frame.holeX + axisX * CLASP.ferruleBottom * s, frame.holeY + axisY * CLASP.ferruleBottom * s);
    ctx.stroke();
  }
  ctx.restore();

  // Cord body: a darker core, so the gaps between strands read as grooves.
  ctx.lineCap = "butt";
  ctx.strokeStyle = "#c6beb1";
  ctx.lineWidth = width + 1.1 * s;
  trace(ctx, 0, from);
  ctx.stroke();
  ctx.strokeStyle = "#e0dacf";
  ctx.lineWidth = width - 0.4 * s;
  trace(ctx, 0, from);
  ctx.stroke();

  // Braid: two columns of strands leaning into each other.
  const pitch = width * 0.62;
  ctx.lineWidth = Math.max(0.5, 0.55 * s);
  ctx.strokeStyle = "rgba(96, 78, 56, 0.3)";
  ctx.fillStyle = "#f5f1ea";
  strands(ctx, width, pitch, 1, pitch, topLimit);
  ctx.fillStyle = "#ffffff";
  strands(ctx, width, pitch, -1, pitch * 0.5, topLimit);

  // Roundness: light along the side facing the window, shade along the other.
  ctx.strokeStyle = "rgba(255, 255, 255, 0.62)";
  ctx.lineWidth = width * 0.16;
  trace(ctx, -width * 0.27, from);
  ctx.stroke();
  ctx.strokeStyle = "rgba(88, 70, 46, 0.15)";
  ctx.lineWidth = width * 0.3;
  trace(ctx, width * 0.32, from);
  ctx.stroke();

  // Hardware, drawn in its own frame: origin at the hole, y pointing down the cord.
  ctx.save();
  ctx.translate(frame.holeX, frame.holeY);
  ctx.rotate(Math.atan2(-axisX, axisY));
  ctx.scale(s, s);

  // Ring. The card will cover the part that passes behind it.
  const ringCentre = (CLASP.ringTop + CLASP.ringBottom) / 2;
  const ringHalf = (CLASP.ringBottom - CLASP.ringTop) / 2;
  ctx.lineWidth = CLASP.ringWeight + 0.9;
  ctx.strokeStyle = "rgba(52, 44, 34, 0.5)";
  ctx.beginPath();
  ctx.ellipse(0, ringCentre, CLASP.ringRadius, ringHalf, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = CLASP.ringWeight;
  ctx.strokeStyle = steel(ctx, -6, CLASP.ringTop, 6, CLASP.ringBottom);
  ctx.beginPath();
  ctx.ellipse(0, ringCentre, CLASP.ringRadius, ringHalf, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Eyelet under the ferrule that the ring hangs from.
  const half = CLASP.ferruleWidth / 2;
  ctx.fillStyle = steel(ctx, -CLASP.eyeletWidth / 2, 0, CLASP.eyeletWidth / 2, 0);
  ctx.strokeStyle = "rgba(52, 44, 34, 0.5)";
  ctx.lineWidth = 0.6;
  roundedRect(
    ctx,
    -CLASP.eyeletWidth / 2,
    CLASP.eyeletTop,
    CLASP.eyeletWidth,
    CLASP.eyeletBottom - CLASP.eyeletTop,
    3,
  );
  ctx.fill();
  ctx.stroke();

  // Ferrule: a small steel sleeve crimped over the end of the cord.
  const ferruleHeight = CLASP.ferruleBottom - CLASP.ferruleTop;
  ctx.fillStyle = steel(ctx, -half, 0, half, 0);
  roundedRect(ctx, -half, CLASP.ferruleTop, CLASP.ferruleWidth, ferruleHeight, 2.6);
  ctx.fill();
  ctx.stroke();
  // Crimp grooves, each with a lit lower lip.
  for (const at of [0.24, 0.76]) {
    const y = CLASP.ferruleTop + ferruleHeight * at;
    ctx.fillStyle = "rgba(44, 38, 30, 0.3)";
    ctx.fillRect(-half + 0.4, y, CLASP.ferruleWidth - 0.8, 0.9);
    ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
    ctx.fillRect(-half + 0.4, y + 0.9, CLASP.ferruleWidth - 0.8, 0.6);
  }

  ctx.restore();
}
