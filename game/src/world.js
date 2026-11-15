// The simulation: the warden, the glooms, the bolts, the shards, the waves and the win.
// It knows nothing about the screen or the keyboard; main.js feeds it a steering vector
// each fixed step and reads back events and counters. Everything here is deterministic
// from the seed, so a screenshot scene can replay a fixed number of steps.

import { BOSS_WAVE, ENEMY_TYPES, FIELD, PLAYER, STEP, WAVE, WAVES } from './config.js';
import { rollUpgrades, UPGRADES } from './upgrades.js';

export const EVENT_HIT = 1;
export const EVENT_OVER = 2;
export const EVENT_WIN = 4;
export const EVENT_LEVELUP = 8;
export const EVENT_WAVE = 16;

export const KIND_MOTE = 'mote';
export const KIND_SKITTER = 'skitter';
export const KIND_BRUTE = 'brute';
export const KIND_HERALD = 'herald';

const COST = { mote: 1, skitter: 2, brute: 4 };

export function createWorld(random) {
  const state = {};
  reset();

  function reset() {
    state.time = 0;
    state.spawnTimer = 0;
    state.trickleTimer = 4;
    state.player = {
      x: FIELD.width / 2,
      y: FIELD.height / 2,
      hp: PLAYER.maxHp,
      maxHp: PLAYER.maxHp,
      speed: PLAYER.speed,
      radius: PLAYER.radius,
      level: 1,
      xp: 0,
      xpNeed: PLAYER.xpNeedBase + PLAYER.xpNeedPerLevel,
      fireTimer: 0.3,
      damage: PLAYER.boltDamage,
      fireInterval: PLAYER.fireInterval,
      projectiles: 1,
      pierce: 0,
      magnet: PLAYER.magnet,
      auraLevel: 0,
      auraRadius: 0,
      auraDps: 0,
      grace: 0,
    };
    state.enemies = [];
    state.bullets = [];
    state.gems = [];
    state.particles = [];
    state.floats = [];
    state.kills = 0;
    state.score = 0;
    state.shards = 0;
    state.levelUps = 0;
    state.upgradeLevels = {};
    state.over = false;
    state.won = false;
    state.levelUpPending = false;
    state.choices = [];
    state.shake = 0;
    state.flash = 0;
    state.shotsFired = 0;
    state.pickups = 0;
    startWave(1);
  }

  /** Build the spawn queue for a wave from its point budget. */
  function buildSpawnQueue(wave) {
    let budget = WAVE.budgetBase + WAVE.budgetPerWave * wave;
    const queue = [];
    while (budget > 0) {
      const moteWeight = 5;
      const skitterWeight = 2 + wave;
      const bruteWeight = wave >= 2 ? 1 + wave / 2 : 0;
      const total = moteWeight + skitterWeight + bruteWeight;
      const roll = random() * total;
      let kind = KIND_MOTE;
      if (roll > moteWeight + skitterWeight) kind = KIND_BRUTE;
      else if (roll > moteWeight) kind = KIND_SKITTER;
      if (COST[kind] > budget) kind = KIND_MOTE;
      budget -= COST[kind];
      queue.push(kind);
    }
    // Shuffle so the kinds arrive mixed.
    for (let i = queue.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }
    return queue;
  }

  function startWave(wave) {
    state.wave = wave;
    state.waveState = 'banner';
    state.waveTimer = WAVE.bannerSeconds;
    state.spawnQueue = wave === BOSS_WAVE ? [KIND_HERALD] : buildSpawnQueue(wave);
    state.spawnTimer = 0.4;
    state.trickleTimer = 4;
  }

  function spawnPoint() {
    const side = Math.floor(random() * 4);
    const margin = 30;
    if (side === 0) return { x: random() * FIELD.width, y: -margin };
    if (side === 1) return { x: FIELD.width + margin, y: random() * FIELD.height };
    if (side === 2) return { x: random() * FIELD.width, y: FIELD.height + margin };
    return { x: -margin, y: random() * FIELD.height };
  }

  function spawnEnemy(kind, x, y) {
    const type = ENEMY_TYPES[kind];
    const point = x === undefined ? spawnPoint() : { x, y };
    state.enemies.push({
      kind,
      x: point.x,
      y: point.y,
      hp: type.hp * (1 + 0.12 * (state.wave - 1)),
      maxHp: type.hp * (1 + 0.12 * (state.wave - 1)),
      speed: type.speed * (0.9 + random() * 0.2),
      radius: type.radius,
      damage: type.damage,
      xp: type.xp,
      score: type.score,
      color: type.color,
      touch: 0,
      flash: 0,
      wobble: random() * Math.PI * 2,
    });
  }

  function nearestEnemy(x, y, maxDist) {
    let best = null;
    let bestDist = maxDist;
    for (const enemy of state.enemies) {
      const dist = Math.hypot(enemy.x - x, enemy.y - y);
      if (dist < bestDist) {
        bestDist = dist;
        best = enemy;
      }
    }
    return best;
  }

  function addFloat(x, y, text, color, size = 13) {
    if (state.floats.length >= 48) state.floats.shift();
    state.floats.push({ x, y, text, color, size, life: 0.8, maxLife: 0.8 });
  }

  function burst(x, y, color, count, speed = 160, size = 3) {
    for (let i = 0; i < count; i += 1) {
      if (state.particles.length >= 512) state.particles.shift();
      const angle = random() * Math.PI * 2;
      const velocity = speed * (0.3 + random() * 0.7);
      state.particles.push({
        x,
        y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        life: 0.35 + random() * 0.35,
        maxLife: 0.7,
        size: size * (0.6 + random() * 0.8),
        color,
      });
    }
  }

  function fireVolley() {
    const player = state.player;
    const target = nearestEnemy(player.x, player.y, PLAYER.boltRange);
    if (!target) return;
    const baseAngle = Math.atan2(target.y - player.y, target.x - player.x);
    const count = player.projectiles;
    for (let i = 0; i < count; i += 1) {
      const spread = (i - (count - 1) / 2) * 0.14;
      const angle = baseAngle + spread;
      state.bullets.push({
        x: player.x + Math.cos(angle) * (player.radius + 6),
        y: player.y + Math.sin(angle) * (player.radius + 6),
        vx: Math.cos(angle) * PLAYER.boltSpeed,
        vy: Math.sin(angle) * PLAYER.boltSpeed,
        damage: player.damage,
        pierce: player.pierce,
        life: 1.4,
        radius: PLAYER.boltRadius,
      });
    }
    state.shotsFired += 1;
  }

  function damageEnemy(enemy, amount) {
    enemy.hp -= amount;
    enemy.flash = 0.12;
    addFloat(enemy.x, enemy.y - enemy.radius - 4, String(Math.round(amount)), '#ffd166', 12);
    if (enemy.hp <= 0) killEnemy(enemy);
  }

  function killEnemy(enemy) {
    const index = state.enemies.indexOf(enemy);
    if (index !== -1) state.enemies.splice(index, 1);
    state.kills += 1;
    state.score += enemy.score;
    burst(enemy.x, enemy.y, enemy.color, enemy.kind === KIND_HERALD ? 60 : 12, 200, 4);
    burst(enemy.x, enemy.y, '#ffd166', 6, 120, 3);
    state.gems.push({
      x: enemy.x,
      y: enemy.y,
      value: enemy.xp,
      vx: (random() - 0.5) * 90,
      vy: (random() - 0.5) * 90,
    });
    if (enemy.kind === KIND_HERALD) {
      state.won = true;
      state.score += 1000;
    }
  }

  function addXp(value) {
    const player = state.player;
    player.xp += value;
    while (player.xp >= player.xpNeed) {
      player.xp -= player.xpNeed;
      player.level += 1;
      player.xpNeed = PLAYER.xpNeedBase + PLAYER.xpNeedPerLevel * player.level;
      state.levelUps += 1;
      burst(player.x, player.y, '#6ee7ff', 24, 220, 3);
      addFloat(player.x, player.y - 30, 'LEVEL UP!', '#6ee7ff', 18);
    }
  }

  function offerChoices() {
    state.choices = rollUpgrades(random, state.upgradeLevels);
    state.levelUpPending = true;
  }

  function applyUpgrade(id) {
    const choice = state.choices.find((upgrade) => upgrade.id === id);
    if (!choice) return false;
    const def = UPGRADES.find((upgrade) => upgrade.id === id);
    def.apply(state.player);
    state.upgradeLevels[id] = (state.upgradeLevels[id] ?? 0) + 1;
    state.choices = [];
    state.levelUpPending = false;
    // Overflow XP can level the player twice from one shard.
    if (state.player.xp >= state.player.xpNeed) {
      addXp(0);
      offerChoices();
    }
    return true;
  }

  function hurtPlayer(amount) {
    const player = state.player;
    if (player.grace > 0) return;
    player.hp -= amount;
    player.grace = PLAYER.contactGrace;
    state.shake = 11;
    state.flash = 0.45;
    burst(player.x, player.y, '#ff5d73', 10, 180, 3);
    if (player.hp <= 0) {
      player.hp = 0;
      state.over = true;
    }
  }

  /**
   * Advance the world one fixed step. `demo` runs an attract mode: the warden cannot die
   * and level-ups apply themselves, so the title screen has a living world behind it.
   */
  function step(dt, moveX, moveY, demo = false) {
    updateParticles(dt);
    updateFloats(dt);
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 30);
    if (state.flash > 0) state.flash = Math.max(0, state.flash - dt * 1.6);
    if (state.over || state.won || state.levelUpPending) return 0;

    let events = 0;
    state.time += dt;
    const player = state.player;
    if (player.grace > 0) player.grace -= dt;

    // Wave flow: banner, then the fight, then a short clear pause.
    if (state.waveState === 'banner') {
      state.waveTimer -= dt;
      if (state.waveTimer <= 0) {
        state.waveState = 'fight';
        events |= EVENT_WAVE;
      }
    } else if (state.waveState === 'fight') {
      if (state.spawnQueue.length > 0) {
        state.spawnTimer -= dt;
        const interval = Math.max(
          WAVE.intervalMin,
          WAVE.intervalStart * Math.pow(WAVE.intervalScale, state.wave - 1),
        );
        if (state.spawnTimer <= 0 && state.enemies.length < WAVE.maxAlive) {
          spawnEnemy(state.spawnQueue.shift());
          state.spawnTimer = interval;
        }
      } else if (state.wave === BOSS_WAVE) {
        // The Herald calls motes while it lives.
        state.trickleTimer -= dt;
        if (state.trickleTimer <= 0 && state.enemies.length < WAVE.maxAlive) {
          spawnEnemy(KIND_MOTE);
          spawnEnemy(KIND_MOTE);
          state.trickleTimer = 4;
        }
      } else if (state.enemies.length === 0) {
        state.waveState = 'clear';
        state.waveTimer = WAVE.clearSeconds;
        state.score += 150;
        events |= EVENT_WAVE;
      }
    } else if (state.waveState === 'clear') {
      state.waveTimer -= dt;
      if (state.waveTimer <= 0) startWave(state.wave + 1);
    }

    // Steering: clamp the warden to the field.
    const length = Math.hypot(moveX, moveY);
    if (length > 0) {
      player.x += (moveX / length) * player.speed * dt;
      player.y += (moveY / length) * player.speed * dt;
    }
    player.x = Math.min(FIELD.width - player.radius, Math.max(player.radius, player.x));
    player.y = Math.min(FIELD.height - player.radius, Math.max(player.radius, player.y));

    // The lantern fires on its own at the nearest gloom in range.
    player.fireTimer -= dt;
    if (player.fireTimer <= 0) {
      fireVolley();
      player.fireTimer = player.fireInterval;
    }

    // The ember aura sears whatever stands too close.
    if (player.auraLevel > 0) {
      for (const enemy of [...state.enemies]) {
        if (Math.hypot(enemy.x - player.x, enemy.y - player.y) <= player.auraRadius + enemy.radius) {
          damageEnemy(enemy, player.auraDps * dt);
        }
      }
    }

    updateBullets(dt);
    updateEnemies(dt, demo);
    updateGems(dt);

    // Contact damage, with a short grace window after each hit.
    for (const enemy of state.enemies) {
      if (enemy.touch > 0) enemy.touch -= dt;
      const dist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
      if (dist < enemy.radius + player.radius && enemy.touch <= 0) {
        enemy.touch = 0.9;
        if (!demo) {
          hurtPlayer(enemy.damage);
          events |= EVENT_HIT;
          if (state.over) events |= EVENT_OVER;
        }
      }
    }

    // Shards feed the level track; a level-up pauses the world for a choice.
    if (player.xp >= player.xpNeed) {
      addXp(0);
      if (demo) {
        const pick = rollUpgrades(random, state.upgradeLevels)[0];
        if (pick) {
          UPGRADES.find((u) => u.id === pick.id).apply(player);
          state.upgradeLevels[pick.id] = (state.upgradeLevels[pick.id] ?? 0) + 1;
        }
      } else {
        offerChoices();
        events |= EVENT_LEVELUP;
      }
    }

    if (state.won) events |= EVENT_WIN;
    return events;
  }

  function updateBullets(dt) {
    for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
      const bullet = state.bullets[i];
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.life -= dt;
      let dead = bullet.life <= 0 || bullet.x < -20 || bullet.x > FIELD.width + 20 || bullet.y < -20 || bullet.y > FIELD.height + 20;
      if (!dead) {
        for (const enemy of [...state.enemies]) {
          if (Math.hypot(enemy.x - bullet.x, enemy.y - bullet.y) < enemy.radius + bullet.radius) {
            damageEnemy(enemy, bullet.damage);
            burst(bullet.x, bullet.y, '#ffc46b', 3, 100, 2);
            if (bullet.pierce > 0) {
              bullet.pierce -= 1;
            } else {
              dead = true;
            }
            break;
          }
        }
      }
      if (dead) state.bullets.splice(i, 1);
    }
  }

  function updateEnemies(dt, demo) {
    const player = state.player;
    for (const enemy of state.enemies) {
      if (enemy.flash > 0) enemy.flash -= dt;
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const dist = Math.hypot(dx, dy) || 1;
      // The Herald drifts in a slow circle instead of charging straight in.
      if (enemy.kind === KIND_HERALD) {
        const angle = Math.atan2(dy, dx) + 0.9;
        enemy.x += Math.cos(angle) * enemy.speed * dt;
        enemy.y += Math.sin(angle) * enemy.speed * dt;
      } else {
        enemy.x += (dx / dist) * enemy.speed * dt;
        enemy.y += (dy / dist) * enemy.speed * dt;
      }
      enemy.wobble += dt * 3;
    }
    // Push overlapping glooms apart so they never stack into one blob.
    for (let i = 0; i < state.enemies.length; i += 1) {
      for (let j = i + 1; j < state.enemies.length; j += 1) {
        const a = state.enemies[i];
        const b = state.enemies[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        const min = a.radius + b.radius;
        if (dist > 0 && dist < min) {
          const push = (min - dist) / 2;
          const nx = dx / dist;
          const ny = dy / dist;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
        }
      }
    }
    if (demo) return;
  }

  function updateGems(dt) {
    const player = state.player;
    for (let i = state.gems.length - 1; i >= 0; i -= 1) {
      const gem = state.gems[i];
      gem.x += gem.vx * dt;
      gem.y += gem.vy * dt;
      gem.vx *= 0.9;
      gem.vy *= 0.9;
      const dx = player.x - gem.x;
      const dy = player.y - gem.y;
      const dist = Math.hypot(dx, dy);
      if (dist < player.magnet) {
        const pull = 620 * dt;
        gem.x += (dx / (dist || 1)) * pull;
        gem.y += (dy / (dist || 1)) * pull;
      }
      if (dist < player.radius + 14) {
        state.gems.splice(i, 1);
        state.shards += 1;
        state.score += 2;
        state.pickups += 1;
        player.xp += gem.value;
        burst(gem.x, gem.y, '#6ee7ff', 3, 90, 2);
      }
    }
  }

  function updateParticles(dt) {
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const particle = state.particles[i];
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 0.94;
      particle.vy *= 0.94;
      particle.life -= dt;
      if (particle.life <= 0) state.particles.splice(i, 1);
    }
  }

  function updateFloats(dt) {
    for (let i = state.floats.length - 1; i >= 0; i -= 1) {
      const float = state.floats[i];
      float.y -= 34 * dt;
      float.life -= dt;
      if (float.life <= 0) state.floats.splice(i, 1);
    }
  }

  return { state, reset, step, applyUpgrade, startWave };
}
