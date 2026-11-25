import test from "node:test";
import assert from "node:assert/strict";
import { Renderer } from "../src/rendering/renderer.js";
import { World } from "../src/world/world.js";
import { Camera } from "../src/camera/camera.js";
import { CONFIG } from "../src/core/config.js";

function makeContext() {
  const calls = [];
  const fillRecords = [];
  const strokeRecords = [];

  let currentPath = [];
  let currentFillStyle = null;
  let currentStrokeStyle = null;
  let currentLineWidth = 1;

  const ctx = {};

  for (const method of [
    "clearRect",
    "fillRect",
    "save",
    "translate",
    "scale",
    "restore"
  ]) {
    ctx[method] = (...args) => {
      calls.push([method, ...args]);
    };
  }

  ctx.beginPath = () => {
    currentPath = [];
    calls.push(["beginPath"]);
  };

  ctx.moveTo = (...args) => {
    currentPath.push(["M", ...args]);
    calls.push(["moveTo", ...args]);
  };

  ctx.lineTo = (...args) => {
    currentPath.push(["L", ...args]);
    calls.push(["lineTo", ...args]);
  };

  ctx.closePath = () => {
    currentPath.push(["Z"]);
    calls.push(["closePath"]);
  };

  ctx.fill = () => {
    fillRecords.push({
      style: currentFillStyle,
      path: currentPath.map((item) => [...item])
    });
    calls.push(["fill"]);
  };

  ctx.stroke = () => {
    strokeRecords.push({
      style: currentStrokeStyle,
      width: currentLineWidth,
      path: currentPath.map((item) => [...item])
    });
    calls.push(["stroke"]);
  };

  Object.defineProperty(ctx, "fillStyle", {
    set: (value) => {
      currentFillStyle = value;
    }
  });

  Object.defineProperty(ctx, "strokeStyle", {
    set: (value) => {
      currentStrokeStyle = value;
    }
  });

  Object.defineProperty(ctx, "lineWidth", {
    get: () => currentLineWidth,
    set: (value) => {
      currentLineWidth = value;
    }
  });

  return {
    ctx,
    calls,
    fillRecords,
    strokeRecords
  };
}

/**
 * Validates that a recorded path contains a complete four-sided diamond.
 */
function assertDiamondPath(record) {
  const path = record.path;

  assert.deepEqual(
    path.map(([command]) => command),
    ["M", "L", "L", "L", "Z"]
  );

  const [, mx, my] = path[0];
  const [, rx, ry] = path[1];
  const [, bx, by] = path[2];
  const [, lx, ly] = path[3];

  assert.equal(rx - mx, CONFIG.tile.width / 2);
  assert.equal(ry - my, CONFIG.tile.height / 2);

  assert.equal(bx - mx, 0);
  assert.equal(by - my, CONFIG.tile.height);

  assert.equal(lx - mx, -CONFIG.tile.width / 2);
  assert.equal(ly - my, CONFIG.tile.height / 2);
}

test("renderer centers the world correctly at non-unit zoom", () => {
  const { ctx, calls, strokeRecords } = makeContext();

  const renderer = new Renderer(ctx, CONFIG);
  renderer.setViewport(200, 100);

  const world = new World({ width: 2, height: 2 });
  const camera = new Camera({
    x: 10,
    y: -5,
    zoom: 2,
    minZoom: 0.5,
    maxZoom: 3
  });

  renderer.render(world, camera);

  assert.ok(
    calls.some(
      ([name, x, y]) =>
        name === "translate" && x === 110 && y === -19
    )
  );

  assert.ok(
    calls.some(
      ([name, x, y]) =>
        name === "scale" && x === 2 && y === 2
    )
  );

  assert.equal(
    calls.filter(([name]) => name === "beginPath").length,
    4
  );

  assert.equal(
    calls.filter(([name]) => name === "fill").length,
    4
  );

  assert.equal(strokeRecords.length, 4);
});

test("base grid outlines remain one CSS pixel at every zoom level", () => {
  const { ctx, strokeRecords } = makeContext();

  const renderer = new Renderer(ctx, CONFIG);
  renderer.setViewport(640, 480);

  const world = new World({ width: 2, height: 2 });

  for (const zoom of [2, 0.5]) {
    strokeRecords.length = 0;

    renderer.render(
      world,
      new Camera({
        zoom,
        minZoom: 0.5,
        maxZoom: 3
      })
    );

    assert.equal(strokeRecords.length, 4);

    assert.ok(
      strokeRecords.every(
        (record) =>
          record.style === CONFIG.colors.grid &&
          record.width === 1 / zoom
      )
    );
  }
});

