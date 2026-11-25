import { gridToScreen } from "../world/coordinates.js";

function isGridCoordinate(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

/**
 * Resolves an object's vertical level from its anchor tile plus its own offset.
 * The result is calculated on demand so tile elevation edits are reflected
 * immediately and object data never duplicates the tile's elevation value.
 * An optional anchor is useful while previewing a move before it is committed.
 */
export function resolveObjectElevation(world, object, anchor = null) {
  if (!world || typeof world.getTile !== "function" || !object || typeof object !== "object") {
    return null;
  }

  const x = anchor?.x ?? object.x;
  const y = anchor?.y ?? object.y;
  const elevationOffset = object.elevationOffset ?? 0;

  if (!isGridCoordinate(x) || !isGridCoordinate(y) || !Number.isFinite(elevationOffset)) {
    return null;
  }

  const anchorTile = world.getTile(x, y);
  if (!anchorTile || !Number.isFinite(anchorTile.elevation)) return null;
  const effectiveElevation = anchorTile.elevation + elevationOffset;
  if (!Number.isFinite(effectiveElevation)) return null;

  return {
    anchorX: x,
    anchorY: y,
    anchorElevation: anchorTile.elevation,
    elevationOffset,
    elevation: effectiveElevation
  };
}

/**
 * Resolves the object's ground-anchor point in isometric world coordinates.
 * Renderer camera translation and zoom are applied later by the shared Canvas
 * transform, keeping this position independent from the current viewport.
 */
export function getObjectWorldPosition(world, object, tileConfig, anchor = null) {
  const elevation = resolveObjectElevation(world, object, anchor);
  if (!elevation || !tileConfig || typeof tileConfig !== "object") return null;

  const { width, height, elevationStep } = tileConfig;
  if (
    !Number.isFinite(width) || width <= 0 ||
    !Number.isFinite(height) || height <= 0 ||
    !Number.isFinite(elevationStep) || elevationStep < 0
  ) return null;

  const point = gridToScreen(elevation.anchorX, elevation.anchorY, width, height);
  const y = point.y + height / 2 - elevation.elevation * elevationStep;
  if (!Number.isFinite(point.x) || !Number.isFinite(y)) return null;

  return { x: point.x, y, ...elevation };
}
