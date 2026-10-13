'use strict';
// Unified input: keyboard, mouse, touch (virtual stick) and gamepads.
// Game code asks for *actions* ("act", "up", "journal", ...) instead of raw keys.

const KEYMAP = {
  up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  act: ['KeyE', 'Space'], alt: ['KeyF'], enter: ['Enter', 'NumpadEnter'], cancel: ['Escape'],
  journal: ['Tab', 'KeyJ'], bag: ['KeyI', 'KeyB'], map: ['KeyM'], chat: ['KeyT'],
  prev: ['KeyQ'], next: ['KeyR'], run: ['ShiftLeft', 'ShiftRight'],
  hot1: ['Digit1'], hot2: ['Digit2'], hot3: ['Digit3'], hot4: ['Digit4'], hot5: ['Digit5'], hot6: ['Digit6'], hot7: ['Digit7'], hot8: ['Digit8'],
};
const PAD_BTN = { 0: 'act', 1: 'cancel', 2: 'alt', 3: 'journal', 4: 'prev', 5: 'next', 8: 'map', 9: 'menu', 12: 'up', 13: 'down', 14: 'left', 15: 'right' };

const Input = {
  down: new Set(),        // physical key codes held
  actDown: new Set(),     // actions held (keyboard + pad + touch)
  pressed: new Set(),     // actions pressed this frame
  mouse: { x: -1, y: -1, down: false, clicked: false, rclicked: false, wheel: 0, moved: false, inside: false },
  text: { on: false, buf: '', back: 0, enter: false, esc: false },
  lastDevice: 'kb',
  touchMode: false,
  stick: { active: false, id: -1, cx: 0, cy: 0, x: 0, y: 0 },
  padPrev: {},
  padAxes: [0, 0],
  canvas: null,
  view: null,
  uiHit: null,            // function(x, y) -> bool: is there a UI widget here?
  _queue: [],
  hiddenInput: null,

  init(canvas, view) {
    this.canvas = canvas;
    this.view = view;
    window.addEventListener('keydown', (e) => this._key(e, true));
    window.addEventListener('keyup', (e) => this._key(e, false));
    window.addEventListener('blur', () => { this.down.clear(); this.actDown.clear(); });
    canvas.addEventListener('pointerdown', (e) => this._pointer(e, 'down'));
    window.addEventListener('pointermove', (e) => this._pointer(e, 'move'));
    window.addEventListener('pointerup', (e) => this._pointer(e, 'up'));
    window.addEventListener('pointercancel', (e) => this._pointer(e, 'up'));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => { this.mouse.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
    window.addEventListener('gamepadconnected', () => { this.lastDevice = 'pad'; });
  },

  _key(e, isDown) {
    if (this.text.on && isDown) {
      if (e.key === 'Enter') this.text.enter = true;
      else if (e.key === 'Escape') this.text.esc = true;
      else if (e.key === 'Backspace') this.text.back++;
      else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) this.text.buf += e.key;
      if (e.target !== this.hiddenInput) e.preventDefault();
      return;
    }
    if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.code) || e.key === ' ') e.preventDefault();
    this.lastDevice = 'kb';
    this.touchMode = false;
    if (isDown) {
      if (e.repeat) return;
      this.down.add(e.code);
      for (const a in KEYMAP) if (KEYMAP[a].includes(e.code)) { this.pressed.add(a); this.actDown.add(a); }
      Audio2.unlock();
    } else {
      this.down.delete(e.code);
      for (const a in KEYMAP) if (KEYMAP[a].includes(e.code) && !KEYMAP[a].some((c) => this.down.has(c))) this.actDown.delete(a);
    }
  },

  toLogical(e) {
    const r = this.canvas.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width * this.canvas.width, (e.clientY - r.top) / r.height * this.canvas.height];
  },

  _pointer(e, kind) {
    const [x, y] = this.toLogical(e);
    const touch = e.pointerType === 'touch' || e.pointerType === 'pen';
    if (kind === 'down') Audio2.unlock();
    if (touch) {
      this.touchMode = true;
      this.lastDevice = 'touch';
      if (kind === 'down') {
        const onUI = this.uiHit && this.uiHit(x, y);
        if (!onUI && !this.stick.active && x < this.canvas.width * 0.45 && G.mode === 'play' && !G.modal) {
          this.stick = { active: true, id: e.pointerId, cx: x, cy: y, x, y };
          return;
        }
        this.mouse.x = x; this.mouse.y = y; this.mouse.down = true; this.mouse.moved = true; this.mouse.inside = true;
      } else if (kind === 'move') {
        if (this.stick.active && e.pointerId === this.stick.id) { this.stick.x = x; this.stick.y = y; return; }
        if (this.mouse.down) { this.mouse.x = x; this.mouse.y = y; }
      } else {
        if (this.stick.active && e.pointerId === this.stick.id) { this.stick.active = false; return; }
        if (this.mouse.down) { this.mouse.down = false; this.mouse.clicked = true; this.mouse.x = x; this.mouse.y = y; }
        // lift the finger "out" so nothing stays hovered
        this._liftTouch = true;
      }
      return;
    }
    this.lastDevice = 'mouse';
    this.touchMode = false;
    this.mouse.x = x; this.mouse.y = y;
    this.mouse.inside = x >= 0 && y >= 0 && x < this.canvas.width && y < this.canvas.height;
    if (kind === 'move') this.mouse.moved = true;
    if (kind === 'down') {
      if (e.button === 2) this.mouse.rclicked = true;
      else { this.mouse.down = true; }
    }
    if (kind === 'up' && e.button !== 2 && this.mouse.down) { this.mouse.down = false; this.mouse.clicked = true; }
  },

  // Call once per frame before game logic
  poll() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let ax = 0, ay = 0;
    for (const p of pads) {
      if (!p || !p.connected) continue;
      const lx = p.axes[0] || 0, ly = p.axes[1] || 0;
      if (Math.abs(lx) > 0.25 || Math.abs(ly) > 0.25) { ax = lx; ay = ly; this.lastDevice = 'pad'; }
      for (const b in PAD_BTN) {
        const pressed = p.buttons[b] && p.buttons[b].pressed;
        const key = p.index + ':' + b;
        const a = PAD_BTN[b];
        if (pressed && !this.padPrev[key]) { this.pressed.add(a); this.lastDevice = 'pad'; Audio2.unlock(); }
        if (pressed) this.actDown.add('pad_' + a); else this.actDown.delete('pad_' + a);
        this.padPrev[key] = pressed;
      }
      // left stick as menu navigation (edge-triggered)
      const nav = Math.abs(lx) > 0.6 ? (lx < 0 ? 'left' : 'right') : Math.abs(ly) > 0.6 ? (ly < 0 ? 'up' : 'down') : '';
      if (nav && nav !== this._padNav) this.pressed.add('nav_' + nav);
      this._padNav = nav;
    }
    this.padAxes = [ax, ay];
    for (const a of this._queue) this.pressed.add(a);
    this._queue = [];
  },

  inject(action) { this._queue.push(action); },

  // Call at the end of each frame
  endFrame() {
    this.pressed.clear();
    this.mouse.clicked = false;
    this.mouse.rclicked = false;
    this.mouse.wheel = 0;
    this.mouse.moved = false;
    this.text.buf = ''; this.text.back = 0; this.text.enter = false; this.text.esc = false;
    if (this._liftTouch) { this._liftTouch = false; this.mouse.x = -100; this.mouse.y = -100; }
  },

  held(a) { return this.actDown.has(a) || this.actDown.has('pad_' + a); },
  hit(a) { return this.pressed.has(a); },
  // menu navigation (keyboard arrows/WASD, d-pad, stick)
  nav(dir) { return this.pressed.has(dir) || this.pressed.has('nav_' + dir); },

  // Movement vector in [-1, 1]
  move() {
    let x = 0, y = 0;
    if (this.held('left')) x -= 1;
    if (this.held('right')) x += 1;
    if (this.held('up')) y -= 1;
    if (this.held('down')) y += 1;
    if (Math.abs(this.padAxes[0]) > 0.25 || Math.abs(this.padAxes[1]) > 0.25) { x = this.padAxes[0]; y = this.padAxes[1]; }
    if (this.stick.active) {
      const dx = this.stick.x - this.stick.cx, dy = this.stick.y - this.stick.cy, d = Math.hypot(dx, dy);
      if (d > 4) { const m = Math.min(1, d / 24); x = dx / d * m; y = dy / d * m; }
    }
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    return [x, y];
  },

  startText(initial) {
    this.text.on = true;
    if (this.touchMode) {
      if (!this.hiddenInput) {
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.autocomplete = 'off';
        inp.style.cssText = 'position:fixed;left:-1000px;top:0;opacity:0;';
        inp.addEventListener('input', () => { this.text.buf += inp.value; inp.value = ''; });
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.text.enter = true; if (e.key === 'Backspace') this.text.back++; });
        document.body.appendChild(inp);
        this.hiddenInput = inp;
      }
      this.hiddenInput.value = '';
      this.hiddenInput.focus();
    }
  },
  stopText() {
    this.text.on = false;
    if (this.hiddenInput) this.hiddenInput.blur();
  },

  // Label for a prompt key depending on the last used device
  keyLabel(action) {
    const pad = this.lastDevice === 'pad', touch = this.lastDevice === 'touch';
    const map = {
      act: pad ? 'A' : touch ? 'A' : 'E', alt: pad ? 'X' : touch ? 'B' : 'F', cancel: pad ? 'B' : 'Esc', ok: pad ? 'A' : 'Space',
      journal: pad ? 'Y' : 'Tab', map: pad ? 'Back' : 'M', bag: 'I',
    };
    return map[action] || action;
  },
};
