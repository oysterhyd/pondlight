// Pondlight's entry point: the canvas, the fixed-step loop, and the screen
// machine (title → play ⇄ pause / level-up → game over / victory).
// The simulation lives in world.js and only advances in STEP-sized pieces,
// so the game plays the same at any refresh rate. Sound cues the world
// queues are played here, keeping world.js itself silent and deterministic.

import { FIELD, STEP } from './config.js';
import { createInput, moveVector, takePress } from './input.js';
import { createAudio } from './audio.js';
import { createWorld, stepWorld, applyUpgrade, PHASE_LOST, PHASE_WON } from './world.js';
import { drawChoices } from './upgrades.js';
import {
  drawWorld, drawHud, drawTitle, drawPaused, drawGameOver, drawVictory, drawLevelUp,
  cardRect, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSE, SCREEN_LEVELUP, SCREEN_OVER, SCREEN_WIN,
} from './render.js';
import { stageShot, pilotIntent } from './shots.js';

const BEST_KEY = 'pondlight-best-score';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');

function bestScore() {
  try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; }
}
function saveBest(value) {
  try { localStorage.setItem(BEST_KEY, String(value)); } catch { /* private mode */ }
}

/** Scale the logical pond to the window, letterboxed and centred. */
function fitCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  const scale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
  return {
    scale,
    offsetX: (canvas.width - FIELD.width * scale) / 2,
    offsetY: (canvas.height - FIELD.height * scale) / 2,
  };
}
let view = fitCanvas();
window.addEventListener('resize', () => { view = fitCanvas(); });

function toLogical(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const px = (clientX - rect.left) * (canvas.width / rect.width);
  const py = (clientY - rect.top) * (canvas.height / rect.height);
  return { x: (px - view.offsetX) / view.scale, y: (py - view.offsetY) / view.scale };
}

const input = createInput(canvas, toLogical);
const audio = createAudio();

let screen = SCREEN_TITLE;
let state = createWorld(20261117);
let demo = state;
let choices = null;
let best = bestScore();
let lastStatus = '';

function newRun() {
  const seed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
  state = createWorld(seed);
  demo = state;
  screen = SCREEN_PLAY;
  choices = null;
}

function playCues() {
  for (const cue of state.cues) {
    if (cue === 'shoot') audio.shoot();
    else if (cue === 'hit') audio.hit();
    else if (cue === 'pop') audio.pop();
    else if (cue === 'hurt') audio.hurt();
    else if (cue === 'dash') audio.dash();
    else if (cue === 'pickup') audio.pickup();
    else if (cue === 'heal') audio.heal();
    else if (cue === 'wave') audio.wave();
    else if (cue === 'boss') audio.boss();
    else if (cue === 'win') audio.win();
    else if (cue === 'lose') audio.lose();
    else if (cue === 'block') audio.block();
    else if (cue === 'splash') audio.splash();
    else if (cue === 'ripple') audio.ripple();
    else if (cue === 'bonus') audio.bonus();
  }
  state.cues.length = 0;
}

function playerIntent() {
  const move = moveVector(input);
  return {
    moveX: move.x,
    moveY: move.y,
    aimX: input.mouseX,
    aimY: input.mouseY,
    firing: input.mouseDown || input.keys.has('KeyJ'),
    dash: takePress(input, 'ShiftLeft', 'ShiftRight', 'Space'),
  };
}

function chooseUpgrade(index) {
  if (!choices || !choices[index]) return;
  applyUpgrade(state, choices[index].id);
  audio.levelup();
  state.pendingLevels -= 1;
  if (state.pendingLevels > 0) {
    choices = drawChoices(state.rng, state.taken);
  } else {
    choices = null;
    screen = SCREEN_PLAY;
  }
}

function handleScreenKeys() {
  if (takePress(input, 'KeyM')) audio.toggleMute();
  if (screen === SCREEN_TITLE) {
    if (takePress(input, 'Enter', 'Space') || input.clickedAt) { input.clickedAt = null; audio.unlock(); newRun(); }
  } else if (screen === SCREEN_PLAY) {
    if (takePress(input, 'KeyP', 'Escape')) screen = SCREEN_PAUSE;
  } else if (screen === SCREEN_PAUSE) {
    if (takePress(input, 'KeyP', 'Escape', 'Enter')) screen = SCREEN_PLAY;
  } else if (screen === SCREEN_LEVELUP) {
    if (takePress(input, 'Digit1')) chooseUpgrade(0);
    else if (takePress(input, 'Digit2')) chooseUpgrade(1);
    else if (takePress(input, 'Digit3')) chooseUpgrade(2);
    if (input.clickedAt) {
      const click = input.clickedAt;
      input.clickedAt = null;
      for (let i = 0; i < 3; i += 1) {
        const r = cardRect(i);
        if (click.x >= r.x && click.x <= r.x + r.w && click.y >= r.y && click.y <= r.y + r.h) chooseUpgrade(i);
      }
    }
  } else if (screen === SCREEN_OVER || screen === SCREEN_WIN) {
    if (takePress(input, 'KeyR', 'Enter') || input.clickedAt) { input.clickedAt = null; newRun(); }
  }
}

