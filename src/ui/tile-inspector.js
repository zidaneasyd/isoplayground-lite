/**
 * DOM view for inspecting and editing the currently selected tile.
 * It does not own tile data; edits are applied to the persistent Tile instance.
 */
export class TileInspector {
  constructor(root, { onTileChange = () => {} } = {}) {
    if (!root || typeof root.querySelector !== "function") {
      throw new TypeError("TileInspector membutuhkan elemen root yang valid.");
    }
    if (typeof onTileChange !== "function") {
      throw new TypeError("onTileChange harus berupa function.");
    }

    this.root = root;
    this.onTileChange = onTileChange;
    this.currentTile = null;
    this.destroyed = false;

    this.status = this.requireElement("[data-inspector-status]");
    this.emptyState = this.requireElement("[data-inspector-empty]");
    this.content = this.requireElement("[data-inspector-content]");
    this.idValue = this.requireElement('[data-value="id"]');
    this.coordinatesValue = this.requireElement('[data-value="coordinates"]');
    this.elevationInput = this.requireElement('[data-input="elevation"]');
    this.terrainInput = this.requireElement('[data-input="terrain"]');
    this.walkableInput = this.requireElement('[data-input="walkable"]');

    this.onElevationChange = () => {
      const raw = this.elevationInput.value;
      const value = raw.trim() === "" ? NaN : Number(raw);
      this.updateTileProperty("elevation", value);
    };
    this.onTerrainChange = () => {
      this.updateTileProperty("terrain", this.terrainInput.value.trim());
    };
    this.onWalkableChange = () => {
      this.updateTileProperty("walkable", this.walkableInput.checked);
    };

    this.elevationInput.addEventListener("change", this.onElevationChange);
    this.terrainInput.addEventListener("change", this.onTerrainChange);
    this.walkableInput.addEventListener("change", this.onWalkableChange);
    this.setTile(null);
  }

  requireElement(selector) {
    const element = this.root.querySelector(selector);
    if (!element) {
      throw new Error(`Elemen Tile Inspector tidak ditemukan: ${selector}`);
    }
    return element;
  }

  /** Updates the panel to show a persistent tile reference, or its empty state. */
  setTile(tile) {
    if (this.destroyed) return;
    this.currentTile = tile ?? null;

    const hasTile = this.currentTile !== null;
    this.status.textContent = hasTile ? "TILE SELECTED" : "NO TILE SELECTED";
    this.emptyState.hidden = hasTile;
    this.content.hidden = !hasTile;

    for (const input of [this.elevationInput, this.terrainInput, this.walkableInput]) {
      input.disabled = !hasTile;
    }

    if (!hasTile) {
      this.idValue.textContent = "—";
      this.coordinatesValue.textContent = "—";
      this.elevationInput.value = "";
      this.terrainInput.value = "";
      this.walkableInput.checked = false;
      return;
    }

    this.syncValues();
  }

  /** Refreshes displayed properties after a model edit or external mutation. */
  syncValues() {
    if (!this.currentTile || this.destroyed) return;

    const tile = this.currentTile;
    this.idValue.textContent = tile.id;
    this.coordinatesValue.textContent = `X ${tile.x}  ·  Y ${tile.y}`;
    this.elevationInput.value = String(tile.elevation);
    this.terrainInput.value = tile.terrain;
    this.walkableInput.checked = tile.walkable;
  }

  updateTileProperty(property, value) {
    if (!this.currentTile || this.destroyed) return false;

    const tile = this.currentTile;
    try {
      tile[property] = value;
    } catch {
      // Restore the last valid model value when a control contains invalid data.
      this.syncValues();
      return false;
    }

    this.syncValues();
    this.onTileChange(tile, property);
    return true;
  }

  destroy() {
    if (this.destroyed) return;
    this.elevationInput.removeEventListener("change", this.onElevationChange);
    this.terrainInput.removeEventListener("change", this.onTerrainChange);
    this.walkableInput.removeEventListener("change", this.onWalkableChange);
    this.currentTile = null;
    this.destroyed = true;
  }
}
