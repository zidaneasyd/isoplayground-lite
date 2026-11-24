export class GameLoop {
  constructor(update, render) {
    this.update = update;
    this.render = render;
    this.running = false;
    this.lastTime = 0;
    this.rafId = null;
    this.frame = this.frame.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.frame);
  }

  stop() {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  frame(now) {
    this.rafId = null;
    if (!this.running) return;

    const deltaTime = Math.min(Math.max((now - this.lastTime) / 1000, 0), 0.05);
    this.lastTime = now;

    try {
      this.update(deltaTime);
      if (!this.running) return;
      this.render();
    } catch (error) {
      this.stop();
      throw error;
    }

    if (this.running) {
      this.rafId = requestAnimationFrame(this.frame);
    }
  }
}
