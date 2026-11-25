import { updateTilesProperty } from "../world/tile-properties.js";

/**
 * DOM view for inspecting and editing the currently selected tile.
 * It does not own tile data; edits are applied to the persistent Tile instance.
 */
export class TileInspector {
  constructor(root, { onTileChange = () => {} } = {}) {
    if (!root || typeof root.querySelector !== "function") {
      throw new TypeError(
        "TileInspector membutuhkan elemen root yang valid."
      );
    }

    if (typeof onTileChange !== "function") {
      throw new TypeError(
        "onTileChange harus berupa function."
      );
    }

    this.root = root;
    this.onTileChange = onTileChange;
    this.currentTile = null;
    this.currentTiles = [];
    this.destroyed = false;

    this.document =
      typeof document !== "undefined" ? document : null;

    // --------------------------------------------------
    // DOM ELEMENTS
    // --------------------------------------------------

    this.status = this.requireElement(
      "[data-inspector-status]"
    );

    this.emptyState = this.requireElement(
      "[data-inspector-empty]"
    );

    this.content = this.requireElement(
      "[data-inspector-content]"
    );

    this.idValue = this.requireElement(
      '[data-value="id"]'
    );

    this.coordinatesValue = this.requireElement(
      '[data-value="coordinates"]'
    );

    this.identitySection = this.requireElement(
      "[data-inspector-identity]"
    );

    this.elevationValue = this.requireElement(
      '[data-input="elevation"]'
    );

    this.elevationDecrease = this.requireElement(
      "[data-elevation-decrease]"
    );

    this.elevationIncrease = this.requireElement(
      "[data-elevation-increase]"
    );

    this.terrainSelect = this.requireElement(
      "[data-terrain-select]"
    );

    this.terrainTrigger = this.requireElement(
      "[data-terrain-trigger]"
    );

    this.terrainValue = this.requireElement(
      "[data-terrain-value]"
    );

    this.terrainMenu = this.requireElement(
      "[data-terrain-menu]"
    );

    this.terrainOptions = Array.from(
      this.terrainMenu.querySelectorAll(
        "[data-terrain-option]"
      )
    );

    if (this.terrainOptions.length === 0) {
      throw new Error(
        "Terrain dropdown membutuhkan minimal satu pilihan."
      );
    }

    this.walkableInput = this.requireElement(
      '[data-input="walkable"]'
    );

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

    // --------------------------------------------------
    // EVENT HANDLERS
    // --------------------------------------------------

    this.onElevationDecrease = () => {
      this.adjustElevation(-1);
    };

    this.onElevationIncrease = () => {
      this.adjustElevation(1);
    };

    this.onWalkableChange = () => {
      this.updateTileProperty(
        "walkable",
        this.walkableInput.indeterminate ? true : this.walkableInput.checked
      );
    };

    this.onTerrainTriggerClick = () => {
      if (!this.currentTiles.length || this.destroyed) {
        return;
      }

      const isOpen =
        this.terrainSelect.classList.contains("open");

      this.setTerrainMenuOpen(!isOpen);
    };

    this.onIdentityToggle = () => {
      this.toggleSection(
        this.identityToggle,
        this.identityBody
      );
    };

    this.onPropertiesToggle = () => {
      this.toggleSection(
        this.propertiesToggle,
        this.propertiesBody
      );
    };

    this.onDocumentClick = (event) => {
      if (!this.terrainSelect.contains(event.target)) {
        this.closeTerrainMenu();
      }
    };

    this.onDocumentKeydown = (event) => {
      if (event.key === "Escape") {
        this.closeTerrainMenu();
      }
    };

    // --------------------------------------------------
    // TERRAIN OPTION HANDLERS
    // --------------------------------------------------

    this.terrainOptionHandlers = new Map();

    for (const option of this.terrainOptions) {
      const handler = () => {
        if (!this.currentTiles.length || this.destroyed) {
          return;
        }

        this.updateTileProperty(
          "terrain",
          option.dataset.terrainOption
        );

        this.closeTerrainMenu();
      };

      option.addEventListener("click", handler);

      this.terrainOptionHandlers.set(
        option,
        handler
      );
    }

    // --------------------------------------------------
    // REGISTER EVENT LISTENERS
    // --------------------------------------------------

    this.elevationDecrease.addEventListener(
      "click",
      this.onElevationDecrease
    );

    this.elevationIncrease.addEventListener(
      "click",
      this.onElevationIncrease
    );

    this.terrainTrigger.addEventListener(
      "click",
      this.onTerrainTriggerClick
    );

    this.walkableInput.addEventListener(
      "change",
      this.onWalkableChange
    );

    this.identityToggle.addEventListener(
      "click",
      this.onIdentityToggle
    );

    this.propertiesToggle.addEventListener(
      "click",
      this.onPropertiesToggle
    );

    this.document?.addEventListener(
      "click",
      this.onDocumentClick
    );

    this.document?.addEventListener(
      "keydown",
      this.onDocumentKeydown
    );

    // Initialize inspector without a selected tile.
    this.setTile(null);
  }

