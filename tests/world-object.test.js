import test from "node:test";
import assert from "node:assert/strict";
import { WorldObject } from "../src/objects/world-object.js";

function createObject(overrides = {}) {
  return new WorldObject({
    id: "object-pool-1",
    type: "decoration",
    x: 2,
    y: 3,
    ...overrides
  });
}

test("world object stores stable identity, type, anchor, and asset reference", () => {
  const object = createObject({
    name: "Swimming Pool",
    assetId: "pool-large"
  });

  assert.equal(object.id, "object-pool-1");
  assert.equal(object.type, "decoration");
  assert.equal(object.name, "Swimming Pool");
  assert.equal(object.assetId, "pool-large");
  assert.equal(object.x, 2);
  assert.equal(object.y, 3);
  assert.deepEqual(object.properties, {});
  assert.equal("elevation" in object, false);
  assert.deepEqual(object.footprint.toJSON(), { width: 1, height: 1 });
});

test("world object defaults its name to its type and permits a missing asset", () => {
  const object = createObject();

  assert.equal(object.name, "decoration");
  assert.equal(object.assetId, null);
  assert.deepEqual(object.footprint.toJSON(), { width: 1, height: 1 });
});

test("world object identity and type are immutable", () => {
  const object = createObject();

  assert.throws(() => { object.id = "changed"; }, TypeError);
  assert.throws(() => { object.type = "building"; }, TypeError);
  assert.equal(object.id, "object-pool-1");
  assert.equal(object.type, "decoration");
});

test("world object mutable data validates and preserves anchor values", () => {
  const object = createObject();

  object.name = "Pool";
  object.assetId = "pool-asset-v2";
  object.x = 5;
  object.y = 7;

  assert.equal(object.name, "Pool");
  assert.equal(object.assetId, "pool-asset-v2");
  assert.equal(object.x, 5);
  assert.equal(object.y, 7);
});

test("world object accepts a multi-cell footprint and serializes its dimensions", () => {
  const object = createObject({ footprint: { width: 5, height: 7 } });

  assert.equal(object.footprint.width, 5);
  assert.equal(object.footprint.height, 7);
  assert.deepEqual(JSON.parse(JSON.stringify(object)).footprint, {
    width: 5,
    height: 7
  });

  object.footprint = { width: 2, height: 3 };
  assert.deepEqual(object.footprint.toJSON(), { width: 2, height: 3 });
});

test("world object rejects invalid identity, type, and anchor coordinates", () => {
  assert.throws(() => createObject({ id: "" }), TypeError);
  assert.throws(() => createObject({ type: " " }), TypeError);
  assert.throws(() => createObject({ x: -1 }), TypeError);
  assert.throws(() => createObject({ x: 1.5 }), TypeError);
  assert.throws(() => createObject({ y: NaN }), TypeError);
  assert.throws(() => createObject({ y: undefined }), TypeError);
});

test("world object rejects invalid mutable values without replacing valid state", () => {
  const object = createObject();

  assert.throws(() => { object.name = ""; }, TypeError);
  assert.throws(() => { object.assetId = " "; }, TypeError);
  assert.throws(() => { object.assetId = 42; }, TypeError);
  assert.throws(() => { object.x = -1; }, TypeError);
  assert.throws(() => { object.y = 1.2; }, TypeError);
  assert.throws(() => { object.footprint = { width: 0, height: 1 }; }, TypeError);
  assert.throws(() => { object.footprint = { width: 1, height: -2 }; }, TypeError);

  assert.equal(object.name, "decoration");
  assert.equal(object.assetId, null);
  assert.equal(object.x, 2);
  assert.equal(object.y, 3);
  assert.deepEqual(object.footprint.toJSON(), { width: 1, height: 1 });
});

test("world object deeply copies property data and serializes a detached snapshot", () => {
  const properties = {
    material: "stone",
    interactive: false,
    metadata: { capacity: 8 },
    tags: ["water", "decoration"]
  };
  const object = createObject({
    name: "Pool",
    assetId: "pool-large",
    properties
  });

  properties.material = "wood";
  properties.metadata.capacity = 2;
  properties.tags.push("changed");

  assert.equal(object.properties.material, "stone");
  assert.equal(object.properties.metadata.capacity, 8);
  assert.deepEqual(object.properties.tags, ["water", "decoration"]);

  const exposedProperties = object.properties;
  exposedProperties.metadata.capacity = 99;
  assert.equal(object.properties.metadata.capacity, 8);

  object.properties = { material: "concrete", capacity: 8 };
  assert.deepEqual(JSON.parse(JSON.stringify(object)), {
    id: "object-pool-1",
    type: "decoration",
    name: "Pool",
    assetId: "pool-large",
    x: 2,
    y: 3,
    footprint: { width: 1, height: 1 },
    properties: { material: "concrete", capacity: 8 }
  });
});

test("world object rejects non-JSON and non-object property data", () => {
  for (const properties of [null, [], "invalid", 3]) {
    assert.throws(() => createObject({ properties }), TypeError);
  }

  for (const invalidValue of [undefined, NaN, Infinity, () => {}, Symbol("x")]) {
    assert.throws(() => createObject({ properties: { invalidValue } }), TypeError);
  }

  const circular = {};
  circular.self = circular;
  assert.throws(() => createObject({ properties: circular }), TypeError);
});
