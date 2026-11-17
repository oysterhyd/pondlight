// Pickups: the fireflies that are experience, the lily hearts that heal, and
// the rare dragonfly that clears the pond's edge with a shockwave of bubbles.
// Pickups drift gently, are pulled to the frog inside its magnet range, and
// are collected on touch. Step functions return what was gathered so the
// world can score, heal and level without this file knowing those rules.

import { FIREFLY } from './config.js';
import { distance } from './random.js';

export const PICKUP_FIREFLY = 'firefly';
export const PICKUP_HEART = 'heart';
export const PICKUP_DRAGONFLY = 'dragonfly';

export function makePickup(kind, x, y, rng) {
  return {
    kind,
    x,
    y,
    vx: (rng() - 0.5) * 30,
    vy: (rng() - 0.5) * 30,
    radius: kind === PICKUP_FIREFLY ? FIREFLY.radius : 13,
    t: rng() * Math.PI * 2,
    dead: false,
  };
}

/** Scatter the fireflies a dead foe pays out, around its position. */
export function scatterFireflies(list, count, x, y, rng) {
  for (let i = 0; i < count; i += 1) {
    const angle = rng() * Math.PI * 2;
    const dist = 6 + rng() * 30;
    list.push(makePickup(PICKUP_FIREFLY, x + Math.cos(angle) * dist, y + Math.sin(angle) * dist, rng));
  }
}

/**
 * Advance all pickups. Returns {fireflies, hearts, dragonflies} counts
 * collected this step. Hearts and dragonflies are collected on touch only;
 * fireflies also fly to the frog once inside the magnet radius.
 */
export function stepPickups(pickups, player, stats, dt) {
  const got = { fireflies: 0, hearts: 0, dragonflies: 0 };
  for (const p of pickups) {
    p.t += dt * 3;
    const d = distance(p.x, p.y, player.x, player.y);
    if (p.kind === PICKUP_FIREFLY && d < stats.magnet) {
      const pull = FIREFLY.magnetSpeed * dt;
      p.x += ((player.x - p.x) / (d || 1)) * pull;
      p.y += ((player.y - p.y) / (d || 1)) * pull;
    } else {
      p.x += p.vx * dt + Math.sin(p.t) * 6 * dt;
      p.y += p.vy * dt + Math.cos(p.t * 0.8) * 6 * dt;
      p.vx *= 1 - 1.4 * dt;
      p.vy *= 1 - 1.4 * dt;
    }
    const collectAt = p.kind === PICKUP_FIREFLY ? FIREFLY.collectRadius : player.radius + p.radius;
    if (d < collectAt) {
      p.dead = true;
      if (p.kind === PICKUP_FIREFLY) got.fireflies += 1;
      else if (p.kind === PICKUP_HEART) got.hearts += 1;
      else got.dragonflies += 1;
    }
  }
  for (let i = pickups.length - 1; i >= 0; i -= 1) {
    if (pickups[i].dead) pickups.splice(i, 1);
  }
  return got;
}
