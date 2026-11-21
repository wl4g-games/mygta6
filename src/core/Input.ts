import { DEFAULT_BINDINGS, resolveKey } from '../config/Preferences';

export class Input {
  readonly keys = new Set<string>();
  private pressed = new Set<string>();
  onLook: (dx: number, dy: number) => void = () => {};
  onClick: () => void = () => {};
  private drag = false;
  firing = false;
  bindings: Readonly<Record<string, string>> = DEFAULT_BINDINGS;
  constructor(private readonly canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', this.down);
    window.addEventListener('keyup', this.up);
    window.addEventListener('blur', this.clear);
    window.addEventListener('mousemove', this.move);
    window.addEventListener('mouseup', this.mouseUp);
    canvas.addEventListener('mousedown', this.mouseDown);
    canvas.addEventListener('contextmenu', this.context);
  }
  private down = (e: KeyboardEvent) => {
    if ((e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) && !['Escape', 'F5', 'F3'].includes(e.code)) return;
    if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'F5', 'F3'].includes(e.code)) e.preventDefault();
    const code = resolveKey(e.code, this.bindings); if (!code) return;
    if (!this.keys.has(code)) this.pressed.add(code);
    this.keys.add(code);
  };
  private up = (e: KeyboardEvent) => { const code = resolveKey(e.code, this.bindings); if (code) this.keys.delete(code); };
  private clear = () => { this.keys.clear(); this.pressed.clear(); this.drag = false; this.firing = false; };
  private move = (e: MouseEvent) => { if (document.pointerLockElement === this.canvas || this.drag) this.onLook(e.movementX, e.movementY); };
  private mouseDown = (e: MouseEvent) => {
    if (e.button === 2) this.drag = true;
    else if (e.button === 0) { this.firing = true; this.onClick(); }
  };
  private mouseUp = (event: MouseEvent) => { if (event.button === 2) this.drag = false; if (event.button === 0) this.firing = false; };
  private context = (e: Event) => e.preventDefault();
  held(code: string) { return this.keys.has(code); }
  take(code: string) { return this.pressed.delete(code); }
  endFrame() { this.pressed.clear(); }
  release() { this.clear(); if (document.pointerLockElement) document.exitPointerLock(); }
  close() {
    window.removeEventListener('keydown', this.down); window.removeEventListener('keyup', this.up);
    window.removeEventListener('blur', this.clear); window.removeEventListener('mousemove', this.move);
    window.removeEventListener('mouseup', this.mouseUp); this.canvas.removeEventListener('mousedown', this.mouseDown);
    this.canvas.removeEventListener('contextmenu', this.context);
  }
}
