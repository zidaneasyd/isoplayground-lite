import { screenToGrid } from "../world/coordinates.js";

/**
 * Finds the topmost tile under a canvas-space pointer position.
 *
 * Tiles are checked in reverse render order so overlapping diamonds select the
 * same tile that is visually on top. Each tile's own elevation is used when
 * converting the pointer position back to grid coordinates.
 */
export function findTileAtScreenPoint(screenX, screenY, view) {
  if (
    !Number.isFinite(screenX) || !Number.isFinite(screenY) ||
    !view?.world || typeof view.world.getTiles !== "function"
  ) return null;

  const tiles = [...view.world.getTiles()];
  for (let index = tiles.length - 1; index >= 0; index -= 1) {
    const tile = tiles[index];
    if (!Number.isFinite(tile?.elevation)) continue;

    const grid = screenToGrid(screenX, screenY, {
      ...view,
      elevation: tile.elevation
    });
    if (!grid) return null;

    const tileX = Math.floor(grid.x + 0.5);
    const tileY = Math.floor(grid.y + 0.5);
    if (tileX === tile.x && tileY === tile.y) return tile;
  }

  return null;
}

/** Owns the current hover reference without modifying the underlying tile. */
export class TileHover {
  constructor() {
    this.hoveredTile = null;
  }

  update(screenX, screenY, view) {
    const nextTile = findTileAtScreenPoint(screenX, screenY, view);
    if (nextTile === this.hoveredTile) return false;

    this.hoveredTile = nextTile;
    return true;
  }

  clear() {
    if (this.hoveredTile === null) return false;
    this.hoveredTile = null;
    return true;
  }
}
