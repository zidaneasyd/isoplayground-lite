import test from "node:test";
import assert from "node:assert/strict";
import { Engine } from "../src/core/engine.js";
import { CONFIG } from "../src/core/config.js";
import { gridToScreen, getWorldCenter } from "../src/world/coordinates.js";

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

test("engine wires bounded drag pan, cursor-centered wheel zoom, resize, and cleanup", () => {
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


test("engine exposes continuous grid coordinates and scales client coordinates to the canvas", () => {
  const originalWindow = globalThis.window;
  globalThis.window = {
    devicePixelRatio: 1,
    addEventListener: () => {},
    removeEventListener: () => {}
  };

  try {
    const { canvas } = makeCanvas();
    const engine = new Engine(canvas, CONFIG);
    const cameraBefore = { x: engine.camera.x, y: engine.camera.y, zoom: engine.camera.zoom };

    // Canvas dirender pada setengah ukuran CSS dari viewport internal renderer.
    canvas.getBoundingClientRect = () => ({ left: 50, top: 100, width: 320, height: 240 });
    assert.deepEqual(engine.clientToCanvas(210, 228), { x: 320, y: 256 });
    assert.deepEqual(engine.getGridAtClient(210, 228), { x: 6, y: 6 });
    assert.deepEqual(engine.getTileAtClient(210, 228), { x: 6, y: 6 });

    assert.equal(engine.clientToCanvas(49, 220), null);
    assert.equal(engine.clientToCanvas(370.1, 220), null);
    assert.equal(engine.getGridAtClient(NaN, 220), null);
    assert.equal(engine.getTileAtClient(210, Infinity), null);

    canvas.getBoundingClientRect = () => ({ left: 50, top: 100, width: 0, height: 240 });
    assert.equal(engine.getTileAtClient(50, 220), null);

    assert.deepEqual(
      { x: engine.camera.x, y: engine.camera.y, zoom: engine.camera.zoom },
      cameraBefore,
      "coordinate queries must not mutate camera state"
    );
    engine.destroy();
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

test("engine keeps drag and cursor-centered zoom aligned when CSS scales the canvas", () => {
  const originalWindow = globalThis.window;
  globalThis.window = {
    devicePixelRatio: 1,
    addEventListener: () => {},
    removeEventListener: () => {}
  };

  try {
    const { canvas, listeners } = makeCanvas();
    const engine = new Engine(canvas, CONFIG);
    canvas.getBoundingClientRect = () => ({ left: 50, top: 100, width: 320, height: 240 });

    listeners.get("pointerdown")({ button: 0, pointerId: 22, clientX: 200, clientY: 200 });
    listeners.get("pointermove")({ pointerId: 22, clientX: 210, clientY: 195 });
    listeners.get("pointerup")({ pointerId: 22 });
    assert.equal(engine.camera.x, 20);
    assert.equal(engine.camera.y, -10);

    const cursor = { x: 210, y: 228 };
    const beforeZoom = engine.getGridAtClient(cursor.x, cursor.y);
    listeners.get("wheel")({
      deltaY: -200,
      clientX: cursor.x,
      clientY: cursor.y,
      preventDefault() {}
    });
    const afterZoom = engine.getGridAtClient(cursor.x, cursor.y);
    assert.ok(engine.camera.zoom > 1);
    assert.ok(Math.abs(afterZoom.x - beforeZoom.x) < 1e-8);
    assert.ok(Math.abs(afterZoom.y - beforeZoom.y) < 1e-8);

    engine.destroy();
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

test("engine.getTileAtClient resolves pointer position to tile through canvas offset, pan and zoom", () => {
  const originalWindow = globalThis.window;
  globalThis.window = {
    devicePixelRatio: 1,
    addEventListener: () => {},
    removeEventListener: () => {}
  };

  try {
    const { canvas, listeners } = makeCanvas(); // canvas 640x480 di (50, 100)
    const engine = new Engine(canvas, CONFIG);

    // Pusat layar = pusat dunia (6,6 batas) -> tile (5,5)/(6,6) berbagi sudut; geser ke pusat tile (6,6).
    const centerClientX = 50 + 320;
    const centerClientY = 100 + 240;
    const tileCenter = (gx, gy, cam) => {
      const worldCenterX = 0;
      const worldCenterY = (12 + 12) * 32 / 4;
      const px = (gx - gy) * 32;
      const py = (gx + gy) * 16 + 16;
      return {
        x: centerClientX + (px - worldCenterX) * cam.zoom + cam.x,
        y: centerClientY + (py - worldCenterY) * cam.zoom + cam.y
      };
    };
    const p0 = tileCenter(6, 6, engine.camera);
    assert.deepEqual(engine.getGridAtClient(p0.x, p0.y), { x: 6, y: 6 });
    assert.deepEqual(engine.getTileAtClient(p0.x, p0.y), { x: 6, y: 6 });
    const p1 = tileCenter(3, 8, engine.camera);
    assert.deepEqual(engine.getTileAtClient(p1.x, p1.y), { x: 3, y: 8 });
    assert.equal(engine.getTileAtClient(0, 0), null);

    // Setelah pan lewat event pointer, hasil konversi mengikuti kamera.
    listeners.get("pointerdown")({ button: 0, pointerId: 1, clientX: 100, clientY: 100 });
    listeners.get("pointermove")({ pointerId: 1, clientX: 140, clientY: 90 });
    listeners.get("pointerup")({ pointerId: 1 });
    assert.equal(engine.camera.x, 40);
    assert.equal(engine.camera.y, -10);
    const p2 = tileCenter(2, 9, engine.camera);
    assert.deepEqual(engine.getTileAtClient(p2.x, p2.y), { x: 2, y: 9 });

    // Setelah zoom lewat wheel, hasil konversi mengikuti zoom dan posisi kamera.
    listeners.get("wheel")({ deltaY: -300, clientX: 300, clientY: 250, preventDefault() {} });
    assert.ok(engine.camera.zoom > 1);
    const p3 = tileCenter(7, 4, engine.camera);
    assert.deepEqual(engine.getTileAtClient(p3.x, p3.y), { x: 7, y: 4 });
    const p4 = tileCenter(0, 0, engine.camera);
    assert.deepEqual(engine.getTileAtClient(p4.x, p4.y), { x: 0, y: 0 });

    engine.destroy();
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});


function getTileClientCenter(engine, canvas, tile) {
  const view = engine.getView();
  const center = getWorldCenter(view.world, view.tile);
  const point = gridToScreen(tile.x, tile.y, view.tile.width, view.tile.height);
  const screenX = view.viewportWidth / 2 + view.camera.x + (point.x - center.x) * view.camera.zoom;
  const screenY = view.viewportHeight / 2 + view.camera.y + (
    point.y - tile.elevation * view.tile.elevationStep + view.tile.height / 2 - center.y
  ) * view.camera.zoom;
  const rect = canvas.getBoundingClientRect();
  return {
    clientX: rect.left + screenX * rect.width / view.viewportWidth,
    clientY: rect.top + screenY * rect.height / view.viewportHeight
  };
}

test("engine updates hover on pointer movement and clears it outside the canvas", () => {
  const originalWindow = globalThis.window;
  globalThis.window = {
    devicePixelRatio: 1,
    addEventListener: () => {},
    removeEventListener: () => {}
  };

  try {
    const { canvas, listeners, calls } = makeCanvas();
    const engine = new Engine(canvas, CONFIG);
    // Simulate CSS scaling: logical renderer remains 640x480 while the element is 320x240.
    canvas.getBoundingClientRect = () => ({ left: 50, top: 100, width: 320, height: 240 });
    const firstTile = engine.world.getTile(6, 6);
    const firstPoint = getTileClientCenter(engine, canvas, firstTile);
    const rendersBeforeHover = calls.filter(([name]) => name === "clearRect").length;

    assert.equal(engine.getHoveredTile(), null);
    listeners.get("pointermove")({ pointerId: 10, ...firstPoint });
    assert.equal(engine.getHoveredTile(), firstTile);
    assert.equal(
      calls.filter(([name]) => name === "clearRect").length,
      rendersBeforeHover + 1,
      "hover highlight should render immediately on pointer movement"
    );

    const secondTile = engine.world.getTile(3, 7);
    const secondPoint = getTileClientCenter(engine, canvas, secondTile);
    listeners.get("pointermove")({ pointerId: 10, ...secondPoint });
    assert.equal(engine.getHoveredTile(), secondTile);

    // A point inside Canvas but outside the world must clear the highlight.
    listeners.get("pointermove")({ pointerId: 10, clientX: 51, clientY: 101 });
    assert.equal(engine.getHoveredTile(), null);

    listeners.get("pointermove")({ pointerId: 10, ...firstPoint });
    assert.equal(engine.getHoveredTile(), firstTile);
    listeners.get("pointerleave")({ pointerId: 10 });
    assert.equal(engine.getHoveredTile(), null);

    engine.destroy();
    assert.equal(listeners.has("pointerleave"), false);
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

test("engine keeps hover aligned during camera drag and cursor-centered zoom", () => {
  const originalWindow = globalThis.window;
  globalThis.window = {
    devicePixelRatio: 1,
    addEventListener: () => {},
    removeEventListener: () => {}
  };

  try {
    const { canvas, listeners } = makeCanvas();
    const engine = new Engine(canvas, CONFIG);
    const target = engine.world.getTile(6, 6);
    const start = getTileClientCenter(engine, canvas, target);

    listeners.get("pointermove")({ pointerId: 12, ...start });
    assert.equal(engine.getHoveredTile(), target);

    listeners.get("pointerdown")({
      button: 0,
      pointerId: 12,
      clientX: start.clientX,
      clientY: start.clientY
    });
    const moved = { clientX: start.clientX + 12, clientY: start.clientY + 8 };
    listeners.get("pointermove")({ pointerId: 12, ...moved });
    assert.ok(engine.camera.x !== 0 || engine.camera.y !== 0);
    assert.ok(engine.getHoveredTile(), "hover should continue tracking during drag pan");
    listeners.get("pointerup")({ pointerId: 12, ...moved, type: "pointerup" });

    const zoomPoint = getTileClientCenter(engine, canvas, engine.getHoveredTile());
    const hoveredBeforeZoom = engine.getHoveredTile();
    listeners.get("wheel")({
      deltaY: -250,
      clientX: zoomPoint.clientX,
      clientY: zoomPoint.clientY,
      preventDefault() {}
    });
    assert.ok(engine.camera.zoom > 1);
    assert.equal(engine.getHoveredTile(), hoveredBeforeZoom);

    engine.destroy();
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

test("engine hover uses per-tile elevation without modifying tile data", () => {
  const originalWindow = globalThis.window;
  globalThis.window = {
    devicePixelRatio: 1,
    addEventListener: () => {},
    removeEventListener: () => {}
  };

  try {
    const { canvas, listeners } = makeCanvas();
    const engine = new Engine(canvas, CONFIG);
    const lowerTile = engine.world.getTile(4, 4);
    const elevatedTile = engine.world.getTile(5, 5);
    elevatedTile.elevation = 2;
    const point = getTileClientCenter(engine, canvas, elevatedTile);
    const dataBefore = {
      elevation: elevatedTile.elevation,
      terrain: elevatedTile.terrain,
      walkable: elevatedTile.walkable
    };

    listeners.get("pointermove")({ pointerId: 13, ...point });
    assert.equal(engine.getHoveredTile(), elevatedTile);
    assert.notEqual(engine.getHoveredTile(), lowerTile);
    assert.deepEqual({
      elevation: elevatedTile.elevation,
      terrain: elevatedTile.terrain,
      walkable: elevatedTile.walkable
    }, dataBefore);

    engine.destroy();
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});


test("engine clears the active hover on pointer cancellation", () => {
  const originalWindow = globalThis.window;
  globalThis.window = {
    devicePixelRatio: 1,
    addEventListener: () => {},
    removeEventListener: () => {}
  };

  try {
    const { canvas, listeners } = makeCanvas();
    const engine = new Engine(canvas, CONFIG);
    const target = engine.world.getTile(6, 6);
    const point = getTileClientCenter(engine, canvas, target);

    listeners.get("pointerdown")({
      button: 0,
      pointerId: 14,
      ...point
    });
    assert.equal(engine.getHoveredTile(), target);

    listeners.get("pointercancel")({ pointerId: 14, type: "pointercancel" });
    assert.equal(engine.getHoveredTile(), null);
    assert.equal(engine.dragPointerId, null);

    engine.destroy();
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});
