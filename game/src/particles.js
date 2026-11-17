// Particles, shockwave rings and floating text: the juice layer.
// Everything here is purely visual — particles never touch the simulation's
// outcomes — and all three pools are fixed-size rings, so a long run cannot
// grow memory or stutter on allocation.

import { clamp } from './random.js';

const MAX_PARTICLES = 900;
const MAX_TEXTS = 48;
const MAX_RINGS = 32;

export function createEffects() {
  return {
    particles: [],
    texts: [],
    rings: [],
    shake: 0,
    hitStop: 0,
  };
}

function addParticle(fx, p) {
  if (fx.particles.length >= MAX_PARTICLES) fx.particles.shift();
  fx.particles.push(p);
}

/** A burst of round droplets in one colour. */
export function burst(fx, rng, x, y, { count = 10, color = '#ffffff', speed = 190, size = 3.4, life = 0.5, gravity = 0 } = {}) {
  for (let i = 0; i < count; i += 1) {
    const angle = rng() * Math.PI * 2;
    const v = speed * (0.3 + rng() * 0.9);
    addParticle(fx, {
      x, y,
      vx: Math.cos(angle) * v,
      vy: Math.sin(angle) * v,
      life: life * (0.5 + rng() * 0.8),
      age: 0,
      size: size * (0.6 + rng() * 0.9),
      color,
      gravity,
      kind: 'drop',
    });
  }
}

/** A soft glowing mote that drifts upward, for fireflies and level-ups. */
export function mote(fx, rng, x, y, { color = '#ffe066', size = 2.6, life = 0.9 } = {}) {
  addParticle(fx, {
    x: x + (rng() - 0.5) * 26,
    y: y + (rng() - 0.5) * 18,
    vx: (rng() - 0.5) * 24,
    vy: -30 - rng() * 42,
    life,
    age: 0,
    size,
    color,
    gravity: 0,
    kind: 'mote',
  });
}

/** An expanding ring, for dashes, boss deaths and wave starts. */
export function ring(fx, x, y, { color = '#bfeaf2', maxRadius = 90, life = 0.42, width = 3 } = {}) {
  if (fx.rings.length >= MAX_RINGS) fx.rings.shift();
  fx.rings.push({ x, y, age: 0, life, maxRadius, color, width });
}

/** A line of floating text that rises and fades ("+30", "LEVEL UP"). */
export function floatText(fx, x, y, text, { color = '#eaf7fa', size = 16, life = 0.85 } = {}) {
  if (fx.texts.length >= MAX_TEXTS) fx.texts.shift();
  fx.texts.push({ x, y, text, age: 0, life, color, size });
}

/** Ask the camera to shake by the given amount (the largest ask wins). */
export function shake(fx, amount) {
  fx.shake = Math.max(fx.shake, amount);
}

/** Freeze the world for a few hundredths of a second on a heavy hit. */
export function hitStop(fx, seconds) {
  fx.hitStop = Math.max(fx.hitStop, seconds);
}

/** Advance every effect by dt seconds. */
export function stepEffects(fx, dt) {
  for (let i = fx.particles.length - 1; i >= 0; i -= 1) {
    const p = fx.particles[i];
    p.age += dt;
    if (p.age >= p.life) {
      fx.particles.splice(i, 1);
      continue;
    }
    p.vy += p.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.kind === 'drop') {
      p.vx *= 1 - 2.4 * dt;
      p.vy *= 1 - 2.4 * dt;
    }
  }
  for (let i = fx.texts.length - 1; i >= 0; i -= 1) {
    const t = fx.texts[i];
    t.age += dt;
    t.y -= 34 * dt;
    if (t.age >= t.life) fx.texts.splice(i, 1);
  }
  for (let i = fx.rings.length - 1; i >= 0; i -= 1) {
    const r = fx.rings[i];
    r.age += dt;
    if (r.age >= r.life) fx.rings.splice(i, 1);
  }
  fx.shake = Math.max(0, fx.shake - 60 * dt);
}

/** How far the camera is displaced this frame, from the current shake. */
export function shakeOffset(fx, rng) {
  if (fx.shake <= 0.2) return { x: 0, y: 0 };
  const m = clamp(fx.shake, 0, 14);
  return { x: (rng() - 0.5) * 2 * m, y: (rng() - 0.5) * 2 * m };
}

/** Draw all effects. Called by render.js in world space, texts last. */
export function drawEffects(ctx, fx) {
  for (const r of fx.rings) {
    const t = r.age / r.life;
    ctx.globalAlpha = (1 - t) * 0.7;
    ctx.strokeStyle = r.color;
    ctx.lineWidth = r.width * (1 - t) + 0.5;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.maxRadius * (0.2 + 0.8 * t), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (const p of fx.particles) {
    const t = 1 - p.age / p.life;
    ctx.globalAlpha = p.kind === 'mote' ? t * 0.9 : t;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(0.4, p.size * (p.kind === 'drop' ? t : 1)), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
  for (const t of fx.texts) {
    const a = 1 - t.age / t.life;
    ctx.globalAlpha = a;
    ctx.font = `700 ${t.size}px system-ui, sans-serif`;
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;
}
