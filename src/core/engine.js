import { GameLoop } from "./game-loop.js";
import { World } from "../world/world.js";
import { Camera } from "../camera/camera.js";
import { Renderer } from "../rendering/renderer.js";
import { screenToGrid, screenToTile } from "../world/coordinates.js";
import { TileHover } from "../interaction/tile-hover.js";
import { TileSelection } from "../interaction/tile-selection.js";

export class Engine {
  constructor(canvas, config, { onSelectionChange = null } = {}) {
    if (!canvas || typeof canvas.getContext !== "function") {
      throw new TypeError("Engine membutuhkan elemen canvas yang valid.");
    }

    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    if (!this.ctx) throw new Error("Canvas 2D context tidak tersedia.");

    if (onSelectionChange !== null && typeof onSelectionChange !== "function") {
      throw new TypeError("onSelectionChange harus berupa function atau null.");
    }

    this.config = config;
    this.onSelectionChange = onSelectionChange;
    this.world = new World(config.world);
    this.camera = new Camera(config.camera);
    this.renderer = new Renderer(this.ctx, config);
    this.tileHover = new TileHover();
    this.tileSelection = new TileSelection();
    this.pointerDownPosition = null;
    this.lastPointerClientPosition = null;
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
    this.onPointerLeave = this.onPointerLeave.bind(this);
    this.onPointerEnd = this.onPointerEnd.bind(this);
    this.onWheel = this.onWheel.bind(this);

    window.addEventListener("resize", this.resize);
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.canvas.addEventListener("pointermove", this.onPointerMove);
    this.canvas.addEventListener("pointerleave", this.onPointerLeave);
    this.canvas.addEventListener("pointerup", this.onPointerEnd);
    this.canvas.addEventListener("pointercancel", this.onPointerEnd);
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

  /**
   * Snapshot parameter tampilan yang dibutuhkan oleh transformasi koordinat.
   */
  getView() {
    return {
      camera: this.camera,
      world: this.world,
      tile: this.config.tile,
      viewportWidth: this.renderer.width,
      viewportHeight: this.renderer.height
    };
  }

  /** Faktor konversi delta pointer layar ke unit CSS yang dipakai Renderer. */
  getCanvasClientScale() {
    const rect = this.canvas.getBoundingClientRect();
    if (
      !rect || !Number.isFinite(rect.width) || !Number.isFinite(rect.height) ||
      rect.width <= 0 || rect.height <= 0 ||
      !Number.isFinite(this.renderer.width) || !Number.isFinite(this.renderer.height) ||
      this.renderer.width <= 0 || this.renderer.height <= 0
    ) return { x: 1, y: 1 };

    return {
      x: this.renderer.width / rect.width,
      y: this.renderer.height / rect.height
    };
  }

  /**
   * Mengubah clientX/clientY menjadi koordinat CSS Canvas.
   * Skala bounding rect turut diperhitungkan agar tetap akurat saat elemen
   * Canvas diubah ukurannya oleh CSS.
   */
  clientToCanvas(clientX, clientY) {
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;

    const rect = this.canvas.getBoundingClientRect();
    if (
      !rect || !Number.isFinite(rect.left) || !Number.isFinite(rect.top) ||
      !Number.isFinite(rect.width) || !Number.isFinite(rect.height) ||
      rect.width <= 0 || rect.height <= 0 ||
      !Number.isFinite(this.renderer.width) || !Number.isFinite(this.renderer.height) ||
      this.renderer.width <= 0 || this.renderer.height <= 0
    ) return null;

    const relativeX = clientX - rect.left;
    const relativeY = clientY - rect.top;
    if (relativeX < 0 || relativeY < 0 || relativeX > rect.width || relativeY > rect.height) {
      return null;
    }

    const scale = this.getCanvasClientScale();
    return { x: relativeX * scale.x, y: relativeY * scale.y };
  }

  /** Returns the persistent tile currently under the pointer, if any. */
  getHoveredTile() {
    return this.tileHover.hoveredTile;
  }

  /** Returns the persistent tile selected by the most recent click. */
  getSelectedTile() {
    return this.tileSelection.selectedTile;
  }

  /** Updates hover using client coordinates and the current camera transform. */
  updateHoverAtClientPoint(clientX, clientY) {
    this.lastPointerClientPosition = { x: clientX, y: clientY };
    const point = this.clientToCanvas(clientX, clientY);
    if (!point) return this.tileHover.clear();
    return this.tileHover.update(point.x, point.y, this.getView());
  }

  clearHover() {
    this.lastPointerClientPosition = null;
    return this.tileHover.clear();
  }

  /** Koordinat grid kontinu di bawah pointer, atau null bila di luar Canvas. */
  getGridAtClient(clientX, clientY) {
    const point = this.clientToCanvas(clientX, clientY);
    if (!point) return null;
    return screenToGrid(point.x, point.y, this.getView());
  }

  /** Tile integer di bawah pointer, atau null bila di luar dunia/Canvas. */
  getTileAtClient(clientX, clientY) {
    const point = this.clientToCanvas(clientX, clientY);
    if (!point) return null;
    return screenToTile(point.x, point.y, this.getView());
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
    if (this.lastPointerClientPosition) {
      this.updateHoverAtClientPoint(
        this.lastPointerClientPosition.x,
        this.lastPointerClientPosition.y
      );
    }
    this.render();
  }

  onPointerDown(event) {
    if (event.button !== 0 || this.dragPointerId !== null) return;
    if (event.isPrimary === false || !Number.isFinite(event.pointerId)) return;

    this.dragPointerId = event.pointerId;
    this.lastPointerX = event.clientX;
    this.lastPointerY = event.clientY;
    this.pointerDownPosition = Number.isFinite(event.clientX) && Number.isFinite(event.clientY)
      ? { x: event.clientX, y: event.clientY }
      : null;
    this.canvas.classList?.add("is-dragging");
    this.canvas.setPointerCapture?.(event.pointerId);
    if (this.updateHoverAtClientPoint(event.clientX, event.clientY)) this.render();
  }

  onPointerMove(event) {
    if (this.dragPointerId !== null && event.pointerId !== this.dragPointerId) return;

    let cameraChanged = false;
    if (event.pointerId === this.dragPointerId) {
      const scale = this.getCanvasClientScale();
      const deltaX = (event.clientX - this.lastPointerX) * scale.x;
      const deltaY = (event.clientY - this.lastPointerY) * scale.y;
      this.lastPointerX = event.clientX;
      this.lastPointerY = event.clientY;
      cameraChanged = this.camera.panBy(deltaX, deltaY, this.getCameraBounds());
    }

    const hoverChanged = this.updateHoverAtClientPoint(event.clientX, event.clientY);
    if (cameraChanged || hoverChanged) this.render();
  }

  onPointerLeave() {
    if (this.clearHover()) this.render();
  }

  onPointerEnd(event) {
    if (event.pointerId !== this.dragPointerId) return;

    this.dragPointerId = null;
    this.canvas.classList?.remove("is-dragging");

    let hoverChanged = false;
    let selectionChanged = false;
    const cancelled = event.type === "pointercancel" || event.type === "lostpointercapture";
    const hasReleasePoint = Number.isFinite(event.clientX) && Number.isFinite(event.clientY);

    if (cancelled) {
      hoverChanged = this.clearHover();
    } else if (hasReleasePoint) {
      hoverChanged = this.updateHoverAtClientPoint(event.clientX, event.clientY);
      if (this.pointerDownPosition) {
        const scale = this.getCanvasClientScale();
        const dx = (event.clientX - this.pointerDownPosition.x) * scale.x;
        const dy = (event.clientY - this.pointerDownPosition.y) * scale.y;
        const clickDistance = Math.hypot(dx, dy);
        // A small tolerance accommodates pointer jitter without treating a pan as a click.
        if (clickDistance <= 4) {
          selectionChanged = this.tileSelection.select(this.tileHover.hoveredTile);
          if (selectionChanged) this.onSelectionChange?.(this.tileSelection.selectedTile);
        }
      }
    }
    this.pointerDownPosition = null;
    if (hoverChanged || selectionChanged) this.render();
  }

  onWheel(event) {
    if (!Number.isFinite(event.deltaY) || event.deltaY === 0) return;
    event.preventDefault();

    const point = this.clientToCanvas(event.clientX, event.clientY);
    if (!point) return;

    const factor = Math.exp(-event.deltaY * this.camera.wheelZoomSpeed);
    const changed = this.camera.zoomAt(
      point.x,
      point.y,
      factor,
      this.renderer.width,
      this.renderer.height
    );

    if (changed) this.camera.constrainToVisibleTile(this.getCameraBounds());
    const hoverChanged = this.updateHoverAtClientPoint(event.clientX, event.clientY);
    if (changed || hoverChanged) this.render();
  }

  update(_deltaTime) {
    // Reserved for world/entity updates as gameplay systems are introduced.
  }

  /** Recalculates hover and redraws after a tile's inspected properties change. */
  refreshWorldView() {
    if (this.destroyed) return;
    if (this.lastPointerClientPosition) {
      this.updateHoverAtClientPoint(
        this.lastPointerClientPosition.x,
        this.lastPointerClientPosition.y
      );
    }
    this.render();
  }

  render() {
    this.renderer.render(this.world, this.camera, {
      hoveredTileId: this.tileHover.hoveredTile?.id ?? null,
      selectedTileId: this.tileSelection.selectedTile?.id ?? null
    });
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
    this.canvas.removeEventListener("pointerleave", this.onPointerLeave);
    this.canvas.removeEventListener("pointerup", this.onPointerEnd);
    this.canvas.removeEventListener("pointercancel", this.onPointerEnd);
    this.canvas.removeEventListener("lostpointercapture", this.onPointerEnd);
    this.canvas.removeEventListener("wheel", this.onWheel);
    this.canvas.classList?.remove("is-dragging");
    this.dragPointerId = null;
    this.pointerDownPosition = null;
    this.clearHover();
    if (this.tileSelection.clear()) this.onSelectionChange?.(null);
  }
}
