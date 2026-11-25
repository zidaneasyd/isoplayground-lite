import test from "node:test";
import assert from "node:assert/strict";
import { ObjectInspector } from "../src/ui/object-inspector.js";
import { WorldObject } from "../src/objects/world-object.js";

class Control {
  constructor() { this.value = ""; this.textContent = ""; this.hidden = false; this.listeners = new Map(); }
  addEventListener(type, fn) { this.listeners.set(type, fn); }
  removeEventListener(type, fn) { if (this.listeners.get(type) === fn) this.listeners.delete(type); }
  click() { this.listeners.get("click")?.({ target: this }); }
}

function makeRoot() {
  const selectors = [
    "[data-object-empty]", "[data-object-content]", "[data-object-status]",
    '[data-object-value="id"]', '[data-object-value="type"]',
    '[data-object-input="name"]', '[data-object-input="assetId"]',
    '[data-object-input="x"]', '[data-object-input="y"]',
    '[data-object-input="width"]', '[data-object-input="height"]',
    '[data-object-input="elevationOffset"]', '[data-object-input="properties"]',
    "[data-object-error]", "[data-object-apply]", "[data-object-move]", "[data-object-delete]"
  ];
  const elements = new Map(selectors.map((selector) => [selector, new Control()]));
  return { querySelector: (selector) => elements.get(selector) ?? null, elements };
}

function createObject() {
  return new WorldObject({
    id: "pool-1", type: "pool", name: "Pool", assetId: "pool-sprite",
    x: 1, y: 2, footprint: { width: 5, height: 3 }, elevationOffset: -1,
    properties: { material: "water" }
  });
}

test("object inspector validates root and required markup", () => {
  assert.throws(() => new ObjectInspector(null), TypeError);
  assert.throws(() => new ObjectInspector({ querySelector: () => null }), /tidak lengkap/);
});

test("object inspector starts empty and displays selected object data", () => {
  const root = makeRoot();
  const inspector = new ObjectInspector(root);
  assert.equal(root.elements.get("[data-object-empty]").hidden, false);
  assert.equal(root.elements.get("[data-object-content]").hidden, true);
  const item = createObject();
  inspector.setObject(item);
  assert.equal(root.elements.get('[data-object-value="id"]').textContent, "pool-1");
  assert.equal(root.elements.get('[data-object-value="type"]').textContent, "pool");
  assert.equal(root.elements.get('[data-object-input="width"]').value, "5");
  assert.equal(root.elements.get('[data-object-input="properties"]').value, '{\n  "material": "water"\n}');
  inspector.destroy();
});

test("object inspector applies validated edits through one callback", () => {
  const root = makeRoot();
  const changes = [];
  const inspector = new ObjectInspector(root, { onChange: (item, value) => changes.push([item, value]) });
  const item = createObject();
  inspector.setObject(item);
  const value = (key) => root.elements.get(`[data-object-input="${key}"]`);
  value("name").value = "Large Pool";
  value("assetId").value = "pool-new";
  value("x").value = "2";
  value("y").value = "1";
  value("width").value = "4";
  value("height").value = "6";
  value("elevationOffset").value = "2.5";
  value("properties").value = '{"material":"stone"}';
  root.elements.get("[data-object-apply]").click();
  assert.equal(changes.length, 1);
  assert.equal(changes[0][0], item);
  assert.deepEqual(changes[0][1].footprint.toJSON(), { width: 4, height: 6 });
  assert.equal(changes[0][1].elevationOffset, 2.5);
  assert.deepEqual(changes[0][1].properties, { material: "stone" });
});

test("object inspector rejects invalid coordinates and malformed properties", () => {
  const root = makeRoot();
  let changed = false;
  const inspector = new ObjectInspector(root, { onChange: () => { changed = true; } });
  inspector.setObject(createObject());
  root.elements.get('[data-object-input="x"]').value = "-1";
  root.elements.get("[data-object-apply]").click();
  assert.equal(changed, false);
  assert.match(root.elements.get("[data-object-error]").textContent, /Anchor/);
  root.elements.get('[data-object-input="x"]').value = "1";
  root.elements.get('[data-object-input="properties"]').value = "{";
  root.elements.get("[data-object-apply]").click();
  assert.equal(changed, false);
  assert.ok(root.elements.get("[data-object-error]").textContent.length > 0);
});

test("object inspector delegates move and delete actions by object ID", () => {
  const root = makeRoot();
  const moves = [];
  const deletes = [];
  const inspector = new ObjectInspector(root, {
    onMove: (id) => moves.push(id),
    onDelete: (id) => deletes.push(id)
  });
  inspector.setObject(createObject());
  root.elements.get("[data-object-move]").click();
  root.elements.get("[data-object-delete]").click();
  assert.deepEqual(moves, ["pool-1"]);
  assert.deepEqual(deletes, ["pool-1"]);
});

test("object inspector detaches listeners and ignores actions after destroy", () => {
  const root = makeRoot();
  let calls = 0;
  const inspector = new ObjectInspector(root, { onMove: () => calls++ });
  inspector.setObject(createObject());
  inspector.destroy();
  inspector.destroy();
  root.elements.get("[data-object-move]").click();
  assert.equal(calls, 0);
  assert.equal(root.elements.get("[data-object-move]").listeners.size, 0);
});
