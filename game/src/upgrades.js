// The level-up upgrades. When the frog gathers enough fireflies it levels,
// the game pauses, and the player picks one of three cards. Each upgrade is a
// small pure change to the player's derived stats, so stacking is easy to
// reason about: world.js recomputes the stats from the list of taken ids.
//
// Icons are drawn by render.js from the `icon` name, keeping this file data.

export const UPGRADES = [
  {
    id: 'damage',
    name: 'Stronger Bubbles',
    icon: 'burst',
    blurb: '+22% bubble damage',
    apply: (s) => { s.damage *= 1.22; },
  },
  {
    id: 'rate',
    name: 'Quick Breath',
    icon: 'wind',
    blurb: '+16% fire rate',
    apply: (s) => { s.fireInterval /= 1.16; },
  },
  {
    id: 'multishot',
    name: 'Twin Blow',
    icon: 'twin',
    blurb: '+1 bubble per shot, −8% damage each',
    max: 4,
    apply: (s) => { s.shots += 1; s.damage *= 0.92; },
  },
  {
    id: 'pierce',
    name: 'Piercing Pop',
    icon: 'spear',
    blurb: 'Bubbles pass through +1 foe',
    max: 4,
    apply: (s) => { s.pierce += 1; },
  },
  {
    id: 'speed',
    name: 'Webbed Feet',
    icon: 'foot',
    blurb: '+9% move speed',
    apply: (s) => { s.speed *= 1.09; },
  },
  {
    id: 'health',
    name: 'Big Lunch',
    icon: 'heart',
    blurb: '+20 max health and heal 20',
    apply: (s) => { s.maxHealth += 20; s.healOnTake += 20; },
  },
  {
    id: 'magnet',
    name: 'Firefly Charm',
    icon: 'magnet',
    blurb: '+55% firefly pull range',
    apply: (s) => { s.magnet *= 1.55; },
  },
  {
    id: 'dash',
    name: 'Slippery Hop',
    icon: 'dash',
    blurb: 'Dash recharges 25% faster',
    max: 4,
    apply: (s) => { s.dashCooldown *= 0.75; },
  },
  {
    id: 'size',
    name: 'Big Bubbles',
    icon: 'orb',
    blurb: '+30% bubble size, +6% damage',
    max: 4,
    apply: (s) => { s.bubbleRadius *= 1.3; s.damage *= 1.06; },
  },
  {
    id: 'regen',
    name: 'Pond Regrowth',
    icon: 'leaf',
    blurb: 'Regain 0.7 health per second',
    max: 5,
    apply: (s) => { s.regen += 0.7; },
  },
  {
    id: 'swift',
    name: 'Swift Bubbles',
    icon: 'bolt',
    blurb: '+18% bubble speed and range',
    apply: (s) => { s.bubbleSpeed *= 1.18; s.bubbleLife *= 1.18; },
  },
  {
    id: 'guard',
    name: 'Thick Skin',
    icon: 'shield',
    blurb: 'Take 10% less damage',
    max: 4,
    apply: (s) => { s.armour *= 0.9; },
  },
];

/** The frog's derived stats before any upgrade is applied. */
export function baseStats(config) {
  const { PLAYER, BUBBLE } = config;
  return {
    damage: BUBBLE.damage,
    fireInterval: BUBBLE.fireInterval,
    shots: 1,
    pierce: 0,
    speed: PLAYER.speed,
    maxHealth: PLAYER.maxHealth,
    magnet: PLAYER.magnetBase,
    dashCooldown: PLAYER.dashCooldown,
    bubbleRadius: BUBBLE.radius,
    bubbleSpeed: BUBBLE.speed,
    bubbleLife: BUBBLE.lifeSeconds,
    regen: PLAYER.regenBase,
    armour: 1,
    healOnTake: 0,
  };
}

/** Recompute derived stats from the list of taken upgrade ids. */
export function computeStats(config, takenIds) {
  const stats = baseStats(config);
  for (const id of takenIds) {
    const upgrade = UPGRADES.find((u) => u.id === id);
    if (upgrade) upgrade.apply(stats);
  }
  return stats;
}

/** How many times an upgrade has been taken. */
export function timesTaken(takenIds, id) {
  return takenIds.reduce((n, t) => n + (t === id ? 1 : 0), 0);
}

/** Draw three distinct upgrades the frog may still take. */
export function drawChoices(rng, takenIds) {
  const pool = UPGRADES.filter((u) => !u.max || timesTaken(takenIds, u.id) < u.max);
  const choices = [];
  const copy = [...pool];
  while (choices.length < 3 && copy.length > 0) {
    const index = Math.floor(rng() * copy.length);
    choices.push(copy.splice(index, 1)[0]);
  }
  return choices;
}
