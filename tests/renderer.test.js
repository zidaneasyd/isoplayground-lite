import test from "node:test";
import assert from "node:assert/strict";
import { Renderer } from "../src/rendering/renderer.js";
import { World } from "../src/world/world.js";
import { Camera } from "../src/camera/camera.js";
import { CONFIG } from "../src/core/config.js";

function makeContext() {
  const calls = [];
  const ctx = {};
  for (const method of [
    "clearRect", "fillRect", "save", "translate", "scale", "beginPath",
    "moveTo", "lineTo", "closePath", "fill", "stroke", "restore"
  ]) {
    ctx[method] = (...args) => calls.push([method, ...args]);
  }
  return { ctx, calls };
}

test("renderer centers the world correctly at non-unit zoom", () => {
  const { ctx, calls } = makeContext();
  const renderer = new Renderer(ctx, CONFIG);
  renderer.setViewport(200, 100);
  const world = new World({ width: 2, height: 2 });
  const camera = new Camera({ x: 10, y: -5, zoom: 2, minZoom: 0.5, maxZoom: 3 });

  renderer.render(world, camera);

  assert.ok(calls.some(([name, x, y]) => name === "translate" && x === 110 && y === -19));
  assert.ok(calls.some(([name, x, y]) => name === "scale" && x === 2 && y === 2));
  assert.equal(calls.filter(([name]) => name === "beginPath").length, 4);
  assert.equal(calls.filter(([name]) => name === "fill").length, 4);
  assert.equal(calls.filter(([name]) => name === "stroke").length, 4);
});
