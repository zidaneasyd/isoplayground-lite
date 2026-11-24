export function gridToScreen(x, y, tileWidth, tileHeight) {
  return {
    x: (x - y) * tileWidth / 2,
    y: (x + y) * tileHeight / 2
  };
}

/**
 * Convert a viewport-local screen position into the integer coordinates of
 * the isometric tile containing that point.
 *
 * `offset` is the same screen-space translation passed to CanvasRenderingContext2D
 * before scaling (the renderer's translate offset). When it is omitted, the
 * translation is derived from the viewport, camera, and world centre.
 *
 * `world` may be supplied as { width, height }, or the centre may be supplied
 * directly as { worldCenterX, worldCenterY }. `camera` may be supplied as
 * { x, y, zoom }, or as the individual cameraX/cameraY/zoom options.
 */
export function screenToGrid(screenX, screenY, tileWidth, tileHeight, options = {}) {
  if (
    !Number.isFinite(screenX) ||
    !Number.isFinite(screenY) ||
    !Number.isFinite(tileWidth) || tileWidth <= 0 ||
    !Number.isFinite(tileHeight) || tileHeight <= 0 ||
    !options || typeof options !== "object"
  ) {
    return null;
  }

  const viewportWidth = options.viewportWidth ?? options.viewport?.width ?? 0;
  const viewportHeight = options.viewportHeight ?? options.viewport?.height ?? 0;
  const cameraX = options.cameraX ?? options.camera?.x ?? 0;
  const cameraY = options.cameraY ?? options.camera?.y ?? 0;
  const zoom = options.zoom ?? options.camera?.zoom ?? 1;
  const worldWidth = options.worldWidth ?? options.world?.width ?? 0;
  const worldHeight = options.worldHeight ?? options.world?.height ?? 0;
  const worldCenterX = options.worldCenterX ??
    (worldWidth - worldHeight) * tileWidth / 4;
  const worldCenterY = options.worldCenterY ??
    (worldWidth + worldHeight) * tileHeight / 4;
  const offsetX = options.offset?.x ?? options.offsetX ??
    (viewportWidth / 2 + cameraX - worldCenterX * zoom);
  const offsetY = options.offset?.y ?? options.offsetY ??
    (viewportHeight / 2 + cameraY - worldCenterY * zoom);
  const elevation = options.elevation ?? 0;
  const elevationStep = options.elevationStep ?? options.tile?.elevationStep ?? 0;

  if (
    !Number.isFinite(viewportWidth) ||
    !Number.isFinite(viewportHeight) ||
    !Number.isFinite(cameraX) ||
    !Number.isFinite(cameraY) ||
    !Number.isFinite(zoom) || zoom <= 0 ||
    !Number.isFinite(worldWidth) ||
    !Number.isFinite(worldHeight) ||
    !Number.isFinite(worldCenterX) ||
    !Number.isFinite(worldCenterY) ||
    !Number.isFinite(offsetX) ||
    !Number.isFinite(offsetY) ||
    !Number.isFinite(elevation) ||
    !Number.isFinite(elevationStep)
  ) {
    return null;
  }

  // Reverse the renderer's translate + scale transform. Elevation is added
  // back because elevated tiles are drawn above their ground-plane position.
  const projectedX = (screenX - offsetX) / zoom;
  const projectedY = (screenY - offsetY) / zoom + elevation * elevationStep;

  // Invert gridToScreen:
  // projectedX = (gridX - gridY) * tileWidth / 2
  // projectedY = (gridX + gridY) * tileHeight / 2
  // The grid coordinates identify the unit cell containing the pointer.
  const gridX = projectedX / tileWidth + projectedY / tileHeight;
  const gridY = projectedY / tileHeight - projectedX / tileWidth;

  if (!Number.isFinite(gridX) || !Number.isFinite(gridY)) return null;

  return {
    x: Math.floor(gridX),
    y: Math.floor(gridY)
  };
}
