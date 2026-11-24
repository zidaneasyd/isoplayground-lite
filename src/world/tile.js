const DEFAULT_TERRAIN = "ground";

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Stores the persistent data associated with one world-grid cell. */
export class Tile {
  constructor({
    x,
    y,
    terrain = DEFAULT_TERRAIN,
    elevation = 0,
    walkable = true,
    data = {}
  }) {
    if (!Number.isInteger(x) || !Number.isInteger(y)) {
      throw new TypeError("Koordinat tile harus berupa bilangan bulat.");
    }
    if (typeof terrain !== "string" || terrain.trim() === "") {
      throw new TypeError("Terrain tile harus berupa string yang tidak kosong.");
    }
    if (!Number.isFinite(elevation)) {
      throw new TypeError("Elevation tile harus berupa angka yang valid.");
    }
    if (typeof walkable !== "boolean") {
      throw new TypeError("Walkable tile harus berupa boolean.");
    }
    if (!isPlainObject(data)) {
      throw new TypeError("Data tambahan tile harus berupa object.");
    }

    Object.defineProperty(this, "x", { value: x, enumerable: true });
    Object.defineProperty(this, "y", { value: y, enumerable: true });
    this.terrain = terrain;
    this.elevation = elevation;
    this.walkable = walkable;
    this.data = { ...data };
  }

  /** Update mutable tile properties while keeping its grid coordinates fixed. */
  update(patch = {}) {
    if (!isPlainObject(patch)) {
      throw new TypeError("Perubahan tile harus berupa object.");
    }

    // Validate the whole patch first so a rejected update cannot partially
    // mutate the existing tile data.
    if (
      Object.hasOwn(patch, "terrain") &&
      (typeof patch.terrain !== "string" || patch.terrain.trim() === "")
    ) {
      throw new TypeError("Terrain tile harus berupa string yang tidak kosong.");
    }
    if (Object.hasOwn(patch, "elevation") && !Number.isFinite(patch.elevation)) {
      throw new TypeError("Elevation tile harus berupa angka yang valid.");
    }
    if (Object.hasOwn(patch, "walkable") && typeof patch.walkable !== "boolean") {
      throw new TypeError("Walkable tile harus berupa boolean.");
    }
    if (Object.hasOwn(patch, "data") && !isPlainObject(patch.data)) {
      throw new TypeError("Data tambahan tile harus berupa object.");
    }

    if (Object.hasOwn(patch, "terrain")) this.terrain = patch.terrain;
    if (Object.hasOwn(patch, "elevation")) this.elevation = patch.elevation;
    if (Object.hasOwn(patch, "walkable")) this.walkable = patch.walkable;
    if (Object.hasOwn(patch, "data")) {
      this.data = { ...this.data, ...patch.data };
    }

    return this;
  }
}
