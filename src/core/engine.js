import { GameLoop } from "./game-loop.js";
import { World } from "../world/world.js";
import { Camera } from "../camera/camera.js";
import { Renderer } from "../rendering/renderer.js";
import { screenToGrid, screenToTile } from "../world/coordinates.js";
import { TileHover } from "../interaction/tile-hover.js";
import { TileSelection } from "../interaction/tile-selection.js";
import { ObjectPlacement } from "../interaction/object-placement.js";
import { ObjectSelection } from "../interaction/object-selection.js";
import { AssetManager } from "../assets/asset-manager.js";
import { updateTilesProperty } from "../world/tile-properties.js";

const INTERACTIVE_ROLES = new Set([
  "button", "checkbox", "combobox", "listbox", "menu", "menuitem",
  "menuitemcheckbox", "menuitemradio", "option", "radio", "radiogroup",
  "searchbox", "slider", "spinbutton", "switch", "tab", "textbox",
  "tree", "treeitem"
]);
const INTERACTIVE_TARGET_SELECTOR = [
  "input", "textarea", "select", "button", "a[href]", "summary",
  "[contenteditable]:not([contenteditable=\"false\"])" ,
  ...[...INTERACTIVE_ROLES].map((role) => `[role=\"${role}\"]`)
].join(", ");

function isInteractiveKeyTarget(target) {
  if (!target || typeof target !== "object") return false;

  if (typeof target.closest === "function") {
    try {
      if (target.closest(INTERACTIVE_TARGET_SELECTOR)) return true;
    } catch {
      // Non-DOM target stubs may expose an incompatible closest method.
    }
  }

  const tagName = typeof target.tagName === "string"
    ? target.tagName.toLowerCase()
    : typeof target.localName === "string"
      ? target.localName.toLowerCase()
      : "";
  if (["input", "textarea", "select", "button"].includes(tagName)) return true;
  if (target.isContentEditable === true) return true;

  const getAttribute = typeof target.getAttribute === "function"
    ? target.getAttribute.bind(target)
    : null;
  if (getAttribute && getAttribute("contenteditable") !== null &&
      String(getAttribute("contenteditable")).toLowerCase() !== "false") return true;
  const role = getAttribute?.("role");
  return typeof role === "string" && INTERACTIVE_ROLES.has(role.toLowerCase());
}

