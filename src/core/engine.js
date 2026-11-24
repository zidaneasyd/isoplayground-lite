import { GameLoop } from "./game-loop.js";
import { World } from "../world/world.js";
import { Camera } from "../camera/camera.js";
import { Renderer } from "../rendering/renderer.js";
import { screenToGrid } from "../world/coordinates.js";

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
    this.pointerGrid = null;

    this.resize = this.resize.bind(this);
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerEnd = this.onPointerEnd.bind(this);
    this.onPointerLeave = this.onPointerLeave.bind(this);
    this.onWheel = this.onWheel.bind(this);

    window.addEventListener("resize", this.resize);
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.canvas.addEventListener("pointermove", this.onPointerMove);
    this.canvas.addEventListener("pointerup", this.onPointerEnd);
    this.canvas.addEventListener("pointercancel", this.onPointerEnd);
    this.canvas.addEventListener("pointerleave", this.onPointerLeave);
    this.canvas.addEventListener("lostpointercapture", this.onPointerEnd);
    this.canvas.addEventListener("wheel", this.onWheel, { passive: false });

    this.resize();
  }

  getCameraBounds() {
    return {
      world: this.world,
      tile: this.config.tile,
      viewportWidth: this.renderer.width,
      viewportHeight: this.renderer.height
    };
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
    this.camera.constrainToVisibleTile(this.getCameraBounds());
    this.render();
  }

  /** Convert client (browser-window) coordinates into world tile coordinates. */
  screenToGrid(clientX, clientY) {
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;

    const bounds = this.canvas.getBoundingClientRect();
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) return null;

    // Renderer coordinates use CSS pixels; account for any CSS scaling of the canvas.
    const screenX = (clientX - bounds.left) * this.renderer.width / bounds.width;
    const screenY = (clientY - bounds.top) * this.renderer.height / bounds.height;

    const transform = {
      viewportWidth: this.renderer.width,
      viewportHeight: this.renderer.height,
      camera: this.camera,
      world: this.world,
      elevationStep: this.config.tile.elevationStep
    };

    // Tiles are drawn in diagonal order. Test them in reverse so overlapping
    // elevated tiles resolve to the last (visually topmost) tile rendered.
    const tiles = [...this.world.getTiles()];
    for (let index = tiles.length - 1; index >= 0; index--) {
      const tile = tiles[index];
      const tileCoordinates = screenToGrid(
        screenX,
        screenY,
        this.config.tile.width,
        this.config.tile.height,
        { ...transform, elevation: tile.elevation }
      );

      if (tileCoordinates?.x === tile.x && tileCoordinates?.y === tile.y) {
        return tileCoordinates;
      }
    }
    return null;
  }

  onPointerDown(event) {
    this.pointerGrid = this.screenToGrid(event.clientX, event.clientY);
    if (event.button !== 0 || this.dragPointerId !== null) return;
    if (event.isPrimary === false || !Number.isFinite(event.pointerId)) return;

    this.dragPointerId = event.pointerId;
    this.lastPointerX = event.clientX;
    this.lastPointerY = event.clientY;
    this.canvas.classList?.add("is-dragging");
    this.canvas.setPointerCapture?.(event.pointerId);
  }

  onPointerMove(event) {
    this.pointerGrid = this.screenToGrid(event.clientX, event.clientY);
    if (event.pointerId !== this.dragPointerId) return;

    const deltaX = event.clientX - this.lastPointerX;
    const deltaY = event.clientY - this.lastPointerY;
    this.lastPointerX = event.clientX;
    this.lastPointerY = event.clientY;

    if (this.camera.panBy(deltaX, deltaY, this.getCameraBounds())) {
      this.render();
      // Re-evaluate against the camera after the pan has been applied.
      this.pointerGrid = this.screenToGrid(event.clientX, event.clientY);
    }
  }

  onPointerLeave() {
    if (this.dragPointerId === null) this.pointerGrid = null;
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

    if (changed) {
      this.camera.constrainToVisibleTile(this.getCameraBounds());
      this.pointerGrid = this.screenToGrid(event.clientX, event.clientY);
      this.render();
    }
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
    this.canvas.removeEventListener("pointerleave", this.onPointerLeave);
    this.canvas.removeEventListener("lostpointercapture", this.onPointerEnd);
    this.canvas.removeEventListener("wheel", this.onWheel);
    this.canvas.classList?.remove("is-dragging");
    this.dragPointerId = null;
    this.pointerGrid = null;
  }
}