  // --------------------------------------------------
  // DOM VALIDATION
  // --------------------------------------------------

  requireElement(selector) {
    const element = this.root.querySelector(selector);

    if (!element) {
      throw new Error(
        `Elemen Tile Inspector tidak ditemukan: ${selector}`
      );
    }

    return element;
  }

  // --------------------------------------------------
  // FOLDABLE SECTIONS
  // --------------------------------------------------

  toggleSection(toggle, body) {
    if (this.destroyed) {
      return;
    }

    const expanded =
      toggle.getAttribute("aria-expanded") === "true";

    toggle.setAttribute(
      "aria-expanded",
      String(!expanded)
    );

    body.hidden = expanded;
  }

  // --------------------------------------------------
  // TERRAIN DROPDOWN
  // --------------------------------------------------

  setTerrainMenuOpen(open) {
    const shouldOpen = Boolean(
      open &&
      this.currentTiles.length > 0 &&
      !this.destroyed
    );

    this.terrainSelect.classList.toggle(
      "open",
      shouldOpen
    );

    this.terrainMenu.hidden = !shouldOpen;

    this.terrainTrigger.setAttribute(
      "aria-expanded",
      String(shouldOpen)
    );
  }

  closeTerrainMenu() {
    this.setTerrainMenuOpen(false);
  }

  syncTerrainValue(value) {
    const terrain = String(value ?? "—");

    this.terrainSelect.dataset.value = terrain;
    this.terrainValue.textContent = terrain;

    for (const option of this.terrainOptions) {
      const selected =
        option.dataset.terrainOption === terrain;

      option.setAttribute(
        "aria-checked",
        String(selected)
      );
    }
  }

  // --------------------------------------------------
  // TILE SELECTION
  // --------------------------------------------------

  /**
   * Updates the inspector to show a persistent tile reference.
   * Passing null resets the inspector to its empty state.
   */
  setTile(tile) {
    return this.setTiles(tile ? [tile] : []);
  }

  /** Updates the view from persistent tile references owned by TileSelection. */
  setTiles(tiles) {
    if (this.destroyed) {
      return false;
    }

    // Close dropdown whenever the selected tile changes.
    this.closeTerrainMenu();

    this.currentTiles = Array.from(tiles ?? []);
    this.currentTile = this.currentTiles.length === 1 ? this.currentTiles[0] : null;

    const count = this.currentTiles.length;
    const hasTiles = count > 0;
    const isMultiple = count > 1;

    this.status.textContent = isMultiple
      ? `MULTI TILE SELECTED (${count})`
      : hasTiles
        ? "TILE SELECTED"
        : "NO TILE SELECTED";

    this.emptyState.hidden = hasTiles;
    this.content.hidden = !hasTiles;
    this.identitySection.hidden = isMultiple;

    this.elevationDecrease.disabled = !hasTiles;
    this.elevationIncrease.disabled = !hasTiles;
    this.terrainTrigger.disabled = !hasTiles;
    this.walkableInput.disabled = !hasTiles;

    if (!hasTiles) {
      this.idValue.textContent = "—";
      this.coordinatesValue.textContent = "—";
      this.elevationValue.textContent = "0";

      this.syncTerrainValue("—");

      this.walkableInput.checked = false;
      this.walkableInput.indeterminate = false;

      return true;
    }

    this.syncValues();
    return true;
  }

