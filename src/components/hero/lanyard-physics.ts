/**
 * Lanyard physics: a card hanging from a cord, in screen space (px, seconds, y down).
 *
 *   pivot ──( elastic cord )── hole ──( rigid card )── centre of oscillation
 *
 * - The pivot is kinematic. The caller moves it (intro drop, scroll retraction)
 *   and everything below reacts.
 * - The cord only pulls, so it can go slack. When taut it behaves like a stiff,
 *   lossy spring, which is where the "stretch and settle" comes from.
 * - The card is a rigid link hanging from the hole, so cord + card form a double
 *   pendulum and the card can wag against the cord.
 * - The cord's shape comes from its first two transverse string modes, driven by
 *   the lateral acceleration of its end points and by air movement.
 * - Yaw (twist about the cord) and pitch (swing in depth) are torsion springs.
 *
 * Integrated with XPBD at a fixed sub-step so it behaves the same at 60, 120 or
 * 144 Hz. Nothing here touches the DOM.
 */

export interface LanyardParams {
  /** px/s². Scaled down from real life so the swing reads as slightly slow-motion. */
  gravity: number;
  /** Unstretched length from the pivot to the hole in the card, clasp included. */
  ropeLength: number;
  /** Hole to the card's centre of oscillation (about two thirds down the card). */
  cardArm: number;
  cardMass: number;
  claspMass: number;
  /** Spring constant of the cord along its length. */
  stiffness: number;
  /** Energy lost along the cord while it stretches. */
  stretchDamping: number;
  /** Air drag on the card, 1/s. Sets how long the swing takes to die down. */
  cardDrag: number;
  /** Friction at the clasp, 1/s. Sets how quickly the card stops wagging. */
  claspDrag: number;
  /** Natural frequencies (rad/s) and damping ratios of the cord's two bending modes. */
  bendFrequency: number;
  bendDamping: number;
  /** How strongly end-point acceleration excites the bending modes (1 = physical). */
  bendGain: number;
  /** Torsion springs for yaw and pitch. */
  yawFrequency: number;
  yawDamping: number;
  pitchFrequency: number;
  pitchDamping: number;
  /** Yaw picked up from sideways speed, rad per px/s. */
  yawFromSwing: number;
}

export interface LanyardInputs {
  pivotX: number;
  pivotY: number;
  /** Sideways acceleration on the card from moving air, px/s². */
  wind: number;
  /** Resting bow of the cord in px, positive to the right. */
  bow: number;
  /** Target yaw and pitch in radians. */
  yaw: number;
  pitch: number;
}

const SUBSTEP = 1 / 600;
const MAX_FRAME = 1 / 20;
const ITERATIONS = 2;

export class Lanyard {
  params: LanyardParams;

  // Kinematic pivot.
  pivotX = 0;
  pivotY = 0;
  private pivotVX = 0;
  private pivotVY = 0;

  // Hole in the card (top of the rigid link).
  holeX = 0;
  holeY = 0;
  private holeVX = 0;
  private holeVY = 0;

  // Card's centre of oscillation.
  cardX = 0;
  cardY = 0;
  private cardVX = 0;
  private cardVY = 0;

  /** Cord bending modes, px. */
  bend1 = 0;
  bend2 = 0;
  private bend1V = 0;
  private bend2V = 0;

  /** Radians. */
  yaw = 0;
  pitch = 0;
  private yawV = 0;
  private pitchV = 0;

  /** Card rotation in the screen plane, radians, positive clockwise (CSS convention). */
  angle = 0;
  /** Cord rotation in the screen plane, same convention. */
  ropeAngle = 0;
  /** How far the cord is stretched past its rest length, px. */
  stretch = 0;
  /** How much slack the cord has, px. */
  slack = 0;
  /** Smoothed cord tension relative to the card's resting weight (1 = hanging still). */
  tension = 1;
  /** Swing amplitude of the whole pendulum, radians. Decays to zero as it settles. */
  amplitude = 0;

  private swingAngle = 0;

  constructor(params: LanyardParams) {
    this.params = params;
  }

  /** Extra length the cord takes on under the resting load. */
  get restStretch(): number {
    const p = this.params;
    return ((p.cardMass + p.claspMass) * p.gravity) / p.stiffness;
  }

  /**
   * Hang everything at rest below the pivot, optionally leaning by `lean` radians
   * and already moving with the pivot's velocity.
   */
  reset(pivotX: number, pivotY: number, lean = 0, velocityX = 0, velocityY = 0): void {
    const p = this.params;
    const sin = Math.sin(lean);
    const cos = Math.cos(lean);
    const rope = p.ropeLength + this.restStretch;

    this.pivotX = pivotX;
    this.pivotY = pivotY;
    this.pivotVX = velocityX;
    this.pivotVY = velocityY;

    this.holeX = pivotX - sin * rope;
    this.holeY = pivotY + cos * rope;
    this.cardX = this.holeX - sin * p.cardArm;
    this.cardY = this.holeY + cos * p.cardArm;

    this.holeVX = this.cardVX = velocityX;
    this.holeVY = this.cardVY = velocityY;

    this.bend1 = this.bend2 = this.bend1V = this.bend2V = 0;
    this.yaw = this.pitch = this.yawV = this.pitchV = 0;
    this.tension = 1;
    this.readOut(0);
    this.amplitude = Math.abs(lean);
  }

