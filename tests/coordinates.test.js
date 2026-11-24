import test from "node:test";
import assert from "node:assert/strict";
import { gridToScreen, screenToGrid } from "../src/world/coordinates.js";

const tile = { width: 64, height: 32 };

function screenPointForTile(x, y, { world, viewport, camera }) {
  const projected = gridToScreen(x + 0.5, y + 0.5, tile.width, tile.height);
  const worldCenterX = (world.width - world.height) * tile.width / 4;
  const worldCenterY = (world.width + world.height) * tile.height / 4;

  return {
    x: viewport.width / 2 + camera.x + (projected.x - worldCenterX) * camera.zoom,
    y: viewport.height / 2 + camera.y + (projected.y - worldCenterY) * camera.zoom
  };
}

test("gridToScreen maps grid coordinates to isometric coordinates", () => {
  assert.deepEqual(gridToScreen(0, 0, 64, 32), { x: 0, y: 0 });
  assert.deepEqual(gridToScreen(1, 0, 64, 32), { x: 32, y: 16 });
  assert.deepEqual(gridToScreen(0, 1, 64, 32), { x: -32, y: 16 });
  assert.deepEqual(gridToScreen(2, 3, 64, 32), { x: -32, y: 80 });
});

test("screenToGrid reverses the isometric projection at tile centres", () => {
  const world = { width: 12, height: 9 };
  const viewport = { width: 960, height: 640 };
  const camera = { x: 0, y: 0, zoom: 1 };

  for (const [x, y] of [[0, 0], [1, 0], [0, 1], [4, 3], [11, 8]]) {
    const screen = screenPointForTile(x, y, { world, viewport, camera });
    assert.deepEqual(
      screenToGrid(screen.x, screen.y, tile.width, tile.height, {
        world,
        viewport,
        camera
      }),
      { x, y }
    );
  }
});

test("screenToGrid remains accurate after camera pan and zoom", () => {
  const world = { width: 12, height: 12 };
  const viewport = { width: 1280, height: 720 };
  const cameraCases = [
    { x: 125, y: -74, zoom: 0.35 },
    { x: -210, y: 93, zoom: 0.6 },
    { x: 48.5, y: 117.25, zoom: 1.75 },
    { x: -300, y: -180, zoom: 3 }
  ];

  for (const camera of cameraCases) {
    for (const [x, y] of [[0, 0], [2, 7], [6, 6], [11, 11]]) {
      const screen = screenPointForTile(x, y, { world, viewport, camera });
      assert.deepEqual(
        screenToGrid(screen.x, screen.y, tile.width, tile.height, {
          world,
          viewport,
          camera
        }),
        { x, y },
        `tile ${x},${y} at camera ${JSON.stringify(camera)}`
      );
    }
  }
});

test("screenToGrid supports an explicit renderer translation offset", () => {
  const offset = { x: 146.25, y: -38.5 };
  const zoom = 1.4;
  const expected = { x: 3, y: 5 };
  const projected = gridToScreen(expected.x + 0.5, expected.y + 0.5, tile.width, tile.height);
  const screenX = offset.x + projected.x * zoom;
  const screenY = offset.y + projected.y * zoom;

  assert.deepEqual(
    screenToGrid(screenX, screenY, tile.width, tile.height, { offset, zoom }),
    expected
  );
});

test("screenToGrid reverses the vertical elevation offset when provided", () => {
  const world = { width: 6, height: 6 };
  const viewport = { width: 800, height: 600 };
  const camera = { x: 16, y: -12, zoom: 2.25 };
  const elevation = 3;
  const elevationStep = 16;
  const projected = gridToScreen(2.5, 4.5, tile.width, tile.height);
  const centerX = (world.width - world.height) * tile.width / 4;
  const centerY = (world.width + world.height) * tile.height / 4;
  const screenX = viewport.width / 2 + camera.x + (projected.x - centerX) * camera.zoom;
  const screenY = viewport.height / 2 + camera.y +
    (projected.y - centerY - elevation * elevationStep) * camera.zoom;

  assert.deepEqual(
    screenToGrid(screenX, screenY, tile.width, tile.height, {
      world,
      viewport,
      camera,
      elevation,
      elevationStep
    }),
    { x: 2, y: 4 }
  );
});

test("screenToGrid returns null for invalid input and invalid zoom", () => {
  assert.equal(screenToGrid(Number.NaN, 10, 64, 32), null);
  assert.equal(screenToGrid(10, 10, 0, 32), null);
  assert.equal(screenToGrid(10, 10, 64, 32, { zoom: 0 }), null);
  assert.equal(screenToGrid(10, 10, 64, 32, { offset: { x: Infinity, y: 0 } }), null);
});
