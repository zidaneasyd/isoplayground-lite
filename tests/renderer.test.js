import test from "node:test";
import assert from "node:assert/strict";
import { Renderer } from "../src/rendering/renderer.js";
import { World } from "../src/world/world.js";
import { Camera } from "../src/camera/camera.js";
import { CONFIG } from "../src/core/config.js";

function makeContext() {
  const calls = [];
  const lineWidths = [];
  const fillStyles = [];
  const strokeStyles = [];
  let currentLineWidth = 1;
  const ctx = {};
  for (const method of [
    "clearRect", "fillRect", "save", "translate", "scale", "beginPath",
    "moveTo", "lineTo", "closePath", "fill", "stroke", "restore"
  ]) {
    ctx[method] = (...args) => calls.push([method, ...args]);
  }
  Object.defineProperty(ctx, "fillStyle", {
    set: (value) => { fillStyles.push(value); }
  });
  Object.defineProperty(ctx, "strokeStyle", {
    set: (value) => { strokeStyles.push(value); }
  });
  Object.defineProperty(ctx, "lineWidth", {
    get: () => currentLineWidth,
    set: (value) => { currentLineWidth = value; lineWidths.push(value); }
  });
  return { ctx, calls, lineWidths, fillStyles, strokeStyles };
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

test("grid line width compensates for zoom and stays at one CSS pixel", () => {
  const { ctx, lineWidths } = makeContext();
  const renderer = new Renderer(ctx, CONFIG);
  renderer.setViewport(640, 480);
  const world = new World({ width: 2, height: 2 });
  const camera = new Camera({ zoom: 2, minZoom: 0.5, maxZoom: 3 });

  renderer.render(world, camera);
  assert.ok(lineWidths.every((width) => width === 0.5));

  lineWidths.length = 0;
  camera.zoom = 0.5;
  renderer.render(world, camera);
  assert.ok(lineWidths.every((width) => width === 2));
});


test("renderer reads mutable per-tile elevation from persistent world data", () => {
  const { ctx, calls } = makeContext();
  const renderer = new Renderer(ctx, CONFIG);
  renderer.setViewport(640, 480);
  const world = new World({ width: 2, height: 2 });
  const tile = world.getTile(0, 0);
  tile.elevation = 2;

  renderer.render(world, new Camera({ zoom: 1 }));

  // The first tile is (0, 0); its top vertex is raised by 2 * 16 world pixels.
  assert.deepEqual(calls.find(([name]) => name === "moveTo"), ["moveTo", 0, -32]);
  assert.equal(world.getTileById(tile.id).elevation, 2);
});


test("renderer highlights only the hovered tile with a distinct fill and outline", () => {
  const { ctx, lineWidths, fillStyles, strokeStyles } = makeContext();
  const renderer = new Renderer(ctx, CONFIG);
  renderer.setViewport(640, 480);
  const world = new World({ width: 2, height: 2 });
  const camera = new Camera({ zoom: 2, minZoom: 0.5, maxZoom: 3 });

  renderer.render(world, camera, { hoveredTileId: "tile-1-0" });

  assert.equal(fillStyles.filter((style) => style === CONFIG.colors.hover).length, 1);
  assert.equal(strokeStyles.filter((style) => style === CONFIG.colors.hoverOutline).length, 1);
  assert.deepEqual(lineWidths, [0.5, 0.5, 1, 0.5]);
});
