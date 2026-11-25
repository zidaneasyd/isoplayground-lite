import test from "node:test";
import assert from "node:assert/strict";
import { ObjectFootprint } from "../src/objects/object-footprint.js";
import { WorldObject } from "../src/objects/world-object.js";
import { World } from "../src/world/world.js";

function createFootprint(width = 1, height = 1) {
  return new ObjectFootprint({ width, height });
}

test("object footprint defaults to one grid cell and keeps dimensions immutable", () => {
  const footprint = new ObjectFootprint();

  assert.equal(footprint.width, 1);
  assert.equal(footprint.height, 1);
  assert.deepEqual(footprint.toJSON(), { width: 1, height: 1 });
  assert.throws(() => { footprint.width = 5; }, TypeError);
  assert.throws(() => { footprint.height = 7; }, TypeError);
});

test("object footprint accepts positive integer dimensions and rejects invalid sizes", () => {
  assert.deepEqual(createFootprint(5, 7).toJSON(), { width: 5, height: 7 });

  for (const width of [0, -1, 1.5, NaN, Infinity, "5", null]) {
    assert.throws(() => createFootprint(width, 1), TypeError);
  }
  for (const height of [0, -1, 2.5, NaN, Infinity, "7", null]) {
    assert.throws(() => createFootprint(1, height), TypeError);
  }
});

test("one-cell footprint resolves to its anchor coordinate", () => {
  assert.deepEqual(createFootprint().getGridCells(3, 4), [{ x: 3, y: 4 }]);
});

test("rectangular 5 by 7 footprint resolves all 35 covered grid cells", () => {
  const footprint = createFootprint(5, 7);
  const cells = footprint.getGridCells(2, 3);
  const keys = cells.map(({ x, y }) => `${x},${y}`);

  assert.equal(cells.length, 35);
  assert.equal(new Set(keys).size, 35);
  assert.ok(cells.every(({ x, y }) => x >= 2 && x < 7 && y >= 3 && y < 10));
  assert.deepEqual(
    cells.map(({ x, y }) => x + y),
    [...cells].map(({ x, y }) => x + y).sort((a, b) => a - b)
  );
});

test("grid coverage starts at the anchor and extends only along positive grid axes", () => {
  const cells = createFootprint(3, 2).getGridCells(4, 6);
  const covered = new Set(cells.map(({ x, y }) => `${x},${y}`));

  assert.equal(covered.has("4,6"), true);
  assert.equal(covered.has("6,7"), true);
  assert.equal(covered.has("3,6"), false);
  assert.equal(covered.has("4,5"), false);
  assert.equal(covered.has("7,7"), false);
});

test("footprint contains checks the inclusive start and exclusive end boundaries", () => {
  const footprint = createFootprint(5, 7);

  assert.equal(footprint.contains(2, 3, 2, 3), true);
  assert.equal(footprint.contains(6, 9, 2, 3), true);
  assert.equal(footprint.contains(7, 9, 2, 3), false);
  assert.equal(footprint.contains(6, 10, 2, 3), false);
  assert.equal(footprint.contains(1, 3, 2, 3), false);
  assert.equal(footprint.contains(2, 2, 2, 3), false);
});

test("footprint validates anchors and queried grid coordinates", () => {
  const footprint = createFootprint(2, 2);

  for (const value of [-1, 1.5, NaN, Infinity, "1", null]) {
    assert.throws(() => footprint.getGridCells(value, 0), TypeError);
    assert.throws(() => footprint.getGridCells(0, value), TypeError);
    assert.throws(() => footprint.fitsWithinWorld(5, 5, value, 0), TypeError);
    assert.throws(() => footprint.contains(value, 0, 0, 0), TypeError);
  }
});

test("footprint fits exactly at world edges and rejects any overflow", () => {
  const footprint = createFootprint(5, 7);

  assert.equal(footprint.fitsWithinWorld(5, 7, 0, 0), true);
  assert.equal(footprint.fitsWithinWorld(10, 12, 5, 5), true);
  assert.equal(footprint.fitsWithinWorld(10, 12, 6, 5), false);
  assert.equal(footprint.fitsWithinWorld(10, 12, 5, 6), false);
  assert.equal(footprint.fitsWithinWorld(4, 12, 0, 0), false);
  assert.equal(footprint.fitsWithinWorld(10, 6, 0, 0), false);
});

test("footprint rejects invalid world dimensions", () => {
  const footprint = createFootprint(2, 2);

  for (const [width, height] of [
    [0, 5], [5, 0], [-1, 5], [5, -1], [1.5, 5], [5, NaN], [Infinity, 5]
  ]) {
    assert.throws(
      () => footprint.fitsWithinWorld(width, height, 0, 0),
      TypeError
    );
  }
});

test("footprint resolves covered tiles to persistent World references", () => {
  const world = new World({ width: 8, height: 9 });
  const footprint = createFootprint(5, 7);
  const tiles = footprint.getCoveredTiles(world, 2, 1);
  const cells = footprint.getGridCells(2, 1);

  assert.equal(tiles.length, 35);
  assert.ok(tiles.every((tile, index) => {
    return tile === world.getTile(cells[index].x, cells[index].y);
  }));
  assert.equal(new Set(tiles).size, 35);
});

test("footprint does not return a partial tile list when it crosses world bounds", () => {
  const world = new World({ width: 8, height: 9 });
  const footprint = createFootprint(5, 7);

  assert.equal(footprint.getCoveredTiles(world, 4, 1), null);
  assert.equal(footprint.getCoveredTiles(world, 2, 3), null);
});

test("footprint rejects invalid world references when resolving tiles", () => {
  const footprint = createFootprint();

  for (const world of [null, undefined, {}, { width: 2, height: 2 }, {
    width: 0,
    height: 2,
    getTile() { return null; }
  }]) {
    assert.throws(() => footprint.getCoveredTiles(world, 0, 0), TypeError);
  }
});

test("world object stores a footprint and resolves its coverage from its anchor", () => {
  const world = new World({ width: 8, height: 9 });
  const object = new WorldObject({
    id: "pool-1",
    type: "decoration",
    x: 2,
    y: 1,
    footprint: { width: 5, height: 7 }
  });
  const cells = object.footprint.getGridCells(object.x, object.y);
  const tiles = object.footprint.getCoveredTiles(world, object.x, object.y);

  assert.equal(cells.length, 35);
  assert.equal(tiles.length, 35);
  assert.equal(tiles[0], world.getTile(cells[0].x, cells[0].y));
  assert.deepEqual(object.toJSON().footprint, { width: 5, height: 7 });
});

test("invalid object footprint assignments preserve the previous dimensions", () => {
  const object = new WorldObject({
    id: "pool-1",
    type: "decoration",
    x: 0,
    y: 0,
    footprint: { width: 5, height: 7 }
  });

  for (const value of [null, {}, { width: 1, height: 0 }, { width: 1.5, height: 2 }]) {
    assert.throws(() => { object.footprint = value; }, TypeError);
  }

  assert.deepEqual(object.footprint.toJSON(), { width: 5, height: 7 });
});
