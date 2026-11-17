// Everything Pondlight draws. The world is rendered in logical pond
// coordinates (1280×720); main.js scales the canvas transform, and this file
// only ever paints: pond, pads, pickups, foes, bubbles, the frog, effects,
// then the HUD and whichever full screen is up (title, pause, level-up,
// game over, victory). No drawing code changes any game state.

import { COLORS, FIELD } from './config.js';
import { TOTAL_WAVES } from './waves.js';
import { PHASE_BREAK, PHASE_FIGHT, PHASE_LOST, PHASE_WON } from './world.js';
import { KIND_BEETLE, KIND_DARTER, KIND_GNAT, KIND_HERON, KIND_MOTH } from './enemies.js';
import { PICKUP_DRAGONFLY, PICKUP_FIREFLY, PICKUP_HEART } from './pickups.js';
import { drawEffects } from './particles.js';
import { clamp } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSE = 'pause';
export const SCREEN_LEVELUP = 'levelup';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

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

function text(ctx, value, x, y, { size = 16, color = COLORS.text, align = 'left', weight = 600, alpha = 1 } = {}) {
  ctx.globalAlpha = alpha;
  ctx.font = `${weight} ${size}px system-ui, 'Segoe UI', sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(value, x, y);
  ctx.globalAlpha = 1;
}

export function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/* ---------------- the pond ---------------- */

function drawPond(ctx, state) {
  const g = ctx.createRadialGradient(FIELD.width / 2, FIELD.height / 2, 120, FIELD.width / 2, FIELD.height / 2, 780);
  g.addColorStop(0, COLORS.waterLight);
  g.addColorStop(0.55, COLORS.waterMid);
  g.addColorStop(1, COLORS.waterDeep);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);

  // Light shafts drifting slowly across the water.
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 4; i += 1) {
    const x = ((state.time * 12 + i * 340) % (FIELD.width + 300)) - 150;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 130, 0);
    ctx.lineTo(x + 40, FIELD.height);
    ctx.lineTo(x - 90, FIELD.height);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Lily pads, with a notch and the odd pink flower.
  for (const pad of state.decor.pads) {
    const bob = Math.sin(state.time * 0.7 + pad.drift) * 2;
    ctx.save();
    ctx.translate(pad.x, pad.y + bob);
    ctx.rotate(pad.notch);
    ctx.fillStyle = COLORS.lily;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, pad.r, 0.35, Math.PI * 2 - 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = COLORS.lilyDark;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, pad.r * 0.72, 0.5, Math.PI * 1.7);
    ctx.stroke();
    ctx.restore();
    if (pad.flower) {
      const fx = pad.x + pad.r * 0.4;
      const fy = pad.y + bob - pad.r * 0.3;
      for (let petal = 0; petal < 5; petal += 1) {
        const a = (petal / 5) * Math.PI * 2;
        ellipse(ctx, fx + Math.cos(a) * 6, fy + Math.sin(a) * 6, 6, 4, a, COLORS.lilyFlower);
      }
      circle(ctx, fx, fy, 3.4, COLORS.gold);
    }
  }

  // Reeds along the top and bottom edges.
  ctx.strokeStyle = COLORS.lilyDark;
  ctx.lineWidth = 3;
  for (const reed of state.decor.reeds) {
    const sway = Math.sin(state.time * 1.2 + reed.x * 0.05) * 3;
    ctx.beginPath();
    ctx.moveTo(reed.x, reed.y);
    const tipY = reed.top ? reed.y + reed.h : reed.y - reed.h;
    ctx.quadraticCurveTo(reed.x + reed.lean * 10, (reed.y + tipY) / 2, reed.x + sway + reed.lean * 16, tipY);
    ctx.stroke();
  }
}

/* ---------------- creatures ---------------- */

export function drawFrog(ctx, x, y, radius, aimAngle, walkPhase, hurt, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  // Feet with dark toe tips, stepping with the walk phase.
  const step = Math.sin(walkPhase) * radius * 0.22;
  for (const side of [-1, 1]) {
    ellipse(ctx, side * radius * 0.95, radius * 0.62 + (side > 0 ? step : -step), radius * 0.34, radius * 0.22, side * 0.5, COLORS.frogSkin);
    circle(ctx, side * radius * 1.18, radius * 0.72 + (side > 0 ? step : -step), radius * 0.11, COLORS.frogToe);
    circle(ctx, side * radius * 1.02, radius * 0.86 + (side > 0 ? step : -step), radius * 0.09, COLORS.frogToe);
  }
  // Body and cream belly.
  circle(ctx, 0, 0, radius, COLORS.frogSkin);
  ellipse(ctx, 0, radius * 0.28, radius * 0.66, radius * 0.52, 0, COLORS.frogBelly);
  // Eye stalks turn toward the aim.
  const ex = Math.cos(aimAngle) * radius * 0.16;
  const ey = Math.sin(aimAngle) * radius * 0.16;
  for (const side of [-1, 1]) {
    const bx = side * radius * 0.44 + ex;
    const by = -radius * 0.52 + ey;
    circle(ctx, bx, by, radius * 0.3, COLORS.frogSkin);
    circle(ctx, bx + ex * 0.7, by + ey * 0.7, radius * 0.19, COLORS.frogEye);
    circle(ctx, bx + ex * 0.7, by + ey * 0.7, radius * 0.1, '#0b1c10');
    circle(ctx, bx + ex * 0.7 + 2, by + ey * 0.7 - 2, radius * 0.045, '#ffffff');
  }
  // A gentle smile, and a blush of hurt when freshly hit.
  ctx.strokeStyle = '#8a6d1f';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(ex * 0.5, radius * 0.08, radius * 0.3, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();
  if (hurt) {
    ctx.globalAlpha = alpha * 0.35;
    circle(ctx, 0, 0, radius, COLORS.danger);
    ctx.globalAlpha = alpha;
  }
  ctx.restore();
}

function drawGnat(ctx, foe) {
  const flap = Math.sin(foe.t * 42) * 0.5;
  ctx.save();
  ctx.translate(foe.x, foe.y);
  ctx.globalAlpha = 0.55;
  ellipse(ctx, -8, -9 - flap * 4, 10, 4.5, -0.6, '#ffffff');
  ellipse(ctx, 8, -9 + flap * 4, 10, 4.5, 0.6, '#ffffff');
  ctx.globalAlpha = 1;
  ellipse(ctx, 0, 0, foe.radius, foe.radius * 0.8, 0, COLORS.gnat);
  circle(ctx, -5, -3, 3, '#3e2723');
  circle(ctx, 5, -3, 3, '#3e2723');
  ctx.restore();
}

function drawDarter(ctx, foe) {
  const angle = Math.atan2(foe.vy, foe.vx);
  ctx.save();
  ctx.translate(foe.x, foe.y);
  if (foe.state === 'aim') {
    ctx.save();
    ctx.rotate(foe.aimAngle ?? angle);
    ctx.strokeStyle = 'rgba(255,82,82,0.65)';
    ctx.setLineDash([8, 8]);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(190, 0);
    ctx.stroke();
    ctx.restore();
  }
  ctx.rotate(angle);
  ctx.fillStyle = COLORS.darter;
  ctx.beginPath();
  ctx.moveTo(foe.radius + 4, 0);
  ctx.lineTo(-foe.radius, -foe.radius * 0.72);
  ctx.lineTo(-foe.radius * 0.55, 0);
  ctx.lineTo(-foe.radius, foe.radius * 0.72);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#0288d1';
  ctx.beginPath();
  ctx.moveTo(-foe.radius * 0.7, 0);
  ctx.lineTo(-foe.radius * 1.3, -foe.radius * 0.6);
  ctx.lineTo(-foe.radius * 1.3, foe.radius * 0.6);
  ctx.closePath();
  ctx.fill();
  circle(ctx, foe.radius * 0.35, -3, 2.6, '#01579b');
  ctx.restore();
}

function drawMoth(ctx, foe) {
  const flap = Math.sin(foe.t * 9) * 0.45;
  ctx.save();
  ctx.translate(foe.x, foe.y);
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.rotate(side * (0.5 + flap * side));
    ellipse(ctx, side * foe.radius * 1.05, 0, foe.radius * 0.95, foe.radius * 0.5, side * 0.4, COLORS.moth);
    ctx.restore();
    circle(ctx, side * foe.radius * 1.2, -2, 3, '#7e57c2');
  }
  ellipse(ctx, 0, 0, foe.radius * 0.55, foe.radius * 0.8, 0, '#6a4fa3');
  circle(ctx, -4, -6, 3, '#ede7f6');
  circle(ctx, 4, -6, 3, '#ede7f6');
  ctx.restore();
}

function drawBeetle(ctx, foe) {
  ctx.save();
  ctx.translate(foe.x, foe.y);
  ctx.strokeStyle = '#3e2723';
  ctx.lineWidth = 3;
  for (const side of [-1, 1]) {
    for (let leg = 0; leg < 3; leg += 1) {
      const lx = -foe.radius * 0.5 + leg * foe.radius * 0.5;
      const wiggle = Math.sin(foe.t * 7 + leg * 2) * 3 * side;
      ctx.beginPath();
      ctx.moveTo(lx, side * foe.radius * 0.6);
      ctx.lineTo(lx + wiggle, side * foe.radius * 1.05);
      ctx.stroke();
    }
  }
  circle(ctx, 0, 0, foe.radius, COLORS.beetle);
  ctx.strokeStyle = '#795548';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, -foe.radius);
  ctx.lineTo(0, foe.radius);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, foe.radius * 0.62, Math.PI * 0.2, Math.PI * 0.8);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, foe.radius * 0.62, Math.PI * 1.2, Math.PI * 1.8);
  ctx.stroke();
  circle(ctx, -6, -foe.radius * 0.62, 3, '#ffccbc');
  circle(ctx, 6, -foe.radius * 0.62, 3, '#ffccbc');
  ctx.restore();
}

function drawHeron(ctx, foe, state) {
  ctx.save();
  ctx.translate(foe.x, foe.y);
  if (foe.state === 'warn' && foe.swoopFrom && foe.swoopTo) {
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = 'rgba(255,82,82,0.55)';
    ctx.setLineDash([14, 10]);
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(foe.swoopFrom.x, foe.swoopFrom.y);
    const dx = foe.swoopTo.x - foe.swoopFrom.x;
    const dy = foe.swoopTo.y - foe.swoopFrom.y;
    ctx.lineTo(foe.swoopFrom.x + dx * 2.4, foe.swoopFrom.y + dy * 2.4);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    ctx.save();
    ctx.translate(foe.x, foe.y);
  }
  const face = state.player.x >= foe.x ? 1 : -1;
  const wingFlap = Math.sin(foe.t * 6) * 0.25;
  // Legs.
  ctx.strokeStyle = '#37474f';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-10, foe.radius * 0.6);
  ctx.lineTo(-14, foe.radius * 1.25);
  ctx.moveTo(12, foe.radius * 0.6);
  ctx.lineTo(18, foe.radius * 1.25);
  ctx.stroke();
  // Far wing, body, near wing.
  ctx.save();
  ctx.rotate(-0.5 - wingFlap);
  ellipse(ctx, -foe.radius * 0.5, -foe.radius * 0.3, foe.radius * 0.85, foe.radius * 0.34, 0, '#37474f');
  ctx.restore();
  ellipse(ctx, 0, 0, foe.radius, foe.radius * 0.78, 0, COLORS.heron);
  ctx.save();
  ctx.rotate(0.35 + wingFlap);
  ellipse(ctx, -foe.radius * 0.3, -foe.radius * 0.15, foe.radius * 0.9, foe.radius * 0.36, 0, '#546e7a');
  ctx.restore();
  // Neck and head, beak toward the frog.
  ctx.strokeStyle = COLORS.heron;
  ctx.lineWidth = 13;
  ctx.beginPath();
  ctx.moveTo(face * foe.radius * 0.55, -foe.radius * 0.3);
  ctx.quadraticCurveTo(face * foe.radius * 1.05, -foe.radius * 0.75, face * foe.radius * 1.2, -foe.radius * 0.42);
  ctx.stroke();
  const hx = face * foe.radius * 1.28;
  const hy = -foe.radius * 0.4;
  circle(ctx, hx, hy, 13, COLORS.heron);
  ctx.fillStyle = COLORS.heronBeak;
  ctx.beginPath();
  ctx.moveTo(hx + face * 8, hy - 4);
  ctx.lineTo(hx + face * 44, hy + 3);
  ctx.lineTo(hx + face * 8, hy + 8);
  ctx.closePath();
  ctx.fill();
  circle(ctx, hx + face * 3, hy - 3, 3.6, '#ff5252');
  ctx.restore();
}

function drawFoe(ctx, foe, state) {
  switch (foe.kind) {
    case KIND_GNAT: drawGnat(ctx, foe); break;
    case KIND_DARTER: drawDarter(ctx, foe); break;
    case KIND_MOTH: drawMoth(ctx, foe); break;
    case KIND_BEETLE: drawBeetle(ctx, foe); break;
    case KIND_HERON: drawHeron(ctx, foe, state); break;
    default: break;
  }
  if (foe.flash > 0) {
    ctx.save();
    ctx.globalAlpha = foe.flash * 0.65;
    circle(ctx, foe.x, foe.y, foe.radius, '#ffffff');
    ctx.restore();
  }
  if (foe.hp < foe.maxHp && foe.kind !== KIND_HERON) {
    const w = foe.radius * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(foe.x - w / 2, foe.y - foe.radius - 12, w, 5);
    ctx.fillStyle = '#69f0ae';
    ctx.fillRect(foe.x - w / 2, foe.y - foe.radius - 12, w * clamp(foe.hp / foe.maxHp, 0, 1), 5);
  }
}

function drawPickup(ctx, p, time) {
  if (p.kind === PICKUP_FIREFLY) {
    const pulse = 0.75 + Math.sin(p.t * 2.2) * 0.25;
    ctx.save();
    ctx.shadowColor = COLORS.firefly;
    ctx.shadowBlur = 14;
    circle(ctx, p.x, p.y, p.radius * pulse, COLORS.firefly);
    ctx.restore();
    circle(ctx, p.x - 1.5, p.y - 1.5, 1.8, '#fffde7');
  } else if (p.kind === PICKUP_HEART) {
    const bob = Math.sin(p.t * 2) * 2;
    ctx.save();
    ctx.translate(p.x, p.y + bob);
    ctx.fillStyle = COLORS.heart;
    ctx.beginPath();
    ctx.moveTo(0, 9);
    ctx.bezierCurveTo(-14, -2, -8, -12, 0, -5);
    ctx.bezierCurveTo(8, -12, 14, -2, 0, 9);
    ctx.fill();
    ctx.restore();
  } else if (p.kind === PICKUP_DRAGONFLY) {
    const flap = Math.sin(time * 30) * 0.4;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.globalAlpha = 0.6;
    ellipse(ctx, -9, -6 - flap * 3, 11, 4, -0.5, '#e1f5fe');
    ellipse(ctx, 9, -6 + flap * 3, 11, 4, 0.5, '#e1f5fe');
    ctx.globalAlpha = 1;
    ellipse(ctx, 0, 0, 4.5, 11, 0, '#29b6f6');
    circle(ctx, 0, -11, 4, '#0288d1');
    ctx.restore();
  }
}

/* ---------------- the composed world ---------------- */

export function drawWorld(ctx, state) {
  drawPond(ctx, state);
  for (const p of state.pickups) drawPickup(ctx, p, state.time);
  for (const foe of state.foes) drawFoe(ctx, foe, state);

  // Bubbles.
  for (const b of state.bubbles) {
    ctx.save();
    ctx.globalAlpha = 0.75;
    circle(ctx, b.x, b.y, b.radius, COLORS.bubble);
    ctx.globalAlpha = 1;
    circle(ctx, b.x - b.radius * 0.3, b.y - b.radius * 0.3, b.radius * 0.32, '#ffffff');
    ctx.restore();
  }
  // Enemy shots: spores are sickly green, feathers are grey barbs.
  for (const s of state.spores) {
    if (s.feather) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(Math.atan2(s.vy, s.vx));
      ellipse(ctx, 0, 0, 11, 3.6, 0, '#b0bec5');
      ctx.restore();
    } else {
      circle(ctx, s.x, s.y, s.radius, '#aed581');
      circle(ctx, s.x - 1.5, s.y - 1.5, 2, '#33691e');
    }
  }

  if (state.phase !== PHASE_LOST) {
    const blink = state.player.hurtT > 0 && Math.floor(state.time * 18) % 2 === 0;
    drawFrog(ctx, state.player.x, state.player.y, state.player.radius, state.player.aimAngle, state.player.walkPhase, state.player.hurtT > 0.3, blink ? 0.45 : 1);
  }
  drawEffects(ctx, state.fx);

  // A soft vignette to seat the scene.
  const v = ctx.createRadialGradient(FIELD.width / 2, FIELD.height / 2, 420, FIELD.width / 2, FIELD.height / 2, 860);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.32)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
}

/* ---------------- HUD and screens ---------------- */

function bar(ctx, x, y, w, h, frac, fill, back = 'rgba(0,0,0,0.5)') {
  ctx.fillStyle = back;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w * clamp(frac, 0, 1), h);
}

export function drawHud(ctx, state, { muted = false, banner = true } = {}) {
  // Health.
  bar(ctx, 22, 20, 250, 18, state.health / state.stats.maxHealth, state.health > 30 ? '#69f0ae' : COLORS.danger);
  text(ctx, `${Math.ceil(state.health)} / ${state.stats.maxHealth}`, 34, 30, { size: 14, weight: 700 });
  // Experience and level.
  bar(ctx, 22, 46, 250, 9, state.xp / state.xpNeed, COLORS.firefly);
  text(ctx, `Lv ${state.level}`, 34, 66, { size: 14, color: COLORS.firefly, weight: 700 });
  if (state.stats.regen > 0) text(ctx, `regen ${state.stats.regen.toFixed(1)}/s`, 92, 66, { size: 12, color: COLORS.textDim });
  // Dash readiness.
  const dashReady = state.player.dashCooldownT <= 0;
  bar(ctx, 22, 78, 110, 7, dashReady ? 1 : 1 - state.player.dashCooldownT / state.stats.dashCooldown, '#80d8ff');
  text(ctx, dashReady ? 'DASH READY' : 'dash…', 34, 96, { size: 11, color: dashReady ? '#80d8ff' : COLORS.textDim });

  // Wave and foes left, centre top.
  const left = state.foes.length + state.spawnQueue.length;
  text(ctx, state.wave === 0 ? 'PONDLIGHT' : `WAVE ${state.wave} / ${TOTAL_WAVES}`, FIELD.width / 2, 30, { size: 20, align: 'center', weight: 800 });
  if (state.phase === PHASE_FIGHT) text(ctx, `${left} to go`, FIELD.width / 2, 56, { size: 13, align: 'center', color: COLORS.textDim });

  // Score and combo, right top.
  text(ctx, `${state.score}`, FIELD.width - 22, 30, { size: 22, align: 'right', weight: 800, color: COLORS.gold });
  if (state.combo >= 6) {
    const mult = Math.min(8, 1 + Math.floor(state.combo / 6));
    text(ctx, `combo ×${mult} (${state.combo})`, FIELD.width - 22, 58, { size: 14, align: 'right', color: COLORS.firefly });
  }
  text(ctx, muted ? 'M muted' : 'M sound on', FIELD.width - 22, FIELD.height - 20, { size: 11, align: 'right', color: COLORS.textDim });
  text(ctx, 'WASD move · mouse aim · hold to blow bubbles · Shift dash · P pause', 22, FIELD.height - 20, { size: 11, color: COLORS.textDim });

  // The heron's health bar, bottom centre.
  if (state.boss) {
    const w = 560;
    bar(ctx, FIELD.width / 2 - w / 2, FIELD.height - 46, w, 13, state.boss.hp / state.boss.maxHp, '#ef5350');
    text(ctx, 'THE SHADOW HERON', FIELD.width / 2, FIELD.height - 58, { size: 13, align: 'center', weight: 800, color: '#ffcdd2' });
  }

  // Wave banners (suppressed under the full-screen overlays, whose own
  // titles sit in the same place).
  if (!banner) {
    // no banner
  } else if (state.phase === PHASE_BREAK && state.phaseT > 0.2) {
    const next = state.wave + 1;
    if (state.wave >= 1) {
      text(ctx, `Wave ${state.wave} clear!`, FIELD.width / 2, 150, { size: 34, align: 'center', weight: 800, color: '#a5d6a7' });
    }
    text(ctx, next === TOTAL_WAVES ? 'Something huge stirs…' : `Wave ${next} incoming`, FIELD.width / 2, 192, { size: 20, align: 'center', color: COLORS.text });
  } else if (state.phase === PHASE_FIGHT && state.waveT < 1.6 && state.wave >= 1) {
    const label = state.wave === TOTAL_WAVES ? 'THE SHADOW HERON' : `WAVE ${state.wave}`;
    text(ctx, label, FIELD.width / 2, 150, { size: 36, align: 'center', weight: 800, color: state.wave === TOTAL_WAVES ? '#ffcdd2' : COLORS.text, alpha: clamp(1.6 - state.waveT, 0, 1) });
  }
}

function overlay(ctx, alpha = 0.62) {
  ctx.fillStyle = `rgba(4, 18, 24, ${alpha})`;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
}

export function drawTitle(ctx, state, best) {
  overlay(ctx, 0.45);
  drawFrog(ctx, FIELD.width / 2, 238, 52, -Math.PI / 2 + Math.sin(state.time * 0.8) * 0.3, state.time * 2, false);
  text(ctx, 'PONDLIGHT', FIELD.width / 2, 348, { size: 76, align: 'center', weight: 800, color: COLORS.firefly });
  text(ctx, 'The milk frog, the fireflies, and the Shadow Heron', FIELD.width / 2, 398, { size: 20, align: 'center', color: COLORS.text });
  text(ctx, 'Blow bubbles to drive ten waves of pond pests off the lily pads.', FIELD.width / 2, 448, { size: 16, align: 'center' });
  text(ctx, 'Gather fireflies, level up, choose your gifts — then face the Heron.', FIELD.width / 2, 476, { size: 16, align: 'center' });
  text(ctx, 'WASD / arrows — swim      Mouse — aim, hold — blow bubbles', FIELD.width / 2, 528, { size: 15, align: 'center', color: COLORS.textDim });
  text(ctx, 'Shift / Space — dash      P — pause      M — mute', FIELD.width / 2, 554, { size: 15, align: 'center', color: COLORS.textDim });
  const pulse = 0.7 + Math.sin(state.time * 4) * 0.3;
  text(ctx, 'Click or press Enter to play', FIELD.width / 2, 612, { size: 22, align: 'center', weight: 800, color: COLORS.gold, alpha: pulse });
  if (best > 0) text(ctx, `Best score ${best}`, FIELD.width / 2, 652, { size: 14, align: 'center', color: COLORS.textDim });
}

export function drawPaused(ctx, state) {
  overlay(ctx, 0.55);
  text(ctx, 'PAUSED', FIELD.width / 2, 300, { size: 48, align: 'center', weight: 800 });
  text(ctx, `Wave ${state.wave} · Score ${state.score} · Level ${state.level}`, FIELD.width / 2, 352, { size: 18, align: 'center', color: COLORS.textDim });
  text(ctx, 'P or Esc to swim on', FIELD.width / 2, 402, { size: 16, align: 'center' });
}

function statsLines(ctx, state, best) {
  const lines = [
    `Score ${state.score}`,
    `Reached wave ${state.wave} of ${TOTAL_WAVES} · Level ${state.level}`,
    `Foes popped ${state.kills} · Best combo ${state.bestCombo}`,
    `Time ${formatTime(state.time)} · Bubbles blown ${state.shotsFired}`,
  ];
  lines.forEach((line, i) => text(ctx, line, FIELD.width / 2, 396 + i * 30, { size: 17, align: 'center', color: COLORS.textDim }));
  if (best > 0) text(ctx, `Best score ${best}`, FIELD.width / 2, 396 + lines.length * 30 + 8, { size: 15, align: 'center', color: COLORS.gold });
}

export function drawGameOver(ctx, state, best) {
  overlay(ctx, 0.66);
  text(ctx, 'THE POND GOES DARK', FIELD.width / 2, 300, { size: 46, align: 'center', weight: 800, color: '#ef9a9a' });
  text(ctx, 'The fireflies scatter. The Heron keeps the lily pads — this time.', FIELD.width / 2, 348, { size: 17, align: 'center' });
  statsLines(ctx, state, best);
  text(ctx, 'Press R or click to try again', FIELD.width / 2, 580, { size: 20, align: 'center', weight: 800, color: COLORS.gold });
}

export function drawVictory(ctx, state, best) {
  overlay(ctx, 0.55);
  drawFrog(ctx, FIELD.width / 2, 218, 44, -Math.PI / 2, state.time * 3, false);
  text(ctx, 'PONDLIGHT PREVAILS!', FIELD.width / 2, 308, { size: 48, align: 'center', weight: 800, color: COLORS.firefly });
  text(ctx, 'The Shadow Heron flees over the reeds, and the fireflies come home.', FIELD.width / 2, 354, { size: 17, align: 'center' });
  statsLines(ctx, state, best);
  text(ctx, 'Press R or click to play again', FIELD.width / 2, 580, { size: 20, align: 'center', weight: 800, color: COLORS.gold });
}

/** The three upgrade cards' rectangles, shared by drawing and clicking. */
export function cardRect(index) {
  const w = 300;
  const h = 210;
  const gap = 28;
  const total = w * 3 + gap * 2;
  return { x: (FIELD.width - total) / 2 + index * (w + gap), y: 268, w, h };
}

const ICON_DRAW = {
  burst: (ctx, x, y, s) => { for (let i = 0; i < 8; i += 1) { const a = (i / 8) * Math.PI * 2; circle(ctx, x + Math.cos(a) * s * 0.5, y + Math.sin(a) * s * 0.5, s * 0.14, COLORS.bubble); } circle(ctx, x, y, s * 0.2, '#ffffff'); },
  wind: (ctx, x, y, s) => { ctx.strokeStyle = '#80d8ff'; ctx.lineWidth = 3.4; for (const dy of [-0.3, 0, 0.3]) { ctx.beginPath(); ctx.moveTo(x - s * 0.6, y + dy * s); ctx.quadraticCurveTo(x, y + dy * s - s * 0.22, x + s * 0.6, y + dy * s); ctx.stroke(); } },
  twin: (ctx, x, y, s) => { circle(ctx, x - s * 0.3, y, s * 0.3, COLORS.bubble); circle(ctx, x + s * 0.3, y, s * 0.3, COLORS.bubble); },
  spear: (ctx, x, y, s) => { ctx.strokeStyle = '#ffe082'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x - s * 0.6, y + s * 0.6); ctx.lineTo(x + s * 0.5, y - s * 0.5); ctx.stroke(); ctx.fillStyle = '#ffe082'; ctx.beginPath(); ctx.moveTo(x + s * 0.62, y - s * 0.62); ctx.lineTo(x + s * 0.18, y - s * 0.55); ctx.lineTo(x + s * 0.55, y - s * 0.18); ctx.closePath(); ctx.fill(); },
  foot: (ctx, x, y, s) => { ellipse(ctx, x, y + s * 0.12, s * 0.36, s * 0.48, 0, COLORS.frogSkin); for (let i = -1; i <= 1; i += 1) circle(ctx, x + i * s * 0.26, y - s * 0.48, s * 0.11, COLORS.frogToe); },
  heart: (ctx, x, y, s) => { ctx.fillStyle = COLORS.heart; ctx.beginPath(); ctx.moveTo(x, y + s * 0.55); ctx.bezierCurveTo(x - s * 0.95, y - s * 0.1, x - s * 0.5, y - s * 0.75, x, y - s * 0.28); ctx.bezierCurveTo(x + s * 0.5, y - s * 0.75, x + s * 0.95, y - s * 0.1, x, y + s * 0.55); ctx.fill(); },
  magnet: (ctx, x, y, s) => { ctx.strokeStyle = '#ff8a65'; ctx.lineWidth = s * 0.3; ctx.beginPath(); ctx.arc(x, y, s * 0.42, Math.PI, 0); ctx.stroke(); ctx.fillStyle = '#ff8a65'; ctx.fillRect(x - s * 0.57, y - s * 0.05, s * 0.3, s * 0.5); ctx.fillRect(x + s * 0.27, y - s * 0.05, s * 0.3, s * 0.5); },
  dash: (ctx, x, y, s) => { ctx.fillStyle = '#80d8ff'; for (let i = 0; i < 3; i += 1) { ctx.globalAlpha = 0.4 + i * 0.3; ctx.beginPath(); ctx.moveTo(x - s * 0.6 + i * s * 0.34, y - s * 0.4); ctx.lineTo(x - s * 0.05 + i * s * 0.34, y); ctx.lineTo(x - s * 0.6 + i * s * 0.34, y + s * 0.4); ctx.closePath(); ctx.fill(); } ctx.globalAlpha = 1; },
  orb: (ctx, x, y, s) => { ctx.globalAlpha = 0.8; circle(ctx, x, y, s * 0.52, COLORS.bubble); ctx.globalAlpha = 1; circle(ctx, x - s * 0.18, y - s * 0.18, s * 0.16, '#ffffff'); },
  leaf: (ctx, x, y, s) => { ctx.fillStyle = '#69f0ae'; ctx.beginPath(); ctx.moveTo(x, y + s * 0.6); ctx.quadraticCurveTo(x - s * 0.65, y - s * 0.2, x, y - s * 0.6); ctx.quadraticCurveTo(x + s * 0.65, y - s * 0.2, x, y + s * 0.6); ctx.fill(); },
  bolt: (ctx, x, y, s) => { ctx.fillStyle = COLORS.gold; ctx.beginPath(); ctx.moveTo(x + s * 0.12, y - s * 0.65); ctx.lineTo(x - s * 0.38, y + s * 0.1); ctx.lineTo(x - s * 0.02, y + s * 0.1); ctx.lineTo(x - s * 0.12, y + s * 0.65); ctx.lineTo(x + s * 0.38, y - s * 0.1); ctx.lineTo(x + s * 0.02, y - s * 0.1); ctx.closePath(); ctx.fill(); },
  shield: (ctx, x, y, s) => { ctx.fillStyle = '#90caf9'; ctx.beginPath(); ctx.moveTo(x, y - s * 0.6); ctx.lineTo(x + s * 0.5, y - s * 0.35); ctx.lineTo(x + s * 0.5, y + s * 0.1); ctx.quadraticCurveTo(x + s * 0.5, y + s * 0.55, x, y + s * 0.68); ctx.quadraticCurveTo(x - s * 0.5, y + s * 0.55, x - s * 0.5, y + s * 0.1); ctx.lineTo(x - s * 0.5, y - s * 0.35); ctx.closePath(); ctx.fill(); },
};

export function drawLevelUp(ctx, state, choices) {
  overlay(ctx, 0.6);
  text(ctx, 'LEVEL UP!', FIELD.width / 2, 168, { size: 40, align: 'center', weight: 800, color: COLORS.firefly });
  text(ctx, `The fireflies offer a gift — choose one (click or 1 · 2 · 3)`, FIELD.width / 2, 208, { size: 16, align: 'center', color: COLORS.textDim });
  choices.forEach((choice, i) => {
    const r = cardRect(i);
    ctx.fillStyle = 'rgba(13, 43, 54, 0.95)';
    ctx.strokeStyle = COLORS.firefly;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 14);
    ctx.fill();
    ctx.stroke();
    const draw = ICON_DRAW[choice.icon];
    if (draw) draw(ctx, r.x + r.w / 2, r.y + 52, 44);
    text(ctx, choice.name, r.x + r.w / 2, r.y + 122, { size: 19, align: 'center', weight: 800 });
    text(ctx, choice.blurb, r.x + r.w / 2, r.y + 152, { size: 13.5, align: 'center', color: COLORS.textDim });
    text(ctx, `${i + 1}`, r.x + r.w / 2, r.y + 186, { size: 13, align: 'center', color: COLORS.gold, weight: 800 });
  });
  void state;
}
