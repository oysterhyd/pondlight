// The milk frog: movement, the dash, and the bubble weapon.
// The player object is plain state; stepPlayer moves it from an intent
// ({moveX, moveY, aimX, aimY, firing, dash}) so real input and the screenshot
// autopilot feed it identically.

import { BUBBLE, FIELD, PLAYER } from './config.js';
import { clamp } from './random.js';

export function makePlayer() {
  return {
    x: FIELD.width / 2,
    y: FIELD.height / 2,
    vx: 0,
    vy: 0,
    radius: PLAYER.radius,
    faceAngle: -Math.PI / 2,
    aimAngle: -Math.PI / 2,
    fireT: 0,
    dashT: 0,
    dashCooldownT: 0,
    dashDirX: 1,
    dashDirY: 0,
    hurtT: 0,
    walkPhase: 0,
    moving: false,
  };
}

/** True while the frog cannot be hurt (just hurt, or mid-dash). */
export function isInvulnerable(player) {
  return player.hurtT > 0 || player.dashT > 0;
}

/**
 * Advance the frog one fixed step.
 * `stats` are the derived upgrade stats; `out.bubbles` collects new bubbles,
 * `out.events` collects 'dash' so the world can add sound and ripples.
 */
export function stepPlayer(player, intent, stats, dt, out) {
  player.fireT -= dt;
  player.dashCooldownT -= dt;
  player.hurtT -= dt;

  const dashing = player.dashT > 0;
  if (intent.dash && player.dashCooldownT <= 0 && !dashing) {
    const mx = intent.moveX || Math.cos(player.faceAngle);
    const my = intent.moveY || Math.sin(player.faceAngle);
    const len = Math.hypot(mx, my) || 1;
    player.dashDirX = mx / len;
    player.dashDirY = my / len;
    player.dashT = PLAYER.dashSeconds;
    player.dashCooldownT = stats.dashCooldown;
    out.events.push('dash');
  }

  if (player.dashT > 0) {
    player.dashT -= dt;
    player.vx = player.dashDirX * PLAYER.dashSpeed;
    player.vy = player.dashDirY * PLAYER.dashSpeed;
  } else {
    const accel = 2400;
    const targetX = intent.moveX * stats.speed;
    const targetY = intent.moveY * stats.speed;
    player.vx += clamp(targetX - player.vx, -accel * dt, accel * dt);
    player.vy += clamp(targetY - player.vy, -accel * dt, accel * dt);
  }

  player.x = clamp(player.x + player.vx * dt, player.radius, FIELD.width - player.radius);
  player.y = clamp(player.y + player.vy * dt, player.radius, FIELD.height - player.radius);
  player.moving = Math.hypot(intent.moveX, intent.moveY) > 0.1;
  if (player.moving || dashing) player.walkPhase += dt * (dashing ? 16 : 10);

  if (intent.moveX !== 0 || intent.moveY !== 0) {
    player.faceAngle = Math.atan2(intent.moveY, intent.moveX);
  }
  player.aimAngle = Math.atan2(intent.aimY - player.y, intent.aimX - player.x);

  if (intent.firing && player.fireT <= 0 && player.dashT <= 0) {
    player.fireT = stats.fireInterval;
    const count = stats.shots;
    for (let i = 0; i < count; i += 1) {
      const offset = count === 1 ? 0 : (i / (count - 1) - 0.5) * 0.16;
      const jitter = (out.rng() - 0.5) * BUBBLE.spreadRadians * 2;
      const angle = player.aimAngle + offset + jitter;
      out.bubbles.push({
        x: player.x + Math.cos(player.aimAngle) * (player.radius + 6),
        y: player.y + Math.sin(player.aimAngle) * (player.radius + 6),
        vx: Math.cos(angle) * stats.bubbleSpeed,
        vy: Math.sin(angle) * stats.bubbleSpeed,
        radius: stats.bubbleRadius,
        damage: stats.damage,
        life: stats.bubbleLife,
        pierceLeft: stats.pierce,
        dead: false,
      });
    }
    out.events.push('shoot');
  }
}
