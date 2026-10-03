/**
 * Stage directions for the hanging badge. Another section writes them; the hero
 * scene reads them on every tick and lets the physics carry them out, so the
 * badge is moved the way a hand would move it rather than animated.
 *
 * Plain mutable state on purpose: it changes every frame and nothing in React
 * needs to re-render for it.
 */
export const direction = {
  /** 0 = where the hero hangs the badge, 1 = at its mark for the identity section. */
  shift: 0,
  /** 0..1, how far the camera has pushed in. */
  zoom: 0,
  /** 0..1, how far the scanner's beam has travelled down the card. */
  scan: 0,
  /** 0..1, how strongly the scanner lights the card. */
  light: 0,
  /** 0..1, how firmly the card is held still, as it is while the scanner reads it. */
  steady: 0,
  /** A one-off sideways push, in design pixels per second. The scene applies it and clears it. */
  push: 0,
  /** The card's resting box at its mark, in viewport pixels. Written by the scene. */
  frame: { x: 0, y: 0, width: 0, height: 0 },
  /**
   * Whether the card hangs at its mark, still enough to be read: the pivot is
   * there and the card has stopped swinging under it. Written by the scene on
   * every tick; the scanner waits for it.
   */
  placed: false,
  /**
   * The breeze in the room, -1..1: what the badge sways in, and the branch
   * outside the window with it. Written by the scene.
   */
  air: 0,

  /**
   * The closing section brings the badge back, in the middle of the room, and
   * turns it over. Each of these is 0..1: how far it has been let down again,
   * how far the camera has moved in on it, how far it has been turned to show
   * its back, how much late sun falls across it, and how firmly it is held still.
   */
  closing: {
    lower: 0,
    zoom: 0,
    turn: 0,
    sun: 0,
    steady: 0,
    /** The card's resting box there, in viewport pixels. Written by the scene. */
    frame: { x: 0, y: 0, width: 0, height: 0 },
    /** Where the room for the closing words under the card ends, in viewport pixels. Written by the scene. */
    floor: 0,
  },
};

/** Fired on `window` whenever the scene has re-measured `direction.frame`. */
export const STAGE_LAYOUT = "stage:layout";
