import test from "node:test";
import assert from "node:assert/strict";
import { Engine } from "../src/core/engine.js";
import { CONFIG } from "../src/core/config.js";
import { gridToScreen, getWorldCenter } from "../src/world/coordinates.js";
import { WorldObject } from "../src/objects/world-object.js";

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

    listeners.get("pointerdown")({ button: 1, pointerId: 7, clientX: 100, clientY: 100 });
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

    listeners.get("pointerdown")({ button: 1, pointerId: 22, clientX: 200, clientY: 200 });
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
    listeners.get("pointerdown")({ button: 1, pointerId: 1, clientX: 100, clientY: 100 });
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
      button: 1,
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
      button: 1,
      pointerId: 14,
      ...point
    });
    assert.equal(engine.getHoveredTile(), target);

    listeners.get("pointercancel")({ pointerId: 14, type: "pointercancel" });
    assert.equal(engine.getHoveredTile(), null);
    assert.equal(engine.pointerSession, null);

    engine.destroy();
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

test("engine selects tiles on click, preserves selection on pan, and ignores empty clicks", () => {
  const originalWindow = globalThis.window;
  globalThis.window = {
    devicePixelRatio: 1,
    addEventListener: () => {},
    removeEventListener: () => {}
  };

  try {
    const { canvas, listeners, calls } = makeCanvas();
    const engine = new Engine(canvas, CONFIG);
    const first = engine.world.getTile(5, 5);
    const firstPoint = getTileClientCenter(engine, canvas, first);

    assert.equal(engine.getSelectedTile(), null);
    listeners.get("pointerdown")({
      button: 0, pointerId: 21,
      clientX: firstPoint.clientX, clientY: firstPoint.clientY
    });
    listeners.get("pointerup")({
      pointerId: 21, type: "pointerup",
      clientX: firstPoint.clientX, clientY: firstPoint.clientY
    });
    assert.equal(engine.getSelectedTile(), first);

    const second = engine.world.getTile(7, 4);
    const secondPoint = getTileClientCenter(engine, canvas, second);
    listeners.get("pointermove")({ pointerId: 22, ...secondPoint });
    assert.equal(engine.getHoveredTile(), second);
    assert.equal(engine.getSelectedTile(), first, "hovering another tile must not change selection");

    const beforePanSelection = engine.getSelectedTile();
    listeners.get("pointerdown")({
      button: 1, pointerId: 23,
      clientX: firstPoint.clientX, clientY: firstPoint.clientY
    });
    listeners.get("pointermove")({
      pointerId: 23,
      clientX: firstPoint.clientX + 30,
      clientY: firstPoint.clientY + 20
    });
    listeners.get("pointerup")({
      pointerId: 23, type: "pointerup",
      clientX: firstPoint.clientX + 30,
      clientY: firstPoint.clientY + 20
    });
    assert.equal(engine.getSelectedTile(), beforePanSelection, "dragging the camera must not select a tile");

    // Clicking outside the world preserves the current selection.
    listeners.get("pointerdown")({ button: 0, pointerId: 24, clientX: 51, clientY: 101 });
    listeners.get("pointerup")({ pointerId: 24, type: "pointerup", clientX: 51, clientY: 101 });
    assert.equal(engine.getSelectedTile(), beforePanSelection);
    assert.ok(calls.filter(([name]) => name === "clearRect").length > 0);

    engine.destroy();
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

test("engine does not select on pointer cancellation and clears selection on destroy", () => {
  const originalWindow = globalThis.window;
  globalThis.window = {
    devicePixelRatio: 1,
    addEventListener: () => {},
    removeEventListener: () => {}
  };

  try {
    const { canvas, listeners } = makeCanvas();
    const engine = new Engine(canvas, CONFIG);
    const tile = engine.world.getTile(5, 5);
    const point = getTileClientCenter(engine, canvas, tile);
    listeners.get("pointerdown")({ button: 0, pointerId: 25, ...point });
    listeners.get("pointercancel")({ pointerId: 25, type: "pointercancel" });
    assert.equal(engine.getSelectedTile(), null);

    listeners.get("pointerdown")({ button: 0, pointerId: 26, ...point });
    listeners.get("pointerup")({ pointerId: 26, type: "pointerup", ...point });
    assert.equal(engine.getSelectedTile(), tile);
    engine.destroy();
    assert.equal(engine.getSelectedTile(), null);
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

test("engine notifies the inspector on selection changes and can refresh after tile edits", () => {
  const originalWindow = globalThis.window;
  globalThis.window = {
    devicePixelRatio: 1,
    addEventListener: () => {},
    removeEventListener: () => {}
  };

  try {
    const { canvas, listeners, calls } = makeCanvas();
    const selectionEvents = [];
    const selectedTileSnapshots = [];
    const engine = new Engine(canvas, CONFIG, {
      onSelectionChange: (tile, tiles) => {
        selectionEvents.push(tile?.id ?? null);
        selectedTileSnapshots.push(tiles);
      }
    });
    const tile = engine.world.getTile(6, 6);
    const point = getTileClientCenter(engine, canvas, tile);

    listeners.get("pointerdown")({ button: 0, pointerId: 41, ...point });
    listeners.get("pointerup")({ pointerId: 41, type: "pointerup", ...point });
    assert.equal(engine.getSelectedTile(), tile);
    assert.deepEqual(selectionEvents, [tile.id]);
    assert.deepEqual(selectedTileSnapshots, [[tile]]);

    const beforeRefresh = calls.filter(([name]) => name === "clearRect").length;
    tile.elevation = 2;
    engine.refreshWorldView();
    assert.equal(calls.filter(([name]) => name === "clearRect").length, beforeRefresh + 1);

    listeners.get("pointerdown")({ button: 0, pointerId: 42, clientX: 51, clientY: 101 });
    listeners.get("pointerup")({ pointerId: 42, type: "pointerup", clientX: 51, clientY: 101 });
    assert.equal(engine.getSelectedTile(), tile, "empty clicks preserve selection");
    assert.deepEqual(selectionEvents, [tile.id]);

    const pointAfterElevationEdit = getTileClientCenter(engine, canvas, tile);
    listeners.get("pointerdown")({ button: 0, pointerId: 43, ...pointAfterElevationEdit });
    listeners.get("pointerup")({ pointerId: 43, type: "pointerup", ...pointAfterElevationEdit });
    assert.equal(engine.getSelectedTile(), null, "clicking the sole selected tile again clears it");
    assert.deepEqual(selectedTileSnapshots.at(-1), []);
    engine.destroy();
    assert.equal(selectionEvents.at(-1), null);
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

test("engine rejects an invalid selection callback", () => {
  const originalWindow = globalThis.window;
  globalThis.window = { devicePixelRatio: 1, addEventListener: () => {}, removeEventListener: () => {} };
  try {
    const { canvas } = makeCanvas();
    assert.throws(() => new Engine(canvas, CONFIG, { onSelectionChange: true }), TypeError);
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

test("engine supports additive and subtractive pointer selection, middle pan, and focused elevation edits", () => {
  const originalWindow = globalThis.window;
  const windowListeners = new Map();
  globalThis.window = {
    devicePixelRatio: 1,
    addEventListener: (name, fn) => windowListeners.set(name, fn),
    removeEventListener: (name) => windowListeners.delete(name)
  };
  try {
    const { canvas, listeners, classNames } = makeCanvas();
    const elevationSyncs = [];
    const selectionSyncs = [];
    const engine = new Engine(canvas, CONFIG, {
      onSelectionChange: (_focus, tiles) => selectionSyncs.push(tiles),
      onElevationChange: (focus, tiles) => elevationSyncs.push({ focus, tiles })
    });
    const a = engine.world.getTile(4, 4);
    const b = engine.world.getTile(6, 5);
    const pa = getTileClientCenter(engine, canvas, a);
    const pb = getTileClientCenter(engine, canvas, b);
    const click = (point, { button = 0, shiftKey = false, pointerId = 1 } = {}) => {
      listeners.get("pointerdown")({ button, shiftKey, pointerId, ...point });
      listeners.get("pointerup")({ pointerId, type: "pointerup", ...point });
    };

    click(pa);
    click(pb, { shiftKey: true, pointerId: 2 });
    assert.deepEqual(engine.getSelectedTiles(), [a, b]);
    click(pb, { shiftKey: true, pointerId: 3 });
    assert.deepEqual(engine.getSelectedTiles(), [a, b], "adding an existing ID is idempotent");
    assert.deepEqual(selectionSyncs, [[a], [a, b]]);
    a.elevation = 2;
    b.elevation = 4;
    windowListeners.get("keydown")({ key: "ArrowUp", repeat: true, preventDefault() {} });
    assert.deepEqual([a.elevation, b.elevation], [3, 5]);
    click(getTileClientCenter(engine, canvas, a), { button: 2, shiftKey: true, pointerId: 4 });
    assert.deepEqual(engine.getSelectedTiles(), [b]);
    assert.deepEqual(selectionSyncs.at(-1), [b]);
    assert.equal(engine.getSelectedTile(), b);

    const beforePan = { x: engine.camera.x, y: engine.camera.y };
    listeners.get("pointerdown")({ button: 1, pointerId: 5, ...pb });
    assert.ok(classNames.has("is-dragging"));
    listeners.get("pointermove")({ pointerId: 5, clientX: pb.clientX + 16, clientY: pb.clientY + 12 });
    listeners.get("pointerup")({ pointerId: 5, type: "pointerup" });
    assert.ok(engine.camera.x !== beforePan.x || engine.camera.y !== beforePan.y);
    assert.deepEqual(engine.getSelectedTiles(), [b]);
    assert.ok(!classNames.has("is-dragging"));

    b.elevation = 0;
    let prevented = false;
    windowListeners.get("keydown")({ key: "ArrowDown", repeat: true, preventDefault: () => { prevented = true; } });
    assert.equal(prevented, true);
    assert.equal(b.elevation, -1);
    assert.equal(a.elevation, 3);
    assert.deepEqual(elevationSyncs.map(({ focus }) => focus), [b, b]);
    assert.deepEqual(elevationSyncs.map(({ tiles }) => tiles), [[a, b], [b]]);
    const cameraBeforeLeftDrag = { x: engine.camera.x, y: engine.camera.y };
    listeners.get("pointerdown")({ button: 0, pointerId: 6, ...pb });
    listeners.get("pointermove")({ pointerId: 6, clientX: pb.clientX + 20, clientY: pb.clientY + 10 });
    listeners.get("pointerup")({ pointerId: 6, type: "pointerup", clientX: pb.clientX + 20, clientY: pb.clientY + 10 });
    assert.deepEqual({ x: engine.camera.x, y: engine.camera.y }, cameraBeforeLeftDrag);
    engine.destroy();
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

test("elevation shortcuts ignore interactive targets and preserve normal edits elsewhere", () => {
  const originalWindow = globalThis.window;
  const windowListeners = new Map();
  globalThis.window = {
    devicePixelRatio: 1,
    addEventListener: (name, fn) => windowListeners.set(name, fn),
    removeEventListener: (name) => windowListeners.delete(name)
  };
  try {
    const { canvas, calls } = makeCanvas();
    const syncs = [];
    const engine = new Engine(canvas, CONFIG, {
      onElevationChange: (focus, tiles) => syncs.push({ focus, tiles })
    });
    const first = engine.world.getTile(4, 4);
    const second = engine.world.getTile(5, 5);
    first.elevation = 2;
    second.elevation = -1;
    engine.tileSelection.select(first);
    engine.tileSelection.add(second);

    const renderCount = () => calls.filter(([name]) => name === "clearRect").length;
    const controls = [
      { tagName: "INPUT" },
      { tagName: "TEXTAREA" },
      { tagName: "SELECT" },
      { tagName: "BUTTON" },
      { isContentEditable: true },
      { getAttribute: (name) => name === "contenteditable" ? "true" : null },
      { getAttribute: (name) => name === "role" ? "textbox" : null },
      { getAttribute: (name) => name === "role" ? "combobox" : null },
      { getAttribute: (name) => name === "role" ? "switch" : null }
    ];

    for (const target of controls) {
      for (const key of ["ArrowUp", "ArrowDown"]) {
        let prevented = false;
        const before = [first.elevation, second.elevation];
        const rendersBefore = renderCount();
        const syncsBefore = syncs.length;
        windowListeners.get("keydown")({ key, target, preventDefault: () => { prevented = true; } });
        assert.deepEqual([first.elevation, second.elevation], before, `${key} on ${target.tagName ?? target.getAttribute?.("role") ?? "contenteditable"}`);
        assert.equal(prevented, false);
        assert.equal(renderCount(), rendersBefore);
        assert.equal(syncs.length, syncsBefore);
      }
    }

    let prevented = false;
    const rendersBefore = renderCount();
    windowListeners.get("keydown")({ key: "ArrowUp", preventDefault: () => { prevented = true; } });
    assert.equal(prevented, true);
    assert.deepEqual([first.elevation, second.elevation], [3, 0]);
    assert.deepEqual(engine.getSelectedTiles(), [first, second]);
    assert.equal(renderCount(), rendersBefore + 1);
    assert.deepEqual(syncs.at(-1), { focus: second, tiles: [first, second] });

    windowListeners.get("keydown")({ key: "ArrowDown", target: null, preventDefault() {} });
    assert.deepEqual([first.elevation, second.elevation], [2, -1]);
    assert.deepEqual(engine.getSelectedTiles(), [first, second]);
    assert.deepEqual(syncs.at(-1), { focus: second, tiles: [first, second] });
    engine.destroy();
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

test("engine replaces selection normally and processes each tile crossed by additive and subtractive drags", () => {
  const originalWindow = globalThis.window;
  globalThis.window = { devicePixelRatio: 1, addEventListener() {}, removeEventListener() {} };
  try {
    const { canvas, listeners } = makeCanvas();
    const engine = new Engine(canvas, CONFIG);
    const first = engine.world.getTile(2, 2);
    const start = engine.world.getTile(3, 3);
    const end = engine.world.getTile(8, 8);
    const point = (tile) => getTileClientCenter(engine, canvas, tile);
    const click = (tile, pointerId, options = {}) => {
      const at = point(tile);
      listeners.get("pointerdown")({ button: options.button ?? 0, shiftKey: options.shiftKey ?? false, pointerId, ...at });
      listeners.get("pointerup")({ pointerId, type: "pointerup", ...at });
    };
    click(first, 1);
    const from = point(start);
    const to = point(end);
    listeners.get("pointerdown")({ button: 0, shiftKey: true, pointerId: 2, ...from });
    listeners.get("pointermove")({ pointerId: 2, ...to });
    listeners.get("pointerup")({ pointerId: 2, type: "pointerup", ...to });
    assert.ok(engine.getSelectedTiles().some((tile) => tile.id === start.id));
    assert.ok(engine.getSelectedTiles().some((tile) => tile.id === end.id));
    assert.equal(new Set(engine.getSelectedTiles().map((tile) => tile.id)).size, engine.getSelectedTiles().length);

    click(end, 3);
    assert.deepEqual(engine.getSelectedTiles(), [end], "ordinary click replaces a multi-selection");
    click(end, 4);
    assert.deepEqual(engine.getSelectedTiles(), [], "clicking the sole selected tile toggles it off");

    click(start, 5);
    click(end, 6, { shiftKey: true });
    const endPoint = point(end);
    const startPoint = point(start);
    listeners.get("pointerdown")({ button: 2, shiftKey: true, pointerId: 7, ...endPoint });
    listeners.get("pointermove")({ pointerId: 7, ...startPoint });
    listeners.get("pointerup")({ pointerId: 7, type: "pointerup", ...startPoint });
    assert.deepEqual(engine.getSelectedTiles(), [], "right drag removes each crossed selected tile");

    let prevented = false;
    listeners.get("contextmenu")({ preventDefault: () => { prevented = true; } });
    assert.equal(prevented, true);
    engine.destroy();
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

// --------------------------------------------------
// OBJECT PLACEMENT AND MOVEMENT
// --------------------------------------------------

function createWorldObject(id, x = 0, y = 0, width = 1, height = 1) {
  return new WorldObject({
    id,
    type: "prop",
    x,
    y,
    footprint: { width, height }
  });
}

test("engine previews and commits a new object from a canvas click without selecting a tile", () => {
  const originalWindow = globalThis.window;
  globalThis.window = {
    devicePixelRatio: 1,
    addEventListener: () => {},
    removeEventListener: () => {}
  };

  try {
    const { canvas, listeners } = makeCanvas();
    const engine = new Engine(canvas, CONFIG);
    const object = createWorldObject("pool-1", 0, 0, 5, 7);
    const tile = engine.world.getTile(2, 1);
    const point = getTileClientCenter(engine, canvas, tile);

    assert.equal(engine.beginObjectPlacement(object), true);
    assert.equal(engine.world.objects.size, 0);

    listeners.get("pointermove")({ pointerId: 51, ...point });
    assert.equal(engine.getObjectPlacementPreview().x, 2);
    assert.equal(engine.getObjectPlacementPreview().y, 1);
    assert.equal(engine.getObjectPlacementPreview().valid, true);

    listeners.get("pointerdown")({ button: 0, pointerId: 51, ...point });
    listeners.get("pointerup")({ pointerId: 51, type: "pointerup", ...point });

    assert.equal(engine.world.objects.getById("pool-1"), object);
    assert.equal(object.x, 2);
    assert.equal(object.y, 1);
    assert.equal(engine.world.objects.size, 1);
    assert.equal(engine.objectPlacement.active, false);
    assert.equal(engine.getObjectPlacementPreview(), null);
    assert.equal(engine.getSelectedTile(), null, "placement must not alter tile selection");

    engine.destroy();
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

test("engine keeps an invalid placement active and commits after moving to a valid footprint anchor", () => {
  const originalWindow = globalThis.window;
  globalThis.window = {
    devicePixelRatio: 1,
    addEventListener: () => {},
    removeEventListener: () => {}
  };

  try {
    const { canvas, listeners } = makeCanvas();
    const engine = new Engine(canvas, CONFIG);
    const object = createWorldObject("large-prop", 0, 0, 2, 2);
    const edgePoint = getTileClientCenter(engine, canvas, engine.world.getTile(11, 11));
    engine.beginObjectPlacement(object);

    listeners.get("pointermove")({ pointerId: 52, ...edgePoint });
    assert.equal(engine.getObjectPlacementPreview().valid, false);
    listeners.get("pointerdown")({ button: 0, pointerId: 52, ...edgePoint });
    listeners.get("pointerup")({ pointerId: 52, type: "pointerup", ...edgePoint });
    assert.equal(engine.objectPlacement.active, true);
    assert.equal(engine.world.objects.size, 0);

    const validPoint = getTileClientCenter(engine, canvas, engine.world.getTile(4, 4));
    listeners.get("pointermove")({ pointerId: 53, ...validPoint });
    assert.equal(engine.getObjectPlacementPreview().valid, true);
    listeners.get("pointerdown")({ button: 0, pointerId: 53, ...validPoint });
    listeners.get("pointerup")({ pointerId: 53, type: "pointerup", ...validPoint });

    assert.equal(engine.world.objects.getById("large-prop"), object);
    assert.equal(object.x, 4);
    assert.equal(object.y, 4);
    assert.equal(engine.objectPlacement.active, false);
    engine.destroy();
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

test("engine moves a stored object only when the preview anchor is confirmed", () => {
  const originalWindow = globalThis.window;
  globalThis.window = {
    devicePixelRatio: 1,
    addEventListener: () => {},
    removeEventListener: () => {}
  };

  try {
    const { canvas, listeners } = makeCanvas();
    const engine = new Engine(canvas, CONFIG);
    const object = createWorldObject("prop-1", 1, 1, 2, 2);
    engine.world.objects.add(object);
    assert.equal(engine.beginObjectMove(object.id), true);

    const target = getTileClientCenter(engine, canvas, engine.world.getTile(5, 3));
    listeners.get("pointermove")({ pointerId: 54, ...target });
    assert.equal(engine.getObjectPlacementPreview().x, 5);
    assert.equal(engine.getObjectPlacementPreview().y, 3);
    assert.equal(object.x, 1);
    assert.equal(object.y, 1);

    listeners.get("pointerdown")({ button: 0, pointerId: 54, ...target });
    listeners.get("pointerup")({ pointerId: 54, type: "pointerup", ...target });

    assert.equal(object.x, 5);
    assert.equal(object.y, 3);
    assert.equal(engine.world.objects.getById(object.id), object);
    assert.equal(engine.world.objects.size, 1);
    engine.destroy();
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

test("engine cancels object placement with Escape and right click", () => {
  const originalWindow = globalThis.window;
  const windowListeners = new Map();
  globalThis.window = {
    devicePixelRatio: 1,
    addEventListener: (name, fn) => windowListeners.set(name, fn),
    removeEventListener: (name) => windowListeners.delete(name)
  };

  try {
    const { canvas, listeners } = makeCanvas();
    const engine = new Engine(canvas, CONFIG);
    engine.beginObjectPlacement(createWorldObject("prop-escape"));
    let prevented = false;
    windowListeners.get("keydown")({
      key: "Escape",
      target: null,
      preventDefault() { prevented = true; }
    });
    assert.equal(prevented, true);
    assert.equal(engine.objectPlacement.active, false);

    engine.beginObjectPlacement(createWorldObject("prop-right-click"));
    listeners.get("pointerdown")({
      button: 2,
      pointerId: 55,
      clientX: 100,
      clientY: 120,
      preventDefault() {}
    });
    assert.equal(engine.objectPlacement.active, false);
    assert.equal(engine.world.objects.size, 0);
    engine.destroy();
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

test("engine preserves an active object preview when pointer gestures are cancelled", () => {
  const originalWindow = globalThis.window;
  globalThis.window = {
    devicePixelRatio: 1,
    addEventListener: () => {},
    removeEventListener: () => {}
  };

  try {
    const { canvas, listeners } = makeCanvas();
    const engine = new Engine(canvas, CONFIG);
    const object = createWorldObject("prop-1");
    const point = getTileClientCenter(engine, canvas, engine.world.getTile(4, 4));
    engine.beginObjectPlacement(object);
    listeners.get("pointerdown")({ button: 0, pointerId: 56, ...point });
    listeners.get("pointercancel")({ pointerId: 56, type: "pointercancel" });

    assert.equal(engine.objectPlacement.active, true);
    assert.equal(engine.world.objects.size, 0);
    assert.equal(engine.getObjectPlacementPreview().valid, false);
    assert.equal(engine.getObjectPlacementPreview().reason, "no-target");
    engine.destroy();
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

test("engine keeps placement preview aligned with hover during camera pan and zoom", () => {
  const originalWindow = globalThis.window;
  globalThis.window = {
    devicePixelRatio: 1,
    addEventListener: () => {},
    removeEventListener: () => {}
  };

  try {
    const { canvas, listeners } = makeCanvas();
    const engine = new Engine(canvas, CONFIG);
    engine.beginObjectPlacement(createWorldObject("prop-1", 0, 0, 2, 2));

    const initialPoint = getTileClientCenter(engine, canvas, engine.world.getTile(5, 5));
    listeners.get("pointermove")({ pointerId: 57, ...initialPoint });
    assert.deepEqual(
      { x: engine.getObjectPlacementPreview().x, y: engine.getObjectPlacementPreview().y },
      { x: engine.getHoveredTile().x, y: engine.getHoveredTile().y }
    );

    listeners.get("pointerdown")({
      button: 1,
      pointerId: 58,
      clientX: initialPoint.clientX,
      clientY: initialPoint.clientY
    });
    const movedPoint = {
      clientX: initialPoint.clientX + 16,
      clientY: initialPoint.clientY + 10
    };
    listeners.get("pointermove")({ pointerId: 58, ...movedPoint });
    listeners.get("pointerup")({ pointerId: 58, type: "pointerup", ...movedPoint });

    assert.deepEqual(
      { x: engine.getObjectPlacementPreview().x, y: engine.getObjectPlacementPreview().y },
      { x: engine.getHoveredTile().x, y: engine.getHoveredTile().y }
    );

    listeners.get("wheel")({
      deltaY: -180,
      clientX: movedPoint.clientX,
      clientY: movedPoint.clientY,
      preventDefault() {}
    });
    assert.deepEqual(
      { x: engine.getObjectPlacementPreview().x, y: engine.getObjectPlacementPreview().y },
      { x: engine.getHoveredTile().x, y: engine.getHoveredTile().y }
    );

    engine.cancelObjectPlacement();
    engine.destroy();
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});
