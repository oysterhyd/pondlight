// The world: one Pondlight run as plain state, advanced in fixed steps.
// world.step is the whole simulation — spawning, the frog, foes, bubbles,
// spores, pickups, combo, waves and winning or losing — and it returns
// nothing; sound cues are queued on state.cues for main.js to play, which
// keeps this file silent, deterministic and easy to stage for screenshots.

import { BUBBLE, COMBO, FIELD, FIREFLY, PLAYER, SPORE } from './config.js';
import { makeRng, range } from './random.js';
import { makePlayer, stepPlayer, isInvulnerable } from './player.js';
import { makeFoe, stepFoe, separateFoes, KIND_BEETLE, KIND_HERON } from './enemies.js';
import { makePickup, scatterFireflies, stepPickups, PICKUP_DRAGONFLY, PICKUP_HEART } from './pickups.js';
import { buildSpawnQueue, spawnPoint, waveScale, INTERMISSION_SECONDS, TOTAL_WAVES } from './waves.js';
import { computeStats } from './upgrades.js';
import { createEffects, burst, mote, ring, floatText, shake, hitStop, stepEffects } from './particles.js';

export const PHASE_FIGHT = 'fight';
export const PHASE_BREAK = 'break';
export const PHASE_WON = 'won';
export const PHASE_LOST = 'lost';

export const HEART_DROP_CHANCE = 0.055;
export const HEART_HEAL = 24;
export const DRAGONFLY_DROP_CHANCE = 0.02;
export const DRAGONFLY_DAMAGE = 55;

/** The pond's fixed decoration: lily pads, flowers and edge reeds. */
function makeDecor(rng) {
  const pads = [];
  for (let i = 0; i < 11; i += 1) {
    pads.push({
      x: range(rng, 70, FIELD.width - 70),
      y: range(rng, 70, FIELD.height - 70),
      r: range(rng, 26, 58),
      notch: rng() * Math.PI * 2,
      flower: rng() < 0.4,
      drift: rng() * Math.PI * 2,
    });
  }
  const reeds = [];
  for (let i = 0; i < 26; i += 1) {
    const top = rng() < 0.5;
    reeds.push({ x: range(rng, 8, FIELD.width - 8), y: top ? 4 : FIELD.height - 4, h: range(rng, 22, 52), lean: range(rng, -0.3, 0.3), top });
  }
  return { pads, reeds };
}

/** A fresh run. The same seed always builds the same pond. */
export function createWorld(seed) {
  const rng = makeRng(seed);
  const state = {
    rng,
    time: 0,
    seed,
    player: makePlayer(),
    stats: null,
    taken: [],
    health: PLAYER.maxHealth,
    xp: 0,
    level: 1,
    xpNeed: FIREFLY.xpBase,
    pendingLevels: 0,
    score: 0,
    combo: 0,
    comboT: 0,
    bestCombo: 0,
    kills: 0,
    shotsFired: 0,
    foes: [],
    bubbles: [],
    spores: [],
    pickups: [],
    fx: createEffects(),
    wave: 0,
    phase: PHASE_BREAK,
    phaseT: 1.1,
    waveT: 0,
    spawnQueue: [],
    boss: null,
    cues: [],
    decor: makeDecor(rng),
    rippleT: 0,
    announcedWave: 0,
  };
  state.stats = worldStats(state);
  return state;
}

/** The frog's current derived stats, from its taken upgrades. */
export function worldStats(state) {
  return computeStats({ PLAYER, BUBBLE }, state.taken);
}

/** Record an upgrade choice and recompute stats, healing any max-HP gain. */
export function applyUpgrade(state, id) {
  const before = state.stats.maxHealth;
  state.taken.push(id);
  state.stats = worldStats(state);
  if (state.stats.maxHealth > before) {
    state.health = Math.min(state.stats.maxHealth, state.health + (state.stats.maxHealth - before));
  }
}

function startWave(state, wave) {
  state.wave = wave;
  state.waveT = 0;
  state.spawnQueue = buildSpawnQueue(wave);
  state.phase = PHASE_FIGHT;
  state.announcedWave = wave;
  state.cues.push(wave === TOTAL_WAVES ? 'boss' : 'wave');
  ring(state.fx, state.player.x, state.player.y, { maxRadius: 130, color: '#ffe066' });
}

function spawnFromQueue(state) {
  while (state.spawnQueue.length > 0 && state.spawnQueue[0].at <= state.waveT) {
    const item = state.spawnQueue.shift();
    const point = item.kind === KIND_HERON
      ? { x: FIELD.width / 2, y: 92 }
      : spawnPoint(state.rng, state.player, FIELD);
    const foe = makeFoe(item.kind, point.x, point.y, waveScale(state.wave));
    foe.phase = state.rng() * Math.PI * 2;
    state.foes.push(foe);
    if (item.kind === KIND_HERON) {
      state.boss = foe;
      ring(state.fx, point.x, point.y, { maxRadius: 200, color: '#ff5252', width: 5 });
      shake(state.fx, 9);
    } else {
      burst(state.fx, state.rng, point.x, point.y, { count: 6, color: '#bfeaf2', speed: 90, size: 2.6, life: 0.4 });
    }
  }
}

