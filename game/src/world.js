// The world: one Pondlight run as plain state, advanced in fixed steps.
// world.step is the whole simulation — spawning, the frog, foes, bubbles,
// spores, pickups, combo, waves and winning or losing — and it returns
// nothing; sound cues are queued on state.cues for main.js to play, which
// keeps this file silent, deterministic and easy to stage for screenshots.

import { BUBBLE, COMBO, FIELD, FIREFLY, PLAYER, SPORE, ELITE, SNAIL } from './config.js';
import { makeRng, range } from './random.js';
import { makePlayer, stepPlayer, isInvulnerable } from './player.js';
import { makeFoe, stepFoe, separateFoes, KIND_BEETLE, KIND_HERON, KIND_SNAIL } from './enemies.js';
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
    auraT: 1.4,
    waveHurt: false,
    endless: false,
    announcedWave: 0,
  };
  state.stats = worldStats(state);
  return state;
}

/** The frog's current derived stats, from its taken upgrades. */
export function worldStats(state) {
  return computeStats({ PLAYER, BUBBLE }, state.taken);
}

/** After the Heron falls, keep swimming: endless waves, growing forever. */
export function enterEndless(state) {
  state.endless = true;
  state.phase = PHASE_BREAK;
  state.phaseT = 2.4;
  state.cues.push('wave');
  ring(state.fx, state.player.x, state.player.y, { maxRadius: 170, color: '#80d8ff', width: 4 });
  floatText(state.fx, state.player.x, state.player.y - 46, 'THE ENDLESS POND', { color: '#80d8ff', size: 22 });
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
  state.waveHurt = false;
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
    const eliteChance = ELITE.chance + (state.endless ? Math.min(0.15, (state.wave - TOTAL_WAVES) * 0.02) : 0);
    const elite = state.wave >= ELITE.fromWave
      && item.kind !== KIND_HERON && item.kind !== KIND_SNAIL
      && state.rng() < eliteChance;
    const foe = makeFoe(item.kind, point.x, point.y, waveScale(state.wave), elite);
    foe.phase = state.rng() * Math.PI * 2;
    state.foes.push(foe);
    if (elite) ring(state.fx, point.x, point.y, { maxRadius: 54, color: '#ffd54f', width: 3 });
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
  state.waveHurt = true;
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
  if (foe.radius >= 23 || foe.elite) {
    ring(state.fx, foe.x, foe.y, { maxRadius: foe.radius * 2.1, color: '#bfeaf2', life: 0.38, width: 2.5 });
  }
  scatterFireflies(state.pickups, foe.fireflies, foe.x, foe.y, state.rng);
  const heartChance = foe.elite ? ELITE.heartChance : HEART_DROP_CHANCE;
  if (foe.kind !== KIND_HERON && state.rng() < heartChance) {
    state.pickups.push(makePickup(PICKUP_HEART, foe.x, foe.y, state.rng));
  }
  const dragonflyChance = DRAGONFLY_DROP_CHANCE + (foe.elite ? ELITE.dragonflyChance : 0);
  if ((foe.kind === 'beetle' || foe.kind === KIND_HERON || foe.elite) && state.rng() < dragonflyChance + (foe.kind === KIND_HERON ? 1 : 0)) {
    state.pickups.push(makePickup(PICKUP_DRAGONFLY, foe.x, foe.y, state.rng));
  }
  if (foe.kind === KIND_HERON) {
    state.boss = null;
    hitStop(state.fx, 0.12);
    shake(state.fx, 13);
    ring(state.fx, foe.x, foe.y, { maxRadius: 260, color: '#ffe066', width: 5 });
  }
}

/** Price and apply damage to a foe from any source. The snail's shell is
 *  priced here: tucked it takes SNAIL.tuckedArmour of the hit (with a clang
 *  cue, throttled), peeking it takes extra. Returns true if the foe died. */
function damageFoe(state, foe, damage, { knockX = 0, knockY = 0 } = {}) {
  if (foe.dead) return false;
  let dealt = damage;
  if (foe.kind === KIND_SNAIL) {
    if (foe.state === 'tuck') {
      dealt = damage * SNAIL.tuckedArmour;
      if (foe.blockCueT <= 0) {
        foe.blockCueT = 0.24;
        state.cues.push('block');
        burst(state.fx, state.rng, foe.x, foe.y - foe.radius * 0.4, { count: 3, color: '#ffe082', speed: 130, size: 2.2, life: 0.25 });
      }
    } else {
      dealt = damage * SNAIL.peekVulnerability;
    }
  }
  foe.hp -= dealt;
  foe.flash = 1;
  if (knockX || knockY) {
    if (foe.kind !== KIND_BEETLE && foe.kind !== KIND_HERON && foe.kind !== KIND_SNAIL) {
      foe.x += knockX;
      foe.y += knockY;
    } else if (foe.kind === KIND_BEETLE && state.rng() < 0.5) {
      foe.x += knockX * 0.4;
      foe.y += knockY * 0.4;
    }
  }
  if (foe.hp <= 0) {
    killFoe(state, foe);
    return true;
  }
  return false;
}

