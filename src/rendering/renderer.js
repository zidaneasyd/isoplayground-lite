import { gridToScreen } from "../world/coordinates.js";

const EPSILON = 1e-9;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function axisPathInterval(origin, delta, min, max) {
  if (Math.abs(delta) < EPSILON) {
    return origin >= min - EPSILON && origin <= max + EPSILON
      ? [-Infinity, Infinity]
      : null;
  }

  const a = (min - origin) / delta;
  const b = (max - origin) / delta;
  return [Math.min(a, b), Math.max(a, b)];
}

export class Camera {
  constructor(config = {}) {
    this.minZoom = Number.isFinite(config.minZoom) && config.minZoom > 0
      ? config.minZoom
      : 0.25;
    this.maxZoom = Number.isFinite(config.maxZoom) && config.maxZoom >= this.minZoom
      ? config.maxZoom
      : Math.max(4, this.minZoom);

    this.x = Number.isFinite(config.x) ? config.x : 0;
    this.y = Number.isFinite(config.y) ? config.y : 0;
    this.zoom = this.clampZoom(Number.isFinite(config.zoom) ? config.zoom : 1);
    this.wheelZoomSpeed = Number.isFinite(config.wheelZoomSpeed) && config.wheelZoomSpeed > 0
      ? config.wheelZoomSpeed
      : 0.001;
  }

  clampZoom(zoom) {
    return Math.min(this.maxZoom, Math.max(this.minZoom, zoom));
  }

  getVisibleTileCameraRects({ world, tile, viewportWidth, viewportHeight }) {
    if (
      !world || typeof world.getTiles !== "function" ||
      !tile || !Number.isFinite(tile.width) || !Number.isFinite(tile.height) ||
      tile.width <= 0 || tile.height <= 0 ||
      !Number.isFinite(viewportWidth) || !Number.isFinite(viewportHeight) ||
      viewportWidth <= 0 || viewportHeight <= 0
    ) return [];

    const scaledWidth = tile.width * this.zoom;
    const scaledHeight = tile.height * this.zoom;
    if (scaledWidth > viewportWidth || scaledHeight > viewportHeight) return [];

    const worldCenterX = (world.width - world.height) * tile.width / 4;
    const worldCenterY = (world.width + world.height) * tile.height / 4;
    const elevationStep = Number.isFinite(tile.elevationStep) ? tile.elevationStep : 0;
    const rects = [];

    for (const { x, y, elevation = 0 } of world.getTiles()) {
      const point = gridToScreen(x, y, tile.width, tile.height);
      const relativeX = (point.x - worldCenterX) * this.zoom;
      const relativeY = (point.y - worldCenterY - elevation * elevationStep) * this.zoom;
      const rect = {
        minX: -viewportWidth / 2 - relativeX + scaledWidth / 2,
        maxX: viewportWidth / 2 - relativeX - scaledWidth / 2,
        minY: -viewportHeight / 2 - relativeY,
        maxY: viewportHeight / 2 - relativeY - scaledHeight
      };

      if (rect.minX <= rect.maxX + EPSILON && rect.minY <= rect.maxY + EPSILON) {
        rects.push(rect);
      }
    }

    return rects;
  }

  constrainToVisibleTile(bounds) {
    const rects = this.getVisibleTileCameraRects(bounds);
    if (!rects.length) return false;

    let bestX = this.x;
    let bestY = this.y;
    let bestDistance = Infinity;

    for (const rect of rects) {
      const x = clamp(this.x, rect.minX, rect.maxX);
      const y = clamp(this.y, rect.minY, rect.maxY);
      const distance = (x - this.x) ** 2 + (y - this.y) ** 2;
      if (distance < bestDistance) {
        bestDistance = distance;
        bestX = x;
        bestY = y;
      }
    }

    this.x = bestX;
    this.y = bestY;
    return true;
  }

  panBy(deltaX, deltaY, bounds = null) {
    if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) return false;
    if (deltaX === 0 && deltaY === 0) return false;

    if (!bounds) {
      this.x += deltaX;
      this.y += deltaY;
      return true;
    }

    const rects = this.getVisibleTileCameraRects(bounds);
    // A full tile cannot fit in this viewport at the current zoom; avoid
    // imposing an impossible visibility constraint on very small canvases.
    if (!rects.length) {
      this.x += deltaX;
      this.y += deltaY;
      return true;
    }

    const intervals = [];
    for (const rect of rects) {
      const xInterval = axisPathInterval(this.x, deltaX, rect.minX, rect.maxX);
      if (!xInterval) continue;
      const yInterval = axisPathInterval(this.y, deltaY, rect.minY, rect.maxY);
      if (!yInterval) continue;

      const start = Math.max(0, xInterval[0], yInterval[0]);
      const end = Math.min(1, xInterval[1], yInterval[1]);
      if (start <= end + EPSILON) intervals.push([start, end]);
    }

    intervals.sort((a, b) => a[0] - b[0]);
    let reachable = -Infinity;
    for (const [start, end] of intervals) {
      if (reachable === -Infinity) {
        if (start > EPSILON) break;
        reachable = end;
      } else if (start <= reachable + EPSILON) {
        reachable = Math.max(reachable, end);
      } else {
        break;
      }
    }

    if (reachable === -Infinity || reachable <= EPSILON) return false;
    const fraction = clamp(reachable, 0, 1);
    this.x += deltaX * fraction;
    this.y += deltaY * fraction;
    return true;
  }

  zoomAt(screenX, screenY, factor, viewportWidth, viewportHeight) {
    if (
      !Number.isFinite(screenX) ||
      !Number.isFinite(screenY) ||
      !Number.isFinite(factor) ||
      factor <= 0 ||
      !Number.isFinite(viewportWidth) ||
      !Number.isFinite(viewportHeight) ||
      viewportWidth <= 0 ||
      viewportHeight <= 0
    ) {
      return false;
    }

    const nextZoom = this.clampZoom(this.zoom * factor);
    if (nextZoom === this.zoom) return false;

    const zoomRatio = nextZoom / this.zoom;
    const centerX = viewportWidth / 2;
    const centerY = viewportHeight / 2;

    // Keep the world point beneath the cursor fixed while zooming.
    this.x = screenX - centerX - (screenX - centerX - this.x) * zoomRatio;
    this.y = screenY - centerY - (screenY - centerY - this.y) * zoomRatio;
    this.zoom = nextZoom;
    return true;
  }
}