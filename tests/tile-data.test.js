import test from "node:test";
import assert from "node:assert/strict";
import { Tile } from "../src/world/tile.js";
import { World } from "../src/world/world.js";

test("world creates persistent tile data with configured defaults", () => {
  const world = new World({
    width: 3,
    height: 2,
    baseElevation: 2,
    defaultTerrain: "grass",
    defaultWalkable: false
  });

  const tiles = [...world.getTiles()];
  assert.equal(tiles.length, 6);
  assert.ok(tiles.every((tile) => tile instanceof Tile));
  assert.ok(tiles.every((tile) => tile.terrain === "grass"));
  assert.ok(tiles.every((tile) => tile.elevation === 2));
  assert.ok(tiles.every((tile) => tile.walkable === false));
  assert.equal(world.getTile(1, 1), tiles.find((tile) => tile.x === 1 && tile.y === 1));
});

test("world updates tile properties without replacing the tile record", () => {
  const world = new World({ width: 2, height: 2 });
  const tile = world.getTile(1, 0);

  const updated = world.setTile(1, 0, {
    terrain: "water",
    elevation: 3,
    walkable: false,
    data: { resource: "ore", variation: 2 }
  });

  assert.equal(updated, tile);
  assert.equal(world.getTile(1, 0), tile);
  assert.deepEqual(
    {
      x: tile.x,
      y: tile.y,
      terrain: tile.terrain,
      elevation: tile.elevation,
      walkable: tile.walkable,
      data: tile.data
    },
    {
      x: 1,
      y: 0,
      terrain: "water",
      elevation: 3,
      walkable: false,
      data: { resource: "ore", variation: 2 }
    }
  );
});

test("tile data updates merge custom data and preserve omitted properties", () => {
  const tile = new Tile({
    x: 4,
    y: 5,
    terrain: "sand",
    elevation: 1,
    data: { biome: "desert", seed: 17 }
  });

  tile.update({ data: { seed: 21, decoration: "cactus" } });

  assert.equal(tile.terrain, "sand");
  assert.equal(tile.elevation, 1);
  assert.deepEqual(tile.data, {
    biome: "desert",
    seed: 21,
    decoration: "cactus"
  });
});

test("world returns null for out-of-bounds tile coordinates", () => {
  const world = new World({ width: 2, height: 3 });
  assert.equal(world.getTile(-1, 0), null);
  assert.equal(world.getTile(0, 3), null);
  assert.equal(world.getTile(1.5, 1), null);
  assert.equal(world.setTile(3, 0, { terrain: "rock" }), null);
});

test("tile rejects invalid property values", () => {
  assert.throws(() => new Tile({ x: 0.5, y: 0 }), TypeError);
  const tile = new Tile({ x: 0, y: 0 });
  assert.throws(() => tile.update({ elevation: Number.NaN }), TypeError);
  assert.throws(() => tile.update({ walkable: "yes" }), TypeError);
  assert.throws(() => tile.update({ data: [] }), TypeError);
  assert.throws(() => tile.update({ terrain: "rock", elevation: Number.NaN }), TypeError);
  assert.equal(tile.terrain, "ground");
  assert.equal(tile.elevation, 0);
});