let accumulator = 0;
let lastTime = performance.now();

function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;
  handleScreenKeys();
  audio.updateMusic(screen === SCREEN_PLAY);

  if (screen === SCREEN_TITLE) {
    // Attract mode: the demo pond plays itself behind the title.
    accumulator += dt;
    while (accumulator >= STEP) {
      accumulator -= STEP;
      stepWorld(demo, pilotIntent(demo), STEP);
      demo.cues.length = 0;
      if (demo.pendingLevels > 0) {
        const demoChoices = drawChoices(demo.rng, demo.taken);
        if (demoChoices.length > 0) applyUpgrade(demo, demoChoices[0].id);
        demo.pendingLevels = 0;
      }
      if (demo.phase === PHASE_LOST || demo.phase === PHASE_WON) {
        demo = createWorld((Math.random() * 0xffffffff) >>> 0);
        state = demo;
      }
    }
  } else if (screen === SCREEN_PLAY) {
    if (state.fx.hitStop > 0) {
      state.fx.hitStop -= dt;
    } else {
      accumulator += dt;
      let guard = 0;
      while (accumulator >= STEP && guard < 8) {
        accumulator -= STEP;
        guard += 1;
        stepWorld(state, playerIntent(), STEP);
        if (state.pendingLevels > 0) {
          choices = drawChoices(state.rng, state.taken);
          screen = SCREEN_LEVELUP;
          accumulator = 0;
          break;
        }
        if (state.phase === PHASE_LOST) { screen = SCREEN_OVER; break; }
        if (state.phase === PHASE_WON) { screen = SCREEN_WIN; break; }
      }
      if (guard >= 8) accumulator = 0;
    }
    playCues();
    if ((screen === SCREEN_OVER || screen === SCREEN_WIN) && state.score > best) {
      best = state.score;
      saveBest(best);
    }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#06222e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(view.scale, 0, 0, view.scale, view.offsetX, view.offsetY);
  drawWorld(ctx, state);
  if (screen === SCREEN_TITLE) drawTitle(ctx, state, best);
  else {
    drawHud(ctx, state, { muted: audio.muted, banner: screen === SCREEN_PLAY });
    if (screen === SCREEN_PAUSE) drawPaused(ctx, state);
    else if (screen === SCREEN_LEVELUP && choices) drawLevelUp(ctx, state, choices);
    else if (screen === SCREEN_OVER) drawGameOver(ctx, state, best);
    else if (screen === SCREEN_WIN) drawVictory(ctx, state, best);
  }

  const line = screen === SCREEN_TITLE
    ? 'Pondlight title screen. Click or press Enter to play.'
    : `Wave ${state.wave}, score ${state.score}, health ${Math.ceil(state.health)}.`;
  if (line !== lastStatus) { status.textContent = line; lastStatus = line; }
  // One-shot presses live for exactly one frame: the screen keys above and
  // the player's dash (inside playerIntent, during the world steps) both
  // consume from the same set, so clearing happens here, after both.
  input.pressed.clear();
}

/* Screenshot mode: ?shot=title|play|boss|upgrade&seed=1 renders one staged
 * frame of the real game and then holds it, for taking the entry's shots. */
const params = new URLSearchParams(window.location.search);
if (params.has('shot')) {
  const staged = stageShot(params.get('shot'), Number(params.get('seed') ?? 1) || 1);
  state = staged.state;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  view = fitCanvas();
  ctx.setTransform(view.scale, 0, 0, view.scale, view.offsetX, view.offsetY);
  drawWorld(ctx, state);
  if (staged.screen === SCREEN_TITLE) drawTitle(ctx, state, 0);
  else if (staged.screen === SCREEN_LEVELUP) { drawHud(ctx, state, { banner: false }); drawLevelUp(ctx, state, staged.choices ?? []); }
  else drawHud(ctx, state, {});
  window.__pondlightShot = params.get('shot');
} else {
  window.__pondlight = { get state() { return state; }, newRun };
  requestAnimationFrame(frame);
}
