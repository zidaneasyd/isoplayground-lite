import test from "node:test";
import assert from "node:assert/strict";
import { World } from "../src/world/world.js";
import { WorldObject } from "../src/objects/world-object.js";
import {
  getObjectWorldPosition,
  resolveObjectElevation
} from "../src/objects/object-elevation.js";

function createObject(overrides = {}) {
  return new WorldObject({
    id: "object-test",
    type: "prop",
    x: 2,
    y: 3,
    ...overrides
  });
}

test("object elevation follows its anchor tile when the offset is zero", () => {
  const world = new World({ width: 6, height: 6 });
  world.getTile(2, 3).elevation = 4;

  assert.deepEqual(resolveObjectElevation(world, createObject()), {
    anchorX: 2,
    anchorY: 3,
    anchorElevation: 4,
    elevationOffset: 0,
    elevation: 4
  });
});

test("object elevation adds a finite relative offset to the anchor tile", () => {
  const world = new World({ width: 6, height: 6 });
  world.getTile(2, 3).elevation = 2;

  const result = resolveObjectElevation(world, createObject({ elevationOffset: 1.25 }));
  assert.equal(result.anchorElevation, 2);
  assert.equal(result.elevationOffset, 1.25);
  assert.equal(result.elevation, 3.25);
});

test("object elevation supports negative anchor levels and negative offsets", () => {
  const world = new World({ width: 6, height: 6 });
  world.getTile(2, 3).elevation = -3;

  const result = resolveObjectElevation(world, createObject({ elevationOffset: -1.5 }));
  assert.equal(result.elevation, -4.5);
});

test("object elevation is derived dynamically after the anchor tile changes", () => {
  const world = new World({ width: 6, height: 6 });
  const anchor = world.getTile(2, 3);
  const object = createObject({ elevationOffset: 0.5 });

  anchor.elevation = 1;
  assert.equal(resolveObjectElevation(world, object).elevation, 1.5);
  anchor.elevation = -2;
  assert.equal(resolveObjectElevation(world, object).elevation, -1.5);
});

test("object elevation can be resolved against a proposed move anchor", () => {
  const world = new World({ width: 6, height: 6 });
  world.getTile(2, 3).elevation = 1;
  world.getTile(4, 1).elevation = 5;
  const object = createObject({ elevationOffset: -0.25 });

  const result = resolveObjectElevation(world, object, { x: 4, y: 1 });
  assert.equal(result.anchorX, 4);
  assert.equal(result.anchorY, 1);
  assert.equal(result.anchorElevation, 5);
  assert.equal(result.elevation, 4.75);
  assert.equal(object.x, 2);
  assert.equal(object.y, 3);
});

test("object elevation returns null for missing or invalid anchors", () => {
  const world = new World({ width: 6, height: 6 });
  const object = createObject();

  assert.equal(resolveObjectElevation(null, object), null);
  assert.equal(resolveObjectElevation(world, null), null);
  assert.equal(resolveObjectElevation(world, object, { x: 6, y: 0 }), null);
  assert.equal(resolveObjectElevation(world, object, { x: 1.5, y: 0 }), null);

  world.getTile = () => ({ elevation: NaN });
  assert.equal(resolveObjectElevation(world, object), null);

  world.getTile = () => ({ elevation: Number.MAX_VALUE });
  assert.equal(
    resolveObjectElevation(world, createObject({ elevationOffset: Number.MAX_VALUE })),
    null
  );
});

test("object world position projects the resolved elevation into isometric space", () => {
  const world = new World({ width: 6, height: 6 });
  world.getTile(2, 3).elevation = 2;
  const object = createObject({ elevationOffset: -0.5 });

  assert.deepEqual(getObjectWorldPosition(world, object, {
    width: 64,
    height: 32,
    elevationStep: 8
  }), {
    x: -32,
    y: 84,
    anchorX: 2,
    anchorY: 3,
    anchorElevation: 2,
    elevationOffset: -0.5,
    elevation: 1.5
  });
});

test("object world position follows changed anchor elevation without changing anchor coordinates", () => {
  const world = new World({ width: 6, height: 6 });
  const anchor = world.getTile(2, 3);
  const object = createObject();
  const tileConfig = { width: 64, height: 32, elevationStep: 8 };

  anchor.elevation = 3;
  const first = getObjectWorldPosition(world, object, tileConfig);
  anchor.elevation = -2;
  const second = getObjectWorldPosition(world, object, tileConfig);

  assert.equal(first.y, 72);
  assert.equal(second.y, 112);
  assert.equal(second.x, first.x);
  assert.equal(object.x, 2);
  assert.equal(object.y, 3);
});

test("object world position rejects invalid tile geometry", () => {
  const world = new World({ width: 6, height: 6 });
  const object = createObject();

  for (const tile of [
    null,
    {},
    { width: 0, height: 32, elevationStep: 8 },
    { width: 64, height: Infinity, elevationStep: 8 },
    { width: 64, height: 32, elevationStep: NaN },
    { width: 64, height: 32, elevationStep: -1 }
  ]) {
    assert.equal(getObjectWorldPosition(world, object, tile), null);
  }
});
