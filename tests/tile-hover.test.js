import test from "node:test";
import assert from "node:assert/strict";
import { Camera } from "../src/camera/camera.js";
import { CONFIG } from "../src/core/config.js";
import { gridToScreen, getWorldCenter } from "../src/world/coordinates.js";
import { TileHover, findTileAtScreenPoint } from "../src/interaction/tile-hover.js";
import { World } from "../src/world/world.js";

function makeView({
  width = 12,
  height = 12,
  viewportWidth = 800,
  viewportHeight = 600,
  cameraX = 0,
  cameraY = 0,
  zoom = 1
} = {}) {
  return {
    world: new World({ width, height }),
    tile: CONFIG.tile,
    camera: new Camera({ ...CONFIG.camera, x: cameraX, y: cameraY, zoom }),
    viewportWidth,
    viewportHeight
  };
}

function tileCenterOnScreen(view, tile) {
  const center = getWorldCenter(view.world, view.tile);
  const point = gridToScreen(tile.x, tile.y, view.tile.width, view.tile.height);
  return {
    x: view.viewportWidth / 2 + view.camera.x + (point.x - center.x) * view.camera.zoom,
    y: view.viewportHeight / 2 + view.camera.y + (
      point.y - tile.elevation * view.tile.elevationStep + view.tile.height / 2 - center.y
    ) * view.camera.zoom
  };
}

const CAMERA_CASES = [
  { zoom: 0.35, cameraX: 0, cameraY: 0 },
  { zoom: 0.75, cameraX: -40, cameraY: 25 },
  { zoom: 1, cameraX: 30, cameraY: -20 },
  { zoom: 1.8, cameraX: 85, cameraY: -55 },
  { zoom: 3, cameraX: -120, cameraY: 90, viewportWidth: 1280, viewportHeight: 720 }
];

test("tile hover finds the correct tile center across camera pan, zoom, and viewport sizes", () => {
  for (const camera of CAMERA_CASES) {
    const view = makeView(camera);
    for (const tile of view.world.getTiles()) {
      const point = tileCenterOnScreen(view, tile);
      assert.equal(
        findTileAtScreenPoint(point.x, point.y, view),
        tile,
        `failed for ${tile.id} with camera ${JSON.stringify(camera)}`
      );
    }
  }
});

test("tile hover accounts for each tile elevation and selects the topmost overlapping tile", () => {
  const view = makeView({ width: 12, height: 12, cameraX: 24, cameraY: -18, zoom: 1.4 });
  const lowerTile = view.world.getTile(4, 4);
  const upperTile = view.world.getTile(5, 5);
  upperTile.elevation = 2;

  // The elevated (5,5) diamond is shifted onto the base-level center of (4,4).
  const overlapPoint = tileCenterOnScreen(view, upperTile);
  const actual = findTileAtScreenPoint(overlapPoint.x, overlapPoint.y, view);
  assert.equal(actual, upperTile);
  assert.notEqual(actual, lowerTile);
});

test("TileHover changes only its reference and clears when no tile is under the pointer", () => {
  const view = makeView();
  const hover = new TileHover();
  const target = view.world.getTile(2, 1);
  const point = tileCenterOnScreen(view, target);
  const before = {
    elevation: target.elevation,
    terrain: target.terrain,
    walkable: target.walkable,
    id: target.id
  };

  assert.equal(hover.hoveredTile, null);
  assert.equal(hover.update(point.x, point.y, view), true);
  assert.equal(hover.hoveredTile, target);
  assert.equal(hover.update(point.x, point.y, view), false);
  assert.deepEqual({
    elevation: target.elevation,
    terrain: target.terrain,
    walkable: target.walkable,
    id: target.id
  }, before);

  assert.equal(hover.update(-10000, -10000, view), true);
  assert.equal(hover.hoveredTile, null);
  assert.equal(hover.clear(), false);
});

test("tile hover rejects invalid coordinates and invalid views safely", () => {
  const view = makeView();
  assert.equal(findTileAtScreenPoint(NaN, 0, view), null);
  assert.equal(findTileAtScreenPoint(0, Infinity, view), null);
  assert.equal(findTileAtScreenPoint(0, 0, null), null);
  assert.equal(findTileAtScreenPoint(0, 0, { ...view, viewportWidth: 0 }), null);
  assert.equal(findTileAtScreenPoint(0, 0, {
    ...view,
    world: { width: 0, height: 4, getTiles: () => [] }
  }), null);
});
