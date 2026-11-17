// Keyboard and mouse state for the game.
// The module only records what is held and where the pointer is (in logical
// pond coordinates); the player module decides what any of it means. Keeping
// input this dumb is what lets the screenshot scenes drive the same world
// with an autopilot instead of real keys.

/** Create the input state and bind it to a canvas. Returns the state object. */
export function createInput(canvas, toLogical) {
  const input = {
    keys: new Set(),
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    /** One-shot presses, consumed by the game loop each frame. */
    pressed: new Set(),
    clickedAt: null,
  };

  const updateMouse = (event) => {
    const point = toLogical(event.clientX, event.clientY);
    input.mouseX = point.x;
    input.mouseY = point.y;
  };

  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    if (!event.repeat) input.pressed.add(event.code);
    input.keys.add(event.code);
  });
  window.addEventListener('keyup', (event) => {
    input.keys.delete(event.code);
  });
  window.addEventListener('blur', () => {
    input.keys.clear();
    input.mouseDown = false;
  });
  canvas.addEventListener('mousemove', updateMouse);
  canvas.addEventListener('mousedown', (event) => {
    updateMouse(event);
    input.mouseDown = true;
    input.clickedAt = { x: input.mouseX, y: input.mouseY };
  });
  window.addEventListener('mouseup', () => {
    input.mouseDown = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  return input;
}

/** True while any of the given key codes is held. */
export function held(input, ...codes) {
  return codes.some((code) => input.keys.has(code));
}

/** Take a one-shot press out of the set: true exactly once per keydown. */
export function takePress(input, ...codes) {
  for (const code of codes) {
    if (input.pressed.has(code)) {
      input.pressed.delete(code);
      return true;
    }
  }
  return false;
}

/** The movement direction the held keys ask for, as a unit-ish {x, y}. */
export function moveVector(input) {
  let x = 0;
  let y = 0;
  if (held(input, 'KeyA', 'ArrowLeft')) x -= 1;
  if (held(input, 'KeyD', 'ArrowRight')) x += 1;
  if (held(input, 'KeyW', 'ArrowUp')) y -= 1;
  if (held(input, 'KeyS', 'ArrowDown')) y += 1;
  if (x !== 0 && y !== 0) {
    const inv = 1 / Math.hypot(x, y);
    x *= inv;
    y *= inv;
  }
  return { x, y };
}
