import test from "node:test";
import assert from "node:assert/strict";
import { Camera } from "../src/camera/camera.js";
import { World } from "../src/world/world.js";

test("camera pans by screen-space deltas", () => {
  const camera = new Camera({ x: 4, y: -3, zoom: 1 });
  assert.equal(camera.panBy(12, 8), true);
  assert.equal(camera.x, 16);
  assert.equal(camera.y, 5);
  assert.equal(camera.panBy(0, 0), false);
  assert.equal(camera.panBy(Number.NaN, 1), false);
});

test("bounded pan stops when only one full diamond tile can remain visible", () => {
  const camera = new Camera({ x: 0, y: 0, zoom: 1, minZoom: 0.35, maxZoom: 3 });
  const bounds = {
    world: new World({ width: 2, height: 2 }),
    tile: { width: 64, height: 32, elevationStep: 16 },
    viewportWidth: 200,
    viewportHeight: 100
  };

  assert.equal(camera.panBy(200, 0, bounds), true);
  assert.ok(Math.abs(camera.x - 100) < 1e-8);
  assert.equal(camera.panBy(20, 0, bounds), false);
  assert.ok(Math.abs(camera.x - 100) < 1e-8);

  assert.equal(camera.panBy(-300, 0, bounds), true);
  assert.ok(Math.abs(camera.x + 100) < 1e-8);
});

test("camera keeps at least one full tile visible after zoom when geometrically possible", () => {
  const camera = new Camera({ x: 0, y: 0, zoom: 1, minZoom: 0.35, maxZoom: 3 });
  const bounds = {
    world: new World({ width: 2, height: 2 }),
    tile: { width: 64, height: 32, elevationStep: 16 },
    viewportWidth: 320,
    viewportHeight: 200
  };

  camera.zoomAt(300, 180, 2, bounds.viewportWidth, bounds.viewportHeight);
  assert.equal(camera.constrainToVisibleTile(bounds), true);
  assert.ok(bounds.world.getTiles().some(({ x, y, elevation = 0 }) => {
    const pX = (x - y) * bounds.tile.width / 2;
    const pY = (x + y) * bounds.tile.height / 2;
    const centerX = (bounds.world.width - bounds.world.height) * bounds.tile.width / 4;
    const centerY = (bounds.world.width + bounds.world.height) * bounds.tile.height / 4;
    const left = bounds.viewportWidth / 2 + camera.x + (pX - centerX) * camera.zoom - bounds.tile.width * camera.zoom / 2;
    const right = left + bounds.tile.width * camera.zoom;
    const top = bounds.viewportHeight / 2 + camera.y + (pY - centerY - elevation * bounds.tile.elevationStep) * camera.zoom;
    const bottom = top + bounds.tile.height * camera.zoom;
    return left >= -1e-7 && right <= bounds.viewportWidth + 1e-7 && top >= -1e-7 && bottom <= bounds.viewportHeight + 1e-7;
  }));
});

test("zoom keeps the point under the cursor stationary", () => {
  const camera = new Camera({ x: 20, y: -10, zoom: 1, minZoom: 0.5, maxZoom: 3 });
  const screenX = 150;
  const screenY = 100;
  const viewportWidth = 400;
  const viewportHeight = 300;
  const relativeWorldX = (screenX - viewportWidth / 2 - camera.x) / camera.zoom;
  const relativeWorldY = (screenY - viewportHeight / 2 - camera.y) / camera.zoom;

  assert.equal(camera.zoomAt(screenX, screenY, 2, viewportWidth, viewportHeight), true);
  assert.equal(camera.zoom, 2);
  assert.ok(Math.abs(viewportWidth / 2 + camera.x + camera.zoom * relativeWorldX - screenX) < 1e-10);
  assert.ok(Math.abs(viewportHeight / 2 + camera.y + camera.zoom * relativeWorldY - screenY) < 1e-10);
});

test("camera clamps zoom and ignores invalid zoom input", () => {
  const camera = new Camera({ zoom: 10, minZoom: 0.5, maxZoom: 2 });
  assert.equal(camera.zoom, 2);
  assert.equal(camera.zoomAt(20, 20, 10, 100, 100), false);
  assert.equal(camera.zoomAt(20, 20, Number.NaN, 100, 100), false);
  assert.equal(camera.zoomAt(20, 20, 0.1, 100, 100), true);
  assert.equal(camera.zoom, 0.5);
});
