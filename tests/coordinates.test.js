import test from "node:test";
import assert from "node:assert/strict";
import {
  getWorldCenter,
  gridToScreen,
  isometricToGrid,
  screenToGrid,
  screenToIso,
  screenToTile
} from "../src/world/coordinates.js";
import { Renderer } from "../src/rendering/renderer.js";
import { Camera } from "../src/camera/camera.js";
import { World } from "../src/world/world.js";
import { CONFIG } from "../src/core/config.js";

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

// Capture pusat poligon yang benar-benar digambar Renderer agar tes picking
// memeriksa transformasi yang sama dengan tampilan, bukan rumus duplikat.
function renderAndCaptureCenters(world, camera, config, viewportWidth, viewportHeight) {
  let tx = 0;
  let ty = 0;
  let scale = 1;
  const polygons = [];
  let current = null;
  const ctx = {
    clearRect() {}, fillRect() {}, save() {}, restore() {}, fill() {}, stroke() {},
    translate(x, y) { tx = x; ty = y; },
    scale(value) { scale = value; },
    beginPath() { current = []; },
    moveTo(x, y) { current.push([x, y]); },
    lineTo(x, y) { current.push([x, y]); },
    closePath() { polygons.push(current); }
  };

  const renderer = new Renderer(ctx, config);
  renderer.setViewport(viewportWidth, viewportHeight);
  renderer.render(world, camera);

  const tiles = [...world.getTiles()];
  return polygons.map((polygon, index) => {
    const centerX = (polygon[0][0] + polygon[2][0]) / 2;
    const centerY = (polygon[0][1] + polygon[2][1]) / 2;
    return {
      tile: tiles[index],
      sx: tx + centerX * scale,
      sy: ty + centerY * scale
    };
  });
}

const cameraStates = [
  { x: 0, y: 0, zoom: 1 },
  { x: 120, y: -45, zoom: 1 },
  { x: -200, y: 80, zoom: 0.5 },
  { x: 35.5, y: 12.25, zoom: 2.3 },
  { x: -310, y: 140, zoom: 3 },
  { x: 10, y: 10, zoom: 0.35 }
];

test("gridToScreen keeps the existing isometric coordinate convention", () => {
  assert.deepEqual(gridToScreen(0, 0, 64, 32), { x: 0, y: 0 });
  assert.deepEqual(gridToScreen(1, 0, 64, 32), { x: 32, y: 16 });
  assert.deepEqual(gridToScreen(0, 1, 64, 32), { x: -32, y: 16 });
  assert.deepEqual(gridToScreen(2, 3, 64, 32), { x: -32, y: 80 });
});

test("isometricToGrid is the mathematical inverse of gridToScreen", () => {
  for (let x = -3; x < 15; x++) {
    for (let y = -3; y < 15; y++) {
      const point = gridToScreen(x, y, 64, 32);
      const grid = isometricToGrid(point.x, point.y, 64, 32);
      near(grid.x, x);
      near(grid.y, y);
    }
  }
  assert.equal(isometricToGrid(NaN, 0, 64, 32), null);
  assert.equal(isometricToGrid(0, Infinity, 64, 32), null);
  assert.equal(isometricToGrid(0, 0, 0, 32), null);
  assert.equal(isometricToGrid(0, 0, 64, -1), null);
});

test("screenToGrid and screenToTile match Renderer for every tile across pan, zoom, viewport, and elevation", () => {
  for (const baseElevation of [0, 2, -1]) {
    const world = new World({ ...CONFIG.world, baseElevation });
    for (const [viewportWidth, viewportHeight] of [[800, 600], [1280, 720]]) {
      for (const cameraState of cameraStates) {
        const camera = new Camera({ ...CONFIG.camera, ...cameraState });
        const view = {
          camera,
          world,
          tile: CONFIG.tile,
          viewportWidth,
          viewportHeight
          // Tidak mengirim elevation untuk memastikan baseElevation dipakai.
        };
        const centers = renderAndCaptureCenters(world, camera, CONFIG, viewportWidth, viewportHeight);
        assert.equal(centers.length, world.width * world.height);

        for (const { tile, sx, sy } of centers) {
          const grid = screenToGrid(sx, sy, view);
          near(grid.x, tile.x);
          near(grid.y, tile.y);
          assert.deepEqual(screenToTile(sx, sy, view), { x: tile.x, y: tile.y });

          const dx = 0.4 * camera.zoom * CONFIG.tile.width / 2;
          const dy = 0.4 * camera.zoom * CONFIG.tile.height / 2;
          for (const [offsetX, offsetY] of [[dx, 0], [-dx, 0], [0, dy], [0, -dy]]) {
            assert.deepEqual(
              screenToTile(sx + offsetX, sy + offsetY, view),
              { x: tile.x, y: tile.y }
            );
          }
        }
      }
    }
  }
});

