// Pondlight — tuning constants for the whole game.
// Every number the simulation uses lives here, so the balance of a run can be
// changed in one place: the field, the frog, the bubbles, the foes, the waves.

/** The logical size of the pond. The canvas scales this to the window. */
export const FIELD = { width: 1280, height: 720 };

/** The simulation advances in fixed steps so a run is deterministic per seed. */
export const STEP = 1 / 60;

/** The milk frog the player drives. */
export const PLAYER = {
  radius: 21,
  speed: 268,
  maxHealth: 100,
  /** Seconds of invulnerability after taking a hit. */
  hurtGrace: 0.65,
  /** The dash: a quick hop that passes through danger. */
  dashSpeed: 880,
  dashSeconds: 0.16,
  dashCooldown: 1.6,
  dashGrace: 0.28,
  /** How close a firefly must drift before it is drawn to the frog. */
  magnetBase: 74,
  /** Health regained per second once the Regrowth upgrade is taken. */
  regenBase: 0,
  /** Damage the dash itself deals to a foe it passes through: the dash is
   *  a weapon as well as an escape, once per foe per dash. */
  dashDamage: 22,
};

/** The bubbles the frog blows. One entry per shot before upgrades multiply them. */
export const BUBBLE = {
  radius: 7,
  speed: 640,
  lifeSeconds: 0.95,
  damage: 12,
  fireInterval: 0.21,
  spreadRadians: 0.055,
};

/** Enemy base stats, before the per-wave scaling in waves.js. */
export const FOE = {
  gnat: { radius: 13, health: 16, speed: 118, damage: 8, score: 30, fireflies: 1 },
  darter: { radius: 15, health: 30, speed: 92, damage: 12, score: 55, fireflies: 2 },
  moth: { radius: 17, health: 38, speed: 64, damage: 10, score: 80, fireflies: 2 },
  beetle: { radius: 23, health: 110, speed: 44, damage: 16, score: 130, fireflies: 3 },
  snail: { radius: 20, health: 150, speed: 30, damage: 12, score: 160, fireflies: 3 },
  heron: { radius: 54, health: 1500, speed: 56, damage: 20, score: 3000, fireflies: 24 },
};

/** The armoured snail: tucked into its shell it shrugs off most damage;
 *  peeking out to crawl, it takes extra. Its cycle is the fight. */
export const SNAIL = { peekSeconds: 2.4, tuckSeconds: 1.7, tuckedArmour: 0.3, peekVulnerability: 1.3 };

/** Elite foes: from the middle waves, some lesser foes arrive gilded —
 *  bigger, tougher, worth far more, and generous with their drops. */
export const ELITE = { fromWave: 5, chance: 0.13, radiusMul: 1.32, healthMul: 2.6, speedMul: 0.94, scoreMul: 3, firefliesBonus: 2, heartChance: 0.3, dragonflyChance: 0.12 };

/** A moth's spore: the only enemy projectile besides the heron's feather fan. */
export const SPORE = { radius: 6, speed: 215, lifeSeconds: 3.4, damage: 9 };

/** The heron's attacks, tuned so the finale is busy but readable. */
export const HERON = {
  fanCount: 7,
  fanSpread: 1.15,
  fanSpeed: 265,
  fanInterval: 2.6,
  swoopSpeed: 430,
  swoopWarnSeconds: 0.75,
  swoopEvery: 5.2,
  summonEvery: 7.5,
  summonCount: 3,
  enrageBelow: 0.35,
};

/** Fireflies are experience: gather them to level up and choose an upgrade. */
export const FIREFLY = {
  radius: 6,
  driftSpeed: 26,
  collectRadius: 30,
  magnetSpeed: 430,
  /** Experience needed for level n is BASE + (n - 1) * GROWTH. */
  xpBase: 5,
  xpGrowth: 4,
};

/** Combo: kills chained inside the window multiply the score they pay. */
export const COMBO = { windowSeconds: 2.6, maxMultiplier: 8 };

/** The palette. Pond water, lily greens, and the milk frog's own colours:
 *  bright yellow skin, a cream belly, deep green eyes, dark toe tips. */
export const COLORS = {
  waterDeep: '#0b2e3d',
  waterMid: '#11485c',
  waterLight: '#1a6a80',
  foam: '#bfeaf2',
  lily: '#2e7d4f',
  lilyDark: '#1f5c39',
  lilyFlower: '#f6a8c1',
  frogSkin: '#f7c948',
  frogBelly: '#fdf3d8',
  frogEye: '#1d7a3a',
  frogToe: '#37474f',
  bubble: '#cfeffb',
  firefly: '#ffe066',
  heart: '#ff6b81',
  gnat: '#8d6e63',
  darter: '#4fc3f7',
  moth: '#b39ddb',
  beetle: '#5d4037',
  snail: '#a1887f',
  heron: '#455a64',
  heronBeak: '#ffb300',
  text: '#eaf7fa',
  textDim: '#9fc6cf',
  danger: '#ff5252',
  gold: '#ffd54f',
};
