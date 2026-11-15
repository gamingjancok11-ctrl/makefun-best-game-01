// The screenshot scenes behind ?shot=start|play|upgrade|end. Each one plays the real rules
// forward from a fresh world for a fixed number of steps, steered by a simple autopilot
// (chase the nearest shard, keep clear of the nearest gloom), so the frame is what a short
// game really looks like and the same seed always gives the same frame.
import { STEP } from './config.js';
import { EVENT_OVER, EVENT_WIN } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_UPGRADE, SCREEN_WIN } from './render.js';

const START_SECONDS = 5;
const PLAY_LIMIT_SECONDS = 90;
const UPGRADE_LIMIT_SECONDS = 150;
const END_LIMIT_SECONDS = 300;
const WIN_LIMIT_SECONDS = 400;

/** Steer toward the nearest shard and away from the nearest gloom. */
function autopilot(state) {
  const player = state.player;
  let ax = 0;
  let ay = 0;
  let gem = null;
  let gemDist = Infinity;
  for (const shard of state.gems) {
    const dist = Math.hypot(shard.x - player.x, shard.y - player.y);
    if (dist < gemDist) {
      gemDist = dist;
      gem = shard;
    }
  }
  if (gem) {
    ax += (gem.x - player.x) / gemDist;
    ay += (gem.y - player.y) / gemDist;
  } else {
    ax += (640 - player.x) / 640 * 0.3;
    ay += (360 - player.y) / 360 * 0.3;
  }
  let foe = null;
  let foeDist = Infinity;
  for (const enemy of state.enemies) {
    const dist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
    if (dist < foeDist) {
      foeDist = dist;
      foe = enemy;
    }
  }
  if (foe && foeDist < 150) {
    const weight = ((150 - foeDist) / 150) * 2;
    ax += ((player.x - foe.x) / foeDist) * weight;
    ay += ((player.y - foe.y) / foeDist) * weight;
  }
  const length = Math.hypot(ax, ay);
  return length > 0 ? { x: ax / length, y: ay / length } : { x: 0, y: 0 };
}

/** The play scene's pilot: it dodges and drifts to the centre but never chases shards,
 * so fallen shards stay on the field for the screenshot instead of being swept up. */
function lazyAutopilot(state) {
  const player = state.player;
  let ax = (640 - player.x) / 640 * 0.3;
  let ay = (360 - player.y) / 360 * 0.3;
  let foe = null;
  let foeDist = Infinity;
  for (const enemy of state.enemies) {
    const dist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
    if (dist < foeDist) {
      foeDist = dist;
      foe = enemy;
    }
  }
  if (foe && foeDist < 150) {
    const weight = ((150 - foeDist) / 150) * 2;
    ax += ((player.x - foe.x) / foeDist) * weight;
    ay += ((player.y - foe.y) / foeDist) * weight;
  }
  const length = Math.hypot(ax, ay);
  return length > 0 ? { x: ax / length, y: ay / length } : { x: 0, y: 0 };
}

/** Steer straight at the nearest gloom: the end scene's hurried, doomed warden. */
function reckless(state) {
  const player = state.player;
  let foe = null;
  let foeDist = Infinity;
  for (const enemy of state.enemies) {
    const dist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
    if (dist < foeDist) {
      foeDist = dist;
      foe = enemy;
    }
  }
  if (!foe) return { x: 0, y: 0 };
  return { x: (foe.x - player.x) / foeDist, y: (foe.y - player.y) / foeDist };
}

/** Auto-apply a level-up during a shot scene: prefer a boon that shows in combat. */
function autoApply(world) {
  const choices = world.state.choices;
  const pick = choices.find((choice) => choice.id !== 'aura') ?? choices[0];
  if (pick) world.applyUpgrade(pick.id);
}

/**
 * Set `world` to the named scene (start, play, upgrade or end; any other name is start)
 * and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name === 'win') {
    for (let index = 0; index < WIN_LIMIT_SECONDS / STEP; index += 1) {
      if (world.state.levelUpPending) autoApply(world);
      const move = autopilot(world.state);
      const events = world.step(STEP, move.x, move.y, false);
      if (events & (EVENT_OVER | EVENT_WIN)) break;
    }
    return { screen: world.state.won ? SCREEN_WIN : SCREEN_OVER, best: world.state.score };
  }
  if (name !== 'play' && name !== 'upgrade' && name !== 'end') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) {
      const move = autopilot(world.state);
      world.step(STEP, move.x, move.y, true);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'play') {
    // Play into wave 3, where skitters and brutes join the motes, and stop only
    // once the field is busy, a gloom is close enough for bolts to be flying, and
    // shards are lying on the ground — a lull between waves would show an empty field.
    for (let index = 0; index < PLAY_LIMIT_SECONDS / STEP; index += 1) {
      if (world.state.levelUpPending) autoApply(world);
      const move = lazyAutopilot(world.state);
      const events = world.step(STEP, move.x, move.y, false);
      if (events & (EVENT_OVER | EVENT_WIN)) break;
      if (world.state.wave < 3 || world.state.enemies.length < 5) continue;
      let nearest = Infinity;
      for (const enemy of world.state.enemies) {
        nearest = Math.min(nearest, Math.hypot(enemy.x - world.state.player.x, enemy.y - world.state.player.y));
      }
      if (nearest < 500 && world.state.gems.length >= 2) break;
    }
    return { screen: world.state.over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'upgrade') {
    for (let index = 0; index < UPGRADE_LIMIT_SECONDS / STEP; index += 1) {
      const move = autopilot(world.state);
      const events = world.step(STEP, move.x, move.y, false);
      if (world.state.levelUpPending) break;
      if (events & (EVENT_OVER | EVENT_WIN)) break;
    }
    if (!world.state.levelUpPending) return { screen: SCREEN_PLAY, best: world.state.score };
    return { screen: SCREEN_UPGRADE, best: world.state.score };
  }
  for (let index = 0; index < END_LIMIT_SECONDS / STEP; index += 1) {
    if (world.state.levelUpPending) autoApply(world);
    const move = reckless(world.state);
    const events = world.step(STEP, move.x, move.y, false);
    if (events & (EVENT_OVER | EVENT_WIN)) break;
  }
  return { screen: SCREEN_OVER, best: world.state.score };
}
