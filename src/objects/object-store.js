import { WorldObject } from "./world-object.js";

/** Owns persistent WorldObject references and provides lookup by stable ID. */
export class ObjectStore {
  #objectsById = new Map();

  /** Adds one WorldObject and returns the same persistent reference. */
  add(object) {
    if (!(object instanceof WorldObject)) {
      throw new TypeError("ObjectStore hanya menerima instance WorldObject.");
    }

    if (this.#objectsById.has(object.id)) {
      throw new Error(`Objek dengan ID "${object.id}" sudah ada.`);
    }

    this.#objectsById.set(object.id, object);
    return object;
  }

  /** Returns the stored object with the supplied ID, or null when absent. */
  getById(id) {
    if (typeof id !== "string") return null;
    return this.#objectsById.get(id) ?? null;
  }

  /** Removes an object by ID and reports whether an object was removed. */
  remove(id) {
    if (typeof id !== "string") return false;
    return this.#objectsById.delete(id);
  }

  has(id) {
    return typeof id === "string" && this.#objectsById.has(id);
  }

  get size() {
    return this.#objectsById.size;
  }

  /** Yields persistent object references in insertion order. */
  *getObjects() {
    yield* this.#objectsById.values();
  }
}
