import test from "node:test";
import assert from "node:assert/strict";
import { Grid } from "../src/world/grid.js";
import { World } from "../src/world/world.js";

test("grid yields every cell exactly once in nondecreasing diagonal order", () => {
  const width = 12;
  const height = 9;
  const tiles = [...new Grid(width, height).tiles()];
  const keys = tiles.map(({ x, y }) => `${x},${y}`);
  const diagonalSums = tiles.map(({ x, y }) => x + y);

  assert.equal(tiles.length, width * height);
  assert.equal(new Set(keys).size, width * height);
  assert.ok(tiles.every(({ x, y }) => x >= 0 && x < width && y >= 0 && y < height));
  assert.deepEqual(diagonalSums, [...diagonalSums].sort((a, b) => a - b));
});

test("world assigns its configured base elevation to every tile", () => {
  const tiles = [...new World({ width: 3, height: 2, baseElevation: 2 }).getTiles()];
  assert.equal(tiles.length, 6);
  assert.ok(tiles.every((tile) => tile.elevation === 2));
});

test("world defaults base elevation to zero", () => {
  const tiles = [...new World({ width: 2, height: 2 }).getTiles()];
  assert.ok(tiles.every((tile) => tile.elevation === 0));
});
