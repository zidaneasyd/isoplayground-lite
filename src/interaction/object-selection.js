/** Keeps object selection independent from TileSelection. */
export class ObjectSelection {
  #world;
  #selectedObjectId = null;

  constructor(world) {
    if (!world || !world.objects || typeof world.objects.getById !== "function" ||
        typeof world.objects.getObjects !== "function") {
      throw new TypeError("ObjectSelection membutuhkan World dengan ObjectStore yang valid.");
    }
    this.#world = world;
  }

  get selectedObjectId() { return this.#selectedObjectId; }
  get selectedObject() {
    return this.#selectedObjectId === null
      ? null
      : this.#world.objects.getById(this.#selectedObjectId);
  }

  select(id) {
    if (typeof id !== "string" || !this.#world.objects.has(id)) return false;
    if (this.#selectedObjectId === id) return false;
    this.#selectedObjectId = id;
    return true;
  }

  clear() {
    if (this.#selectedObjectId === null) return false;
    this.#selectedObjectId = null;
    return true;
  }

  /** Returns the visually topmost object whose footprint contains the tile. */
  getObjectAt(x, y) {
    if (!Number.isSafeInteger(x) || x < 0 || !Number.isSafeInteger(y) || y < 0) return null;
    const candidates = [];
    let order = 0;
    for (const object of this.#world.objects.getObjects()) {
      if (object.footprint.contains(x, y, object.x, object.y)) {
        const centerX = object.x + (object.footprint.width - 1) / 2;
        const centerY = object.y + (object.footprint.height - 1) / 2;
        candidates.push({
          object,
          depth: centerX + centerY,
          secondaryDepth: centerX - centerY,
          order
        });
      }
      order++;
    }
    candidates.sort((a, b) =>
      b.depth - a.depth || b.secondaryDepth - a.secondaryDepth || b.order - a.order
    );
    return candidates[0]?.object ?? null;
  }

  selectAt(x, y) {
    const object = this.getObjectAt(x, y);
    if (!object) return null;
    this.select(object.id);
    return object;
  }
}
