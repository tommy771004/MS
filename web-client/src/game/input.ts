/**
 * Keyboard state with edge detection. Ignores events while a DOM input/textarea
 * is focused, so typing in the React chat box never leaks into the game (a real
 * benefit of the DOM-UI / WebGL-game split).
 */
export class Keyboard {
  private down = new Set<string>();
  private prev = new Set<string>();

  constructor() {
    window.addEventListener('keydown', this.onDown);
    window.addEventListener('keyup', this.onUp);
  }

  private typingInDom(): boolean {
    const el = document.activeElement;
    return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
  }

  private onDown = (e: KeyboardEvent): void => {
    if (this.typingInDom()) return;
    this.down.add(e.code);
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
  };

  private onUp = (e: KeyboardEvent): void => {
    this.down.delete(e.code);
  };

  isDown(code: string): boolean {
    return this.down.has(code);
  }

  justPressed(code: string): boolean {
    return this.down.has(code) && !this.prev.has(code);
  }

  /** Call once at the end of each frame to refresh edge detection. */
  endFrame(): void {
    this.prev = new Set(this.down);
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onDown);
    window.removeEventListener('keyup', this.onUp);
  }
}
