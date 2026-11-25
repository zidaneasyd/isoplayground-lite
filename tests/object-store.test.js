import test from "node:test";
import assert from "node:assert/strict";
import { ObjectStore } from "../src/objects/object-store.js";
import { WorldObject } from "../src/objects/world-object.js";
import { World } from "../src/world/world.js";

function createObject(id, x = 0, y = 0) {
  return new WorldObject({ id, type: "prop", x, y });
}

test("object store starts empty and exposes its size", () => {
  const store = new ObjectStore();

  assert.equal(store.size, 0);
  assert.deepEqual([...store.getObjects()], []);
});

test("object store preserves object references and indexes them by ID", () => {
  const store = new ObjectStore();
  const object = createObject("prop-1", 2, 3);

  assert.equal(store.add(object), object);
  assert.equal(store.getById(object.id), object);
  assert.equal([...store.getObjects()][0], object);
  assert.equal(store.has(object.id), true);
  assert.equal(store.size, 1);
});

test("object store preserves insertion order and independent object data", () => {
  const store = new ObjectStore();
  const first = createObject("prop-1", 1, 1);
  const second = createObject("prop-2", 2, 2);

  store.add(first);
  store.add(second);

  assert.deepEqual([...store.getObjects()], [first, second]);
  assert.notEqual(first, second);
  assert.equal(first.id, "prop-1");
  assert.equal(second.id, "prop-2");
});

test("object store rejects duplicate IDs without replacing the stored reference", () => {
  const store = new ObjectStore();
  const first = createObject("prop-1");
  const duplicate = createObject("prop-1", 4, 5);

  store.add(first);

  assert.throws(() => store.add(duplicate), /sudah ada/);
  assert.equal(store.getById("prop-1"), first);
  assert.equal(store.size, 1);
});

test("object store accepts only WorldObject instances", () => {
  const store = new ObjectStore();

  assert.throws(() => store.add({ id: "plain-object" }), TypeError);
  assert.throws(() => store.add(null), TypeError);
  assert.equal(store.size, 0);
});

test("object store removes by ID and reports missing IDs", () => {
  const store = new ObjectStore();
  const object = createObject("prop-1");
  store.add(object);

  assert.equal(store.remove("prop-1"), true);
  assert.equal(store.getById("prop-1"), null);
  assert.equal(store.has("prop-1"), false);
  assert.equal(store.remove("prop-1"), false);
  assert.equal(store.size, 0);
});

test("object store safely rejects invalid and unknown IDs", () => {
  const store = new ObjectStore();

  for (const id of [null, undefined, 1, ""]) {
    assert.equal(store.getById(id), null);
    assert.equal(store.has(id), false);
    assert.equal(store.remove(id), false);
  }

  assert.equal(store.getById("missing"), null);
  assert.equal(store.has("missing"), false);
  assert.equal(store.remove("missing"), false);
});

test("each world owns an independent object store separate from persistent tiles", () => {
  const firstWorld = new World({ width: 2, height: 2 });
  const secondWorld = new World({ width: 2, height: 2 });
  const tile = firstWorld.getTile(1, 1);
  const object = createObject("pool-1", 1, 1);

  const firstStore = firstWorld.objects;
  firstWorld.objects.add(object);

  assert.throws(() => { firstWorld.objects = new ObjectStore(); }, TypeError);
  assert.equal(firstWorld.objects, firstStore);
  assert.equal(firstWorld.objects.getById("pool-1"), object);
  assert.equal(firstWorld.objects.size, 1);
  assert.equal(secondWorld.objects.size, 0);
  assert.equal(firstWorld.getTile(1, 1), tile);
  assert.equal(firstWorld.getTileById(tile.id), tile);
  assert.equal([...firstWorld.getTiles()].length, 4);
  assert.equal([...firstWorld.objects.getObjects()].length, 1);
  assert.equal(tile.id, "tile-1-1");
});
