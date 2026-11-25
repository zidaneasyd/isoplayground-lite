import { WorldObject } from "../objects/world-object.js";
import { resolveObjectElevation } from "../objects/object-elevation.js";

/**
 * Controls the temporary placement or move of one WorldObject.
 * The persistent object is not mutated until confirm() succeeds.
 * Occupancy/collision rules are intentionally outside this stage.
 */
export class ObjectPlacement {
  #world;
  #session = null;

  constructor(world) {
    if (
      !world ||
      typeof world !== "object" ||
      typeof world.getTile !== "function" ||
      !world.objects ||
      typeof world.objects.getById !== "function" ||
      typeof world.objects.has !== "function" ||
      typeof world.objects.add !== "function"
    ) {
      throw new TypeError("ObjectPlacement membutuhkan World dengan ObjectStore yang valid.");
    }
    this.#world = world;
  }

  get active() {
    return this.#session !== null;
  }

  /** Starts placing a new object that is not yet registered in the World. */
  beginPlacement(object) {
    if (!(object instanceof WorldObject)) {
      throw new TypeError("Penempatan hanya menerima instance WorldObject.");
    }
    if (this.#session) throw new Error("Operasi penempatan objek lain masih aktif.");
    if (this.#world.objects.has(object.id)) {
      throw new Error(`Objek dengan ID "${object.id}" sudah terdaftar di World.`);
    }

    this.#session = {
      mode: "place",
      object,
      x: object.x,
      y: object.y,
      valid: false,
      reason: null,
      elevation: null,
      anchorElevation: null,
      elevationOffset: object.elevationOffset
    };
    this.#evaluate();
    return true;
  }

  /** Starts moving an existing object by ID without changing its stored anchor. */
  beginMove(id) {
    if (this.#session) throw new Error("Operasi penempatan objek lain masih aktif.");
    const object = this.#world.objects.getById(id);
    if (!object) return false;

    this.#session = {
      mode: "move",
      object,
      x: object.x,
      y: object.y,
      valid: false,
      reason: null,
      elevation: null,
      anchorElevation: null,
      elevationOffset: object.elevationOffset
    };
    this.#evaluate();
    return true;
  }

  /** Updates the candidate anchor; null/null clears the current target. */
  updatePreview(x, y) {
    if (!this.#session) return false;

    if (x === null && y === null) {
      this.#session.x = null;
      this.#session.y = null;
      this.#session.valid = false;
      this.#session.reason = "no-target";
      return true;
    }

    if (!Number.isSafeInteger(x) || x < 0 || !Number.isSafeInteger(y) || y < 0) {
      throw new TypeError("Anchor penempatan harus berupa koordinat grid bulat non-negatif.");
    }

    this.#session.x = x;
    this.#session.y = y;
    this.#evaluate();
    return true;
  }

  #evaluate() {
    const session = this.#session;
    if (!session) return;

    if (session.x === null || session.y === null) {
      session.valid = false;
      session.reason = "no-target";
      session.elevation = null;
      session.anchorElevation = null;
      return;
    }

    if (session.mode === "move" && this.#world.objects.getById(session.object.id) !== session.object) {
      session.valid = false;
      session.reason = "object-removed";
      session.elevation = null;
      session.anchorElevation = null;
      return;
    }

    if (this.#world.objects.has(session.object.id) && session.mode === "place") {
      session.valid = false;
      session.reason = "duplicate-id";
      session.elevation = null;
      session.anchorElevation = null;
      return;
    }

    const elevation = resolveObjectElevation(this.#world, session.object, {
      x: session.x,
      y: session.y
    });
    session.anchorElevation = elevation?.anchorElevation ?? null;
    session.elevationOffset = session.object.elevationOffset;
    session.elevation = elevation?.elevation ?? null;

    if (!elevation) {
      session.valid = false;
      session.reason = "missing-anchor";
      return;
    }

    session.valid = session.object.footprint.fitsWithinWorld(
      this.#world.width,
      this.#world.height,
      session.x,
      session.y
    );
    session.reason = session.valid ? null : "out-of-bounds";
  }

  /** Commits a valid placement/move and returns the persistent object. */
  confirm() {
    const session = this.#session;
    if (!session) return false;

    this.#evaluate();
    if (!session.valid) return false;

    const { object, x, y, mode } = session;
    if (mode === "place") {
      object.x = x;
      object.y = y;
      this.#world.objects.add(object);
    } else {
      object.x = x;
      object.y = y;
    }

    this.#session = null;
    return object;
  }

  /** Cancels the temporary operation without mutating persistent object data. */
  cancel() {
    if (!this.#session) return false;
    this.#session = null;
    return true;
  }

  /** Returns a detached preview snapshot for the renderer and UI. */
  getPreview() {
    if (!this.#session) return null;
    this.#evaluate();
    const { object, mode, x, y, valid, reason, elevation, anchorElevation, elevationOffset } = this.#session;
    return {
      mode,
      objectId: object.id,
      x,
      y,
      width: object.footprint.width,
      height: object.footprint.height,
      anchorElevation,
      elevationOffset,
      elevation,
      valid,
      reason,
      cells: x === null || y === null
        ? []
        : object.footprint.getGridCells(x, y)
    };
  }
}
