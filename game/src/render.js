// Everything the player sees, drawn on one canvas. The playfield is a fixed 1280x720
// logical area, scaled to the window with letterboxing; toLogical inverts that transform
// so clicks land on the upgrade cards and buttons they appear to hit.

import { FIELD, FONT, PALETTE } from './config.js';
import { KIND_BRUTE, KIND_HERALD, KIND_MOTE, KIND_SKITTER } from './world.js';
import { createRandom } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_UPGRADE = 'upgrade';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const CARD_WIDTH = 300;
const CARD_HEIGHT = 230;
const CARD_GAP = 30;
const CARD_Y = 250;

/** The on-screen rectangle of an upgrade card, for click hit-testing. */
export function choiceRect(index) {
  const total = 3 * CARD_WIDTH + 2 * CARD_GAP;
  const x = (FIELD.width - total) / 2 + index * (CARD_WIDTH + CARD_GAP);
  return { x, y: CARD_Y, width: CARD_WIDTH, height: CARD_HEIGHT };
}

const STARS = (() => {
  const random = createRandom(20261116);
  const stars = [];
  for (let i = 0; i < 130; i += 1) {
    stars.push({
      x: random() * FIELD.width,
      y: random() * FIELD.height,
      size: 0.6 + random() * 1.8,
      phase: random() * Math.PI * 2,
      speed: 0.4 + random() * 1.2,
    });
  }
  return stars;
})();

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    scale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
    offsetX = (canvas.width - FIELD.width * scale) / 2;
    offsetY = (canvas.height - FIELD.height * scale) / 2;
  }

  window.addEventListener('resize', resize);
  resize();

  function toLogical(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    const y = ((clientY - rect.top) / rect.height) * canvas.height;
    return { x: (x - offsetX) / scale, y: (y - offsetY) / scale };
  }

  function drawBackground(time) {
    const gradient = ctx.createLinearGradient(0, 0, 0, FIELD.height);
    gradient.addColorStop(0, PALETTE.horizon);
    gradient.addColorStop(0.55, PALETTE.backdrop);
    gradient.addColorStop(1, PALETTE.ground);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    for (const star of STARS) {
      const twinkle = 0.35 + 0.65 * Math.abs(Math.sin(time * star.speed + star.phase));
      ctx.globalAlpha = twinkle * 0.8;
      ctx.fillStyle = PALETTE.star;
      ctx.fillRect(star.x, star.y, star.size, star.size);
    }
    ctx.globalAlpha = 1;
    // A faint glow on the horizon, where the dark presses in.
    const horizon = ctx.createRadialGradient(640, 720, 40, 640, 720, 620);
    horizon.addColorStop(0, 'rgba(179, 136, 255, 0.10)');
    horizon.addColorStop(1, 'rgba(179, 136, 255, 0)');
    ctx.fillStyle = horizon;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  function drawGems(state) {
    for (const gem of state.gems) {
      const bob = Math.sin(state.time * 4 + gem.x) * 2;
      ctx.save();
      ctx.translate(gem.x, gem.y + bob);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = PALETTE.shard;
      ctx.shadowColor = PALETTE.shard;
      ctx.shadowBlur = 10;
      const size = gem.value >= 3 ? 9 : 6;
      ctx.fillRect(-size / 2, -size / 2, size, size);
      ctx.restore();
    }
  }

  function drawAura(state) {
    const player = state.player;
    if (player.auraLevel <= 0) return;
    ctx.save();
    ctx.globalAlpha = 0.07 + 0.03 * Math.sin(state.time * 5);
    ctx.fillStyle = PALETTE.ember;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.auraRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = PALETTE.ember;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.auraRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawEnemy(state, enemy) {
    const bob = Math.sin(enemy.wobble) * 2;
    ctx.save();
    ctx.translate(enemy.x, enemy.y + bob);
    ctx.shadowColor = enemy.color;
    ctx.shadowBlur = 14;
    ctx.fillStyle = enemy.flash > 0 ? '#ffffff' : enemy.color;
    if (enemy.kind === KIND_MOTE) {
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(-4, -4, 2.5, 0, Math.PI * 2);
      ctx.arc(4, -4, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (enemy.kind === KIND_SKITTER) {
      ctx.rotate(Math.atan2(state.player.y - enemy.y, state.player.x - enemy.x));
      ctx.beginPath();
      ctx.moveTo(enemy.radius + 4, 0);
      ctx.lineTo(-enemy.radius, -enemy.radius);
      ctx.lineTo(-enemy.radius * 0.5, 0);
      ctx.lineTo(-enemy.radius, enemy.radius);
      ctx.closePath();
      ctx.fill();
    } else if (enemy.kind === KIND_BRUTE) {
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const angle = (i / 6) * Math.PI * 2 + Math.PI / 6;
        const px = Math.cos(angle) * enemy.radius;
        const py = Math.sin(angle) * enemy.radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.arc(-6, -4, 3, 0, Math.PI * 2);
      ctx.arc(6, -4, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (enemy.kind === KIND_HERALD) {
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius + 7 + Math.sin(state.time * 3) * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ffd166';
      for (let i = 0; i < 5; i += 1) {
        const angle = -Math.PI / 2 + (i - 2) * 0.42;
        ctx.beginPath();
        ctx.arc(Math.cos(angle) * (enemy.radius - 4), Math.sin(angle) * (enemy.radius - 4) - 6, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#1a0b12';
      ctx.beginPath();
      ctx.arc(-10, -4, 4, 0, Math.PI * 2);
      ctx.arc(10, -4, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    if (enemy.kind === KIND_BRUTE || enemy.kind === KIND_HERALD) {
      const width = enemy.radius * 2;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(enemy.x - width / 2, enemy.y - enemy.radius - 12, width, 5);
      ctx.fillStyle = enemy.color;
      ctx.fillRect(enemy.x - width / 2, enemy.y - enemy.radius - 12, width * Math.max(0, enemy.hp / enemy.maxHp), 5);
    }
  }

  function drawBullets(state) {
    for (const bullet of state.bullets) {
      ctx.save();
      ctx.fillStyle = PALETTE.bullet;
      ctx.shadowColor = PALETTE.bullet;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawPlayer(state) {
    const player = state.player;
    const flicker = 0.85 + 0.15 * Math.sin(state.time * 11) + 0.08 * Math.sin(state.time * 23);
    ctx.save();
    ctx.translate(player.x, player.y);
    const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 64 * flicker);
    glow.addColorStop(0, 'rgba(255, 179, 71, 0.55)');
    glow.addColorStop(1, 'rgba(255, 179, 71, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 64 * flicker, 0, Math.PI * 2);
    ctx.fill();
    // The warden: a hooded keeper, drawn as a warm lantern with a face.
    ctx.fillStyle = '#3a2b1c';
    ctx.beginPath();
    ctx.arc(0, 2, player.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(0, 0, player.radius - 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.playerCore;
    ctx.beginPath();
    ctx.arc(0, -2, 6 * flicker, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2a1a08';
    ctx.beginPath();
    ctx.arc(-5, -2, 2, 0, Math.PI * 2);
    ctx.arc(5, -2, 2, 0, Math.PI * 2);
    ctx.fill();
    if (player.grace > 0 && Math.floor(state.time * 14) % 2 === 0) {
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, player.radius + 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function drawParticles(state) {
    for (const particle of state.particles) {
      ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      ctx.fillStyle = particle.color;
      ctx.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size);
    }
    ctx.globalAlpha = 1;
  }

  function drawFloats(state) {
    ctx.textAlign = 'center';
    for (const float of state.floats) {
      ctx.globalAlpha = Math.max(0, float.life / float.maxLife);
      ctx.font = `700 ${float.size}px ${FONT}`;
      ctx.fillStyle = float.color;
      ctx.fillText(float.text, float.x, float.y);
    }
    ctx.globalAlpha = 1;
  }

  function bar(x, y, width, height, fraction, fill, back) {
    ctx.fillStyle = back;
    ctx.fillRect(x, y, width, height);
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, width * Math.min(1, Math.max(0, fraction)), height);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, width, height);
  }

  function drawHud(state, best) {
    const player = state.player;
    ctx.textAlign = 'left';
    ctx.font = `700 15px ${FONT}`;
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(`HEALTH  ${Math.ceil(player.hp)} / ${player.maxHp}`, 24, 30);
    bar(24, 38, 220, 14, player.hp / player.maxHp, PALETTE.hp, PALETTE.hpBack);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 13px ${FONT}`;
    ctx.fillText(`LEVEL ${player.level}`, 24, 76);
    bar(24, 82, 220, 8, player.xp / player.xpNeed, PALETTE.xp, PALETTE.hpBack);

    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 20px ${FONT}`;
    ctx.fillText(`WAVE ${state.wave} / 10`, FIELD.width / 2, 32);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 13px ${FONT}`;
    const minutes = Math.floor(state.time / 60);
    const seconds = Math.floor(state.time % 60).toString().padStart(2, '0');
    ctx.fillText(`${minutes}:${seconds}`, FIELD.width / 2, 52);

    const herald = state.enemies.find((enemy) => enemy.kind === KIND_HERALD);
    if (herald) {
      ctx.fillStyle = '#ffb3b8';
      ctx.font = `700 14px ${FONT}`;
      ctx.fillText('THE GLOOM HERALD', FIELD.width / 2, 76);
      bar(FIELD.width / 2 - 160, 84, 320, 10, herald.hp / herald.maxHp, '#e5484d', '#33121a');
    }

    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 20px ${FONT}`;
    ctx.fillText(`SCORE ${state.score}`, FIELD.width - 24, 32);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 13px ${FONT}`;
    ctx.fillText(`${state.kills} glooms banished · ${state.shards} shards`, FIELD.width - 24, 52);
    ctx.fillText(`Best ${best}`, FIELD.width - 24, 70);
  }

  function drawBanner(state) {
    if (state.waveState === 'banner') {
      ctx.textAlign = 'center';
      ctx.fillStyle = PALETTE.text;
      ctx.font = `800 44px ${FONT}`;
      ctx.fillText(state.wave === 10 ? 'THE GLOOM HERALD AWAKENS' : `WAVE ${state.wave}`, FIELD.width / 2, 190);
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `600 17px ${FONT}`;
      ctx.fillText(
        state.wave === 10 ? 'Banish the Herald to win the dawn' : 'Hold the ember. Survive the dark.',
        FIELD.width / 2,
        222,
      );
    } else if (state.waveState === 'clear') {
      ctx.textAlign = 'center';
      ctx.fillStyle = PALETTE.gold;
      ctx.font = `800 36px ${FONT}`;
      ctx.fillText(`WAVE ${state.wave} CLEARED  ·  +150`, FIELD.width / 2, 190);
    }
  }

  function panel(x, y, width, height) {
    ctx.fillStyle = PALETTE.panel;
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 14);
    ctx.fill();
    ctx.stroke();
  }

  function drawTitle(state, best) {
    ctx.fillStyle = 'rgba(8, 9, 20, 0.55)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `800 84px ${FONT}`;
    ctx.shadowColor = PALETTE.ember;
    ctx.shadowBlur = 34;
    ctx.fillText('EMBERWARD', FIELD.width / 2, 250);
    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.text;
    ctx.font = `600 22px ${FONT}`;
    ctx.fillText('Hold the last ember against the night.', FIELD.width / 2, 292);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `500 17px ${FONT}`;
    ctx.fillText('WASD or arrows to move · your lantern fires on its own', FIELD.width / 2, 340);
    ctx.fillText('Gather star-shards, choose a boon, survive 10 waves', FIELD.width / 2, 366);
    ctx.fillText('Banish the Gloom Herald on wave 10 to win the dawn.', FIELD.width / 2, 392);
    panel(FIELD.width / 2 - 190, 428, 380, 64);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 20px ${FONT}`;
    ctx.fillText('Press SPACE or click to begin', FIELD.width / 2, 467);
    if (best > 0) {
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `600 16px ${FONT}`;
      ctx.fillText(`Best score ${best}`, FIELD.width / 2, 530);
    }
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `500 14px ${FONT}`;
    ctx.fillText('P pauses · M mutes · an original game, made of light and code', FIELD.width / 2, 690);
  }

  function drawUpgrade(state) {
    ctx.fillStyle = 'rgba(8, 9, 20, 0.66)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.xp;
    ctx.font = `800 40px ${FONT}`;
    ctx.fillText('LEVEL UP', FIELD.width / 2, 170);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `600 19px ${FONT}`;
    ctx.fillText('The ember grows stronger. Choose a boon — click a card or press 1, 2 or 3.', FIELD.width / 2, 208);
    state.choices.forEach((choice, index) => {
      const rect = choiceRect(index);
      const level = (state.upgradeLevels[choice.id] ?? 0) + 1;
      panel(rect.x, rect.y, rect.width, rect.height);
      ctx.fillStyle = PALETTE.gold;
      ctx.font = `800 15px ${FONT}`;
      ctx.fillText(`BOON ${index + 1}  ·  ${'◆'.repeat(level)}`, rect.x + rect.width / 2, rect.y + 36);
      ctx.fillStyle = PALETTE.text;
      ctx.font = `700 21px ${FONT}`;
      ctx.fillText(choice.name, rect.x + rect.width / 2, rect.y + 78);
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `500 16px ${FONT}`;
      ctx.fillText(choice.desc, rect.x + rect.width / 2, rect.y + 112);
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `600 14px ${FONT}`;
      ctx.fillText(level >= choice.max ? 'Final rank' : `Rank ${level} of ${choice.max}`, rect.x + rect.width / 2, rect.y + 196);
    });
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(8, 9, 20, 0.6)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `800 48px ${FONT}`;
    ctx.fillText('PAUSED', FIELD.width / 2, 350);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 18px ${FONT}`;
    ctx.fillText('Press P or SPACE to keep holding the ember.', FIELD.width / 2, 388);
  }

  function drawStats(state, best, lines) {
    ctx.textAlign = 'center';
    ctx.font = `600 19px ${FONT}`;
    ctx.fillStyle = PALETTE.text;
    lines.forEach((line, index) => {
      ctx.fillText(line, FIELD.width / 2, 348 + index * 30);
    });
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 16px ${FONT}`;
    ctx.fillText(`Best score ${best}`, FIELD.width / 2, 348 + lines.length * 30 + 12);
  }

  function drawOver(state, best) {
    ctx.fillStyle = 'rgba(10, 6, 14, 0.72)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.danger;
    ctx.font = `800 56px ${FONT}`;
    ctx.fillText('THE EMBER FADES', FIELD.width / 2, 250);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 19px ${FONT}`;
    ctx.fillText('The dark takes the lantern — this time.', FIELD.width / 2, 288);
    const minutes = Math.floor(state.time / 60);
    const seconds = Math.floor(state.time % 60).toString().padStart(2, '0');
    drawStats(state, best, [
      `Score ${state.score}  ·  Wave ${state.wave}  ·  ${state.kills} glooms banished`,
      `Level ${state.player.level}  ·  ${state.shards} shards  ·  Survived ${minutes}:${seconds}`,
    ]);
    panel(FIELD.width / 2 - 190, 470, 380, 64);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 20px ${FONT}`;
    ctx.fillText('Press SPACE or click to try again', FIELD.width / 2, 509);
  }

  function drawWin(state, best) {
    ctx.fillStyle = 'rgba(8, 12, 8, 0.6)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `800 56px ${FONT}`;
    ctx.shadowColor = PALETTE.ember;
    ctx.shadowBlur = 28;
    ctx.fillText('THE DAWN RETURNS', FIELD.width / 2, 250);
    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.text;
    ctx.font = `600 19px ${FONT}`;
    ctx.fillText('The Herald is banished. The ember burns bright again.', FIELD.width / 2, 288);
    const minutes = Math.floor(state.time / 60);
    const seconds = Math.floor(state.time % 60).toString().padStart(2, '0');
    drawStats(state, best, [
      `Score ${state.score}  ·  ${state.kills} glooms banished`,
      `Level ${state.player.level}  ·  ${state.shards} shards  ·  Won in ${minutes}:${seconds}`,
    ]);
    panel(FIELD.width / 2 - 190, 470, 380, 64);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 20px ${FONT}`;
    ctx.fillText('Press SPACE or click to play again', FIELD.width / 2, 509);
  }

  function draw(state, screen, best) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#05060f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
    ctx.save();
    if (state.shake > 0) {
      ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
    }
    drawBackground(state.time);
    if (screen === SCREEN_TITLE) {
      drawGems(state);
      drawAura(state);
      for (const enemy of state.enemies) drawEnemy(state, enemy);
      drawBullets(state);
      drawPlayer(state);
      drawParticles(state);
      drawTitle(state, best);
    } else {
      drawGems(state);
      drawAura(state);
      for (const enemy of state.enemies) drawEnemy(state, enemy);
      drawBullets(state);
      drawPlayer(state);
      drawParticles(state);
      drawFloats(state);
      drawHud(state, best);
      if (screen === SCREEN_PLAY) drawBanner(state);
      if (screen === SCREEN_UPGRADE) drawUpgrade(state);
      else if (screen === SCREEN_PAUSED) drawPaused();
      else if (screen === SCREEN_OVER) drawOver(state, best);
      else if (screen === SCREEN_WIN) drawWin(state, best);
    }
    if (state.flash > 0) {
      ctx.fillStyle = `rgba(229, 72, 77, ${state.flash * 0.28})`;
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    }
    ctx.restore();
  }

  return { draw, toLogical, resize };
}
