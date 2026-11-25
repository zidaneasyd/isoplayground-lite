import test from "node:test";
import assert from "node:assert/strict";
import { ObjectSelection } from "../src/interaction/object-selection.js";
import { WorldObject } from "../src/objects/world-object.js";
import { World } from "../src/world/world.js";

function object(id, x, y, width = 1, height = 1) {
  return new WorldObject({ id, type: "prop", x, y, footprint: { width, height } });
}

test("object selection validates its World dependency", () => {
  for (const value of [null, undefined, {}, { objects: {} }]) {
    assert.throws(() => new ObjectSelection(value), TypeError);
  }
});

test("object selection starts empty and selects only stored object IDs", () => {
  const world = new World({ width: 5, height: 5 });
  const selection = new ObjectSelection(world);
  const item = object("crate", 1, 1);
  assert.equal(selection.selectedObject, null);
  assert.equal(selection.select("missing"), false);
  world.objects.add(item);
  assert.equal(selection.select(item.id), true);
  assert.equal(selection.selectedObject, item);
  assert.equal(selection.selectedObjectId, item.id);
  assert.equal(selection.select(item.id), false);
});

test("object selection clears independently and tolerates repeated clear", () => {
  const world = new World({ width: 5, height: 5 });
  const item = object("crate", 1, 1);
  world.objects.add(item);
  const selection = new ObjectSelection(world);
  selection.select(item.id);
  assert.equal(selection.clear(), true);
  assert.equal(selection.clear(), false);
  assert.equal(selection.selectedObject, null);
});

test("object hit testing recognizes every footprint cell", () => {
  const world = new World({ width: 8, height: 8 });
  const pool = object("pool", 1, 2, 5, 3);
  world.objects.add(pool);
  const selection = new ObjectSelection(world);
  for (let x = 1; x < 6; x++) {
    for (let y = 2; y < 5; y++) assert.equal(selection.getObjectAt(x, y), pool);
  }
  assert.equal(selection.getObjectAt(6, 4), null);
});

test("object hit testing chooses the topmost object using sprite depth order", () => {
  const world = new World({ width: 8, height: 8 });
  const back = object("back", 1, 1, 3, 3);
  const front = object("front", 2, 2, 2, 2);
  world.objects.add(back);
  world.objects.add(front);
  const selection = new ObjectSelection(world);
  assert.equal(selection.getObjectAt(2, 2), front);
});

test("object hit testing resolves exact depth ties by later render order", () => {
  const world = new World({ width: 8, height: 8 });
  const first = object("first", 1, 2, 2, 2);
  const second = object("second", 1, 2, 2, 2);
  world.objects.add(first);
  world.objects.add(second);
  assert.equal(new ObjectSelection(world).getObjectAt(1, 2), second);
});

test("object hit testing rejects invalid coordinates and never mutates tile selection data", () => {
  const world = new World({ width: 4, height: 4 });
  world.objects.add(object("crate", 0, 0));
  const selection = new ObjectSelection(world);
  for (const [x, y] of [[-1, 0], [0, -1], [1.5, 0], [0, NaN], [Infinity, 0]]) {
    assert.equal(selection.getObjectAt(x, y), null);
  }
  assert.equal(world.getTile(0, 0).elevation, 0);
  assert.equal(world.getTile(0, 0).terrain, "default");
});

test("selection becomes empty if its object is removed from the store", () => {
  const world = new World({ width: 4, height: 4 });
  const item = object("crate", 0, 0);
  world.objects.add(item);
  const selection = new ObjectSelection(world);
  selection.select(item.id);
  world.objects.remove(item.id);
  assert.equal(selection.selectedObject, null);
});
