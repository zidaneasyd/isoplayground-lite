function validateId(value) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError("Asset ID harus berupa string yang tidak kosong.");
  }
}

function validateSource(value) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError("Sumber gambar harus berupa string yang tidak kosong.");
  }
}

function validateOptionalDimension(value, label) {
  if (value !== null && value !== undefined && (!Number.isFinite(value) || value <= 0)) {
    throw new TypeError(`${label} harus berupa angka finite positif atau null.`);
  }
}

function validateAnchor(value, label) {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new TypeError(`${label} harus berada di antara 0 dan 1.`);
  }
}

function normalizeOptions(options = {}) {
  if (options === null || typeof options !== "object" || Array.isArray(options)) {
    throw new TypeError("Opsi asset harus berupa object.");
  }

  const width = options.width ?? null;
  const height = options.height ?? null;
  const anchorX = options.anchorX ?? 0.5;
  const anchorY = options.anchorY ?? 1;
  const imageSmoothingEnabled = options.imageSmoothingEnabled ?? null;

  validateOptionalDimension(width, "Lebar sprite");
  validateOptionalDimension(height, "Tinggi sprite");
  validateAnchor(anchorX, "Anchor X sprite");
  validateAnchor(anchorY, "Anchor Y sprite");
  if (imageSmoothingEnabled !== null && typeof imageSmoothingEnabled !== "boolean") {
    throw new TypeError("imageSmoothingEnabled harus berupa boolean atau null.");
  }

  return { width, height, anchorX, anchorY, imageSmoothingEnabled };
}

function getNaturalDimension(image, primary, fallback) {
  const value = image?.[primary] || image?.[fallback];
  return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Loads and owns image assets independently from WorldObject instances.
 * A WorldObject stores only an assetId; this manager owns the actual Image.
 */
export class AssetManager {
  #assets = new Map();

  constructor({ ImageClass = globalThis.Image } = {}) {
    if (ImageClass !== null && ImageClass !== undefined && typeof ImageClass !== "function") {
      throw new TypeError("ImageClass harus berupa constructor atau null.");
    }
    this.ImageClass = ImageClass ?? null;
  }

  /** Loads one image and resolves with its Image instance after successful decoding. */
  load(id, source, options = {}) {
    validateId(id);
    validateSource(source);
    const normalized = normalizeOptions(options);

    const existing = this.#assets.get(id);
    if (existing) {
      if (existing.source !== source) {
        throw new Error(`Asset ID "${id}" sudah digunakan oleh sumber gambar lain.`);
      }
      const optionsChanged = Object.keys(normalized).some((key) => {
        return existing.options[key] !== normalized[key];
      });
      if (optionsChanged) {
        throw new Error(`Asset ID "${id}" sudah terdaftar dengan opsi tampilan berbeda.`);
      }
      return existing.promise;
    }

    if (!this.ImageClass) {
      return Promise.reject(new Error("Image API tidak tersedia pada lingkungan ini."));
    }

    const image = new this.ImageClass();
    const record = {
      id,
      source,
      options: normalized,
      image,
      status: "loading",
      error: null,
      width: null,
      height: null,
      anchorX: normalized.anchorX,
      anchorY: normalized.anchorY,
      imageSmoothingEnabled: normalized.imageSmoothingEnabled,
      promise: null
    };

    record.promise = new Promise((resolve, reject) => {
      image.onload = () => {
        image.onload = null;
        image.onerror = null;
        const naturalWidth = getNaturalDimension(image, "naturalWidth", "width");
        const naturalHeight = getNaturalDimension(image, "naturalHeight", "height");
        if (!naturalWidth || !naturalHeight) {
          const error = new Error(`Asset "${id}" berhasil dimuat tanpa dimensi gambar yang valid.`);
          record.status = "error";
          record.error = error;
          reject(error);
          return;
        }

        if (normalized.width && normalized.height) {
          record.width = normalized.width;
          record.height = normalized.height;
        } else if (normalized.width) {
          record.width = normalized.width;
          record.height = naturalHeight * (normalized.width / naturalWidth);
        } else if (normalized.height) {
          record.height = normalized.height;
          record.width = naturalWidth * (normalized.height / naturalHeight);
        } else {
          record.width = naturalWidth;
          record.height = naturalHeight;
        }

        record.status = "loaded";
        resolve(image);
      };

      image.onerror = (event) => {
        image.onload = null;
        image.onerror = null;
        const error = event instanceof Error
          ? event
          : new Error(`Gagal memuat asset gambar "${id}" dari sumber yang diberikan.`);
        record.status = "error";
        record.error = error;
        reject(error);
      };
    });

    this.#assets.set(id, record);
    image.src = source;
    return record.promise;
  }

  /** Returns loaded image metadata, or null while missing/loading/failed. */
  get(id) {
    const record = this.#assets.get(id);
    if (!record || record.status !== "loaded") return null;
    return Object.freeze({
      id: record.id,
      source: record.source,
      image: record.image,
      width: record.width,
      height: record.height,
      anchorX: record.anchorX,
      anchorY: record.anchorY,
      imageSmoothingEnabled: record.imageSmoothingEnabled
    });
  }

  /** Returns the current lifecycle state for diagnostics and loading UI. */
  getStatus(id) {
    const record = this.#assets.get(id);
    return record ? record.status : "missing";
  }

  has(id) {
    return this.#assets.has(id);
  }

  /** Removes an asset registration. Already-running browser image requests may finish harmlessly. */
  remove(id) {
    return this.#assets.delete(id);
  }

  clear() {
    this.#assets.clear();
  }

  get size() {
    return this.#assets.size;
  }
}
