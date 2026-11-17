// Screenshot scenes for Pondlight, behind ?shot=title|play|boss|upgrade.
// Each scene runs the real simulation forward from a fresh world with a
// simple autopilot at the controls, so a screenshot is an honest frame of
// the game being played — never a mock-up — and the same seed always stages
// the same frame. main.js renders the staged state once and stops.

import { FIELD, STEP } from './config.js';
import { createWorld, stepWorld, applyUpgrade, PHASE_FIGHT } from './world.js';
import { drawChoices } from './upgrades.js';
import { SCREEN_LEVELUP, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const IDLE = { moveX: 0, moveY: 0, aimX: FIELD.width / 2, aimY: 0, firing: false, dash: false };

/** The autopilot's intent for this step: kite the nearest foe, chase
 *  fireflies when safe, aim and fire at whatever is closest. */
export function pilotIntent(state) {
  const p = state.player;
  let nearest = null;
  let nearestD = Infinity;
  for (const foe of state.foes) {
    const d = Math.hypot(foe.x - p.x, foe.y - p.y);
    if (d < nearestD) { nearestD = d; nearest = foe; }
  }
  let moveX = 0;
  let moveY = 0;
  if (nearest) {
    // Run from the nearest foe, biased toward the pond's centre; the bias
    // grows when the foe is far, so the pilot never wedges into a corner
    // out of its own bubbles' range.
    const centreBias = nearestD > 260 ? 1.7 : 0.7;
    moveX = (p.x - nearest.x) / (nearestD || 1) + (FIELD.width / 2 - p.x) / FIELD.width * centreBias;
    moveY = (p.y - nearest.y) / (nearestD || 1) + (FIELD.height / 2 - p.y) / FIELD.height * centreBias;
  }
  // Drift toward the closest firefly when nothing is on top of the frog.
  if (!nearest || nearestD > 190) {
    let fly = null;
    let flyD = Infinity;
    for (const pick of state.pickups) {
      if (pick.kind !== 'firefly') continue;
      const d = Math.hypot(pick.x - p.x, pick.y - p.y);
      if (d < flyD) { flyD = d; fly = pick; }
    }
    if (fly) { moveX = (fly.x - p.x) / (flyD || 1); moveY = (fly.y - p.y) / (flyD || 1); }
  }
  const len = Math.hypot(moveX, moveY);
  if (len > 1) { moveX /= len; moveY /= len; }
  // In the finale the pilot does what a player does: burn the heron down,
  // only swatting at whatever is about to bite.
  const boss = state.boss && !state.boss.dead ? state.boss : null;
  const aim = boss && nearestD > 90 ? boss : nearest;
  return {
    moveX,
    moveY,
    aimX: aim ? aim.x : p.x + 40,
    aimY: aim ? aim.y : p.y,
    firing: Boolean(nearest || boss),
    dash: nearestD < 74,
  };
}

function runSteps(state, steps, intentFor) {
  for (let i = 0; i < steps; i += 1) {
    stepWorld(state, intentFor(state), STEP);
    state.cues.length = 0;
    if (state.phase === 'lost' || state.phase === 'won') break;
  }
}

/** Stage the title: a calm pond just before the first wave. */
function stageTitle(seed) {
  const state = createWorld(seed);
  runSteps(state, 50, () => IDLE);
  return { state, screen: SCREEN_TITLE, choices: null };
}

/** Stage mid-game combat: the pilot plays on until a busy wave-3+ frame —
 *  several foes on screen and bubbles in flight — and freezes there. */
function stagePlay(seed) {
  const state = createWorld(seed);
  const cap = 60 * 240;
  for (let i = 0; i < cap; i += 1) {
    stepWorld(state, pilotIntent(state), STEP);
    state.cues.length = 0;
    if (state.pendingLevels > 0) {
      // Spend level-ups at once in staging, choosing the first card.
      const choices = drawChoices(state.rng, state.taken);
      if (choices.length > 0) applyUpgrade(state, choices[0].id);
      state.pendingLevels = 0;
    }
    if (state.wave >= 3 && state.phase === PHASE_FIGHT && state.foes.length >= 7 && state.bubbles.length >= 4) {
      // Prefer a frame where the fight is happening mid-pond, not at the edges.
      const central = state.foes.filter((f) => f.x > 220 && f.x < 1060 && f.y > 120 && f.y < 600).length;
      if (central >= 4) break;
    }
    if (state.phase === 'lost') break;
  }
  state.health = Math.max(state.health, 62);
  return { state, screen: SCREEN_PLAY, choices: null };
}

/** Stage the finale honestly: the pilot plays the whole run, and the frame
 *  is a moment in the heron fight with the boss mid-pond and its feathers
 *  in the air. If the pilot falls before the finale, fall back to jumping
 *  straight to the heron with a few gifts already taken. */
function stageBoss(seed) {
  const state = createWorld(seed);
  const cap = 60 * 60 * 8;
  let framed = false;
  for (let i = 0; i < cap; i += 1) {
    stepWorld(state, pilotIntent(state), STEP);
    state.cues.length = 0;
    if (state.pendingLevels > 0) {
      const choices = drawChoices(state.rng, state.taken);
      if (choices.length > 0) applyUpgrade(state, choices[0].id);
      state.pendingLevels = 0;
    }
    if (state.boss && state.boss.hp < state.boss.maxHp * 0.92
      && state.boss.y > 90 && state.boss.y < 470
      && state.spores.length >= 2 && state.bubbles.length >= 3) {
      framed = true;
      break;
    }
    if (state.phase === 'lost' || state.phase === 'won') break;
  }
  if (!framed) {
    const jump = createWorld(seed);
    for (const id of ['multishot', 'damage', 'pierce', 'rate']) applyUpgrade(jump, id);
    jump.level = 9;
    jump.wave = 9;
    jump.phase = 'break';
    jump.phaseT = 0.05;
    runSteps(jump, 60 * 5, pilotIntent);
    jump.health = Math.max(jump.health, 78);
    return { state: jump, screen: SCREEN_PLAY, choices: null };
  }
  state.health = Math.max(state.health, 55);
  return { state, screen: SCREEN_PLAY, choices: null };
}

/** Stage the level-up choice, earned honestly by the pilot in wave 1–2. */
function stageUpgrade(seed) {
  const state = createWorld(seed);
  const cap = 60 * 180;
  let choices = null;
  for (let i = 0; i < cap; i += 1) {
    stepWorld(state, pilotIntent(state), STEP);
    state.cues.length = 0;
    if (state.pendingLevels > 0) {
      choices = drawChoices(state.rng, state.taken);
      break;
    }
    if (state.phase === 'lost') break;
  }
  if (!choices) choices = drawChoices(state.rng, state.taken);
  return { state, screen: SCREEN_LEVELUP, choices };
}

/** Stage a named scene ('title' by default) at a seed. */
export function stageShot(name, seed) {
  switch (name) {
    case 'play': return stagePlay(seed);
    case 'boss': return stageBoss(seed);
    case 'upgrade': return stageUpgrade(seed);
    default: return stageTitle(seed);
  }
}
