// Keyboard and pointer input. Held keys give a steering vector; one-shot presses (start or
// restart, pause, mute, upgrade picks) are queued as bit flags and taken once by the loop, so a
// press between two frames is never lost and never counted twice. Pointer clicks are queued
// with their logical coordinates, for the title buttons and the upgrade cards.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_CHOICE_1 = 8;
export const ACTION_CHOICE_2 = 16;
export const ACTION_CHOICE_3 = 32;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const MUTE = new Set(['KeyM']);
const CHOICES = new Map([
  ['Digit1', ACTION_CHOICE_1],
  ['Digit2', ACTION_CHOICE_2],
  ['Digit3', ACTION_CHOICE_3],
  ['Numpad1', ACTION_CHOICE_1],
  ['Numpad2', ACTION_CHOICE_2],
  ['Numpad3', ACTION_CHOICE_3],
]);

/**
 * Build input for a canvas that fills the window. `toLogical` converts a client point to
 * the game's 1280x720 logical coordinates (the renderer's letterbox transform, inverted).
 */
export function createInput(canvas, toLogical) {
  let up = false;
  let down = false;
  let left = false;
  let right = false;
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  const clicks = [];

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code)) up = true;
    else if (DOWN.has(event.code)) down = true;
    else if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else if (CHOICES.has(event.code)) {
      if (!event.repeat) actions |= CHOICES.get(event.code);
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) up = false;
    else if (DOWN.has(event.code)) down = false;
    else if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    up = false;
    down = false;
    left = false;
    right = false;
  });

  function trackPointer(event) {
    const point = toLogical(event.clientX, event.clientY);
    mouseX = point.x;
    mouseY = point.y;
  }
  canvas.addEventListener('pointermove', trackPointer);
  canvas.addEventListener('pointerdown', (event) => {
    trackPointer(event);
    clicks.push({ x: mouseX, y: mouseY });
    actions |= ACTION_CONFIRM;
  });

  return {
    /** The steering vector, normalised, from the held movement keys. */
    move() {
      const x = (right ? 1 : 0) - (left ? 1 : 0);
      const y = (down ? 1 : 0) - (up ? 1 : 0);
      if (x === 0 && y === 0) return { x: 0, y: 0 };
      const length = Math.hypot(x, y);
      return { x: x / length, y: y / length };
    },
    /** The mouse position in logical coordinates. */
    mouse() {
      return { x: mouseX, y: mouseY };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** The pointer clicks since the last call, in logical coordinates. */
    takeClicks() {
      return clicks.splice(0, clicks.length);
    },
  };
}
