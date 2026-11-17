// The six foes of the pond and how each one moves.
// Every foe is a plain object made by makeFoe; stepFoe advances one foe for a
// fixed step and returns events the world acts on (a spore to fire, a summon
// to spawn), so this file never reaches into the world's arrays directly.

import { FOE, HERON, SPORE, FIELD, SNAIL, ELITE } from './config.js';
import { angleTo, clamp, distance } from './random.js';

export const KIND_GNAT = 'gnat';
export const KIND_DARTER = 'darter';
export const KIND_MOTH = 'moth';
export const KIND_BEETLE = 'beetle';
export const KIND_SNAIL = 'snail';
export const KIND_HERON = 'heron';

/** Create a foe of a kind at a position, scaled for the wave it belongs to.
 *  `elite` gilds a lesser foe: bigger, tougher, worth more (see ELITE). */
export function makeFoe(kind, x, y, scale, elite = false) {
  const base = FOE[kind];
  const gild = elite ? ELITE : null;
  const health = Math.round(base.health * scale.health * (gild ? gild.healthMul : 1));
  return {
    kind,
    elite: Boolean(gild),
    x,
    y,
    vx: 0,
    vy: 0,
    radius: Math.round(base.radius * (gild ? gild.radiusMul : 1)),
    hp: health,
    maxHp: health,
    speed: base.speed * scale.speed * (gild ? gild.speedMul : 1),
    damage: Math.round(base.damage * scale.damage),
    score: base.score * (gild ? gild.scoreMul : 1),
    fireflies: base.fireflies + (gild ? gild.firefliesBonus : 0),
    t: 0,
    phase: 0,
    state: kind === KIND_HERON ? 'stalk' : kind === KIND_SNAIL ? 'peek' : 'chase',
    stateT: 0,
    dashHitCd: 0,
    blockCueT: 0,
    fireT: 1 + scale.wave * 0.1,
    fanT: HERON.fanInterval,
    swoopT: HERON.swoopEvery,
    summonT: HERON.summonEvery,
    swoopFrom: null,
    swoopTo: null,
    flash: 0,
    dead: false,
  };
}

function steer(foe, targetX, targetY, speed, dt, wobble, rng) {
  const angle = angleTo(foe.x, foe.y, targetX, targetY) + (wobble ? Math.sin(foe.t * 5 + foe.phase) * wobble : 0);
  foe.vx = Math.cos(angle) * speed;
  foe.vy = Math.sin(angle) * speed;
  foe.x += foe.vx * dt;
  foe.y += foe.vy * dt;
  void rng;
}

/** The gnat: a straight, wobbling chase. Weak alone, rude in a swarm. */
function stepGnat(foe, player, dt, rng) {
  steer(foe, player.x, player.y, foe.speed, dt, 0.45, rng);
}

/** The darter: circles at range, telegraphs, then charges in a straight line. */
function stepDarter(foe, player, dt, rng) {
  foe.stateT += dt;
  const dist = distance(foe.x, foe.y, player.x, player.y);
  if (foe.state === 'chase') {
    steer(foe, player.x, player.y, foe.speed, dt, 0.15, rng);
    if (dist < 330 && foe.stateT > 0.9) {
      foe.state = 'aim';
      foe.stateT = 0;
    }
  } else if (foe.state === 'aim') {
    foe.vx *= 1 - 6 * dt;
    foe.vy *= 1 - 6 * dt;
    foe.x += foe.vx * dt;
    foe.y += foe.vy * dt;
    foe.aimAngle = angleTo(foe.x, foe.y, player.x, player.y);
    if (foe.stateT > 0.55) {
      foe.state = 'charge';
      foe.stateT = 0;
      foe.vx = Math.cos(foe.aimAngle) * 460;
      foe.vy = Math.sin(foe.aimAngle) * 460;
    }
  } else if (foe.state === 'charge') {
    foe.x += foe.vx * dt;
    foe.y += foe.vy * dt;
    if (foe.stateT > 0.62) {
      foe.state = 'chase';
      foe.stateT = 0;
    }
  }
}

/** The moth: keeps its distance and spits spores at the frog. */
function stepMoth(foe, player, dt, rng, events) {
  const dist = distance(foe.x, foe.y, player.x, player.y);
  const wanted = 300;
  const dir = dist > wanted + 24 ? 1 : dist < wanted - 24 ? -1 : 0;
  const angle = angleTo(foe.x, foe.y, player.x, player.y);
  const strafe = Math.sin(foe.t * 1.7 + foe.phase) * 0.7;
  foe.vx = Math.cos(angle) * foe.speed * dir + Math.cos(angle + Math.PI / 2) * foe.speed * strafe;
  foe.vy = Math.sin(angle) * foe.speed * dir + Math.sin(angle + Math.PI / 2) * foe.speed * strafe;
  foe.x += foe.vx * dt;
  foe.y += foe.vy * dt;
  foe.fireT -= dt;
  if (foe.fireT <= 0 && dist < 560) {
    foe.fireT = 2.3 + rng() * 0.9;
    events.push({
      type: 'spore',
      x: foe.x,
      y: foe.y,
      vx: Math.cos(angle) * SPORE.speed,
      vy: Math.sin(angle) * SPORE.speed,
    });
  }
}

/** The beetle: slow, armoured, and it shrugs off every second hit's knockback.
 *  Its step is plain; the armour lives in world.js where hits are resolved. */
function stepBeetle(foe, player, dt, rng) {
  steer(foe, player.x, player.y, foe.speed, dt, 0.06, rng);
}

