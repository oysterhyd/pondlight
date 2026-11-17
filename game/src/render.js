// Everything Pondlight draws. The world is rendered in logical pond
// coordinates (1280×720); main.js scales the canvas transform, and this
// file only ever paints: pond, pads, pickups, foes, bubbles, the frog,
// effects, then the HUD and whichever full screen is up. Creatures and
// props are the pre-rendered sprites from sprites.js; this file composes
// them and draws all of the interface: panels, plaques, chips and cards.
// No drawing code changes any game state.

import { COLORS, FIELD } from './config.js';
import { TOTAL_WAVES } from './waves.js';
import { PHASE_BREAK, PHASE_FIGHT, PHASE_LOST } from './world.js';
import { KIND_BEETLE, KIND_DARTER, KIND_GNAT, KIND_HERON, KIND_MOTH, KIND_SNAIL } from './enemies.js';
import { PICKUP_DRAGONFLY, PICKUP_FIREFLY, PICKUP_HEART } from './pickups.js';
import { drawEffects } from './particles.js';
import { clamp } from './random.js';
import {
  BEETLE_FRAMES, BEETLE_WHITE, BUBBLE_SPRITE, CAUSTIC_TILE, DARTER_FRAMES, DARTER_WHITE,
  DRAGONFLY_FRAMES, FEATHER_SPRITE, FIREFLY_SPRITE, FROG_BODY, FROG_FRAMES, FROG_WHITE,
  GNAT_FRAMES, GNAT_WHITE, HEART_SPRITE, HERON_FRAMES, HERON_WHITE, MOTH_FRAMES, MOTH_WHITE,
  PAD_SPRITES, REED_SHADOW, REED_SPRITE, SNAIL_FRAMES, SNAIL_WHITE, SPORE_SPRITE, blit, makeVignette,
} from './sprites.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSE = 'pause';
export const SCREEN_LEVELUP = 'levelup';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const DISPLAY = `"Avenir Next", "Trebuchet MS", system-ui, 'Segoe UI', sans-serif`;
const BODY = `system-ui, 'Segoe UI', sans-serif`;
const SERIF = `Georgia, 'Times New Roman', serif`;

function circle(ctx, x, y, r, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function ellipse(ctx, x, y, rx, ry, rotation, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rotation, 0, Math.PI * 2);
  ctx.fill();
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function text(ctx, value, x, y, { size = 16, color = COLORS.text, align = 'left', weight = 600, alpha = 1, font = BODY, spacing = 0, italic = false } = {}) {
  ctx.save();
  ctx.globalAlpha = alpha;
  try { ctx.letterSpacing = `${spacing}px`; } catch { /* older engines */ }
  ctx.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(value, x, y);
  ctx.restore();
}

function shadowedText(ctx, value, x, y, opts, shadow = 'rgba(2, 20, 28, 0.55)', blur = 6, dy = 3) {
  ctx.save();
  ctx.shadowColor = shadow;
  ctx.shadowBlur = blur;
  ctx.shadowOffsetY = dy;
  text(ctx, value, x, y, opts);
  ctx.restore();
}

export function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** A soft contact shadow under a creature. */
function shadow(ctx, x, y, r) {
  ellipse(ctx, x, y + r * 0.72, r * 1.02, r * 0.4, 0, 'rgba(3, 24, 31, 0.30)');
}

/** A translucent panel with a lit rim — the game's one interface material. */
function panel(ctx, x, y, w, h, r = 14, alpha = 0.82) {
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 3;
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, `rgba(16, 58, 72, ${alpha})`);
  g.addColorStop(1, `rgba(7, 32, 42, ${alpha})`);
  rr(ctx, x, y, w, h, r);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
  rr(ctx, x, y, w, h, r);
  ctx.strokeStyle = 'rgba(160, 225, 240, 0.35)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // A hairline of light along the top edge.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.beginPath();
  ctx.moveTo(x + r, y + 1);
  ctx.lineTo(x + w - r, y + 1);
  ctx.stroke();
}

/** A small key-cap chip: [ WASD ] style hint. */
function chip(ctx, x, y, label, { size = 12, align = 'left' } = {}) {
  ctx.save();
  ctx.font = `700 ${size}px ${BODY}`;
  const w = ctx.measureText(label).width + 16;
  const bx = align === 'center' ? x - w / 2 : x;
  rr(ctx, bx, y - 11, w, 22, 7);
  ctx.fillStyle = 'rgba(6, 28, 38, 0.72)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(160, 225, 240, 0.4)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
  text(ctx, label, bx + w / 2, y + 0.5, { size, align: 'center', weight: 700, color: '#cfeef5' });
  return w;
}

/* ---------------- the pond ---------------- */

let vignette = null;

