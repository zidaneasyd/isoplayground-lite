import { ObjectFootprint } from "../objects/object-footprint.js";

/** DOM inspector for one selected WorldObject. */
export class ObjectInspector {
  constructor(root, { onChange = null, onMove = null, onDelete = null } = {}) {
    if (!root || typeof root.querySelector !== "function") {
      throw new TypeError("ObjectInspector membutuhkan root DOM yang valid.");
    }
    for (const [name, callback] of Object.entries({ onChange, onMove, onDelete })) {
      if (callback !== null && typeof callback !== "function") {
        throw new TypeError(`${name} harus berupa function atau null.`);
      }
    }
    this.root = root;
    this.onChange = onChange;
    this.onMove = onMove;
    this.onDelete = onDelete;
    this.object = null;
    this.destroyed = false;
    this.elements = {
      empty: root.querySelector("[data-object-empty]"),
      content: root.querySelector("[data-object-content]"),
      status: root.querySelector("[data-object-status]"),
      id: root.querySelector('[data-object-value="id"]'),
      type: root.querySelector('[data-object-value="type"]'),
      name: root.querySelector('[data-object-input="name"]'),
      assetId: root.querySelector('[data-object-input="assetId"]'),
      x: root.querySelector('[data-object-input="x"]'),
      y: root.querySelector('[data-object-input="y"]'),
      width: root.querySelector('[data-object-input="width"]'),
      height: root.querySelector('[data-object-input="height"]'),
      elevationOffset: root.querySelector('[data-object-input="elevationOffset"]'),
      properties: root.querySelector('[data-object-input="properties"]'),
      error: root.querySelector("[data-object-error]"),
      apply: root.querySelector("[data-object-apply]"),
      move: root.querySelector("[data-object-move]"),
      remove: root.querySelector("[data-object-delete]")
    };
    const required = ["empty", "content", "status", "id", "type", "name", "assetId", "x", "y", "width", "height", "elevationOffset", "properties", "error", "apply", "move", "remove"];
    if (required.some((key) => !this.elements[key])) {
      throw new TypeError("Markup Object Inspector tidak lengkap.");
    }
    this.onSubmit = this.onSubmit.bind(this);
    this.onMoveClick = this.onMoveClick.bind(this);
    this.onDeleteClick = this.onDeleteClick.bind(this);
    this.elements.apply.addEventListener("click", this.onSubmit);
    this.elements.move.addEventListener("click", this.onMoveClick);
    this.elements.remove.addEventListener("click", this.onDeleteClick);
    this.setObject(null);
  }

  setObject(object) {
    if (this.destroyed) return;
    this.object = object ?? null;
    const active = Boolean(this.object);
    this.elements.empty.hidden = active;
    this.elements.content.hidden = !active;
    this.elements.status.textContent = active ? "OBJECT SELECTED" : "NO OBJECT SELECTED";
    if (!active) {
      this.elements.error.textContent = "";
      return;
    }
    const item = this.object;
    this.elements.id.textContent = item.id;
    this.elements.type.textContent = item.type;
    this.elements.name.value = item.name;
    this.elements.assetId.value = item.assetId ?? "";
    this.elements.x.value = String(item.x);
    this.elements.y.value = String(item.y);
    this.elements.width.value = String(item.footprint.width);
    this.elements.height.value = String(item.footprint.height);
    this.elements.elevationOffset.value = String(item.elevationOffset);
    this.elements.properties.value = JSON.stringify(item.properties, null, 2);
    this.elements.error.textContent = "";
  }

  onSubmit() {
    if (this.destroyed || !this.object) return false;
    try {
      const x = Number(this.elements.x.value);
      const y = Number(this.elements.y.value);
      const footprint = new ObjectFootprint({
        width: Number(this.elements.width.value),
        height: Number(this.elements.height.value)
      });
      const elevationOffset = Number(this.elements.elevationOffset.value);
      const assetId = this.elements.assetId.value.trim() || null;
      const properties = JSON.parse(this.elements.properties.value || "{}");
      if (!Number.isSafeInteger(x) || x < 0 || !Number.isSafeInteger(y) || y < 0) {
        throw new TypeError("Anchor X dan Y harus bilangan bulat non-negatif.");
      }
      if (!Number.isFinite(elevationOffset)) throw new TypeError("Elevation offset harus berupa angka finite.");
      if (assetId !== null && !assetId.trim()) throw new TypeError("Asset ID tidak valid.");
      if (!properties || typeof properties !== "object" || Array.isArray(properties)) {
        throw new TypeError("Properties harus berupa JSON object.");
      }
      const changes = {
        name: this.elements.name.value,
        assetId,
        x,
        y,
        footprint,
        elevationOffset,
        properties
      };
      this.onChange?.(this.object, changes);
      this.setObject(this.object);
      return true;
    } catch (error) {
      this.elements.error.textContent = error instanceof Error ? error.message : "Perubahan objek tidak valid.";
      return false;
    }
  }

  onMoveClick() {
    if (!this.destroyed && this.object) this.onMove?.(this.object.id);
  }

  onDeleteClick() {
    if (!this.destroyed && this.object) this.onDelete?.(this.object.id);
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.elements.apply.removeEventListener("click", this.onSubmit);
    this.elements.move.removeEventListener("click", this.onMoveClick);
    this.elements.remove.removeEventListener("click", this.onDeleteClick);
    this.object = null;
  }
}
