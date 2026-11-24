import { Grid } from "./grid.js";
import { Tile } from "./tile.js";

export class World {
  constructor({
    width,
    height,
    baseElevation = 0,
    defaultTerrain = "ground",
    defaultWalkable = true
  }) {
    this.width = width;
    this.height = height;
    this.baseElevation = baseElevation;
    this.grid = new Grid(width, height);
    this.tiles = new Map();

    for (const { x, y } of this.grid.tiles()) {
      const tile = new Tile({
        x,
        y,
        terrain: defaultTerrain,
        elevation: baseElevation,
        walkable: defaultWalkable
      });
      this.tiles.set(this.getTileKey(x, y), tile);
    }
  }

  getTileKey(x, y) {
    return `${x},${y}`;
  }

  /** Return the persistent tile at x/y, or null when the cell is out of bounds. */
  getTile(x, y) {
    if (
      !Number.isInteger(x) ||
      !Number.isInteger(y) ||
      x < 0 || y < 0 || x >= this.width || y >= this.height
    ) {
      return null;
    }

    return this.tiles.get(this.getTileKey(x, y)) ?? null;
  }

  /** Update a tile in place, preserving object identity and grid coordinates. */
  setTile(x, y, updates) {
    const tile = this.getTile(x, y);
    if (!tile) return null;
    return tile.update(updates);
  }

  *getTiles() {
    for (const { x, y } of this.grid.tiles()) {
      yield this.getTile(x, y);
    }
  }
}
