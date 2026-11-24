import { Grid } from "./grid.js";
import { DEFAULT_TERRAIN, Tile } from "./tile.js";

function coordinateKey(x, y) {
  return `${x},${y}`;
}

/**
 * Owns the world's tile instances and provides indexed access to their data.
 * Grid remains responsible only for coordinate structure and render order.
 */
export class World {
  #tilesByCoordinates = new Map();
  #tilesById = new Map();

  constructor({
    width,
    height,
    baseElevation = 0,
    defaultTerrain = DEFAULT_TERRAIN,
    defaultWalkable = true
  }) {
    this.width = width;
    this.height = height;
    this.baseElevation = baseElevation;
    this.grid = new Grid(width, height);

    for (const { x, y } of this.grid.tiles()) {
      const tile = new Tile({
        id: `tile-${x}-${y}`,
        x,
        y,
        elevation: this.baseElevation,
        terrain: defaultTerrain,
        walkable: defaultWalkable
      });

      this.#tilesByCoordinates.set(coordinateKey(x, y), tile);
      this.#tilesById.set(tile.id, tile);
    }
  }

  /** Returns the tile at integer grid coordinates, or null when out of bounds. */
  getTile(x, y) {
    if (!Number.isInteger(x) || !Number.isInteger(y)) return null;
    return this.#tilesByCoordinates.get(coordinateKey(x, y)) ?? null;
  }

  /** Returns the tile with the supplied ID, or null when it does not exist. */
  getTileById(id) {
    if (typeof id !== "string") return null;
    return this.#tilesById.get(id) ?? null;
  }

  /**
   * Yields the world's persistent tile objects in the existing diagonal order.
   * Callers receive the same references used by coordinate and ID lookups.
   */
  *getTiles() {
    for (const { x, y } of this.grid.tiles()) {
      yield this.getTile(x, y);
    }
  }
}
