/** Owns the currently selected persistent tile reference. */
export class TileSelection {
  constructor() {
    this.selectedTile = null;
  }

  select(tile) {
    const nextTile = tile ?? null;
    if (nextTile === this.selectedTile) return false;
    this.selectedTile = nextTile;
    return true;
  }

  clear() {
    return this.select(null);
  }
}