/** A cleared wave with no damage taken pays a flawless bonus. */
function awardFlawless(state) {
  if (state.waveHurt || state.wave < 2) return;
  const bonus = 100 + state.wave * 20;
  state.score += bonus;
  state.cues.push('bonus');
  floatText(state.fx, state.player.x, state.player.y - 44, `FLAWLESS +${bonus}`, { color: '#ffd54f', size: 21 });
  ring(state.fx, state.player.x, state.player.y, { maxRadius: 120, color: '#ffd54f', width: 3 });
  scatterFireflies(state.pickups, 3, state.player.x, state.player.y, state.rng);
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
      if (state.wave >= TOTAL_WAVES && !state.endless) {
        state.phase = PHASE_WON;
        state.cues.push('win');
        state.score += Math.round(state.health) * 10;
      } else {
        awardFlawless(state);
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
    } else if (ev.type === 'phase2') {
      state.cues.push('boss');
      shake(state.fx, 12);
      ring(state.fx, ev.x, ev.y, { maxRadius: 240, color: '#ff5252', width: 5 });
      burst(state.fx, state.rng, ev.x, ev.y, { count: 30, color: '#90a4ae', speed: 300, size: 3.4, life: 0.6 });
      floatText(state.fx, ev.x, ev.y - 96, 'THE HERON RAGES', { color: '#ff5252', size: 23 });
    }
  }

  // Bubbles: seeking bubbles first bend toward the nearest foe, then fly.
  for (const b of state.bubbles) {
    if (state.stats.seekerTurn > 0 && !b.dead) {
      let best = null;
      let bestD = 320;
      for (const foe of state.foes) {
        if (foe.dead) continue;
        const d = Math.hypot(foe.x - b.x, foe.y - b.y);
        if (d < bestD) { bestD = d; best = foe; }
      }
      if (best) {
        const speed = Math.hypot(b.vx, b.vy);
        const current = Math.atan2(b.vy, b.vx);
        const wanted = Math.atan2(best.y - b.y, best.x - b.x);
        let turn = wanted - current;
        while (turn > Math.PI) turn -= Math.PI * 2;
        while (turn < -Math.PI) turn += Math.PI * 2;
        const maxTurn = state.stats.seekerTurn * dt;
        const next = current + Math.max(-maxTurn, Math.min(maxTurn, turn));
        b.vx = Math.cos(next) * speed;
        b.vy = Math.sin(next) * speed;
      }
    }
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
        state.cues.push('hit');
        burst(state.fx, state.rng, b.x, b.y, { count: 3, color: '#cfeffb', speed: 120, size: 2.4, life: 0.3 });
        damageFoe(state, foe, b.damage, { knockX: (b.vx / 640) * 5, knockY: (b.vy / 640) * 5 });
        // Splash Pop: the burst wets every other foe standing close.
        if (state.stats.splashLevel > 0) {
          const splashR = 42 + state.stats.splashLevel * 9;
          const splashDmg = b.damage * (0.38 + state.stats.splashLevel * 0.09);
          ring(state.fx, b.x, b.y, { maxRadius: splashR, color: '#81d4fa', life: 0.3, width: 2.5 });
          state.cues.push('splash');
          for (const other of state.foes) {
            if (other === foe || other.dead) continue;
            if (Math.hypot(other.x - b.x, other.y - b.y) <= splashR + other.radius * 0.5) {
              damageFoe(state, other, splashDmg);
            }
          }
        }
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
    const dist = Math.hypot(foe.x - state.player.x, foe.y - state.player.y);
    // The dash is a weapon: passing through a foe pops it, once per dash.
    if (state.player.dashT > 0 && foe.dashHitCd <= 0 && dist <= foe.radius + state.player.radius + 6) {
      foe.dashHitCd = 0.4;
      state.cues.push('hit');
      burst(state.fx, state.rng, foe.x, foe.y, { count: 7, color: '#ffe066', speed: 190, size: 3, life: 0.35 });
      damageFoe(state, foe, state.stats.dashDamage, { knockX: (foe.x - state.player.x) * 0.14, knockY: (foe.y - state.player.y) * 0.14 });
    }
    if (dist <= foe.radius + state.player.radius * 0.85) {
      hurtPlayer(state, foe.damage);
      if (foe.kind === 'gnat') { foe.dead = true; burst(state.fx, state.rng, foe.x, foe.y, { count: 6, color: '#8d6e63', speed: 150, size: 2.6, life: 0.35 }); }
    }
  }
  state.foes = state.foes.filter((f) => !f.dead);

  // Pond Ripple: a standing shockwave that shoves the pond's pests back.
  if (state.stats.rippleEvery > 0) {
    state.auraT -= dt;
    if (state.auraT <= 0 && state.foes.length > 0) {
      state.auraT = state.stats.rippleEvery;
      state.cues.push('ripple');
      ring(state.fx, state.player.x, state.player.y, { maxRadius: 132, color: '#80d8ff', width: 4, life: 0.5 });
      for (const foe of [...state.foes]) {
        const d = Math.hypot(foe.x - state.player.x, foe.y - state.player.y);
        if (d <= 132 + foe.radius) {
          const push = foe.kind === KIND_HERON ? 0 : 26;
          damageFoe(state, foe, state.stats.rippleDamage, {
            knockX: d > 1 ? ((foe.x - state.player.x) / d) * push : 0,
            knockY: d > 1 ? ((foe.y - state.player.y) / d) * push : 0,
          });
        }
      }
      state.foes = state.foes.filter((f) => !f.dead);
    }
  }

  // Pickups, experience and healing.
  const got = stepPickups(state.pickups, state.player, state.stats, dt);
  if (got.fireflies > 0) {
    state.cues.push('pickup');
    state.xp += got.fireflies * state.stats.xpMul;
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
