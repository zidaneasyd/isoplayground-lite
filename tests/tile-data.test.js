import test from "node:test";
import assert from "node:assert/strict";
import { Tile, DEFAULT_TERRAIN } from "../src/world/tile.js";
import { World } from "../src/world/world.js";

test("world creates persistent tile data for every grid coordinate", () => {
  const world = new World({ width: 12, height: 12, baseElevation: 2 });
  const tiles = [...world.getTiles()];

  assert.equal(tiles.length, 144);
  assert.ok(tiles.every((tile) => tile instanceof Tile));
  assert.deepEqual(
    tiles.map(({ x, y }) => [x, y]),
    [...world.grid.tiles()].map(({ x, y }) => [x, y])
  );
  assert.equal(new Set(tiles.map(({ id }) => id)).size, tiles.length);
  assert.ok(tiles.every((tile) => tile.id === `tile-${tile.x}-${tile.y}`));
});

test("each tile contains elevation, terrain, and walkable defaults", () => {
  const world = new World({ width: 3, height: 2, baseElevation: 4 });
  const tiles = [...world.getTiles()];

  assert.ok(tiles.every((tile) => tile.elevation === 4));
  assert.ok(tiles.every((tile) => tile.terrain === DEFAULT_TERRAIN));
  assert.ok(tiles.every((tile) => tile.walkable === true));
});

test("tile data defaults can be configured for a new world", () => {
  const world = new World({
    width: 2,
    height: 2,
    baseElevation: -1,
    defaultTerrain: "stone",
    defaultWalkable: false
  });

  assert.ok([...world.getTiles()].every((tile) => {
    return tile.elevation === -1 && tile.terrain === "stone" && tile.walkable === false;
  }));
});

test("world lookup by coordinates and ID returns the same persistent tile", () => {
  const world = new World({ width: 5, height: 4 });
  const tile = world.getTile(3, 2);

  assert.ok(tile instanceof Tile);
  assert.equal(world.getTileById(tile.id), tile);
  assert.equal(world.getTile(3, 2), tile);
  assert.equal([...world.getTiles()].find((item) => item.id === tile.id), tile);
});

test("world lookup safely returns null for invalid or unknown coordinates and IDs", () => {
  const world = new World({ width: 3, height: 2 });

  for (const [x, y] of [
    [-1, 0], [0, -1], [3, 0], [0, 2], [1.5, 1], [1, NaN], [Infinity, 0]
  ]) {
    assert.equal(world.getTile(x, y), null, `Expected no tile at (${x}, ${y})`);
  }

  assert.equal(world.getTileById("missing-tile"), null);
  assert.equal(world.getTileById(""), null);
  assert.equal(world.getTileById(null), null);
  assert.equal(world.getTileById(undefined), null);
});

test("tile data fields are enumerable and included in JSON serialization", () => {
  const tile = new World({ width: 1, height: 1, baseElevation: 2 }).getTile(0, 0);

  assert.deepEqual(Object.keys(tile), ["id", "x", "y", "elevation", "terrain", "walkable"]);
  assert.deepEqual(JSON.parse(JSON.stringify(tile)), {
    id: "tile-0-0",
    x: 0,
    y: 0,
    elevation: 2,
    terrain: DEFAULT_TERRAIN,
    walkable: true
  });
});

test("tile gameplay data can be changed and changes persist through world lookups", () => {
  const world = new World({ width: 2, height: 2 });
  const tile = world.getTile(1, 0);

  tile.elevation = 3;
  tile.terrain = "water";
  tile.walkable = false;

  const byCoordinates = world.getTile(1, 0);
  const byId = world.getTileById(tile.id);
  assert.equal(byCoordinates.elevation, 3);
  assert.equal(byCoordinates.terrain, "water");
  assert.equal(byCoordinates.walkable, false);
  assert.equal(byId, tile);
});

test("tile identity and grid coordinates are immutable", () => {
  const tile = new World({ width: 2, height: 2 }).getTile(1, 1);

  assert.throws(() => { tile.id = "changed"; }, TypeError);
  assert.throws(() => { tile.x = 0; }, TypeError);
  assert.throws(() => { tile.y = 0; }, TypeError);
  assert.equal(tile.id, "tile-1-1");
  assert.equal(tile.x, 1);
  assert.equal(tile.y, 1);
});

test("tile gameplay properties reject invalid values", () => {
  const tile = new Tile({ id: "tile-test", x: 0, y: 0 });

  assert.throws(() => { tile.elevation = NaN; }, TypeError);
  assert.throws(() => { tile.elevation = Infinity; }, TypeError);
  assert.throws(() => { tile.terrain = ""; }, TypeError);
  assert.throws(() => { tile.terrain = null; }, TypeError);
  assert.throws(() => { tile.walkable = 1; }, TypeError);
});

test("tile constructor rejects invalid identity and coordinates", () => {
  assert.throws(() => new Tile({ id: "", x: 0, y: 0 }), TypeError);
  assert.throws(() => new Tile({ id: "tile", x: -1, y: 0 }), TypeError);
  assert.throws(() => new Tile({ id: "tile", x: 0.5, y: 0 }), TypeError);
});
