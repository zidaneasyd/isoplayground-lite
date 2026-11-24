import test from "node:test";
import assert from "node:assert/strict";
import { Camera } from "../src/camera/camera.js";

test("camera pans by screen-space deltas", () => {
  const camera = new Camera({ x: 4, y: -3, zoom: 1 });
  assert.equal(camera.panBy(12, 8), true);
  assert.equal(camera.x, 16);
  assert.equal(camera.y, 5);
  assert.equal(camera.panBy(0, 0), false);
  assert.equal(camera.panBy(Number.NaN, 1), false);
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
