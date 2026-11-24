import test from "node:test";
import assert from "node:assert/strict";
import { Engine } from "../src/core/engine.js";
import { CONFIG } from "../src/core/config.js";
import { gridToScreen } from "../src/world/coordinates.js";

function makeCanvas() {
  const listeners = new Map();
  const calls = [];
  const classNames = new Set();
  const ctx = {};
  for (const method of [
    "setTransform", "clearRect", "fillRect", "save", "translate", "scale",
    "beginPath", "moveTo", "lineTo", "closePath", "fill", "stroke", "restore"
  ]) {
    ctx[method] = (...args) => calls.push([method, ...args]);
  }

  return {
    canvas: {
      clientWidth: 640,
      clientHeight: 480,
      width: 0,
      height: 0,
      getContext: () => ctx,
      addEventListener: (name, fn) => listeners.set(name, fn),
      removeEventListener: (name) => listeners.delete(name),
      getBoundingClientRect: () => ({ left: 50, top: 100, width: 640, height: 480 }),
      setPointerCapture: () => {},
      classList: {
        add: (name) => classNames.add(name),
        remove: (name) => classNames.delete(name)
      }
    },
    listeners,
    calls,
    classNames
  };
}

test("engine wires drag pan, cursor-centered wheel zoom, resize, and cleanup", () => {
  const originalWindow = globalThis.window;
  const windowListeners = new Map();
  globalThis.window = {
    devicePixelRatio: 2,
    addEventListener: (name, fn) => windowListeners.set(name, fn),
    removeEventListener: (name) => windowListeners.delete(name)
  };

  try {
    const { canvas, listeners, calls, classNames } = makeCanvas();
    const engine = new Engine(canvas, CONFIG);
    assert.equal(canvas.width, 1280);
    assert.equal(canvas.height, 960);

    listeners.get("pointerdown")({ button: 0, pointerId: 7, clientX: 100, clientY: 100 });
    assert.ok(classNames.has("is-dragging"));
    listeners.get("pointermove")({ pointerId: 7, clientX: 120, clientY: 135 });
    assert.equal(engine.camera.x, 20);
    assert.equal(engine.camera.y, 35);
    listeners.get("pointerup")({ pointerId: 7 });
    assert.ok(!classNames.has("is-dragging"));

    let prevented = false;
    listeners.get("wheel")({
      deltaY: -200,
      clientX: 250,
      clientY: 280,
      preventDefault: () => { prevented = true; }
    });
    assert.equal(prevented, true);
    assert.ok(engine.camera.zoom > 1);
    assert.ok(calls.some(([name]) => name === "scale"));

    canvas.clientWidth = 800;
    canvas.clientHeight = 600;
    windowListeners.get("resize")();
    assert.equal(canvas.width, 1600);
    assert.equal(canvas.height, 1200);

    engine.destroy();
    assert.equal(windowListeners.has("resize"), false);
    assert.equal(listeners.size, 0);
    assert.equal(engine.destroyed, true);
    engine.destroy();
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

test("engine converts client mouse coordinates using camera pan, zoom, and world centre", () => {
  const originalWindow = globalThis.window;
  globalThis.window = {
    devicePixelRatio: 1,
    addEventListener: () => {},
    removeEventListener: () => {}
  };

  try {
    const { canvas, listeners } = makeCanvas();
    const engine = new Engine(canvas, CONFIG);
    engine.camera.x = 73;
    engine.camera.y = -42;
    engine.camera.zoom = 1.85;

    const expected = { x: 4, y: 6 };
    const projected = gridToScreen(
      expected.x + 0.5,
      expected.y + 0.5,
      CONFIG.tile.width,
      CONFIG.tile.height
    );
    const worldCenterX = (engine.world.width - engine.world.height) * CONFIG.tile.width / 4;
    const worldCenterY = (engine.world.width + engine.world.height) * CONFIG.tile.height / 4;
    const localX = engine.renderer.width / 2 + engine.camera.x +
      (projected.x - worldCenterX) * engine.camera.zoom;
    const localY = engine.renderer.height / 2 + engine.camera.y +
      (projected.y - worldCenterY) * engine.camera.zoom;
    const clientX = 50 + localX;
    const clientY = 100 + localY;

    assert.deepEqual(engine.screenToGrid(clientX, clientY), expected);
    listeners.get("pointermove")({ pointerId: 12, clientX, clientY });
    assert.deepEqual(engine.pointerGrid, expected);

    listeners.get("pointerleave")();
    assert.equal(engine.pointerGrid, null);

    engine.destroy();
    assert.equal(listeners.size, 0);
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

test("engine hit-tests tiles using their individual elevation data", () => {
  const originalWindow = globalThis.window;
  globalThis.window = {
    devicePixelRatio: 1,
    addEventListener: () => {},
    removeEventListener: () => {}
  };

  try {
    const { canvas } = makeCanvas();
    const engine = new Engine(canvas, CONFIG);
    const elevation = 2;
    engine.world.setTile(0, 0, { elevation });

    const projected = gridToScreen(0.5, 0.5, CONFIG.tile.width, CONFIG.tile.height);
    const worldCenterX = (engine.world.width - engine.world.height) * CONFIG.tile.width / 4;
    const worldCenterY = (engine.world.width + engine.world.height) * CONFIG.tile.height / 4;
    const localX = engine.renderer.width / 2 + engine.camera.x +
      (projected.x - worldCenterX) * engine.camera.zoom;
    const localY = engine.renderer.height / 2 + engine.camera.y +
      (projected.y - elevation * CONFIG.tile.elevationStep - worldCenterY) * engine.camera.zoom;

    assert.deepEqual(engine.screenToGrid(50 + localX, 100 + localY), { x: 0, y: 0 });
    engine.destroy();
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});
