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

  panBy(deltaX, deltaY) {
    if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) return false;
    if (deltaX === 0 && deltaY === 0) return false;

    this.x += deltaX;
    this.y += deltaY;
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