function drawPond(ctx, state) {
  const g = ctx.createRadialGradient(FIELD.width / 2, FIELD.height * 0.42, 140, FIELD.width / 2, FIELD.height / 2, 820);
  g.addColorStop(0, '#1d7186');
  g.addColorStop(0.5, COLORS.waterMid);
  g.addColorStop(1, COLORS.waterDeep);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);

  // Drifting caustic light, two tiled layers moving against each other.
  ctx.save();
  for (const layer of [{ s: 1, a: 0.38, vx: 6, vy: 2.4 }, { s: 1.7, a: 0.22, vx: -3.6, vy: 4.2 }]) {
    const size = CAUSTIC_TILE.w * layer.s;
    const ox = (state.time * layer.vx) % size;
    const oy = (state.time * layer.vy) % size;
    ctx.globalAlpha = layer.a;
    for (let x = -size + ox; x < FIELD.width; x += size) {
      for (let y = -size + oy; y < FIELD.height; y += size) {
        ctx.drawImage(CAUSTIC_TILE.c, x, y, size, size);
      }
    }
  }
  ctx.restore();

  // Light shafts drifting slowly across the water.
  ctx.save();
  ctx.globalAlpha = 0.045;
  ctx.fillStyle = '#dff7ff';
  for (let i = 0; i < 4; i += 1) {
    const x = ((state.time * 11 + i * 340) % (FIELD.width + 300)) - 150;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 140, 0);
    ctx.lineTo(x + 44, FIELD.height);
    ctx.lineTo(x - 96, FIELD.height);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Two broad moonlight patches breathing across the surface.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const [fx, fy, fr, sp] of [[0.3, 0.36, 300, 0.35], [0.72, 0.62, 380, 0.26]]) {
    const px = FIELD.width * fx + Math.sin(state.time * sp) * 60;
    const py = FIELD.height * fy + Math.cos(state.time * sp * 0.76) * 44;
    const g = ctx.createRadialGradient(px, py, 10, px, py, fr);
    g.addColorStop(0, 'rgba(120, 200, 235, 0.05)');
    g.addColorStop(1, 'rgba(120, 200, 235, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(px - fr, py - fr, fr * 2, fr * 2);
  }
  ctx.restore();

  // Lily pads from the sprite set; flowering pads get the lotus variant.
  state.decor.pads.forEach((pad, i) => {
    const bob = Math.sin(state.time * 0.7 + pad.drift) * 2;
    ellipse(ctx, pad.x, pad.y + bob + pad.r * 0.24, pad.r * 0.95, pad.r * 0.34, 0, 'rgba(3, 24, 31, 0.22)');
    const spr = pad.flower ? PAD_SPRITES[2] : PAD_SPRITES[i % 2];
    blit(ctx, spr, pad.x, pad.y + bob, { rot: pad.notch, scale: pad.r / 66 });
  });

  // Reed clusters along the top and bottom edges, swaying.
  for (const reed of state.decor.reeds) {
    const scale = (reed.h + 26) / 150;
    const sway = Math.sin(state.time * 1.15 + reed.x * 0.05) * 0.045 + reed.lean * 0.22;
    ctx.save();
    ctx.translate(reed.x, reed.top ? reed.y - 2 : reed.y + 2);
    if (reed.top) ctx.scale(1, -1);
    ctx.rotate(sway * (reed.top ? -1 : 1));
    ctx.drawImage(REED_SPRITE.c, -REED_SPRITE.w / 2 * scale, -REED_SPRITE.h * scale + 46 * scale, REED_SPRITE.w * scale, REED_SPRITE.h * scale);
    ctx.restore();
  }

  // Drifting motes of light in the water.
  ctx.save();
  ctx.fillStyle = 'rgba(210, 245, 255, 0.35)';
  for (let i = 0; i < 22; i += 1) {
    const mx = ((i * 173.3 + state.time * (4 + (i % 5))) % (FIELD.width + 20)) - 10;
    const my = (i * 97.7) % FIELD.height + Math.sin(state.time * 0.6 + i) * 7;
    ctx.globalAlpha = 0.1 + (i % 4) * 0.05;
    ctx.beginPath();
    ctx.arc(mx, my, 1.4 + (i % 3) * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/* ---------------- creatures ---------------- */

/** A squashed, flipped echo of a sprite on the water under its owner. */
function reflect(ctx, spr, x, y, { rot = 0, scale = 1, flipX = false, alpha = 0.1 } = {}) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(flipX ? -scale : scale, -scale * 0.62);
  ctx.rotate(-rot);
  ctx.drawImage(spr.c, -spr.w / 2, -spr.h / 2, spr.w, spr.h);
  ctx.restore();
}

export function drawFrog(ctx, x, y, radius, aimAngle, walkPhase, hurt, alpha = 1) {
  const frame = Math.abs(Math.floor(walkPhase * 0.6366)) % 4;
  const spr = FROG_FRAMES[frame];
  reflect(ctx, spr, x, y + radius * 1.85, { rot: aimAngle + Math.PI / 2, scale: radius / FROG_BODY, alpha: 0.09 * alpha });
  shadow(ctx, x, y, radius * 1.06);
  blit(ctx, spr, x, y, { rot: aimAngle + Math.PI / 2, scale: radius / FROG_BODY, alpha });
  if (hurt) blit(ctx, FROG_WHITE[frame], x, y, { rot: aimAngle + Math.PI / 2, scale: radius / FROG_BODY, alpha: alpha * 0.45 });
}

function foeFrame(foe, frames, rate) {
  return frames[Math.abs(Math.floor(foe.t * rate)) % frames.length];
}

function drawGnat(ctx, foe) {
  const frame = Math.abs(Math.floor(foe.t * 22)) % 2;
  shadow(ctx, foe.x, foe.y, foe.radius);
  blit(ctx, GNAT_FRAMES[frame], foe.x, foe.y + Math.sin(foe.t * 7) * 1.6, { rot: Math.sin(foe.t * 5.3) * 0.18, scale: foe.radius / 13 });
  if (foe.flash > 0) blit(ctx, GNAT_WHITE[frame], foe.x, foe.y, { alpha: foe.flash * 0.8, scale: foe.radius / 13 });
}

function drawDarter(ctx, foe) {
  if (foe.state === 'aim') {
    ctx.save();
    ctx.rotate(0);
    ctx.translate(foe.x, foe.y);
    ctx.rotate(foe.aimAngle ?? 0);
    ctx.strokeStyle = 'rgba(255, 82, 82, 0.6)';
    ctx.setLineDash([8, 8]);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(195, 0);
    ctx.stroke();
    ctx.restore();
  }
  const angle = Math.atan2(foe.vy, foe.vx);
  const frame = Math.abs(Math.floor(foe.t * 9)) % 3;
  shadow(ctx, foe.x, foe.y, foe.radius);
  blit(ctx, DARTER_FRAMES[frame], foe.x, foe.y, { rot: angle, scale: foe.radius / 15 });
  if (foe.flash > 0) blit(ctx, DARTER_WHITE[frame], foe.x, foe.y, { rot: angle, alpha: foe.flash * 0.8, scale: foe.radius / 15 });
}

function drawMoth(ctx, foe) {
  const frame = Math.abs(Math.floor(foe.t * 6.5)) % 2;
  const angle = Math.atan2(foe.vy, foe.vx) * 0.22;
  shadow(ctx, foe.x, foe.y, foe.radius * 1.2);
  blit(ctx, MOTH_FRAMES[frame], foe.x, foe.y + Math.sin(foe.t * 3.4) * 2, { rot: angle, scale: foe.radius / 17 });
  if (foe.flash > 0) blit(ctx, MOTH_WHITE[frame], foe.x, foe.y, { rot: angle, alpha: foe.flash * 0.8, scale: foe.radius / 17 });
}

function drawBeetle(ctx, foe) {
  const frame = Math.abs(Math.floor(foe.t * 5)) % 2;
  const angle = Math.atan2(foe.vy, foe.vx) + Math.PI / 2;
  reflect(ctx, BEETLE_FRAMES[frame], foe.x, foe.y + foe.radius * 1.8, { rot: angle, scale: foe.radius / 23, alpha: 0.08 });
  shadow(ctx, foe.x, foe.y, foe.radius * 1.08);
  blit(ctx, BEETLE_FRAMES[frame], foe.x, foe.y, { rot: angle, scale: foe.radius / 23 });
  if (foe.flash > 0) blit(ctx, BEETLE_WHITE[frame], foe.x, foe.y, { rot: angle, alpha: foe.flash * 0.8, scale: foe.radius / 23 });
}

function drawSnail(ctx, foe) {
  const tucked = foe.state === 'tuck';
  const frame = tucked ? 1 : 0;
  const angle = Math.atan2(foe.vy, foe.vx) + Math.PI / 2;
  reflect(ctx, SNAIL_FRAMES[frame], foe.x, foe.y + foe.radius * 1.85, { rot: angle, scale: foe.radius / 20, alpha: 0.09 });
  shadow(ctx, foe.x, foe.y, foe.radius * 1.05);
  blit(ctx, SNAIL_FRAMES[frame], foe.x, foe.y, { rot: angle, scale: foe.radius / 20 });
  if (foe.flash > 0) blit(ctx, SNAIL_WHITE[frame], foe.x, foe.y, { rot: angle, alpha: foe.flash * 0.8, scale: foe.radius / 20 });
  if (tucked) {
    // A small shield floats over the shell: this one is armoured right now.
    const sx = foe.x;
    const sy = foe.y - foe.radius - 27;
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = '#ffe082';
    ctx.beginPath();
    ctx.moveTo(sx, sy - 6);
    ctx.lineTo(sx + 5.4, sy - 3.8);
    ctx.lineTo(sx + 5.4, sy + 1);
    ctx.quadraticCurveTo(sx + 5.4, sy + 5.6, sx, sy + 7.4);
    ctx.quadraticCurveTo(sx - 5.4, sy + 5.6, sx - 5.4, sy + 1);
    ctx.lineTo(sx - 5.4, sy - 3.8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawHeron(ctx, foe, state) {
  if (foe.state === 'warn' && foe.swoopFrom && foe.swoopTo) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 82, 82, 0.55)';
    ctx.setLineDash([14, 10]);
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(foe.swoopFrom.x, foe.swoopFrom.y);
    const dx = foe.swoopTo.x - foe.swoopFrom.x;
    const dy = foe.swoopTo.y - foe.swoopFrom.y;
    ctx.lineTo(foe.swoopFrom.x + dx * 2.4, foe.swoopFrom.y + dy * 2.4);
    ctx.stroke();
    ctx.restore();
  }
  const face = state.player.x >= foe.x ? 1 : -1;
  const frame = Math.abs(Math.floor(foe.t * 3.2)) % 3;
  const bob = Math.sin(foe.t * 2.1) * 3;
  reflect(ctx, HERON_FRAMES[frame], foe.x, foe.y + foe.radius * 1.5, { flipX: face < 0, scale: foe.radius / 54, alpha: 0.08 });
  shadow(ctx, foe.x, foe.y + 8, foe.radius * 1.25);
  blit(ctx, HERON_FRAMES[frame], foe.x, foe.y + bob, { flipX: face < 0, scale: foe.radius / 54 });
  if (foe.flash > 0) blit(ctx, HERON_WHITE[frame], foe.x, foe.y + bob, { flipX: face < 0, alpha: foe.flash * 0.75, scale: foe.radius / 54 });
  if (foe.phase2) {
    // The second phase shows: a pulsing blood-red ring and a hunter's eye.
    const pulse = 1 + Math.sin(foe.t * 6) * 0.05;
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 82, 82, 0.55)';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(foe.x, foe.y + bob, (foe.radius + 12) * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    const hx = foe.x + face * 86;
    const hy = foe.y + bob - 78;
    const glow = ctx.createRadialGradient(hx, hy, 1, hx, hy, 13);
    glow.addColorStop(0, 'rgba(255, 60, 60, 0.85)');
    glow.addColorStop(1, 'rgba(255, 60, 60, 0)');
    circle(ctx, hx, hy, 13, glow);
    circle(ctx, hx, hy, 3.2, '#ff1744');
  }
}

function drawFoe(ctx, foe, state) {
  // Elites wear a slowly turning gilded ring.
  if (foe.elite) {
    ctx.save();
    ctx.translate(foe.x, foe.y);
    ctx.rotate(foe.t * 0.9);
    ctx.strokeStyle = 'rgba(255, 213, 79, 0.85)';
    ctx.lineWidth = 2.4;
    ctx.setLineDash([10, 7]);
    ctx.beginPath();
    ctx.arc(0, 0, foe.radius + 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    ellipse(ctx, foe.x, foe.y + foe.radius * 0.8, foe.radius * 1.15, foe.radius * 0.4, 0, 'rgba(255, 183, 0, 0.10)');
  }
  switch (foe.kind) {
    case KIND_GNAT: drawGnat(ctx, foe); break;
    case KIND_DARTER: drawDarter(ctx, foe); break;
    case KIND_MOTH: drawMoth(ctx, foe); break;
    case KIND_BEETLE: drawBeetle(ctx, foe); break;
    case KIND_SNAIL: drawSnail(ctx, foe); break;
    case KIND_HERON: drawHeron(ctx, foe, state); break;
    default: break;
  }
  if (foe.hp < foe.maxHp && foe.kind !== KIND_HERON) {
    const w = Math.max(30, foe.radius * 2);
    const x = foe.x - w / 2;
    const y = foe.y - foe.radius - 15;
    rr(ctx, x, y, w, 6, 3);
    ctx.fillStyle = 'rgba(3, 20, 26, 0.62)';
    ctx.fill();
    const frac = clamp(foe.hp / foe.maxHp, 0, 1);
    if (frac > 0) {
      rr(ctx, x + 1, y + 1, (w - 2) * frac, 4, 2);
      ctx.fillStyle = frac > 0.35 ? '#69f0ae' : '#ff8a65';
      ctx.fill();
    }
  }
}

function drawPickup(ctx, p, time) {
  if (p.kind === PICKUP_FIREFLY) {
    const pulse = 0.85 + Math.sin(p.t * 2.4) * 0.15;
    blit(ctx, FIREFLY_SPRITE, p.x, p.y + Math.sin(p.t * 1.7) * 2, { scale: pulse * (p.radius / 6) * 0.9 });
  } else if (p.kind === PICKUP_HEART) {
    shadow(ctx, p.x, p.y + 4, 11);
    blit(ctx, HEART_SPRITE, p.x, p.y + Math.sin(p.t * 2) * 2.4, { scale: 1.05 });
  } else if (p.kind === PICKUP_DRAGONFLY) {
    const frame = Math.abs(Math.floor(time * 14)) % 2;
    shadow(ctx, p.x, p.y + 6, 13);
    blit(ctx, DRAGONFLY_FRAMES[frame], p.x, p.y + Math.sin(time * 3.1) * 2.5, { scale: 0.95 });
  }
}

/* ---------------- the composed world ---------------- */

export function drawWorld(ctx, state) {
  drawPond(ctx, state);
  for (const p of state.pickups) drawPickup(ctx, p, state.time);
  for (const foe of state.foes) drawFoe(ctx, foe, state);

  // Bubbles: stamped spheres with a glassy rim.
  for (const b of state.bubbles) {
    blit(ctx, BUBBLE_SPRITE, b.x, b.y, { scale: b.radius / 21, alpha: 0.92 });
  }
  // Enemy shots: spores and the heron's feathers.
  for (const s of state.spores) {
    if (s.feather) {
      blit(ctx, FEATHER_SPRITE, s.x, s.y, { rot: Math.atan2(s.vy, s.vx), scale: 1.05 });
    } else {
      blit(ctx, SPORE_SPRITE, s.x, s.y, { scale: s.radius / 7.6 });
    }
  }

  if (state.phase !== PHASE_LOST) {
    const p = state.player;
    // A soft ripple ring breathes under the swimming frog.
    const ripple = (state.time * 0.7) % 1;
    ctx.save();
    ctx.globalAlpha = 0.14 * (1 - ripple);
    ctx.strokeStyle = '#cfeffb';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + p.radius * 0.7, p.radius * (0.9 + ripple * 0.9), p.radius * 0.4 * (0.9 + ripple * 0.9), 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    const blink = p.hurtT > 0 && Math.floor(state.time * 18) % 2 === 0;
    ctx.save();
    if (p.dashT > 0) {
      // A motion stretch along the dash.
      ctx.translate(p.x, p.y);
      ctx.rotate(p.aimAngle + Math.PI / 2);
      ctx.scale(0.88, 1.14);
      ctx.translate(-p.x, -p.y);
    }
    drawFrog(ctx, p.x, p.y, p.radius, p.aimAngle, p.walkPhase, p.hurtT > 0.3, blink ? 0.45 : 1);
    ctx.restore();
  }
  drawEffects(ctx, state.fx);

  if (!vignette) vignette = makeVignette(FIELD.width, FIELD.height);
  ctx.drawImage(vignette, 0, 0);

  // The finale is a storm: when the Heron is on the pond the light drops,
  // rain stitches the water, and now and then the sky flickers.
  if (state.boss || state.wave === TOTAL_WAVES) {
    ctx.fillStyle = 'rgba(5, 16, 28, 0.26)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    // Rain streaks.
    ctx.save();
    ctx.strokeStyle = 'rgba(190, 230, 245, 0.34)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i < 90; i += 1) {
      const rx = ((i * 149.7 + state.time * 130) % (FIELD.width + 60)) - 30;
      const ry = ((i * 83.3 + state.time * 760 * (0.85 + (i % 4) * 0.09)) % (FIELD.height + 40)) - 20;
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - 4.5, ry + 17);
    }
    ctx.stroke();
    ctx.restore();
    // Rain rings where drops strike.
    ctx.save();
    ctx.strokeStyle = '#bfeaf2';
    for (let i = 0; i < 16; i += 1) {
      const phase = (state.time * 0.9 + i * 0.618) % 1;
      const rx = (i * 263.4) % FIELD.width;
      const ry = (i * 179.9) % FIELD.height;
      ctx.globalAlpha = 0.28 * (1 - phase);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(rx, ry, 3 + phase * 13, (3 + phase * 13) * 0.42, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    // Lightning: a brief brightening every few seconds.
    const cycle = state.time % 7.3;
    if (cycle < 0.1) {
      ctx.fillStyle = `rgba(210, 235, 255, ${0.13 * (1 - cycle / 0.1)})`;
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    }
  }

  // Foreground reeds, near-black silhouettes that frame the pond's corners.
  blit(ctx, REED_SHADOW, 8, FIELD.height - 26, { scale: 1.02, alpha: 0.34 });
  blit(ctx, REED_SHADOW, FIELD.width - 10, FIELD.height - 22, { scale: 1.18, alpha: 0.38, flipX: true });
  blit(ctx, REED_SHADOW, FIELD.width - 96, FIELD.height - 8, { scale: 0.8, alpha: 0.28 });
  blit(ctx, REED_SHADOW, 14, 64, { rot: Math.PI, scale: 0.95, alpha: 0.3 });
  blit(ctx, REED_SHADOW, FIELD.width - 20, 56, { rot: Math.PI, scale: 1.05, alpha: 0.32, flipX: true });
}

/* ---------------- HUD and screens ---------------- */

function meter(ctx, x, y, w, h, frac, stops, { back = 'rgba(3, 20, 26, 0.66)' } = {}) {
  rr(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = back;
  ctx.fill();
  const f = clamp(frac, 0, 1);
  if (f > 0) {
    const g = ctx.createLinearGradient(x, y, x, y + h);
    for (const [at, color] of stops) g.addColorStop(at, color);
    rr(ctx, x + 1.5, y + 1.5, Math.max(h - 3, (w - 3) * f), h - 3, (h - 3) / 2);
    ctx.fillStyle = g;
    ctx.fill();
    // Glossy shine on the upper half of the fill.
    rr(ctx, x + 3, y + 2.5, Math.max(2, (w - 6) * f), (h - 5) / 2, (h - 5) / 4);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.fill();
  }
  rr(ctx, x, y, w, h, h / 2);
  ctx.strokeStyle = 'rgba(190, 235, 245, 0.28)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

export function drawHud(ctx, state, { muted = false, banner = true } = {}) {
  // Left status panel: heart, health, fireflies, level, dash.
  panel(ctx, 16, 14, 292, 104, 14);
  blit(ctx, HEART_SPRITE, 40, 38, { scale: 0.62 });
  meter(ctx, 58, 29, 192, 17, state.health / state.stats.maxHealth,
    state.health > 30 ? [[0, '#a5f2c0'], [0.5, '#69f0ae'], [1, '#2fbf71']] : [[0, '#ffb3b3'], [0.5, '#ff6b6b'], [1, '#d32f2f']]);
  text(ctx, `${Math.ceil(state.health)} / ${state.stats.maxHealth}`, 286, 38, { size: 13, align: 'right', weight: 800 });
  blit(ctx, FIREFLY_SPRITE, 40, 66, { scale: 0.5 });
  meter(ctx, 58, 59, 176, 12, state.xp / state.xpNeed, [[0, '#fff3b0'], [0.55, '#ffe066'], [1, '#f9a825']]);
  // Level badge.
  circle(ctx, 264, 65, 15, '#0b3542');
  ctx.save();
  ctx.beginPath();
  ctx.arc(264, 65, 15, 0, Math.PI * 2);
  ctx.strokeStyle = COLORS.gold;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
  text(ctx, `${state.level}`, 264, 66, { size: 14, align: 'center', weight: 800, color: COLORS.gold });
  // Dash pips and regen note.
  const dashReady = state.player.dashCooldownT <= 0;
  text(ctx, 'DASH', 30, 99, { size: 10.5, weight: 800, color: dashReady ? '#9be7ff' : COLORS.textDim, spacing: 1.6 });
  meter(ctx, 76, 93, 118, 10, dashReady ? 1 : 1 - state.player.dashCooldownT / state.stats.dashCooldown, [[0, '#b3ecff'], [1, '#38b6e8']]);
  if (state.stats.regen > 0) text(ctx, `regen ${state.stats.regen.toFixed(1)}/s`, 206, 99, { size: 11.5, color: '#a5d6a7' });
  if (muted) text(ctx, 'muted', 286, 99, { size: 11, align: 'right', color: COLORS.textDim });

  // Centre wave plaque.
  const plaqueW = 252;
  panel(ctx, FIELD.width / 2 - plaqueW / 2, 14, plaqueW, 56, 13);
  shadowedText(ctx, state.wave === 0 ? 'PONDLIGHT' : state.wave > TOTAL_WAVES ? `WAVE ${state.wave} · ENDLESS` : `WAVE ${state.wave} / ${TOTAL_WAVES}`, FIELD.width / 2, 36, { size: 19, align: 'center', weight: 800, font: DISPLAY, spacing: 2.5 });
  if (state.phase === PHASE_FIGHT) {
    const left = state.foes.length + state.spawnQueue.length;
    text(ctx, state.boss ? 'the Heron remains' : `${left} pest${left === 1 ? '' : 's'} to go`, FIELD.width / 2, 58, { size: 12, align: 'center', color: COLORS.textDim });
  }

  // Right score panel.
  panel(ctx, FIELD.width - 252, 14, 236, 56, 13);
  circle(ctx, FIELD.width - 224, 42, 10.5, '#f9a825');
  circle(ctx, FIELD.width - 224, 42, 8, COLORS.gold);
  text(ctx, '★', FIELD.width - 224, 43.5, { size: 12.5, align: 'center', weight: 800, color: '#8d5a00' });
  shadowedText(ctx, `${state.score}`, FIELD.width - 32, 37, { size: 24, align: 'right', weight: 800, color: COLORS.gold, font: DISPLAY });
  if (state.combo >= 6) {
    const mult = Math.min(8, 1 + Math.floor(state.combo / 6));
    text(ctx, `combo ×${mult} · ${state.combo} chain`, FIELD.width - 32, 60, { size: 12, align: 'right', color: COLORS.firefly, weight: 700 });
  } else {
    text(ctx, `best combo ${state.bestCombo}`, FIELD.width - 32, 60, { size: 12, align: 'right', color: COLORS.textDim });
  }

  // Bottom hint chips.
  const hints = [['WASD', 'swim'], ['MOUSE', 'aim + hold'], ['SHIFT', 'dash'], ['P', 'pause'], ['M', 'mute']];
  let hx = 18;
  for (const [key, label] of hints) {
    const w = chip(ctx, hx, FIELD.height - 24, key, { size: 11 });
    text(ctx, label, hx + w + 7, FIELD.height - 23.5, { size: 11.5, color: COLORS.textDim });
    ctx.save();
    ctx.font = `400 11.5px ${BODY}`;
    hx += w + 14 + ctx.measureText(label).width + 16;
    ctx.restore();
  }

  // The heron's health bar, bottom centre: ornate, feather-capped.
  if (state.boss) {
    const w = 560;
    const x = FIELD.width / 2 - w / 2;
    const y = FIELD.height - 44;
    blit(ctx, FEATHER_SPRITE, x - 26, y + 2, { rot: -0.5, scale: 1.15 });
    blit(ctx, FEATHER_SPRITE, x + w + 26, y + 2, { rot: Math.PI + 0.5, scale: 1.15 });
    meter(ctx, x, y, w, 15, state.boss.hp / state.boss.maxHp, [[0, '#ffcdd2'], [0.45, '#ef5350'], [1, '#b71c1c']]);
    shadowedText(ctx, 'T H E   S H A D O W   H E R O N', FIELD.width / 2, y - 17, { size: 13.5, align: 'center', weight: 800, color: '#ffcdd2', font: DISPLAY });
  }

  // Wave banners.
  if (!banner) {
    // suppressed under full-screen overlays
  } else if (state.phase === PHASE_BREAK && state.phaseT > 0.2) {
    const next = state.wave + 1;
    if (state.wave >= 1) bannerText(ctx, `Wave ${state.wave} clear!`, 148, '#a5f2c0', 33);
    bannerText(ctx, next === TOTAL_WAVES ? 'Something huge stirs…' : `Wave ${next} incoming`, 190, COLORS.text, 19);
  } else if (state.phase === PHASE_FIGHT && state.waveT < 1.6 && state.wave >= 1) {
    const isBossWave = state.wave === TOTAL_WAVES || (state.endless && state.wave % 5 === 0);
    const label = isBossWave ? 'THE SHADOW HERON' : `WAVE ${state.wave}`;
    bannerText(ctx, label, 148, isBossWave ? '#ffcdd2' : COLORS.text, 36, clamp(1.6 - state.waveT, 0, 1));
  }
}

function bannerText(ctx, value, y, color, size, alpha = 1) {
  const cx = FIELD.width / 2;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = 'rgba(190, 235, 245, 0.5)';
  ctx.lineWidth = 1.4;
  const wText = size * value.length * 0.36;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + side * (wText + 26), y);
    ctx.lineTo(cx + side * (wText + 92), y);
    ctx.stroke();
    ctx.save();
    ctx.translate(cx + side * (wText + 104), y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = COLORS.gold;
    ctx.fillRect(-4.4, -4.4, 8.8, 8.8);
    ctx.restore();
  }
  ctx.restore();
  shadowedText(ctx, value, cx, y, { size, align: 'center', weight: 800, color, font: DISPLAY, spacing: 2, alpha });
}

function overlay(ctx, alpha = 0.62) {
  const g = ctx.createLinearGradient(0, 0, 0, FIELD.height);
  g.addColorStop(0, `rgba(4, 22, 30, ${alpha})`);
  g.addColorStop(1, `rgba(2, 12, 18, ${alpha + 0.08})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
}

/** A decorative double frame for the title screen. */
function titleFrame(ctx) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 224, 102, 0.4)';
  ctx.lineWidth = 2;
  rr(ctx, 20, 20, FIELD.width - 40, FIELD.height - 40, 18);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(160, 225, 240, 0.22)';
  ctx.lineWidth = 1;
  rr(ctx, 30, 30, FIELD.width - 60, FIELD.height - 60, 13);
  ctx.stroke();
  for (const [cx, cy, rot] of [[52, 52, 0.6], [FIELD.width - 52, 52, 2.2], [52, FIELD.height - 52, -0.6], [FIELD.width - 52, FIELD.height - 52, -2.2]]) {
    blit(ctx, PAD_SPRITES[0], cx, cy, { rot, scale: 0.34, alpha: 0.9 });
  }
  ctx.restore();
}

export function drawTitle(ctx, state, best) {
  overlay(ctx, 0.42);
  titleFrame(ctx);
  const cx = FIELD.width / 2;
  // Fireflies orbit the hero frog.
  for (let i = 0; i < 7; i += 1) {
    const a = state.time * 0.55 + (i / 7) * Math.PI * 2;
    const fx = cx + Math.cos(a) * 128;
    const fy = 208 + Math.sin(a) * 40 + Math.sin(state.time * 2 + i) * 3;
    blit(ctx, FIREFLY_SPRITE, fx, fy, { scale: 0.55 + (i % 3) * 0.1 });
  }
  drawFrog(ctx, cx, 208 + Math.sin(state.time * 1.4) * 5, 56, -Math.PI / 2 + Math.sin(state.time * 0.7) * 0.24, state.time * 2.4, false);
  // The logo, in a gold-to-firefly gradient.
  ctx.save();
  ctx.shadowColor = 'rgba(2, 20, 28, 0.6)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;
  try { ctx.letterSpacing = '7px'; } catch { /* older engines */ }
  ctx.font = `800 78px ${DISPLAY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lg = ctx.createLinearGradient(0, 306, 0, 372);
  lg.addColorStop(0, '#fff6c9');
  lg.addColorStop(0.55, '#ffe066');
  lg.addColorStop(1, '#f5a623');
  ctx.fillStyle = lg;
  ctx.fillText('PONDLIGHT', cx, 340);
  ctx.restore();
  text(ctx, 'The milk frog, the fireflies, and the Shadow Heron', cx, 396, { size: 21, align: 'center', font: SERIF, italic: true, color: '#d8f3f8' });
  text(ctx, 'Blow bubbles to drive ten waves of pond pests off the lily pads.', cx, 448, { size: 16.5, align: 'center' });
  text(ctx, 'Gather fireflies, level up, choose your gifts — then face the Heron.', cx, 477, { size: 16.5, align: 'center' });
  // Control chips, centred as one row.
  const row = [['WASD / ←↑↓→', 'swim'], ['MOUSE', 'aim · hold to blow'], ['SHIFT / SPACE', 'dash'], ['P', 'pause'], ['M', 'mute']];
  ctx.save();
  ctx.font = `700 12px ${BODY}`;
  const widths = row.map(([k, l]) => ctx.measureText(k).width + 16 + 8 + ctx.measureText(l).width * 0.86 + 22);
  ctx.restore();
  let rx = cx - widths.reduce((a, b) => a + b, 0) / 2;
  row.forEach(([key, label], i) => {
    const w = chip(ctx, rx, 532, key, { size: 12 });
    text(ctx, label, rx + w + 7, 532.5, { size: 12.5, color: COLORS.textDim });
    rx += widths[i];
  });
  // The play pill, breathing gently.
  const pulse = 0.72 + Math.sin(state.time * 4) * 0.28;
  const pw = 342;
  const ph = 46;
  ctx.save();
  ctx.globalAlpha = 0.35 + pulse * 0.65;
  ctx.shadowColor = 'rgba(249, 168, 37, 0.55)';
  ctx.shadowBlur = 18;
  const pg = ctx.createLinearGradient(0, 584, 0, 584 + ph);
  pg.addColorStop(0, '#ffe082');
  pg.addColorStop(1, '#f9a825');
  rr(ctx, cx - pw / 2, 584, pw, ph, ph / 2);
  ctx.fillStyle = pg;
  ctx.fill();
  ctx.restore();
  text(ctx, 'Click or press Enter to play', cx, 608, { size: 19.5, align: 'center', weight: 800, color: '#4a2f00', font: DISPLAY, spacing: 0.6 });
  if (best > 0) {
    const bw = chip(ctx, cx, 664, `★  Best score  ${best}`, { size: 13, align: 'center' });
    void bw;
  }
}

/** A centred menu card shared by pause, game over and victory. */
function menuCard(ctx, w, h) {
  const x = FIELD.width / 2 - w / 2;
  const y = FIELD.height / 2 - h / 2;
  panel(ctx, x, y, w, h, 20, 0.92);
  return { x, y, w, h };
}

export function drawPaused(ctx, state) {
  overlay(ctx, 0.55);
  const card = menuCard(ctx, 520, 264);
  shadowedText(ctx, 'PAUSED', FIELD.width / 2, card.y + 66, { size: 44, align: 'center', weight: 800, font: DISPLAY, spacing: 5 });
  text(ctx, `Wave ${state.wave}  ·  Score ${state.score}  ·  Level ${state.level}`, FIELD.width / 2, card.y + 122, { size: 17, align: 'center', color: COLORS.textDim });
  text(ctx, 'The pond holds its breath.', FIELD.width / 2, card.y + 156, { size: 15, align: 'center', font: SERIF, italic: true, color: '#b9dde6' });
  const w = chip(ctx, FIELD.width / 2, card.y + 208, 'P / Esc — swim on', { size: 13.5, align: 'center' });
  void w;
}

function statsLines(ctx, state, y0) {
  const lines = [
    ['Score', `${state.score}`],
    ['Reached', `wave ${state.wave} of ${TOTAL_WAVES} · level ${state.level}`],
    ['Foes popped', `${state.kills}`],
    ['Best combo', `${state.bestCombo}`],
    ['Time', `${formatTime(state.time)} · ${state.shotsFired} bubbles blown`],
  ];
  lines.forEach(([label, value], i) => {
    const y = y0 + i * 31;
    text(ctx, label, FIELD.width / 2 - 168, y, { size: 15, color: COLORS.textDim, weight: 600 });
    text(ctx, value, FIELD.width / 2 + 168, y, { size: 15.5, align: 'right', weight: 700 });
    if (i < lines.length - 1) {
      ctx.save();
      ctx.strokeStyle = 'rgba(160, 225, 240, 0.14)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(FIELD.width / 2 - 168, y + 15.5);
      ctx.lineTo(FIELD.width / 2 + 168, y + 15.5);
      ctx.stroke();
      ctx.restore();
    }
  });
}

export function drawGameOver(ctx, state, best) {
  overlay(ctx, 0.66);
  const card = menuCard(ctx, 560, 430);
  shadowedText(ctx, 'THE POND GOES DARK', FIELD.width / 2, card.y + 58, { size: 37, align: 'center', weight: 800, color: '#ff9d9d', font: DISPLAY, spacing: 1.5 });
  text(ctx, state.endless ? `The endless pond claims its frog at wave ${state.wave}. It will be back.` : 'The fireflies scatter. The Heron keeps the lily pads — this time.', FIELD.width / 2, card.y + 98, { size: 15, align: 'center', font: SERIF, italic: true, color: '#b9dde6' });
  statsLines(ctx, state, card.y + 148);
  if (best > 0) text(ctx, `Best score ${best}`, FIELD.width / 2, card.y + 148 + 5 * 31 + 6, { size: 14, align: 'center', color: COLORS.gold });
  const w = chip(ctx, FIELD.width / 2, card.y + card.h - 34, 'R / click — try again', { size: 13.5, align: 'center' });
  void w;
}

export function drawVictory(ctx, state, best) {
  overlay(ctx, 0.5);
  const card = menuCard(ctx, 560, 470);
  drawFrog(ctx, FIELD.width / 2, card.y + 62, 34, -Math.PI / 2, state.time * 3, false);
  shadowedText(ctx, 'PONDLIGHT PREVAILS!', FIELD.width / 2, card.y + 128, { size: 38, align: 'center', weight: 800, color: COLORS.firefly, font: DISPLAY, spacing: 1.5 });
  text(ctx, 'The Shadow Heron flees over the reeds, and the fireflies come home.', FIELD.width / 2, card.y + 166, { size: 15, align: 'center', font: SERIF, italic: true, color: '#b9dde6' });
  statsLines(ctx, state, card.y + 212);
  if (best > 0) text(ctx, `Best score ${best}`, FIELD.width / 2, card.y + 212 + 5 * 31 + 6, { size: 14, align: 'center', color: COLORS.gold });
  const cy = card.y + card.h - 34;
  ctx.save();
  ctx.font = `700 13.5px ${BODY}`;
  const w1 = ctx.measureText('Enter — keep swimming · endless').width + 16;
  const w2 = ctx.measureText('R — new run').width + 16;
  ctx.restore();
  const total = w1 + 14 + w2;
  chip(ctx, FIELD.width / 2 - total / 2, cy, 'Enter — keep swimming · endless', { size: 13.5, align: 'left' });
  chip(ctx, FIELD.width / 2 - total / 2 + w1 + 14, cy, 'R — new run', { size: 13.5, align: 'left' });
}

/** The three upgrade cards' rectangles, shared by drawing and clicking. */
export function cardRect(index) {
  const w = 300;
  const h = 210;
  const gap = 28;
  const total = w * 3 + gap * 2;
  return { x: (FIELD.width - total) / 2 + index * (w + gap), y: 268, w, h };
}

const ICON_STYLE = {
  burst: { accent: '#81d4fa', draw: (ctx, x, y, s) => { for (let i = 0; i < 7; i += 1) { const a = (i / 7) * Math.PI * 2; blit(ctx, BUBBLE_SPRITE, x + Math.cos(a) * s * 0.52, y + Math.sin(a) * s * 0.52, { scale: 0.31 }); } blit(ctx, BUBBLE_SPRITE, x, y, { scale: 0.52 }); } },
  wind: { accent: '#80d8ff', draw: (ctx, x, y, s) => { ctx.strokeStyle = '#aee9ff'; ctx.lineCap = 'round'; for (const [dy, len, lw] of [[-0.34, 0.62, 4.4], [0, 0.78, 5.2], [0.34, 0.62, 4.4]]) { ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(x - s * len, y + dy * s); ctx.quadraticCurveTo(x - s * 0.1, y + dy * s - s * 0.3, x + s * len * 0.72, y + dy * s - s * 0.12); ctx.stroke(); ctx.beginPath(); ctx.arc(x + s * len * 0.78, y + dy * s - s * 0.1, s * 0.1, 0, Math.PI * 2); ctx.stroke(); } } },
  twin: { accent: '#81d4fa', draw: (ctx, x, y, s) => { blit(ctx, BUBBLE_SPRITE, x - s * 0.3, y + s * 0.08, { scale: 0.57 }); blit(ctx, BUBBLE_SPRITE, x + s * 0.3, y - s * 0.08, { scale: 0.57 }); } },
  spear: { accent: '#ffe082', draw: (ctx, x, y, s) => { blit(ctx, BUBBLE_SPRITE, x - s * 0.18, y + s * 0.18, { scale: 0.43 }); ctx.strokeStyle = '#ffe082'; ctx.lineWidth = 4.6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x - s * 0.52, y + s * 0.52); ctx.lineTo(x + s * 0.4, y - s * 0.4); ctx.stroke(); ctx.fillStyle = '#fff3c4'; ctx.beginPath(); ctx.moveTo(x + s * 0.66, y - s * 0.66); ctx.lineTo(x + s * 0.2, y - s * 0.52); ctx.lineTo(x + s * 0.52, y - s * 0.2); ctx.closePath(); ctx.fill(); } },
  foot: { accent: '#ffd54f', draw: (ctx, x, y, s) => { ctx.save(); ctx.translate(x, y); ctx.rotate(-0.2); const g = ctx.createRadialGradient(-s * 0.1, -s * 0.14, s * 0.08, -s * 0.1, -s * 0.14, s * 0.58); g.addColorStop(0, '#ffec8b'); g.addColorStop(1, '#e8ac0a'); ellipse(ctx, 0, s * 0.1, s * 0.37, s * 0.5, 0, g); for (let i = -1; i <= 1; i += 1) { circle(ctx, i * s * 0.27, -s * 0.47, s * 0.13, '#f7c948'); circle(ctx, i * s * 0.27, -s * 0.52, s * 0.085, '#37474f'); } ctx.restore(); } },
  heart: { accent: '#ff8fa3', draw: (ctx, x, y, s) => { void s; blit(ctx, HEART_SPRITE, x, y, { scale: 0.95 }); } },
  magnet: { accent: '#ffab91', draw: (ctx, x, y, s) => { ctx.strokeStyle = '#ff7043'; ctx.lineWidth = s * 0.3; ctx.beginPath(); ctx.arc(x, y + s * 0.08, s * 0.4, Math.PI, 0); ctx.stroke(); for (const side of [-1, 1]) { ctx.fillStyle = '#ffe0d6'; ctx.fillRect(x + side * s * 0.4 - s * 0.15, y - s * 0.02, s * 0.3, s * 0.34); ctx.fillStyle = '#ff7043'; ctx.fillRect(x + side * s * 0.4 - s * 0.15, y + s * 0.32, s * 0.3, s * 0.26); } } },
  dash: { accent: '#80d8ff', draw: (ctx, x, y, s) => { for (let i = 0; i < 3; i += 1) { ctx.save(); ctx.globalAlpha = 0.35 + i * 0.32; ctx.fillStyle = '#9be7ff'; const ox = -s * 0.62 + i * s * 0.36; ctx.beginPath(); ctx.moveTo(ox, y - s * 0.42); ctx.lineTo(ox + s * 0.4, y); ctx.lineTo(ox, y + s * 0.42); ctx.lineTo(ox + s * 0.16, y); ctx.closePath(); ctx.fill(); ctx.restore(); } } },
  orb: { accent: '#b3e5fc', draw: (ctx, x, y, s) => { void s; blit(ctx, BUBBLE_SPRITE, x, y, { scale: 1.0 }); } },
  leaf: { accent: '#69f0ae', draw: (ctx, x, y, s) => { const g = ctx.createLinearGradient(x, y + s * 0.6, x, y - s * 0.6); g.addColorStop(0, '#2e9e57'); g.addColorStop(1, '#7bf0a8'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, y + s * 0.62); ctx.quadraticCurveTo(x - s * 0.66, y - s * 0.18, x, y - s * 0.62); ctx.quadraticCurveTo(x + s * 0.66, y - s * 0.18, x, y + s * 0.62); ctx.fill(); ctx.strokeStyle = 'rgba(10, 60, 30, 0.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y + s * 0.55); ctx.lineTo(x, y - s * 0.5); ctx.stroke(); } },
  bolt: { accent: '#ffd54f', draw: (ctx, x, y, s) => { const g = ctx.createLinearGradient(x, y - s * 0.65, x, y + s * 0.65); g.addColorStop(0, '#fff59d'); g.addColorStop(1, '#f9a825'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x + s * 0.14, y - s * 0.66); ctx.lineTo(x - s * 0.4, y + s * 0.1); ctx.lineTo(x - s * 0.03, y + s * 0.1); ctx.lineTo(x - s * 0.14, y + s * 0.66); ctx.lineTo(x + s * 0.4, y - s * 0.1); ctx.lineTo(x + s * 0.03, y - s * 0.1); ctx.closePath(); ctx.fill(); ctx.strokeStyle = 'rgba(146, 96, 0, 0.5)'; ctx.lineWidth = 1.6; ctx.stroke(); } },
  shield: { accent: '#90caf9', draw: (ctx, x, y, s) => { const g = ctx.createLinearGradient(x, y - s * 0.6, x, y + s * 0.68); g.addColorStop(0, '#bbdefb'); g.addColorStop(1, '#1e6fb8'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, y - s * 0.6); ctx.lineTo(x + s * 0.5, y - s * 0.36); ctx.lineTo(x + s * 0.5, y + s * 0.08); ctx.quadraticCurveTo(x + s * 0.5, y + s * 0.55, x, y + s * 0.68); ctx.quadraticCurveTo(x - s * 0.5, y + s * 0.55, x - s * 0.5, y + s * 0.08); ctx.lineTo(x - s * 0.5, y - s * 0.36); ctx.closePath(); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - s * 0.3, y - s * 0.28); ctx.lineTo(x - s * 0.3, y + s * 0.05); ctx.stroke(); } },
  splash: { accent: '#4dd0e1', draw: (ctx, x, y, s) => { blit(ctx, BUBBLE_SPRITE, x, y - s * 0.08, { scale: 0.66 }); ctx.fillStyle = '#aee9ff'; for (const [dx, dy, r] of [[-0.52, 0.3, 0.09], [0.52, 0.3, 0.09], [-0.34, 0.52, 0.07], [0.34, 0.52, 0.07], [0, 0.58, 0.08]]) { ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2); ctx.fill(); } } },
  seeker: { accent: '#ce93d8', draw: (ctx, x, y, s) => { ctx.strokeStyle = '#e1bee7'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x + s * 0.16, y - s * 0.1, s * 0.44, Math.PI * 0.7, Math.PI * 1.75); ctx.stroke(); ctx.fillStyle = '#f3c4fb'; ctx.beginPath(); ctx.moveTo(x + s * 0.52, y - s * 0.52); ctx.lineTo(x + s * 0.28, y - s * 0.3); ctx.lineTo(x + s * 0.58, y - s * 0.22); ctx.closePath(); ctx.fill(); blit(ctx, BUBBLE_SPRITE, x - s * 0.18, y + s * 0.22, { scale: 0.5 }); circle(ctx, x + s * 0.3, y + s * 0.34, s * 0.07, '#ef5350'); } },
  ripple: { accent: '#80d8ff', draw: (ctx, x, y, s) => { ctx.strokeStyle = '#aee9ff'; for (const [r, lw, a] of [[0.2, 4.4, 1], [0.42, 3.4, 0.75], [0.64, 2.6, 0.5]]) { ctx.save(); ctx.globalAlpha = a; ctx.lineWidth = lw; ctx.beginPath(); ctx.ellipse(x, y, s * r, s * r * 0.62, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); } circle(ctx, x, y, s * 0.07, '#e1f5fe'); } },
  greed: { accent: '#ffe082', draw: (ctx, x, y, s) => { blit(ctx, FIREFLY_SPRITE, x - s * 0.1, y + s * 0.05, { scale: 1.05 }); text(ctx, '+', x + s * 0.34, y - s * 0.3, { size: s * 0.62, align: 'center', weight: 800, color: '#ffd54f' }); } },
};

export function drawLevelUp(ctx, state, choices) {
  overlay(ctx, 0.6);
  const cx = FIELD.width / 2;
  for (const side of [-1, 1]) blit(ctx, FIREFLY_SPRITE, cx + side * 218, 158, { scale: 0.8 + Math.sin(state.time * 3 + side) * 0.08 });
  shadowedText(ctx, 'LEVEL UP!', cx, 158, { size: 42, align: 'center', weight: 800, color: COLORS.firefly, font: DISPLAY, spacing: 3 });
  text(ctx, 'The fireflies offer a gift — choose one', cx, 200, { size: 16.5, align: 'center', font: SERIF, italic: true, color: '#b9dde6' });
  choices.forEach((choice, i) => {
    const r = cardRect(i);
    const style = ICON_STYLE[choice.icon] ?? ICON_STYLE.orb;
    // Card body with an accent rim.
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 4;
    const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    g.addColorStop(0, 'rgba(19, 66, 82, 0.97)');
    g.addColorStop(1, 'rgba(8, 34, 45, 0.97)');
    rr(ctx, r.x, r.y, r.w, r.h, 16);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();
    rr(ctx, r.x, r.y, r.w, r.h, 16);
    ctx.strokeStyle = style.accent;
    ctx.lineWidth = 2;
    ctx.stroke();
    // Medallion.
    const mx = r.x + r.w / 2;
    const my = r.y + 56;
    circle(ctx, mx, my, 37, 'rgba(3, 20, 26, 0.55)');
    ctx.save();
    ctx.beginPath();
    ctx.arc(mx, my, 37, 0, Math.PI * 2);
    ctx.strokeStyle = style.accent;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.restore();
    const glow = ctx.createRadialGradient(mx, my, 4, mx, my, 40);
    glow.addColorStop(0, 'rgba(255, 255, 255, 0.14)');
    glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
    circle(ctx, mx, my, 40, glow);
    style.draw(ctx, mx, my, 46);
    text(ctx, choice.name, mx, r.y + 126, { size: 19.5, align: 'center', weight: 800, font: DISPLAY });
    text(ctx, choice.blurb, mx, r.y + 156, { size: 13.5, align: 'center', color: COLORS.textDim });
    // Key chip.
    circle(ctx, mx, r.y + 186, 12.5, 'rgba(3, 20, 26, 0.6)');
    ctx.save();
    ctx.beginPath();
    ctx.arc(mx, r.y + 186, 12.5, 0, Math.PI * 2);
    ctx.strokeStyle = COLORS.gold;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.restore();
    text(ctx, `${i + 1}`, mx, r.y + 187, { size: 13, align: 'center', weight: 800, color: COLORS.gold });
  });
  void state;
}
