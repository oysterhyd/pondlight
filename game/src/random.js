// A small seeded random number generator (mulberry32) plus helpers.
// The game never calls Math.random inside the simulation: every run is built
// from one seed, so screenshot scenes and replays come out the same each time.

/** Create a generator from a 32-bit seed. Returns a function giving [0, 1). */
export function makeRng(seed) {
  let state = (seed >>> 0) || 1;
  return function rng() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A float in [min, max). */
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

/** An integer in [min, max], both ends included. */
export function intRange(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

/** One element of a non-empty array. */
export function pick(rng, items) {
  return items[Math.floor(rng() * items.length)];
}

/** True with probability p. */
export function chance(rng, p) {
  return rng() < p;
}

/** Clamp a value into [min, max]. */
export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

/** Linear interpolation. */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** The angle from one point to another. */
export function angleTo(x1, y1, x2, y2) {
  return Math.atan2(y2 - y1, x2 - x1);
}

/** The distance between two points. */
export function distance(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.hypot(dx, dy);
}

/** The distance at which two circles of the given radii touch. */
export function circlesTouch(ax, ay, ar, bx, by, br) {
  return distance(ax, ay, bx, by) <= ar + br;
}