test("renderer reads mutable per-tile elevation from persistent world data", () => {
  const { ctx, fillRecords } = makeContext();

  const renderer = new Renderer(ctx, CONFIG);
  renderer.setViewport(640, 480);

  const world = new World({ width: 2, height: 2 });

  const tile = world.getTile(0, 0);
  tile.elevation = 2;

  renderer.render(world, new Camera({ zoom: 1 }));

  const groundTop = fillRecords.find(
    (record) => record.style === CONFIG.colors.ground
  );

  assert.ok(groundTop, "the elevated tile top should be rendered");
  assert.deepEqual(
    groundTop.path[0],
    ["M", 0, -16]
  );

  assert.equal(
    world.getTileById(tile.id).elevation,
    2
  );
});

test("renderer highlights only the hovered tile with a complete four-edge outline", () => {
  const {
    ctx,
    fillRecords,
    strokeRecords
  } = makeContext();

  const renderer = new Renderer(ctx, CONFIG);
  renderer.setViewport(640, 480);

  const world = new World({ width: 2, height: 2 });
  const camera = new Camera({
    zoom: 2,
    minZoom: 0.5,
    maxZoom: 3
  });

  renderer.render(world, camera, {
    hoveredTileId: "tile-1-0"
  });

  assert.equal(
    fillRecords.filter(
      (record) => record.style === CONFIG.colors.hover
    ).length,
    1
  );

  assert.equal(
    fillRecords.filter(
      (record) => record.style === CONFIG.colors.ground
    ).length,
    3
  );

  assert.equal(
    strokeRecords.filter(
      (record) => record.style === CONFIG.colors.grid
    ).length,
    4
  );

  const activeOutline = strokeRecords.at(-1);

  assert.equal(
    activeOutline.style,
    CONFIG.colors.hoverOutline
  );

  assert.equal(
    activeOutline.width,
    2 / camera.zoom
  );

  assertDiamondPath(activeOutline);
});

test("hover and selected outlines preserve two CSS pixel thickness at different zoom levels", () => {
  const { ctx, strokeRecords } = makeContext();

  const renderer = new Renderer(ctx, CONFIG);
  renderer.setViewport(640, 480);

  const world = new World({ width: 2, height: 2 });

  for (const zoom of [2, 0.5]) {
    strokeRecords.length = 0;

    renderer.render(
      world,
      new Camera({
        zoom,
        minZoom: 0.5,
        maxZoom: 3
      }),
      {
        hoveredTileId: "tile-1-0"
      }
    );

    const gridOutlines = strokeRecords.filter(
      (record) => record.style === CONFIG.colors.grid
    );

    const hoverOutline = strokeRecords.filter(
      (record) => record.style === CONFIG.colors.hoverOutline
    );

    assert.equal(gridOutlines.length, 4);
    assert.equal(hoverOutline.length, 1);

    assert.ok(
      gridOutlines.every(
        (record) => record.width === 1 / zoom
      )
    );

    assert.equal(
      hoverOutline[0].width,
      2 / zoom
    );

    assertDiamondPath(hoverOutline[0]);
  }
});

test("renderer gives selected tile visual priority over hover", () => {
  const {
    ctx,
    fillRecords,
    strokeRecords
  } = makeContext();

  const renderer = new Renderer(ctx, CONFIG);
  renderer.setViewport(640, 480);

  const world = new World({ width: 2, height: 2 });
  const selected = world.getTile(0, 1);

  const camera = new Camera({ zoom: 2 });

  renderer.render(world, camera, {
    hoveredTileId: selected.id,
    selectedTileId: selected.id
  });

  assert.equal(
    fillRecords.filter(
      (record) => record.style === CONFIG.colors.selected
    ).length,
    1
  );

  assert.equal(
    fillRecords.filter(
      (record) => record.style === CONFIG.colors.hover
    ).length,
    0
  );

  assert.equal(
    strokeRecords.filter(
      (record) => record.style === CONFIG.colors.hoverOutline
    ).length,
    0
  );

  const selectedOutline = strokeRecords.at(-1);

  assert.equal(
    selectedOutline.style,
    CONFIG.colors.selectedOutline
  );

  assert.equal(
    selectedOutline.width,
    2 / camera.zoom
  );

  assertDiamondPath(selectedOutline);
});

