import { GameLoop } from "./game-loop.js";
import { World } from "../world/world.js";
import { Camera } from "../camera/camera.js";
import { Renderer } from "../rendering/renderer.js";

export class Engine {
  constructor(canvas, config) {
    if (!canvas || typeof canvas.getContext !== "function") {
      throw new TypeError("Engine membutuhkan elemen canvas yang valid.");
    }

    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    if (!this.ctx) throw new Error("Canvas 2D context tidak tersedia.");

    this.config = config;
    this.world = new World(config.world);
    this.camera = new Camera(config.camera);
    this.renderer = new Renderer(this.ctx, config);
    this.loop = new GameLoop(
      (deltaTime) => this.update(deltaTime),
      () => this.render()
    );

    this.destroyed = false;
    this.dragPointerId = null;
    this.lastPointerX = 0;
    this.lastPointerY = 0;

    this.resize = this.resize.bind(this);
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerEnd = this.onPointerEnd.bind(this);
    this.onWheel = this.onWheel.bind(this);

    window.addEventListener("resize", this.resize);
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.canvas.addEventListener("pointermove", this.onPointerMove);
    this.canvas.addEventListener("pointerup", this.onPointerEnd);
    this.canvas.addEventListener("pointercancel", this.onPointerEnd);
    this.canvas.addEventListener("lostpointercapture", this.onPointerEnd);
    this.canvas.addEventListener("wheel", this.onWheel, { passive: false });

    this.resize();
  }

  resize() {
    if (this.destroyed) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    const pixelWidth = Math.round(width * dpr);
    const pixelHeight = Math.round(height * dpr);

    if (this.canvas.width !== pixelWidth) this.canvas.width = pixelWidth;
    if (this.canvas.height !== pixelHeight) this.canvas.height = pixelHeight;

    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.renderer.setViewport(width, height);
    this.render();
  }

  onPointerDown(event) {
    if (event.button !== 0 || this.dragPointerId !== null) return;
    if (event.isPrimary === false || !Number.isFinite(event.pointerId)) return;

    this.dragPointerId = event.pointerId;
    this.lastPointerX = event.clientX;
    this.lastPointerY = event.clientY;
    this.canvas.classList?.add("is-dragging");
    this.canvas.setPointerCapture?.(event.pointerId);
  }

  onPointerMove(event) {
    if (event.pointerId !== this.dragPointerId) return;

    const deltaX = event.clientX - this.lastPointerX;
    const deltaY = event.clientY - this.lastPointerY;
    this.lastPointerX = event.clientX;
    this.lastPointerY = event.clientY;

    if (this.camera.panBy(deltaX, deltaY)) this.render();
  }

  onPointerEnd(event) {
    if (event.pointerId !== this.dragPointerId) return;

    this.dragPointerId = null;
    this.canvas.classList?.remove("is-dragging");
  }

  onWheel(event) {
    if (!Number.isFinite(event.deltaY) || event.deltaY === 0) return;
    event.preventDefault();

    const bounds = this.canvas.getBoundingClientRect();
    const factor = Math.exp(-event.deltaY * this.camera.wheelZoomSpeed);
    const changed = this.camera.zoomAt(
      event.clientX - bounds.left,
      event.clientY - bounds.top,
      factor,
      this.renderer.width,
      this.renderer.height
    );

    if (changed) this.render();
  }

  update(_deltaTime) {
    // Reserved for world/entity updates as gameplay systems are introduced.
  }

  render() {
    this.renderer.render(this.world, this.camera);
  }

  start() {
    if (!this.destroyed) this.loop.start();
  }

  stop() {
    this.loop.stop();
  }

  destroy() {
    if (this.destroyed) return;

    this.stop();
    this.destroyed = true;
    window.removeEventListener("resize", this.resize);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerup", this.onPointerEnd);
    this.canvas.removeEventListener("pointercancel", this.onPointerEnd);
    this.canvas.removeEventListener("lostpointercapture", this.onPointerEnd);
    this.canvas.removeEventListener("wheel", this.onWheel);
    this.canvas.classList?.remove("is-dragging");
    this.dragPointerId = null;
  }
}