function hurtPlayer(state, damage) {
  if (isInvulnerable(state.player) || state.phase === PHASE_WON || state.phase === PHASE_LOST) return;
  const dealt = Math.max(1, Math.round(damage * state.stats.armour));
  state.health -= dealt;
  state.player.hurtT = PLAYER.hurtGrace;
  state.combo = 0;
  state.comboT = 0;
  state.cues.push('hurt');
  shake(state.fx, 7);
  burst(state.fx, state.rng, state.player.x, state.player.y, { count: 12, color: '#ff6b81', speed: 210, size: 3.4, life: 0.45 });
  floatText(state.fx, state.player.x, state.player.y - 30, `-${dealt}`, { color: '#ff8a80', size: 17 });
  if (state.health <= 0) {
    state.health = 0;
    state.phase = PHASE_LOST;
    state.cues.push('lose');
    burst(state.fx, state.rng, state.player.x, state.player.y, { count: 42, color: '#f7c948', speed: 280, size: 4, life: 0.8 });
    ring(state.fx, state.player.x, state.player.y, { maxRadius: 170, color: '#f7c948' });
  }
}

function killFoe(state, foe) {
  foe.dead = true;
  state.kills += 1;
  state.combo += 1;
  state.comboT = COMBO.windowSeconds;
  state.bestCombo = Math.max(state.bestCombo, state.combo);
  const multiplier = Math.min(COMBO.maxMultiplier, 1 + Math.floor(state.combo / 6));
  const gained = foe.score * multiplier;
  state.score += gained;
  state.cues.push('pop');
  burst(state.fx, state.rng, foe.x, foe.y, {
    count: foe.kind === KIND_HERON ? 90 : 10 + Math.floor(foe.radius),
    color: foe.kind === KIND_HERON ? '#90a4ae' : '#cfeffb',
    speed: foe.kind === KIND_HERON ? 330 : 200,
    size: 3.6,
    life: 0.6,
  });
  floatText(state.fx, foe.x, foe.y - foe.radius - 6, `+${gained}`, { color: multiplier > 1 ? '#ffd54f' : '#eaf7fa', size: multiplier > 2 ? 19 : 15 });
  scatterFireflies(state.pickups, foe.fireflies, foe.x, foe.y, state.rng);
  if (foe.kind !== KIND_HERON && state.rng() < HEART_DROP_CHANCE) {
    state.pickups.push(makePickup(PICKUP_HEART, foe.x, foe.y, state.rng));
  }
  if ((foe.kind === 'beetle' || foe.kind === KIND_HERON) && state.rng() < DRAGONFLY_DROP_CHANCE + (foe.kind === KIND_HERON ? 1 : 0)) {
    state.pickups.push(makePickup(PICKUP_DRAGONFLY, foe.x, foe.y, state.rng));
  }
  if (foe.kind === KIND_HERON) {
    state.boss = null;
    hitStop(state.fx, 0.12);
    shake(state.fx, 13);
    ring(state.fx, foe.x, foe.y, { maxRadius: 260, color: '#ffe066', width: 5 });
  }
}

function dragonflyBlast(state) {
  state.cues.push('levelup');
  ring(state.fx, state.player.x, state.player.y, { maxRadius: 330, color: '#80d8ff', width: 5 });
  shake(state.fx, 8);
  for (const foe of state.foes) {
    foe.hp -= DRAGONFLY_DAMAGE;
    foe.flash = 1;
    burst(state.fx, state.rng, foe.x, foe.y, { count: 8, color: '#80d8ff', speed: 220, size: 3, life: 0.4 });
    if (foe.hp <= 0 && !foe.dead) killFoe(state, foe);
  }
}

