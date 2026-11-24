/** Neutral terrain value used until a world assigns a concrete terrain type. */
export const DEFAULT_TERRAIN = "default";

/**
 * Data model for one cell in an isometric world.
 * Identity and grid coordinates are immutable; gameplay properties are mutable.
 */
export class Tile {
  #elevation;
  #terrain;
  #walkable;

  constructor({
    id,
    x,
    y,
    elevation = 0,
    terrain = DEFAULT_TERRAIN,
    walkable = true
  }) {
    if (typeof id !== "string" || id.trim() === "") {
      throw new TypeError("Tile membutuhkan ID berupa string yang tidak kosong.");
    }
    if (!Number.isInteger(x) || x < 0 || !Number.isInteger(y) || y < 0) {
      throw new TypeError("Koordinat tile harus berupa bilangan bulat non-negatif.");
    }

    Object.defineProperties(this, {
      id: { value: id, enumerable: true },
      x: { value: x, enumerable: true },
      y: { value: y, enumerable: true },
      elevation: {
        enumerable: true,
        get: () => this.#elevation,
        set: (value) => {
          if (!Number.isFinite(value)) {
            throw new TypeError("Elevation tile harus berupa angka finite.");
          }
          this.#elevation = value;
        }
      },
      terrain: {
        enumerable: true,
        get: () => this.#terrain,
        set: (value) => {
          if (typeof value !== "string" || value.trim() === "") {
            throw new TypeError("Terrain tile harus berupa string yang tidak kosong.");
          }
          this.#terrain = value;
        }
      },
      walkable: {
        enumerable: true,
        get: () => this.#walkable,
        set: (value) => {
          if (typeof value !== "boolean") {
            throw new TypeError("Properti walkable tile harus berupa boolean.");
          }
          this.#walkable = value;
        }
      }
    });

    this.elevation = elevation;
    this.terrain = terrain;
    this.walkable = walkable;
  }
}