export class Engine {
  constructor(canvas, config, { onSelectionChange = null, onElevationChange = null, onObjectSelectionChange = null, assetManager = null } = {}) {
    if (!canvas || typeof canvas.getContext !== "function") {
      throw new TypeError("Engine membutuhkan elemen canvas yang valid.");
    }

    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    if (!this.ctx) throw new Error("Canvas 2D context tidak tersedia.");

    if (onSelectionChange !== null && typeof onSelectionChange !== "function") {
      throw new TypeError("onSelectionChange harus berupa function atau null.");
    }
    if (onElevationChange !== null && typeof onElevationChange !== "function") {
      throw new TypeError("onElevationChange harus berupa function atau null.");
    }
    if (onObjectSelectionChange !== null && typeof onObjectSelectionChange !== "function") {
      throw new TypeError("onObjectSelectionChange harus berupa function atau null.");
    }
    if (assetManager !== null && (
      typeof assetManager.load !== "function" ||
      typeof assetManager.get !== "function" ||
      typeof assetManager.remove !== "function" ||
      typeof assetManager.clear !== "function"
    )) {
      throw new TypeError("assetManager harus menyediakan load(), get(), remove(), dan clear().");
    }

    this.config = config;
    this.onSelectionChange = onSelectionChange;
    this.onElevationChange = onElevationChange;
    this.onObjectSelectionChange = onObjectSelectionChange;
    this.assets = assetManager ?? new AssetManager();
    this.world = new World(config.world);
    this.camera = new Camera(config.camera);
    this.renderer = new Renderer(this.ctx, config, { assetManager: this.assets });
    this.tileHover = new TileHover();
    this.tileSelection = new TileSelection();
    this.objectPlacement = new ObjectPlacement(this.world);
    this.objectSelection = new ObjectSelection(this.world);
    this.lastPointerClientPosition = null;
    this.loop = new GameLoop(
      (deltaTime) => this.update(deltaTime),
      () => this.render()
    );

    this.destroyed = false;
    this.pointerSession = null;

    this.resize = this.resize.bind(this);
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerLeave = this.onPointerLeave.bind(this);
    this.onPointerEnd = this.onPointerEnd.bind(this);
    this.onWheel = this.onWheel.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onContextMenu = (event) => event.preventDefault();

    window.addEventListener("resize", this.resize);
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.canvas.addEventListener("pointermove", this.onPointerMove);
    this.canvas.addEventListener("pointerleave", this.onPointerLeave);
    this.canvas.addEventListener("pointerup", this.onPointerEnd);
    this.canvas.addEventListener("pointercancel", this.onPointerEnd);
    this.canvas.addEventListener("lostpointercapture", this.onPointerEnd);
    this.canvas.addEventListener("wheel", this.onWheel, { passive: false });
    this.canvas.addEventListener("contextmenu", this.onContextMenu);
    window.addEventListener("keydown", this.onKeyDown);

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

  getSelectedTiles() { return this.tileSelection.getSelectedTiles(); }

  getSelectedObject() { return this.objectSelection.selectedObject; }

  notifyObjectSelectionChange() {
    this.onObjectSelectionChange?.(this.objectSelection.selectedObject);
  }

  removeWorldObject(id) {
    const removed = this.world.objects.remove(id);
    if (!removed) return false;
    if (this.objectSelection.selectedObjectId === id) {
      this.objectSelection.clear();
      this.notifyObjectSelectionChange();
    }
    this.refreshWorldView();
    return true;
  }

  /** Updates hover using client coordinates and the current camera transform. */
  updateHoverAtClientPoint(clientX, clientY) {
    this.lastPointerClientPosition = { x: clientX, y: clientY };
    const point = this.clientToCanvas(clientX, clientY);
    const hoverChanged = point
      ? this.tileHover.update(point.x, point.y, this.getView())
      : this.tileHover.clear();
    return this.updateObjectPlacementPreviewFromHover() || hoverChanged;
  }

  clearHover() {
    this.lastPointerClientPosition = null;
    const hoverChanged = this.tileHover.clear();
    return this.updateObjectPlacementPreviewFromHover() || hoverChanged;
  }

  /** Updates the placement candidate from the tile currently under the pointer. */
  updateObjectPlacementPreviewFromHover() {
    if (!this.objectPlacement.active) return false;
    const tile = this.tileHover.hoveredTile;
    const previous = this.objectPlacement.getPreview();
    this.objectPlacement.updatePreview(tile?.x ?? null, tile?.y ?? null);
    const next = this.objectPlacement.getPreview();
    return (
      previous.mode !== next.mode ||
      previous.objectId !== next.objectId ||
      previous.x !== next.x ||
      previous.y !== next.y ||
      previous.valid !== next.valid ||
      previous.reason !== next.reason
    );
  }

  /** Starts a new-object placement session. The object is stored only on commit. */
  beginObjectPlacement(object) {
    if (this.destroyed) return false;
    this.objectPlacement.beginPlacement(object);
    if (this.lastPointerClientPosition) {
      this.updateHoverAtClientPoint(
        this.lastPointerClientPosition.x,
        this.lastPointerClientPosition.y
      );
    } else {
      this.objectPlacement.updatePreview(null, null);
    }
    this.render();
    return true;
  }

  /** Starts moving a stored object by ID. */
  beginObjectMove(id) {
    if (this.destroyed || !this.objectPlacement.beginMove(id)) return false;
    if (this.lastPointerClientPosition) {
      this.updateHoverAtClientPoint(
        this.lastPointerClientPosition.x,
        this.lastPointerClientPosition.y
      );
    }
    this.render();
    return true;
  }

  /** Cancels the active placement/move and removes its preview. */
  cancelObjectPlacement() {
    const cancelled = this.objectPlacement.cancel();
    if (cancelled) this.render();
    return cancelled;
  }

  /** Commits the current valid preview, or returns false while it is invalid. */
  confirmObjectPlacement() {
    const object = this.objectPlacement.confirm();
    if (object) {
      if (this.objectSelection.select(object.id)) this.notifyObjectSelectionChange();
      this.refreshWorldView();
    }
    else if (this.objectPlacement.active) this.render();
    return object;
  }

  getObjectPlacementPreview() {
    return this.objectPlacement.getPreview();
  }

  /** Loads a sprite asset and redraws the world when the image is ready. */
  loadSprite(assetId, source, options = {}) {
    if (this.destroyed) {
      return Promise.reject(new Error("Engine sudah dihancurkan dan tidak dapat memuat asset."));
    }
    return this.assets.load(assetId, source, options).then((image) => {
      if (!this.destroyed) this.render();
      return image;
    });
  }

  /** Removes a sprite asset registration and redraws objects using that asset. */
  removeSprite(assetId) {
    const removed = this.assets.remove(assetId);
    if (removed && !this.destroyed) this.render();
    return removed;
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
    if (this.pointerSession || ![0, 1, 2].includes(event.button) || !Number.isFinite(event.pointerId)) return;
    if (event.button === 0 && event.isPrimary === false) return;

    if (this.objectPlacement.active && event.button === 2) {
      event.preventDefault?.();
      this.cancelObjectPlacement();
      return;
    }

    const pan = event.button === 1;
    const mode = pan ? "pan" : this.objectPlacement.active && event.button === 0
      ? "object-placement"
      : event.button === 0
        ? (event.shiftKey ? "add" : "select")
        : (event.shiftKey ? "remove" : null);
    if (!mode) return;

    this.pointerSession = {
      pointerId: event.pointerId,
      mode,
      downX: event.clientX,
      downY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      processed: new Set()
    };
    if (pan) this.canvas.classList?.add("is-dragging");
    this.canvas.setPointerCapture?.(event.pointerId);
    const hoverChanged = this.updateHoverAtClientPoint(event.clientX, event.clientY);
    let selectionChanged = false;
    if (mode === "add" || mode === "remove") selectionChanged = this.processSelectionPoint(event.clientX, event.clientY);
    if (selectionChanged) this.notifySelectionChange();
    if (hoverChanged || selectionChanged) this.render();
  }

  processSelectionPoint(clientX, clientY) {
    const session = this.pointerSession;
    const point = this.clientToCanvas(clientX, clientY);
    if (!point) return false;
    this.tileHover.update(point.x, point.y, this.getView());
    const tile = this.tileHover.hoveredTile;
    if (!session || !tile || session.processed.has(tile.id)) return false;
    session.processed.add(tile.id);
    return session.mode === "add" ? this.tileSelection.add(tile) : this.tileSelection.remove(tile.id);
  }

  processSelectionSegment(fromX, fromY, toX, toY) {
    const scale = this.getCanvasClientScale();
    const step = Math.max(1, Math.min(
      this.config.tile.width * this.camera.zoom / scale.x,
      this.config.tile.height * this.camera.zoom / scale.y
    ) * 0.35);
    const distance = Math.hypot(toX - fromX, toY - fromY);
    const count = Math.max(1, Math.ceil(distance / step));
    let changed = false;
    for (let index = 1; index <= count; index++) {
      const ratio = index / count;
      changed = this.processSelectionPoint(
        fromX + (toX - fromX) * ratio,
        fromY + (toY - fromY) * ratio
      ) || changed;
    }
    return changed;
  }

  notifySelectionChange() {
    this.onSelectionChange?.(
      this.tileSelection.selectedTile,
      this.tileSelection.getSelectedTiles()
    );
  }

  onPointerMove(event) {
    const session = this.pointerSession;
    if (session && event.pointerId !== session.pointerId) return;

    let cameraChanged = false;
    let selectionChanged = false;
    if (session?.mode === "pan") {
      const scale = this.getCanvasClientScale();
      const deltaX = (event.clientX - session.lastX) * scale.x;
      const deltaY = (event.clientY - session.lastY) * scale.y;
      session.lastX = event.clientX;
      session.lastY = event.clientY;
      cameraChanged = this.camera.panBy(deltaX, deltaY, this.getCameraBounds());
    } else if (session?.mode === "add" || session?.mode === "remove") {
      selectionChanged = this.processSelectionSegment(
        session.lastX, session.lastY, event.clientX, event.clientY
      );
      session.lastX = event.clientX;
      session.lastY = event.clientY;
    }

    const hoverChanged = this.updateHoverAtClientPoint(event.clientX, event.clientY);
    if (selectionChanged) this.notifySelectionChange();
    if (cameraChanged || hoverChanged || selectionChanged) this.render();
  }

  onPointerLeave() {
    if (this.clearHover()) this.render();
  }

  onPointerEnd(event) {
    const session = this.pointerSession;
    if (!session || event.pointerId !== session.pointerId) return;

    this.pointerSession = null;
    if (session.mode === "pan") this.canvas.classList?.remove("is-dragging");

    let hoverChanged = false;
    let selectionChanged = false;
    const cancelled = event.type === "pointercancel" || event.type === "lostpointercapture";
    const hasReleasePoint = Number.isFinite(event.clientX) && Number.isFinite(event.clientY);

    if (cancelled) {
      hoverChanged = this.clearHover();
    } else if (hasReleasePoint) {
      hoverChanged = this.updateHoverAtClientPoint(event.clientX, event.clientY);
      if (session.mode === "select" || session.mode === "object-placement") {
        const scale = this.getCanvasClientScale();
        const dx = (event.clientX - session.downX) * scale.x;
        const dy = (event.clientY - session.downY) * scale.y;
        const clickDistance = Math.hypot(dx, dy);
        // A small tolerance accommodates pointer jitter without treating a drag as a click.
        if (clickDistance <= 4) {
          if (session.mode === "object-placement") {
            this.confirmObjectPlacement();
          } else {
            const tile = this.tileHover.hoveredTile;
            const object = tile ? this.objectSelection.selectAt(tile.x, tile.y) : null;
            if (object) {
              this.notifyObjectSelectionChange();
            } else {
              const objectCleared = this.objectSelection.clear();
              if (objectCleared) this.notifyObjectSelectionChange();
              if (tile) {
                const focused = this.tileSelection.selectedTile;
                if (this.tileSelection.selectedTiles.length === 1 && focused?.id === tile.id) {
                  selectionChanged = this.tileSelection.clear();
                } else {
                  selectionChanged = this.tileSelection.select(tile);
                }
              }
              if (selectionChanged) this.notifySelectionChange();
            }
          }
        }
      }
    }
    if (hoverChanged || selectionChanged) this.render();
  }

  onKeyDown(event) {
    if (isInteractiveKeyTarget(event.target)) return;
    if (event.key === "Escape" && this.objectPlacement.active) {
      event.preventDefault();
      this.cancelObjectPlacement();
      return;
    }
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    const tiles = this.tileSelection.getSelectedTiles();
    if (!tiles.length) return;
    event.preventDefault();
    const delta = event.key === "ArrowUp" ? 1 : -1;
    const changedTiles = updateTilesProperty(
      tiles,
      "elevation",
      (elevation) => elevation + delta
    );
    if (!changedTiles.length) return;
    this.onElevationChange?.(this.tileSelection.selectedTile, tiles);
    this.refreshWorldView();
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
      selectedTileIds: this.tileSelection.selectedTiles.map((tile) => tile.id),
      objectPlacementPreview: this.objectPlacement.getPreview(),
      selectedObjectId: this.objectSelection.selectedObjectId
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
    this.canvas.removeEventListener("contextmenu", this.onContextMenu);
    window.removeEventListener("keydown", this.onKeyDown);
    this.canvas.classList?.remove("is-dragging");
    this.pointerSession = null;
    this.objectPlacement.cancel();
    this.assets.clear();
    this.clearHover();
    if (this.tileSelection.clear()) this.notifySelectionChange();
    if (this.objectSelection.clear()) this.notifyObjectSelectionChange();
  }
}
