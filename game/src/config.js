// Every tuning number and colour in one place. The playfield is a fixed 1280x720 logical
// area; the renderer scales it to the window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** How many waves a run lasts; wave 10 holds the boss, and beating it wins the run. */
export const WAVES = 10;
export const BOSS_WAVE = 10;

export const PLAYER = {
  radius: 16,
  speed: 265,
  maxHp: 100,
  fireInterval: 0.42,
  boltSpeed: 680,
  boltDamage: 12,
  boltRange: 560,
  boltRadius: 5,
  magnet: 95,
  xpNeedBase: 6,
  xpNeedPerLevel: 3,
  contactGrace: 0.55,
};

/** Enemy kinds: hit points, speed, size, contact damage, XP value and score value. */
export const ENEMY_TYPES = {
  mote: { hp: 18, speed: 74, radius: 12, damage: 8, xp: 1, score: 10, color: '#b388ff' },
  skitter: { hp: 10, speed: 158, radius: 9, damage: 6, xp: 1, score: 10, color: '#ff5d8f' },
  brute: { hp: 66, speed: 47, radius: 21, damage: 16, xp: 3, score: 25, color: '#ff6b4a' },
  herald: { hp: 980, speed: 54, radius: 36, damage: 24, xp: 25, score: 500, color: '#e5484d' },
};

/** Spawn budget in points (mote 1, skitter 2, brute 4) and the seconds between spawns. */
export const WAVE = {
  budgetBase: 6,
  budgetPerWave: 5,
  intervalStart: 1.15,
  intervalMin: 0.34,
  intervalScale: 0.9,
  bannerSeconds: 3,
  clearSeconds: 2.2,
  maxAlive: 70,
};

/** How many things can exist at once; the pools are allocated once, at boot. */
export const POOL = { enemies: 96, bullets: 128, gems: 256, particles: 512, floats: 48 };

export const PALETTE = {
  backdrop: '#0c0e1d',
  horizon: '#171a33',
  ground: '#10122a',
  star: '#cdd6ff',
  ember: '#ff9a3c',
  gold: '#ffd166',
  shard: '#6ee7ff',
  player: '#ffb347',
  playerCore: '#fff3d6',
  bullet: '#ffc46b',
  panel: 'rgba(16, 19, 38, 0.92)',
  panelEdge: '#3a4066',
  text: '#f2f0ff',
  muted: '#9aa0c3',
  hp: '#ff5d73',
  hpBack: '#2a2033',
  xp: '#6ee7ff',
  danger: '#ff5d73',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'emberward.best';
