# pondlight

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/oysterhyd/pondlight/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/oysterhyd/pondlight/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

**Pondlight** is a complete arena-survival game for the desktop browser. You are the milk frog — bright yellow, cream belly, green eyes — and your pond has been invaded. Blow bubbles to pop ten waves of gnats, darters, spore moths and armoured beetles; gather the fireflies they drop to level up and choose from twelve gifts (twin bubbles, piercing pops, a slippery dash, pond regrowth…); then face the Shadow Heron, who fans feathers, summons gnats and swoops across the water on a telegraphed line.

It is one static site: plain ES modules under `game/`, no build step, no library, no network request. Sound and music are synthesised with WebAudio, the art is drawn in code, and the simulation runs on a fixed 60 Hz step from a seeded RNG, so every run is reproducible. It keeps your best score in `localStorage`.

**Controls** — WASD / arrows swim · mouse aims, hold to blow bubbles · Shift / Space dash · P pause · M mute · on level-up, click a card or press 1 · 2 · 3.

## Run it

```sh
node serve.ts
# then open http://localhost:8080
```

Node 22.18 or later runs the TypeScript server as it is; there is nothing to install. To hand the game in the way the grader does:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

That copies `game/` and `screenshots/` into `out/` and writes `out/dossier.json` with the vendored library in `vendor/makefun-game.ts` (the kit's copy, unchanged).

## How it is put together

- `game/src/config.js` — every tuning number: field, frog, bubbles, foes, the heron, combo, palette
- `game/src/world.js` — the whole simulation in fixed steps: spawning, collisions, combo, waves, winning and losing
- `game/src/enemies.js` — the five foes and their behaviours, including the heron's fan, summons and swoop
- `game/src/player.js` — the frog: movement, dash, and the bubble weapon
- `game/src/upgrades.js` — the twelve level-up gifts and the derived stats they stack into
- `game/src/waves.js` — the ten wave recipes and their scaling
- `game/src/pickups.js` — fireflies (experience), lily hearts and the dragonfly blast
- `game/src/render.js` — all drawing: pond, creatures, HUD and the title / pause / level-up / ending screens
- `game/src/audio.js` — WebAudio-synthesised effects and the generative pentatonic music
- `game/src/particles.js` — droplet bursts, motes, rings and floating text, in fixed-size pools
- `game/src/input.js`, `game/src/random.js` — input state, and the seeded RNG with geometry helpers
- `game/src/shots.js` — deterministic screenshot scenes (`?shot=title|play|boss|upgrade&seed=n`) that stage real autopilot play for the four screenshots in `screenshots/`
- `main.ts` — the hand-in program; `serve.ts` — the local static server

MIT licensed — see `LICENSE`.

---
<sub>Entered on [make.fun](https://make.fun/?ref=32svpeq5&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
