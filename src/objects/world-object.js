import { ObjectFootprint } from "./object-footprint.js";

function validateNonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${label} harus berupa string yang tidak kosong.`);
  }
}

function validateGridCoordinate(value, label) {
  if (!Number.isInteger(value) || value < 0) {
    throw new TypeError(`${label} harus berupa bilangan bulat non-negatif.`);
  }
}

function cloneJsonValue(value, path = "properties", ancestors = new WeakSet()) {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError(`${path} hanya boleh berisi angka finite.`);
    }
    return value;
  }

  if (typeof value !== "object") {
    throw new TypeError(`${path} hanya boleh berisi data JSON.`);
  }

  if (ancestors.has(value)) {
    throw new TypeError(`${path} tidak boleh memiliki referensi melingkar.`);
  }

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return value.map((item, index) => {
        return cloneJsonValue(item, `${path}[${index}]`, ancestors);
      });
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError(`${path} hanya boleh berisi object biasa.`);
    }

    const clone = {};
    for (const [key, item] of Object.entries(value)) {
      Object.defineProperty(clone, key, {
        value: cloneJsonValue(item, `${path}.${key}`, ancestors),
        enumerable: true,
        configurable: true,
        writable: true
      });
    }
    return clone;
  } finally {
    ancestors.delete(value);
  }
}

function cloneProperties(value) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new TypeError("Properties objek harus berupa object biasa.");
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError("Properties objek harus berupa object biasa.");
  }

  return cloneJsonValue(value);
}

/**
 * Data model for an independent object anchored to a grid coordinate.
 * Object identity and type are immutable. Display metadata, asset reference,
 * grid anchor, and serializable custom properties are independent of Tile data.
 * Footprint defines rectangular grid coverage. Final elevation is resolved
 * from the anchor tile plus the object's relative elevationOffset.
 */
export class WorldObject {
  #name;
  #assetId;
  #x;
  #y;
  #properties;
  #footprint;
  #elevationOffset;

  constructor({
    id,
    type,
    name = type,
    assetId = null,
    x,
    y,
    footprint = { width: 1, height: 1 },
    elevationOffset = 0,
    properties = {}
  }) {
    validateNonEmptyString(id, "ID objek");
    validateNonEmptyString(type, "Tipe objek");
    validateGridCoordinate(x, "Koordinat X objek");
    validateGridCoordinate(y, "Koordinat Y objek");

    Object.defineProperties(this, {
      id: { value: id, enumerable: true },
      type: { value: type, enumerable: true },
      name: {
        enumerable: true,
        get: () => this.#name,
        set: (value) => {
          validateNonEmptyString(value, "Nama objek");
          this.#name = value;
        }
      },
      assetId: {
        enumerable: true,
        get: () => this.#assetId,
        set: (value) => {
          if (value !== null) validateNonEmptyString(value, "Asset ID objek");
          this.#assetId = value;
        }
      },
      x: {
        enumerable: true,
        get: () => this.#x,
        set: (value) => {
          validateGridCoordinate(value, "Koordinat X objek");
          this.#x = value;
        }
      },
      y: {
        enumerable: true,
        get: () => this.#y,
        set: (value) => {
          validateGridCoordinate(value, "Koordinat Y objek");
          this.#y = value;
        }
      },
      footprint: {
        enumerable: true,
        get: () => this.#footprint,
        set: (value) => {
          const dimensions = value instanceof ObjectFootprint
            ? value.toJSON()
            : value;
          this.#footprint = new ObjectFootprint(dimensions);
        }
      },
      elevationOffset: {
        enumerable: true,
        get: () => this.#elevationOffset,
        set: (value) => {
          if (!Number.isFinite(value)) {
            throw new TypeError("Elevation offset objek harus berupa angka finite.");
          }
          this.#elevationOffset = value;
        }
      },
      properties: {
        enumerable: true,
        get: () => cloneProperties(this.#properties),
        set: (value) => {
          this.#properties = cloneProperties(value);
        }
      }
    });

    this.name = name;
    this.assetId = assetId;
    this.x = x;
    this.y = y;
    this.footprint = footprint;
    this.elevationOffset = elevationOffset;
    this.properties = properties;
  }

  /** Returns a detached snapshot suitable for JSON serialization. */
  toJSON() {
    return {
      id: this.id,
      type: this.type,
      name: this.name,
      assetId: this.assetId,
      x: this.x,
      y: this.y,
      footprint: this.footprint.toJSON(),
      elevationOffset: this.elevationOffset,
      properties: this.properties
    };
  }
}
