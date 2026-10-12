const KEY_DIRECTIONS = Object.freeze({ KeyW: 'NE', KeyA: 'NW', KeyS: 'SW', KeyD: 'SE' });

/** One keypress = one cell. All screen/world conversion is delegated to Inkstone. */
export function bindControls(canvas, renderer, game, {
  isEnabled = () => true,
  onChange = () => {},
  onHover = () => {},
} = {}) {
  const win = canvas.ownerDocument.defaultView;
  const pressed = new Set();
  const interactive = target => target?.closest?.('input, textarea, select, button, a, [contenteditable="true"], [role="slider"]');
  const worldCell = event => {
    const world = renderer.eventToWorld(event);
    return [Math.floor(world.x), Math.floor(world.y)];
  };

  function keydown(event) {
    if (!isEnabled() || event.altKey || event.ctrlKey || event.metaKey || interactive(event.target)) return;
    if (!(event.code in KEY_DIRECTIONS) && event.code !== 'Space') return;
    event.preventDefault();
    if (event.repeat || pressed.has(event.code)) return;
    pressed.add(event.code);
    if (event.code === 'Space') game.attack();
    else game.moveDirection(KEY_DIRECTIONS[event.code]);
    onChange();
  }
  function keyup(event) { pressed.delete(event.code); }
  function pointerdown(event) {
    if (!isEnabled() || event.button !== 0) return;
    canvas.focus({ preventScroll: true });
    game.moveTo(...worldCell(event)); onChange();
  }
  function pointermove(event) { if (isEnabled()) onHover(worldCell(event)); }
  function pointerleave() { onHover(null); }
  function clear() { pressed.clear(); onHover(null); }

  if (!canvas.hasAttribute('tabindex')) canvas.tabIndex = 0;
  win.addEventListener('keydown', keydown);
  win.addEventListener('keyup', keyup);
  win.addEventListener('blur', clear);
  canvas.addEventListener('pointerdown', pointerdown);
  canvas.addEventListener('pointermove', pointermove);
  canvas.addEventListener('pointerleave', pointerleave);
  return {
    clear,
    dispose() {
      win.removeEventListener('keydown', keydown);
      win.removeEventListener('keyup', keyup);
      win.removeEventListener('blur', clear);
      canvas.removeEventListener('pointerdown', pointerdown);
      canvas.removeEventListener('pointermove', pointermove);
      canvas.removeEventListener('pointerleave', pointerleave);
      clear();
    },
  };
}
