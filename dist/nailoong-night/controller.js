const emptyEdges = () => ({ a: false, x: false, y: false, menu: false });
const buttonIndices = { a: 0, x: 2, y: 3, menu: 9 };
const keyFor = pad => `${pad.index}:${pad.id}`;
const held = (pad, index) => !!pad.buttons?.[index]?.pressed || Number(pad.buttons?.[index]?.value) > .5;
const axis = value => Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;

// Browser snapshots enter here; input ownership and button edges stay independent
// of rendering so disconnects, focus changes and noisy sticks can be tested.
export class ControllerInput {
  constructor({ deadzone = .22 } = {}) {
    this.deadzone = Number.isFinite(deadzone) ? Math.max(0, Math.min(.9, deadzone)) : .22;
    this.enabled = true;
    this.selected = null;
    this.previous = new Map();
    this.wasFocused = null;
    this.seedNext = false;
  }

  setEnabled(enabled) {
    this.enabled = !!enabled;
    this.selected = null;
    this.seedNext = true;
  }

  poll(gamepads, { focused = true } = {}) {
    const pads = Array.from(gamepads || []).filter(pad => pad && pad.connected !== false);
    const selected = pads.find(pad => keyFor(pad) === this.selected && pad.mapping === 'standard');
    const disconnected = this.selected !== null && !selected;
    if (disconnected) this.selected = null;
    const suppressEdges = !focused || this.wasFocused === false || !this.enabled || this.seedNext || disconnected;
    const edges = new Map();
    const next = new Map();
    for (const pad of pads) {
      const key = keyFor(pad), before = this.previous.get(key) || [];
      const buttons = Array.from({ length: 17 }, (_, i) => held(pad, i));
      edges.set(key, Object.fromEntries(Object.entries(buttonIndices).map(([name, i]) => [name, !suppressEdges && buttons[i] && !before[i]])));
      next.set(key, buttons);
    }
    this.previous = next;
    this.wasFocused = focused;
    this.seedNext = false;
    let justActivated = false;
    if (!this.selected && this.enabled && focused && !disconnected) {
      const claimant = pads.find(pad => pad.mapping === 'standard' && (edges.get(keyFor(pad)).a || edges.get(keyFor(pad)).menu));
      if (claimant) { this.selected = keyFor(claimant); justActivated = true; }
    }
    const activePad = pads.find(pad => keyFor(pad) === this.selected);
    const visiblePad = activePad || pads.find(pad => pad.mapping === 'standard') || pads[0];
    const result = {
      connected: pads.length > 0, active: !!activePad && this.enabled,
      justActivated, disconnected, enabled: this.enabled,
      id: visiblePad?.id || '', mapping: visiblePad ? (visiblePad.mapping === 'standard' ? 'standard' : 'unsupported') : '',
      x: 0, z: 0, dash: false, pressed: emptyEdges()
    };
    if (!result.active || !focused) return result;
    result.pressed = edges.get(keyFor(activePad));
    const x = axis(activePad.axes?.[0]), z = axis(activePad.axes?.[1]);
    const magnitude = Math.hypot(x, z);
    if (magnitude > this.deadzone) {
      const scale = (Math.min(1, magnitude) - this.deadzone) / (1 - this.deadzone) / magnitude;
      result.x = x * scale; result.z = z * scale;
    }
    result.x += Number(held(activePad, 15)) - Number(held(activePad, 14));
    result.z += Number(held(activePad, 13)) - Number(held(activePad, 12));
    const length = Math.hypot(result.x, result.z);
    if (length > 1) { result.x /= length; result.z /= length; }
    result.dash = held(activePad, 1) || held(activePad, 7);
    return result;
  }
}

export function controllerCommands(input, mode) {
  if (!input.active) return [];
  const p = input.pressed;
  // Resolve from the frame's original mode: one press cannot start then pause,
  // or resume then immediately knock on a door.
  if (mode === 'intro' || mode === 'end') return p.a || p.menu ? ['start'] : [];
  if (mode === 'paused') return p.a || p.menu ? ['pause'] : [];
  if (mode !== 'playing') return [];
  if (p.menu) return ['pause'];
  return [p.a && 'interact', p.x && 'laugh', p.y && 'camera'].filter(Boolean);
}
