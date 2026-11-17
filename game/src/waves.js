// The ten waves of a Pondlight run.
// A wave is a list of spawn groups; each group drips its foes in over a few
// seconds from the pond's edge. Waves 1–9 mix the five lesser foes in growing
// numbers (the armoured snail joins from wave 5), and wave 10 is the Shadow
// Heron alone. Clearing wave 10 wins.

import { KIND_BEETLE, KIND_DARTER, KIND_GNAT, KIND_HERON, KIND_MOTH, KIND_SNAIL } from './enemies.js';

export const TOTAL_WAVES = 10;

/** One wave's recipe: groups of {kind, count, delay, gap}. */
export const WAVES = [
  { groups: [{ kind: KIND_GNAT, count: 6, delay: 0.5, gap: 0.7 }] },
  { groups: [{ kind: KIND_GNAT, count: 9, delay: 0.5, gap: 0.6 }, { kind: KIND_DARTER, count: 2, delay: 6, gap: 1.4 }] },
  { groups: [{ kind: KIND_GNAT, count: 8, delay: 0.5, gap: 0.55 }, { kind: KIND_MOTH, count: 2, delay: 5, gap: 2.2 }, { kind: KIND_DARTER, count: 3, delay: 10, gap: 1.2 }] },
  { groups: [{ kind: KIND_BEETLE, count: 2, delay: 1, gap: 2.5 }, { kind: KIND_GNAT, count: 10, delay: 2, gap: 0.5 }, { kind: KIND_DARTER, count: 3, delay: 9, gap: 1.1 }] },
  { groups: [{ kind: KIND_MOTH, count: 3, delay: 0.5, gap: 2 }, { kind: KIND_GNAT, count: 12, delay: 3, gap: 0.45 }, { kind: KIND_BEETLE, count: 2, delay: 11, gap: 2.4 }, { kind: KIND_SNAIL, count: 2, delay: 16, gap: 3 }] },
  { groups: [{ kind: KIND_DARTER, count: 6, delay: 0.5, gap: 1 }, { kind: KIND_GNAT, count: 10, delay: 4, gap: 0.45 }, { kind: KIND_MOTH, count: 3, delay: 10, gap: 1.9 }, { kind: KIND_SNAIL, count: 2, delay: 15, gap: 3 }] },
  { groups: [{ kind: KIND_BEETLE, count: 4, delay: 0.5, gap: 2.2 }, { kind: KIND_DARTER, count: 5, delay: 5, gap: 1 }, { kind: KIND_GNAT, count: 12, delay: 8, gap: 0.4 }, { kind: KIND_SNAIL, count: 3, delay: 14, gap: 2.8 }] },
  { groups: [{ kind: KIND_MOTH, count: 5, delay: 0.5, gap: 1.7 }, { kind: KIND_BEETLE, count: 3, delay: 6, gap: 2.3 }, { kind: KIND_DARTER, count: 6, delay: 10, gap: 0.9 }, { kind: KIND_SNAIL, count: 3, delay: 15, gap: 2.8 }] },
  { groups: [{ kind: KIND_GNAT, count: 16, delay: 0.5, gap: 0.35 }, { kind: KIND_BEETLE, count: 4, delay: 6, gap: 2 }, { kind: KIND_MOTH, count: 4, delay: 9, gap: 1.6 }, { kind: KIND_DARTER, count: 6, delay: 12, gap: 0.9 }, { kind: KIND_SNAIL, count: 3, delay: 16, gap: 2.6 }] },
  { groups: [{ kind: KIND_HERON, count: 1, delay: 1.2, gap: 1 }] },
];

/** How much tougher foes get on a given wave (1-based). Past wave 10 the
 *  health curve flattens — endless waves grow by numbers and elites instead. */
export function waveScale(wave) {
  const w = wave - 1;
  return {
    wave,
    health: w <= 9 ? 1 + w * 0.16 : 2.44 + (w - 9) * 0.09,
    damage: 1 + w * 0.07,
    speed: 1 + Math.min(w, 14) * 0.018,
  };
}

/** Expand a wave's groups into a timed spawn queue, sorted by time.
 *  Waves past 10 are endless: the hard mixes recycle with growing counts,
 *  and every fifth wave the Shadow Heron returns with the mix as escort. */
export function buildSpawnQueue(wave) {
  const queue = [];
  if (wave > TOTAL_WAVES) {
    if (wave % 5 === 0) queue.push({ kind: KIND_HERON, at: 1.2 });
    const template = WAVES[4 + ((wave - 11) % 5)];
    const countMul = 1 + (wave - 10) * 0.12;
    for (const group of template.groups) {
      const count = Math.max(1, Math.round(group.count * countMul));
      for (let i = 0; i < count; i += 1) {
        queue.push({ kind: group.kind, at: group.delay + 2 + i * group.gap });
      }
    }
    queue.sort((a, b) => a.at - b.at);
    return queue;
  }
  const recipe = WAVES[wave - 1];
  for (const group of recipe.groups) {
    for (let i = 0; i < group.count; i += 1) {
      queue.push({ kind: group.kind, at: group.delay + i * group.gap });
    }
  }
  queue.sort((a, b) => a.at - b.at);
  return queue;
}

/** A spawn point just inside a random edge of the pond, away from the frog. */
export function spawnPoint(rng, player, field) {
  for (let tries = 0; tries < 12; tries += 1) {
    const edge = Math.floor(rng() * 4);
    const margin = 36;
    let x;
    let y;
    if (edge === 0) { x = margin + rng() * (field.width - margin * 2); y = margin; }
    else if (edge === 1) { x = margin + rng() * (field.width - margin * 2); y = field.height - margin; }
    else if (edge === 2) { x = margin; y = margin + rng() * (field.height - margin * 2); }
    else { x = field.width - margin; y = margin + rng() * (field.height - margin * 2); }
    if (Math.hypot(x - player.x, y - player.y) > 260) return { x, y };
    if (tries === 11) return { x, y };
  }
  return { x: field.width / 2, y: 40 };
}

/** The short breather between waves, in seconds. */
export const INTERMISSION_SECONDS = 3.2;