  // --------------------------------------------------
  // VALUE SYNCHRONIZATION
  // --------------------------------------------------

  /**
   * Refreshes displayed values from the selected tile.
   * Also used after external tile mutations.
   */
  syncValues() {
    if (!this.currentTiles.length || this.destroyed) {
      return;
    }

    const values = (property) => this.currentTiles.map((tile) => tile[property]);
    const uniformValue = (property) => {
      const [first, ...rest] = values(property);
      return rest.every((value) => Object.is(value, first)) ? first : "Mixed";
    };

    if (this.currentTiles.length === 1) {
      const tile = this.currentTiles[0];
      this.idValue.textContent = tile.id;
      this.coordinatesValue.textContent = `X ${tile.x}  ·  Y ${tile.y}`;
    } else {
      this.idValue.textContent = "—";
      this.coordinatesValue.textContent = "—";
    }

    this.elevationValue.textContent = String(uniformValue("elevation"));
    this.syncTerrainValue(uniformValue("terrain"));
    const walkable = uniformValue("walkable");
    this.walkableInput.indeterminate = walkable === "Mixed";
    this.walkableInput.checked = walkable === true;
  }

  // --------------------------------------------------
  // ELEVATION
  // --------------------------------------------------

  /**
   * Changes elevation by the requested amount.
   * Normal button interactions use -1 and +1.
   */
  adjustElevation(step) {
    if (
      !this.currentTiles.length ||
      this.destroyed ||
      !Number.isFinite(step)
    ) {
      return false;
    }

    return this.updateTileProperty(
      "elevation",
      (elevation) => elevation + step
    );
  }

  // --------------------------------------------------
  // TILE PROPERTY UPDATES
  // --------------------------------------------------

  /**
   * Updates one supported gameplay property on the selected tile.
   * Invalid values are rejected by the Tile model.
   */
  updateTileProperty(property, value) {
    if (!this.currentTiles.length || this.destroyed) {
      return false;
    }

    const changedTiles = updateTilesProperty(this.currentTiles, property, value);
    if (!changedTiles.length) {
      this.syncValues();
      return false;
    }

    this.syncValues();
    for (const tile of changedTiles) this.onTileChange(tile, property);

    return true;
  }

  // --------------------------------------------------
  // CLEANUP
  // --------------------------------------------------

  destroy() {
    if (this.destroyed) {
      return;
    }

    // Remove elevation listeners.
    this.elevationDecrease.removeEventListener(
      "click",
      this.onElevationDecrease
    );

    this.elevationIncrease.removeEventListener(
      "click",
      this.onElevationIncrease
    );

    // Remove terrain listeners.
    this.terrainTrigger.removeEventListener(
      "click",
      this.onTerrainTriggerClick
    );

    for (const [option, handler] of this.terrainOptionHandlers) {
      option.removeEventListener(
        "click",
        handler
      );
    }

    // Remove walkable listener.
    this.walkableInput.removeEventListener(
      "change",
      this.onWalkableChange
    );

    // Remove foldable section listeners.
    this.identityToggle.removeEventListener(
      "click",
      this.onIdentityToggle
    );

    this.propertiesToggle.removeEventListener(
      "click",
      this.onPropertiesToggle
    );

    // Remove document listeners.
    this.document?.removeEventListener(
      "click",
      this.onDocumentClick
    );

    this.document?.removeEventListener(
      "keydown",
      this.onDocumentKeydown
    );

    this.closeTerrainMenu();

    this.currentTile = null;
    this.currentTiles = [];
    this.destroyed = true;
  }
}