  /**
   * Move to a new pivot and resize about it without disturbing the motion.
   * Used when the layout changes under a badge that is mid-swing.
   */
  rescale(pivotX: number, pivotY: number, factor: number): void {
    this.holeX = pivotX + (this.holeX - this.pivotX) * factor;
    this.holeY = pivotY + (this.holeY - this.pivotY) * factor;
    this.cardX = pivotX + (this.cardX - this.pivotX) * factor;
    this.cardY = pivotY + (this.cardY - this.pivotY) * factor;
    this.pivotX = pivotX;
    this.pivotY = pivotY;

    this.holeVX *= factor;
    this.holeVY *= factor;
    this.cardVX *= factor;
    this.cardVY *= factor;
    this.bend1 *= factor;
    this.bend2 *= factor;
    this.bend1V *= factor;
    this.bend2V *= factor;
  }

  /** Kick the card sideways, px/s. */
  push(velocityX: number, velocityY = 0): void {
    this.cardVX += velocityX;
    this.cardVY += velocityY;
  }

  /** Kick the twist and pitch, rad/s. */
  spin(yawVelocity: number, pitchVelocity = 0): void {
    this.yawV += yawVelocity;
    this.pitchV += pitchVelocity;
  }

  /** Pluck the cord, px/s. */
  pluck(velocity: number): void {
    this.bend1V += velocity;
  }

  setPose(yaw: number, pitch: number): void {
    this.yaw = yaw;
    this.pitch = pitch;
    this.yawV = 0;
    this.pitchV = 0;
  }

