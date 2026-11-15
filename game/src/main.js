// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between six screens: title, play, upgrade, paused, game over and
// victory. Sounds fire from the world's counters, so a shot scene stays silent.
// 
// ?seed=N fixes the spawn pattern. ?shot=start|play|upgrade|end (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets window.__shotReady.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_HIT, EVENT_LEVELUP, EVENT_OVER, EVENT_WAVE, EVENT_WIN } from './world.js';
import { createAudio } from './audio.js';
import {
  ACTION_CHOICE_1,
  ACTION_CHOICE_2,
  ACTION_CHOICE_3,
  ACTION_CONFIRM,
  ACTION_MUTE,
  ACTION_PAUSE,
  createInput,
} from './input.js';
import {
  SCREEN_OVER,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TITLE,
  SCREEN_UPGRADE,
  SCREEN_WIN,
  choiceRect,
  createRenderer,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const audio = createAudio();
const renderer = createRenderer(canvas);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas, (x, y) => renderer.toLogical(x, y));
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let lastShots = 0;
  let lastKills = 0;
  let lastPickups = 0;

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    lastShots = 0;
    lastKills = 0;
    lastPickups = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    announce('Playing. Hold the ember.');
  }

  function endGame(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(won ? `Victory. Score ${world.state.score}.` : `Game over. Score ${world.state.score}. Best ${best}.`);
  }

  function playSounds(events) {
    if (world.state.shotsFired !== lastShots) {
      lastShots = world.state.shotsFired;
      audio.shoot();
    }
    if (world.state.kills !== lastKills) {
      lastKills = world.state.kills;
      audio.kill();
    }
    if (world.state.pickups !== lastPickups) {
      lastPickups = world.state.pickups;
      audio.pickup();
    }
    if (events & EVENT_HIT) audio.hurt();
    if (events & EVENT_LEVELUP) audio.levelup();
    if (events & EVENT_WAVE) audio.waveHorn();
    if (events & EVENT_WIN) audio.win();
    if (events & EVENT_OVER) audio.lose();
  }

  function chooseUpgrade(index) {
    const choice = world.state.choices[index];
    if (!choice) return;
    world.applyUpgrade(choice.id);
    audio.unlock();
    if (!world.state.levelUpPending) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const on = audio.toggle();
      announce(on ? 'Sound on.' : 'Sound off.');
    }
    if (actions & ACTION_CONFIRM) audio.unlock();
    if (screen === SCREEN_TITLE && actions & ACTION_CONFIRM) {
      startGame();
      return;
    }
    if (screen === SCREEN_OVER || screen === SCREEN_WIN) {
      if (actions & ACTION_CONFIRM) startGame();
      return;
    }
    if (screen === SCREEN_UPGRADE) {
      if (actions & ACTION_CHOICE_1) chooseUpgrade(0);
      else if (actions & ACTION_CHOICE_2) chooseUpgrade(1);
      else if (actions & ACTION_CHOICE_3) chooseUpgrade(2);
      const clicks = input.takeClicks();
      for (const click of clicks) {
        for (let index = 0; index < 3; index += 1) {
          const rect = choiceRect(index);
          if (
            click.x >= rect.x &&
            click.x <= rect.x + rect.width &&
            click.y >= rect.y &&
            click.y <= rect.y + rect.height
          ) {
            chooseUpgrade(index);
            break;
          }
        }
      }
      return;
    }
    if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
    input.takeClicks();
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      const move = { x: 0.3, y: 0.1 };
      world.step(STEP, move.x, move.y, true);
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const move = input.move();
    const events = world.step(STEP, move.x, move.y, false);
    playSounds(events);
    if (world.state.levelUpPending) {
      screen = SCREEN_UPGRADE;
      announce('Level up. Choose a boon.');
    } else if (world.state.won) {
      endGame(true);
    } else if (world.state.over) {
      endGame(false);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting glooms close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  // A small hook for automated play-testing: read the screen and the score, or force
  // the warden's health and XP from a test script. It changes nothing about the game.
  window.__emberward = {
    get screen() {
      return screen;
    },
    get state() {
      return world.state;
    },
    hurt(amount) {
      world.state.player.hp = Math.max(0, world.state.player.hp - amount);
      if (world.state.player.hp <= 0) world.state.over = true;
    },
    grantXp(amount) {
      world.state.player.xp += amount;
    },
  };

  announce('Emberward. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