test("screenToTile applies deterministic half-open tile boundary rules", () => {
  const world = new World(CONFIG.world);
  const camera = new Camera({ ...CONFIG.camera, x: 40, y: -20, zoom: 1.7 });
  const view = { camera, world, tile: CONFIG.tile, viewportWidth: 800, viewportHeight: 600 };
  const { sx, sy } = renderAndCaptureCenters(world, camera, CONFIG, 800, 600)
    .find(({ tile }) => tile.x === 5 && tile.y === 5);
  const halfWidth = camera.zoom * CONFIG.tile.width / 2;

  assert.deepEqual(screenToTile(sx + halfWidth * 0.98, sy, view), { x: 5, y: 5 });
  assert.notDeepEqual(screenToTile(sx + halfWidth * 1.02, sy, view), { x: 5, y: 5 });

  // Batas tepat dimiliki indeks yang lebih besar pada sumbu terkait.
  assert.deepEqual(screenToTile(sx + halfWidth, sy, view), { x: 6, y: 5 });
  assert.deepEqual(screenToTile(sx - halfWidth, sy, view), { x: 5, y: 6 });

  // Menyeberangi sisi bawah-kanan masuk ke tile dengan indeks X lebih besar.
  const neighbour = screenToTile(
    sx + halfWidth * 0.5 + 2,
    sy + camera.zoom * CONFIG.tile.height * 0.25 + 2,
    view
  );
  assert.deepEqual(neighbour, { x: 6, y: 5 });
});

test("screenToGrid and screenToTile reject points outside the world and invalid views", () => {
  const world = new World(CONFIG.world);
  const camera = new Camera(CONFIG.camera);
  const view = { camera, world, tile: CONFIG.tile, viewportWidth: 800, viewportHeight: 600 };

  const outsideGrid = screenToGrid(-500, -500, view);
  assert.ok(Number.isFinite(outsideGrid.x) && Number.isFinite(outsideGrid.y));
  assert.equal(screenToTile(-500, -500, view), null);
  assert.equal(screenToTile(5000, 300, view), null);
  assert.equal(screenToTile(400, 5000, view), null);
  assert.equal(screenToGrid(NaN, 10, view), null);
  assert.equal(screenToGrid(10, Infinity, view), null);
  assert.equal(screenToGrid(10, 10, null), null);
  assert.equal(screenToTile(10, 10, null), null);
  assert.equal(screenToIso(10, 10, null), null);
  assert.equal(screenToGrid(10, 10, { ...view, viewportWidth: 0 }), null);
  assert.equal(screenToGrid(10, 10, { ...view, viewportHeight: NaN }), null);
  assert.equal(screenToGrid(10, 10, { ...view, tile: { width: 0, height: 32 } }), null);
  assert.equal(screenToGrid(10, 10, { ...view, world: { width: NaN, height: 12 } }), null);
  assert.equal(screenToGrid(10, 10, { ...view, camera: { x: 0, y: 0, zoom: 0 } }), null);
  assert.equal(screenToGrid(10, 10, { ...view, elevation: Infinity }), null);
  assert.equal(screenToGrid(10, 10, { ...view, tile: { ...CONFIG.tile, elevationStep: NaN } }), null);

  const center = getWorldCenter(world, CONFIG.tile);
  assert.deepEqual(center, { x: 0, y: 192 });
  assert.equal(getWorldCenter(null, CONFIG.tile), null);
  assert.equal(getWorldCenter(world, { width: 0, height: 32 }), null);
});

test("screenToIso reverses pan and zoomAt without moving the point under the cursor", () => {
  const world = new World(CONFIG.world);
  const camera = new Camera({ ...CONFIG.camera, x: -60, y: 35, zoom: 1.2 });
  const view = { world, tile: CONFIG.tile, camera, viewportWidth: 800, viewportHeight: 600 };
  const before = screenToIso(321, 222, view);

  camera.zoomAt(321, 222, 1.8, 800, 600);
  const after = screenToIso(321, 222, view);
  near(before.x, after.x);
  near(before.y, after.y);

  const center = getWorldCenter(world, CONFIG.tile);
  const middle = screenToIso(400, 300, {
    ...view,
    camera: { x: 0, y: 0, zoom: 1 }
  });
  near(middle.x, center.x);
  near(middle.y, center.y);
});

test("screenToGrid supports non-square worlds and non-default tile dimensions", () => {
  const tile = { width: 96, height: 48, elevationStep: 12 };
  const world = new World({ width: 5, height: 9, baseElevation: 3 });
  const camera = new Camera({ x: 73, y: -42, zoom: 1.65, minZoom: 0.35, maxZoom: 3 });
  const config = { ...CONFIG, tile };
  const viewportWidth = 1024;
  const viewportHeight = 768;
  const view = { camera, world, tile, viewportWidth, viewportHeight };
  const centers = renderAndCaptureCenters(world, camera, config, viewportWidth, viewportHeight);

  for (const { tile: cell, sx, sy } of centers) {
    const grid = screenToGrid(sx, sy, view);
    near(grid.x, cell.x);
    near(grid.y, cell.y);
    assert.deepEqual(screenToTile(sx, sy, view), { x: cell.x, y: cell.y });
  }
});