  step(frameDt: number, input: LanyardInputs): void {
    const p = this.params;
    const dt = Math.min(frameDt, MAX_FRAME);
    if (dt <= 0) return;

    const steps = Math.max(1, Math.round(dt / SUBSTEP));
    const h = dt / steps;

    const wHole = 1 / p.claspMass;
    const wCard = 1 / p.cardMass;
    const compliance = 1 / p.stiffness;
    const alpha = compliance / (h * h);
    const gamma = (compliance * p.stretchDamping) / h;
    const holeDamp = Math.exp(-p.claspDrag * h);
    const cardDamp = Math.exp(-p.cardDrag * h);
    const restTension = (p.cardMass + p.claspMass) * p.gravity;

    // The pivot moves in a straight line across the frame.
    const fromX = this.pivotX;
    const fromY = this.pivotY;
    const stepPX = (input.pivotX - fromX) / steps;
    const stepPY = (input.pivotY - fromY) / steps;
    const newPivotVX = (input.pivotX - fromX) / dt;
    const newPivotVY = (input.pivotY - fromY) / dt;
    const pivotAX = (newPivotVX - this.pivotVX) / dt;
    const pivotAY = (newPivotVY - this.pivotVY) / dt;
    this.pivotVX = newPivotVX;
    this.pivotVY = newPivotVY;

    for (let i = 0; i < steps; i++) {
      const pivotX = fromX + stepPX * (i + 1);
      const pivotY = fromY + stepPY * (i + 1);

      // Forces.
      this.holeVY += p.gravity * h;
      this.cardVY += p.gravity * h;
      this.cardVX += input.wind * h;
      this.holeVX *= holeDamp;
      this.holeVY *= holeDamp;
      this.cardVX *= cardDamp;
      this.cardVY *= cardDamp;

      const holeX0 = this.holeX;
      const holeY0 = this.holeY;
      const cardX0 = this.cardX;
      const cardY0 = this.cardY;
      const holeVX0 = this.holeVX;
      const holeVY0 = this.holeVY;

      this.holeX += this.holeVX * h;
      this.holeY += this.holeVY * h;
      this.cardX += this.cardVX * h;
      this.cardY += this.cardVY * h;

      // Constraints.
      let lambda = 0;
      for (let k = 0; k < ITERATIONS; k++) {
        // Cord: pivot to hole. Pulls only.
        let dx = this.holeX - pivotX;
        let dy = this.holeY - pivotY;
        let d = Math.hypot(dx, dy) || 1e-6;
        const over = d - p.ropeLength;
        if (over > 0) {
          const nx = dx / d;
          const ny = dy / d;
          const closing = nx * (this.holeX - holeX0 - stepPX) + ny * (this.holeY - holeY0 - stepPY);
          const dLambda = (-over - alpha * lambda - gamma * closing) / ((1 + gamma) * wHole + alpha);
          lambda += dLambda;
          this.holeX += wHole * dLambda * nx;
          this.holeY += wHole * dLambda * ny;
        }

        // Card: hole to centre of oscillation. Rigid.
        dx = this.cardX - this.holeX;
        dy = this.cardY - this.holeY;
        d = Math.hypot(dx, dy) || 1e-6;
        const error = d - p.cardArm;
        const nx = dx / d;
        const ny = dy / d;
        const dLambda = -error / (wHole + wCard);
        this.cardX += wCard * dLambda * nx;
        this.cardY += wCard * dLambda * ny;
        this.holeX -= wHole * dLambda * nx;
        this.holeY -= wHole * dLambda * ny;
      }

      this.holeVX = (this.holeX - holeX0) / h;
      this.holeVY = (this.holeY - holeY0) / h;
      this.cardVX = (this.cardX - cardX0) / h;
      this.cardVY = (this.cardY - cardY0) / h;

      // Cord tension, low-passed. It stiffens or relaxes the bending modes.
      const tensionNow = Math.max(0, -lambda / (h * h)) / restTension;
      this.tension += (tensionNow - this.tension) * Math.min(1, h * 40);

      // Bending modes. Seen from the straight line between its ends, every piece
      // of cord feels gravity minus the acceleration of that line, so the cord
      // sags when it leans and lags when its ends are thrown sideways.
      const cx = this.holeX - pivotX;
      const cy = this.holeY - pivotY;
      const chord = Math.hypot(cx, cy) || 1e-6;
      const normalX = cy / chord;
      const normalY = -cx / chord;
      // Velocities were sampled after gravity, so this is the pull of the
      // constraints alone: the hole's acceleration minus gravity.
      const pullX = (this.holeVX - holeVX0) / h;
      const pullY = (this.holeVY - holeVY0) / h;
      const topDrive = -pivotAX * normalX + (p.gravity - pivotAY) * normalY;
      const endDrive = -(pullX * normalX + pullY * normalY);
      const tautness = Math.sqrt(Math.min(3, Math.max(0.08, this.tension)));
      const w1 = p.bendFrequency * tautness;
      const w2 = w1 * 2;
      const drive1 = p.bendGain * (2 / Math.PI) * (topDrive + endDrive);
      const drive2 = p.bendGain * (1 / Math.PI) * (topDrive - endDrive);

      this.bend1V += (drive1 - 2 * p.bendDamping * w1 * this.bend1V - w1 * w1 * (this.bend1 - input.bow)) * h;
      this.bend1 += this.bend1V * h;
      this.bend2V += (drive2 - 2 * p.bendDamping * w2 * this.bend2V - w2 * w2 * this.bend2) * h;
      this.bend2 += this.bend2V * h;

      // Twist and pitch.
      const yawTarget = input.yaw + p.yawFromSwing * (this.cardVX - newPivotVX);
      this.yawV +=
        (-2 * p.yawDamping * p.yawFrequency * this.yawV -
          p.yawFrequency * p.yawFrequency * (this.yaw - yawTarget)) *
        h;
      this.yaw += this.yawV * h;
      this.pitchV +=
        (-2 * p.pitchDamping * p.pitchFrequency * this.pitchV -
          p.pitchFrequency * p.pitchFrequency * (this.pitch - input.pitch)) *
        h;
      this.pitch += this.pitchV * h;
    }

    this.pivotX = input.pivotX;
    this.pivotY = input.pivotY;
    this.readOut(dt);
  }

  private readOut(dt: number): void {
    const p = this.params;
    const ropeDX = this.holeX - this.pivotX;
    const ropeDY = this.holeY - this.pivotY;
    const ropeLength = Math.hypot(ropeDX, ropeDY);

    this.angle = Math.atan2(-(this.cardX - this.holeX), this.cardY - this.holeY);
    this.ropeAngle = Math.atan2(-ropeDX, ropeDY);
    this.stretch = Math.max(0, ropeLength - p.ropeLength);
    this.slack = Math.max(0, p.ropeLength - ropeLength);

    const previousSwing = this.swingAngle;
    this.swingAngle = Math.atan2(-(this.cardX - this.pivotX), this.cardY - this.pivotY);

    if (dt > 0) {
      // For a pendulum, angle² + (rate / ω)² is the squared amplitude, so this
      // reads the size of the swing at any instant without waiting for a peak.
      const omega = Math.sqrt(p.gravity / (p.ropeLength + p.cardArm));
      const rate = (this.swingAngle - previousSwing) / dt;
      const now = Math.hypot(this.swingAngle, rate / omega);
      this.amplitude += (now - this.amplitude) * Math.min(1, dt * 12);
    }
  }
}