test("selected outline is rendered after hover outline when different tiles are active", () => {
  const {
    ctx,
    fillRecords,
    strokeRecords
  } = makeContext();

  const renderer = new Renderer(ctx, CONFIG);
  renderer.setViewport(640, 480);

  const world = new World({ width: 2, height: 2 });

  const hovered = world.getTile(1, 0);
  const selected = world.getTile(0, 1);

  const camera = new Camera({ zoom: 2 });

  renderer.render(world, camera, {
    hoveredTileId: hovered.id,
    selectedTileId: selected.id
  });

  assert.equal(
    fillRecords.filter(
      (record) => record.style === CONFIG.colors.hover
    ).length,
    1
  );

  assert.equal(
    fillRecords.filter(
      (record) => record.style === CONFIG.colors.selected
    ).length,
    1
  );

  const activeOutlines = strokeRecords.slice(-2);

  assert.deepEqual(
    activeOutlines.map((record) => record.style),
    [
      CONFIG.colors.hoverOutline,
      CONFIG.colors.selectedOutline
    ]
  );

  for (const outline of activeOutlines) {
    assert.equal(outline.width, 2 / camera.zoom);
    assertDiamondPath(outline);
  }
});

test("renderer outlines every selected tile above hover, including adjacent selections", () => {
  const { ctx, fillRecords, strokeRecords } = makeContext();
  const renderer = new Renderer(ctx, CONFIG);
  renderer.setViewport(640, 480);
  const world = new World({ width: 2, height: 2 });
  const first = world.getTile(0, 0);
  const second = world.getTile(1, 0);
  renderer.render(world, new Camera({ zoom: 1 }), {
    hoveredTileId: first.id,
    selectedTileIds: [first.id, second.id]
  });
  assert.equal(fillRecords.filter((record) => record.style === CONFIG.colors.selected).length, 2);
  assert.equal(fillRecords.filter((record) => record.style === CONFIG.colors.hover).length, 0);
  assert.equal(strokeRecords.filter((record) => record.style === CONFIG.colors.selectedOutline).length, 2);
  assert.equal(strokeRecords.filter((record) => record.style === CONFIG.colors.hoverOutline).length, 0);
});
test("one elevation level uses eight pixels and renders both side faces", () => {
  const { ctx, fillRecords } = makeContext();

  const renderer = new Renderer(ctx, CONFIG);
  renderer.setViewport(640, 480);

  const world = new World({ width: 1, height: 1 });
  world.getTile(0, 0).elevation = 1;

  renderer.render(world, new Camera({ zoom: 1 }));

  assert.equal(CONFIG.tile.elevationStep, 8);

  const sideFaces = fillRecords.filter((record) =>
    [
      CONFIG.colors.sideRight,
      CONFIG.colors.sideLeft
    ].includes(record.style)
  );

  assert.equal(sideFaces.length, 2);

  assert.deepEqual(sideFaces[0].path, [
    ["M", 32, 8],
    ["L", 0, 24],
    ["L", 0, 32],
    ["L", 32, 16],
    ["Z"]
  ]);

  assert.deepEqual(sideFaces[1].path, [
    ["M", 0, 24],
    ["L", -32, 8],
    ["L", -32, 16],
    ["L", 0, 32],
    ["Z"]
  ]);
});

test("equal elevation neighbors do not create a shared vertical wall", () => {
  const { ctx, fillRecords } = makeContext();

  const renderer = new Renderer(ctx, CONFIG);
  renderer.setViewport(640, 480);

  const world = new World({ width: 2, height: 1 });

  world.getTile(0, 0).elevation = 1;
  world.getTile(1, 0).elevation = 1;

  renderer.render(world, new Camera({ zoom: 1 }));

  const rightFaces = fillRecords.filter(
    (record) => record.style === CONFIG.colors.sideRight
  );

  // Tile pertama tidak membuat dinding pada batas bersama.
  // Tile kedua tetap memiliki sisi luar dunia.
  assert.equal(rightFaces.length, 1);

  assert.deepEqual(rightFaces[0].path, [
    ["M", 64, 24],
    ["L", 32, 40],
    ["L", 32, 48],
    ["L", 64, 32],
    ["Z"]
  ]);
});
