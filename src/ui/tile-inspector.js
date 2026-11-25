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

    this.elevationValue = this.requireElement('[data-input="elevation"]');
    this.elevationDecrease = this.requireElement("[data-elevation-decrease]");
    this.elevationIncrease = this.requireElement("[data-elevation-increase]");

    this.terrainInput = this.requireElement('[data-input="terrain"]');
    this.walkableInput = this.requireElement('[data-input="walkable"]');
    this.identityToggle = this.requireElement(
  '[data-inspector-toggle="identity"]'
);

this.identityBody = this.requireElement(
  '[data-inspector-body="identity"]'
);

this.propertiesToggle = this.requireElement(
  '[data-inspector-toggle="properties"]'
);

this.propertiesBody = this.requireElement(
  '[data-inspector-body="properties"]'
);

    this.onElevationDecrease = () => {
      this.adjustElevation(-1);
    };

    this.onElevationIncrease = () => {
      this.adjustElevation(1);
    };

    this.onTerrainChange = () => {
      this.updateTileProperty("terrain", this.terrainInput.value.trim());
    };

    this.onWalkableChange = () => {
      this.updateTileProperty("walkable", this.walkableInput.checked);
    };

    this.elevationDecrease.addEventListener("click", this.onElevationDecrease);
    this.elevationIncrease.addEventListener("click", this.onElevationIncrease);
    this.terrainInput.addEventListener("change", this.onTerrainChange);
    this.walkableInput.addEventListener("change", this.onWalkableChange);
this.onIdentityToggle = () => {
  this.toggleSection(this.identityToggle, this.identityBody);
};

this.onPropertiesToggle = () => {
  this.toggleSection(this.propertiesToggle, this.propertiesBody);
};

this.identityToggle.addEventListener(
  "click",
  this.onIdentityToggle
);

this.propertiesToggle.addEventListener(
  "click",
  this.onPropertiesToggle
);
    this.setTile(null);
  }

  requireElement(selector) {
    
    const element = this.root.querySelector(selector);

    if (!element) {
      throw new Error(`Elemen Tile Inspector tidak ditemukan: ${selector}`);
    }

    return element;
  }
  toggleSection(toggle, body) {
    if (this.destroyed) return;

    const expanded = toggle.getAttribute("aria-expanded") === "true";

    toggle.setAttribute("aria-expanded", String(!expanded));
    body.hidden = expanded;
  }
  /** Updates the panel to show a persistent tile reference, or its empty state. */
  setTile(tile) {
    if (this.destroyed) return;

    this.currentTile = tile ?? null;

    const hasTile = this.currentTile !== null;

    this.status.textContent = hasTile
      ? "TILE SELECTED"
      : "NO TILE SELECTED";

    this.emptyState.hidden = hasTile;
    this.content.hidden = !hasTile;

    this.elevationDecrease.disabled = !hasTile;
    this.elevationIncrease.disabled = !hasTile;
    this.terrainInput.disabled = !hasTile;
    this.walkableInput.disabled = !hasTile;

    if (!hasTile) {
      this.idValue.textContent = "—";
      this.coordinatesValue.textContent = "—";
      this.elevationValue.textContent = "0";
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
    this.elevationValue.textContent = String(tile.elevation);
    this.terrainInput.value = tile.terrain;
    this.walkableInput.checked = tile.walkable;
  }

  /** Changes elevation by one unit per button press. */
  adjustElevation(step) {
    if (!this.currentTile || this.destroyed) return false;

    const nextElevation = this.currentTile.elevation + step;

    return this.updateTileProperty("elevation", nextElevation);
  }

  updateTileProperty(property, value) {
    if (!this.currentTile || this.destroyed) return false;

    const tile = this.currentTile;

    try {
      tile[property] = value;
    } catch {
      this.syncValues();
      return false;
    }

    this.syncValues();
    this.onTileChange(tile, property);

    return true;
  }

  destroy() {
    if (this.destroyed) return;

    this.elevationDecrease.removeEventListener("click", this.onElevationDecrease);
    this.elevationIncrease.removeEventListener("click", this.onElevationIncrease);
    this.terrainInput.removeEventListener("change", this.onTerrainChange);
    this.walkableInput.removeEventListener("change", this.onWalkableChange);

    this.currentTile = null;
    this.destroyed = true;
    this.identityToggle.removeEventListener(
  "click",
  this.onIdentityToggle
);

this.propertiesToggle.removeEventListener(
  "click",
  this.onPropertiesToggle
);
  }
}