/** The armoured snail: it crawls with its head out (peek), then tucks into
 *  its shell and barely creeps (tuck). World.js prices bubble damage by the
 *  state: tucked is armoured, peeking is vulnerable. Patience, or pierce. */
function stepSnail(foe, player, dt, rng) {
  foe.stateT += dt;
  if (foe.state === 'peek' && foe.stateT > SNAIL.peekSeconds) {
    foe.state = 'tuck';
    foe.stateT = 0;
  } else if (foe.state === 'tuck' && foe.stateT > SNAIL.tuckSeconds) {
    foe.state = 'peek';
    foe.stateT = 0;
  }
  const speed = foe.state === 'tuck' ? foe.speed * 0.22 : foe.speed;
  steer(foe, player.x, player.y, speed, dt, 0.04, rng);
}

/** The Shadow Heron, the wave-ten boss. It stalks, fans feathers, summons
 *  gnats, and swoops across the pond on a telegraphed line. Below a third of
 *  its health it enrages: everything it does comes faster. */
function stepHeron(foe, player, dt, rng, events) {
  const enraged = foe.hp <= foe.maxHp * HERON.enrageBelow;
  const pace = enraged ? 0.62 : 1;
  foe.stateT += dt;

  if (foe.state === 'stalk') {
    steer(foe, player.x, player.y, foe.speed * (enraged ? 1.35 : 1), dt, 0.1, rng);
    foe.fanT -= dt;
    foe.summonT -= dt;
    foe.swoopT -= dt;
    if (foe.fanT <= 0) {
      foe.fanT = HERON.fanInterval * pace;
      const base = angleTo(foe.x, foe.y, player.x, player.y);
      for (let i = 0; i < HERON.fanCount; i += 1) {
        const a = base + HERON.fanSpread * (i / (HERON.fanCount - 1) - 0.5);
        events.push({ type: 'feather', x: foe.x, y: foe.y, vx: Math.cos(a) * HERON.fanSpeed, vy: Math.sin(a) * HERON.fanSpeed });
      }
    }
    if (foe.summonT <= 0) {
      foe.summonT = HERON.summonEvery * pace;
      events.push({ type: 'summon', count: HERON.summonCount, x: foe.x, y: foe.y });
    }
    if (foe.swoopT <= 0) {
      foe.state = 'warn';
      foe.stateT = 0;
      foe.swoopFrom = { x: foe.x, y: foe.y };
      foe.swoopTo = { x: player.x, y: player.y };
    }
  } else if (foe.state === 'warn') {
    foe.vx *= 1 - 8 * dt;
    foe.vy *= 1 - 8 * dt;
    foe.x += foe.vx * dt;
    foe.y += foe.vy * dt;
    if (foe.stateT >= HERON.swoopWarnSeconds * pace) {
      foe.state = 'swoop';
      foe.stateT = 0;
      const a = angleTo(foe.swoopFrom.x, foe.swoopFrom.y, foe.swoopTo.x, foe.swoopTo.y);
      foe.vx = Math.cos(a) * HERON.swoopSpeed;
      foe.vy = Math.sin(a) * HERON.swoopSpeed;
    }
  } else if (foe.state === 'swoop') {
    foe.x += foe.vx * dt;
    foe.y += foe.vy * dt;
    if (foe.stateT > 1.15 || foe.x < 30 || foe.x > FIELD.width - 30 || foe.y < 30 || foe.y > FIELD.height - 30) {
      foe.state = 'stalk';
      foe.stateT = 0;
      foe.swoopT = HERON.swoopEvery * pace;
    }
  }
  foe.x = clamp(foe.x, foe.radius, FIELD.width - foe.radius);
  foe.y = clamp(foe.y, foe.radius, FIELD.height - foe.radius);
}

/** Advance one foe. `events` collects spores, feathers and summons. */
export function stepFoe(foe, player, dt, rng, events) {
  foe.t += dt;
  foe.flash = Math.max(0, foe.flash - dt * 6);
  foe.dashHitCd = Math.max(0, (foe.dashHitCd ?? 0) - dt);
  foe.blockCueT = Math.max(0, (foe.blockCueT ?? 0) - dt);
  switch (foe.kind) {
    case KIND_GNAT: stepGnat(foe, player, dt, rng); break;
    case KIND_DARTER: stepDarter(foe, player, dt, rng); break;
    case KIND_MOTH: stepMoth(foe, player, dt, rng, events); break;
    case KIND_BEETLE: stepBeetle(foe, player, dt, rng); break;
    case KIND_SNAIL: stepSnail(foe, player, dt, rng); break;
    case KIND_HERON: stepHeron(foe, player, dt, rng, events); break;
    default: break;
  }
  if (foe.kind !== KIND_HERON) {
    foe.x = clamp(foe.x, foe.radius, FIELD.width - foe.radius);
    foe.y = clamp(foe.y, foe.radius, FIELD.height - foe.radius);
  }
}

/** Soft separation so foes overlap less and read as individuals. */
export function separateFoes(foes, dt) {
  for (let i = 0; i < foes.length; i += 1) {
    for (let j = i + 1; j < foes.length; j += 1) {
      const a = foes[i];
      const b = foes[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      const min = (a.radius + b.radius) * 0.82;
      if (dist > 0.01 && dist < min) {
        const push = (min - dist) * 0.5 * Math.min(1, dt * 10);
        const ux = dx / dist;
        const uy = dy / dist;
        if (a.kind !== KIND_HERON) { a.x -= ux * push; a.y -= uy * push; }
        if (b.kind !== KIND_HERON) { b.x += ux * push; b.y += uy * push; }
      }
    }
  }
}
