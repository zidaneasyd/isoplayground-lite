import test from "node:test";
import assert from "node:assert/strict";
import { Engine } from "../src/core/engine.js";
import { CONFIG } from "../src/core/config.js";
import { WorldObject } from "../src/objects/world-object.js";
import { resolveObjectElevation } from "../src/objects/object-elevation.js";

function makeCanvas() {
  const listeners = new Map();
  const calls = [];
  const ctx = {};
  for (const method of [
    "setTransform", "clearRect", "fillRect", "save", "translate", "scale",
    "beginPath", "moveTo", "lineTo", "closePath", "fill", "stroke", "restore", "drawImage"
  ]) ctx[method] = (...args) => calls.push([method, ...args]);

  return {
    calls,
    listeners,
    canvas: {
      clientWidth: 640,
      clientHeight: 480,
      width: 0,
      height: 0,
      getContext: () => ctx,
      addEventListener: (name, fn) => listeners.set(name, fn),
      removeEventListener: (name) => listeners.delete(name),
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 640, height: 480 }),
      setPointerCapture() {},
      classList: { add() {}, remove() {} }
    }
  };
}

function withWindow(run) {
  const originalWindow = globalThis.window;
  globalThis.window = {
    devicePixelRatio: 1,
    addEventListener() {},
    removeEventListener() {}
  };
  try { run(); }
  finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
}

test("Level 3 workflow integrates placement, footprint, object selection, move, and deletion", () => {
  withWindow(() => {
    const { canvas } = makeCanvas();
    const selectionEvents = [];
    const engine = new Engine(canvas, CONFIG, {
      onObjectSelectionChange: (object) => selectionEvents.push(object?.id ?? null)
    });

    const object = new WorldObject({
      id: "building-1", type: "building", name: "Workshop", x: 2, y: 3,
      footprint: { width: 2, height: 3 }, properties: { owner: "player" }
    });
    assert.equal(engine.beginObjectPlacement(object), true);
    engine.objectPlacement.updatePreview(2, 3);
    assert.equal(engine.getObjectPlacementPreview().valid, true);
    assert.equal(engine.confirmObjectPlacement(), object);
    assert.equal(engine.world.objects.getById(object.id), object);
    assert.equal(engine.getSelectedObject(), object);
    assert.deepEqual(selectionEvents, ["building-1"]);

    const coveredCell = engine.objectSelection.selectAt(3, 5);
    assert.equal(coveredCell, object, "setiap cell footprint harus menunjuk objek yang sama");

    assert.equal(engine.beginObjectMove(object.id), true);
    engine.objectPlacement.updatePreview(6, 4);
    assert.equal(engine.getObjectPlacementPreview().valid, true);
    assert.equal(object.x, 2, "anchor tidak berubah sebelum move dikonfirmasi");
    assert.equal(engine.confirmObjectPlacement(), object);
    assert.deepEqual({ x: object.x, y: object.y }, { x: 6, y: 4 });
    assert.equal(engine.world.objects.size, 1);

    assert.equal(engine.removeWorldObject(object.id), true);
    assert.equal(engine.world.objects.size, 0);
    assert.equal(engine.getSelectedObject(), null);
    assert.deepEqual(selectionEvents, ["building-1", null]);
    assert.equal(engine.removeWorldObject(object.id), false);
    engine.destroy();
  });
});

test("object placement and move remain atomic when footprint is outside world bounds", () => {
  withWindow(() => {
    const { canvas } = makeCanvas();
    const engine = new Engine(canvas, CONFIG);
    const object = new WorldObject({
      id: "large-object", type: "structure", x: 1, y: 1,
      footprint: { width: 3, height: 2 }
    });

    engine.beginObjectPlacement(object);
    engine.objectPlacement.updatePreview(11, 10);
    assert.equal(engine.getObjectPlacementPreview().valid, false);
    assert.equal(engine.confirmObjectPlacement(), false);
    assert.equal(engine.world.objects.has(object.id), false);
    engine.objectPlacement.updatePreview(4, 4);
    assert.equal(engine.confirmObjectPlacement(), object);

    engine.beginObjectMove(object.id);
    engine.objectPlacement.updatePreview(11, 10);
    assert.equal(engine.confirmObjectPlacement(), false);
    assert.deepEqual({ x: object.x, y: object.y }, { x: 4, y: 4 });
    assert.equal(engine.world.objects.getById(object.id), object);
    engine.cancelObjectPlacement();
    engine.destroy();
  });
});

test("object elevation follows its anchor tile while preserving its relative offset through move", () => {
  withWindow(() => {
    const { canvas } = makeCanvas();
    const engine = new Engine(canvas, CONFIG);
    const object = new WorldObject({
      id: "tower", type: "building", x: 2, y: 2, elevationOffset: 1.5
    });

    engine.beginObjectPlacement(object);
    engine.objectPlacement.updatePreview(2, 2);
    engine.confirmObjectPlacement();
    engine.world.getTile(2, 2).elevation = 4;
    assert.deepEqual(resolveObjectElevation(engine.world, object), {
      anchorX: 2, anchorY: 2, anchorElevation: 4,
      elevationOffset: 1.5, elevation: 5.5
    });

    engine.beginObjectMove(object.id);
    engine.objectPlacement.updatePreview(5, 5);
    assert.equal(engine.getObjectPlacementPreview().elevation, 1.5);
    engine.confirmObjectPlacement();
    engine.world.getTile(5, 5).elevation = -2;
    assert.equal(resolveObjectElevation(engine.world, object).elevation, -0.5);
    assert.equal(object.elevationOffset, 1.5);
    engine.destroy();
  });
});

test("stored object sprites render through the same engine world after asset registration", async () => {
  const originalWindow = globalThis.window;
  globalThis.window = {
    devicePixelRatio: 1,
    addEventListener() {},
    removeEventListener() {}
  };
  try {
    await new Promise((resolve, reject) => {
      const { canvas, calls } = makeCanvas();
      const image = { width: 48, height: 64 };
      const assets = new Map();
      const assetManager = {
        load: async (id) => {
          const asset = { image, width: 48, height: 64, anchorX: 0.5, anchorY: 1, imageSmoothingEnabled: false };
          assets.set(id, asset);
          return asset;
        },
        get: (id) => assets.get(id) ?? null,
        remove: (id) => assets.delete(id),
        clear: () => assets.clear()
      };
      const engine = new Engine(canvas, CONFIG, { assetManager });
      const object = new WorldObject({
        id: "tree-1", type: "tree", x: 3, y: 3, assetId: "tree-sprite"
      });
      engine.beginObjectPlacement(object);
      engine.objectPlacement.updatePreview(3, 3);
      engine.confirmObjectPlacement();

      engine.loadSprite("tree-sprite", "tree.png").then(() => {
        assert.ok(calls.some(([method, drawnImage]) => method === "drawImage" && drawnImage === image));
        engine.removeSprite("tree-sprite");
        assert.equal(assets.has("tree-sprite"), false);
        engine.destroy();
        resolve();
      }).catch((error) => {
        engine.destroy();
        reject(error);
      });
    });
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});