/** Advance the whole run by one fixed step under the given intent. */
export function stepWorld(state, intent, dt) {
  if (state.phase === PHASE_WON || state.phase === PHASE_LOST) {
    stepEffects(state.fx, dt);
    return;
  }
  state.time += dt;

  // Ambient ripples, so the pond always breathes.
  state.rippleT -= dt;
  if (state.rippleT <= 0) {
    state.rippleT = 0.5 + state.rng() * 0.9;
    ring(state.fx, range(state.rng, 40, FIELD.width - 40), range(state.rng, 40, FIELD.height - 40), { maxRadius: 26 + state.rng() * 30, color: '#1a6a80', life: 1.1, width: 1.5 });
  }

  if (state.phase === PHASE_BREAK) {
    state.phaseT -= dt;
    if (state.phaseT <= 0) startWave(state, state.wave + 1);
  } else if (state.phase === PHASE_FIGHT) {
    state.waveT += dt;
    spawnFromQueue(state);
    if (state.spawnQueue.length === 0 && state.foes.length === 0) {
      if (state.wave >= TOTAL_WAVES) {
        state.phase = PHASE_WON;
        state.cues.push('win');
        state.score += Math.round(state.health) * 10;
      } else {
        state.phase = PHASE_BREAK;
        state.phaseT = INTERMISSION_SECONDS;
      }
    }
  }

  // The frog.
  const out = { bubbles: [], events: [], rng: state.rng };
  stepPlayer(state.player, intent, state.stats, dt, out);
  for (const b of out.bubbles) {
    state.bubbles.push(b);
    state.shotsFired += 1;
  }
  for (const e of out.events) state.cues.push(e);

  // Foes.
  const foeEvents = [];
  for (const foe of state.foes) stepFoe(foe, state.player, dt, state.rng, foeEvents);
  separateFoes(state.foes, dt);
  for (const ev of foeEvents) {
    if (ev.type === 'spore' || ev.type === 'feather') {
      state.spores.push({ x: ev.x, y: ev.y, vx: ev.vx, vy: ev.vy, radius: SPORE.radius, damage: ev.type === 'feather' ? 12 : SPORE.damage, life: SPORE.lifeSeconds, feather: ev.type === 'feather', dead: false });
    } else if (ev.type === 'summon') {
      for (let i = 0; i < ev.count; i += 1) {
        const foe = makeFoe('gnat', ev.x + range(state.rng, -70, 70), ev.y + range(state.rng, -50, 50), waveScale(state.wave));
        foe.phase = state.rng() * Math.PI * 2;
        state.foes.push(foe);
      }
    }
  }

  // Bubbles against foes.
  for (const b of state.bubbles) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0 || b.x < -20 || b.x > FIELD.width + 20 || b.y < -20 || b.y > FIELD.height + 20) {
      b.dead = true;
      continue;
    }
    for (const foe of state.foes) {
      if (foe.dead) continue;
      const d = Math.hypot(foe.x - b.x, foe.y - b.y);
      if (d <= foe.radius + b.radius) {
        foe.hp -= b.damage;
        foe.flash = 1;
        state.cues.push('hit');
        burst(state.fx, state.rng, b.x, b.y, { count: 3, color: '#cfeffb', speed: 120, size: 2.4, life: 0.3 });
        if (foe.kind !== KIND_BEETLE && foe.kind !== KIND_HERON) {
          foe.x += (b.vx / 640) * 5;
          foe.y += (b.vy / 640) * 5;
        } else if (foe.kind === KIND_BEETLE && state.rng() < 0.5) {
          foe.x += (b.vx / 640) * 2;
          foe.y += (b.vy / 640) * 2;
        }
        if (foe.hp <= 0) killFoe(state, foe);
        if (b.pierceLeft > 0) b.pierceLeft -= 1;
        else { b.dead = true; break; }
      }
    }
  }
  state.bubbles = state.bubbles.filter((b) => !b.dead);
  state.foes = state.foes.filter((f) => !f.dead);

  // Spores and feathers against the frog; foes against the frog.
  for (const s of state.spores) {
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.life -= dt;
    if (s.life <= 0) s.dead = true;
    if (!s.dead && Math.hypot(s.x - state.player.x, s.y - state.player.y) <= s.radius + state.player.radius * 0.8) {
      s.dead = true;
      hurtPlayer(state, s.damage);
    }
  }
  state.spores = state.spores.filter((s) => !s.dead);
  for (const foe of state.foes) {
    if (Math.hypot(foe.x - state.player.x, foe.y - state.player.y) <= foe.radius + state.player.radius * 0.85) {
      hurtPlayer(state, foe.damage);
      if (foe.kind === 'gnat') { foe.dead = true; burst(state.fx, state.rng, foe.x, foe.y, { count: 6, color: '#8d6e63', speed: 150, size: 2.6, life: 0.35 }); }
    }
  }
  state.foes = state.foes.filter((f) => !f.dead);

  // Pickups, experience and healing.
  const got = stepPickups(state.pickups, state.player, state.stats, dt);
  if (got.fireflies > 0) {
    state.cues.push('pickup');
    state.xp += got.fireflies;
    mote(state.fx, state.rng, state.player.x, state.player.y, {});
    while (state.xp >= state.xpNeed) {
      state.xp -= state.xpNeed;
      state.level += 1;
      state.xpNeed = FIREFLY.xpBase + (state.level - 1) * FIREFLY.xpGrowth;
      state.pendingLevels += 1;
    }
  }
  if (got.hearts > 0) {
    state.health = Math.min(state.stats.maxHealth, state.health + HEART_HEAL * got.hearts);
    state.cues.push('heal');
    floatText(state.fx, state.player.x, state.player.y - 34, `+${HEART_HEAL * got.hearts}`, { color: '#69f0ae', size: 17 });
  }
  if (got.dragonflies > 0) dragonflyBlast(state);

  // Regeneration and combo decay.
  if (state.stats.regen > 0) state.health = Math.min(state.stats.maxHealth, state.health + state.stats.regen * dt);
  if (state.comboT > 0) {
    state.comboT -= dt;
    if (state.comboT <= 0) state.combo = 0;
  }

  stepEffects(state.fx, dt);
}
