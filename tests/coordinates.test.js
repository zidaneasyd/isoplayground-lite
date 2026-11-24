import test from "node:test";
import assert from "node:assert/strict";
import { gridToScreen } from "../src/world/coordinates.js";

test("gridToScreen maps grid coordinates to isometric coordinates", () => {
  assert.deepEqual(gridToScreen(0, 0, 64, 32), { x: 0, y: 0 });
  assert.deepEqual(gridToScreen(1, 0, 64, 32), { x: 32, y: 16 });
  assert.deepEqual(gridToScreen(0, 1, 64, 32), { x: -32, y: 16 });
  assert.deepEqual(gridToScreen(2, 3, 64, 32), { x: -32, y: 80 });
});
