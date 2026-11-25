/** Owns persistent selected tile references, keyed by stable tile ID. */
export class TileSelection {
  constructor() {
    this.tilesById = new Map();
    this.focusedTile = null;
  }

  get selectedTile() { return this.focusedTile; }
  get selectedTiles() { return [...this.tilesById.values()]; }

  select(tile) {
    const next = tile ?? null;
    const changed = this.tilesById.size !== (next ? 1 : 0) ||
      (next && (this.tilesById.size !== 1 || !this.tilesById.has(next.id)));
    this.tilesById.clear();
    if (next) this.tilesById.set(next.id, next);
    this.focusedTile = next;
    return Boolean(changed);
  }

  add(tile) {
    if (!tile || this.tilesById.has(tile.id)) return false;
    this.tilesById.set(tile.id, tile);
    this.focusedTile = tile;
    return true;
  }

  remove(tileOrId) {
    const id = typeof tileOrId === "object" ? tileOrId?.id : tileOrId;
    if (!this.tilesById.delete(id)) return false;
    if (this.focusedTile?.id === id) {
      this.focusedTile = this.tilesById.values().next().value ?? null;
    }
    return true;
  }

  getSelectedTiles() { return this.selectedTiles; }

  clear() {
    if (!this.tilesById.size) return false;
    this.tilesById.clear();
    this.focusedTile = null;
    return true;
  }
}
