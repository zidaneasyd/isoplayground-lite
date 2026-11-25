import test from "node:test";
import assert from "node:assert/strict";
import { SpriteRenderer } from "../src/rendering/sprite-renderer.js";
import { World } from "../src/world/world.js";
import { WorldObject } from "../src/objects/world-object.js";
import { CONFIG } from "../src/core/config.js";

function makeContext() {
  const calls = [];
  const stateStack = [];
  return {
    calls,
    imageSmoothingEnabled: true,
    save() {
      stateStack.push(this.imageSmoothingEnabled);
      calls.push(["save"]);
    },
    restore() {
      this.imageSmoothingEnabled = stateStack.pop();
      calls.push(["restore"]);
    },
    drawImage(...args) { calls.push(["drawImage", ...args]); }
  };
}

function addObject(world, values = {}) {
  const object = new WorldObject({
    id: values.id ?? "object-1",
    type: values.type ?? "prop",
    assetId: values.assetId ?? "sprite-1",
    x: values.x ?? 0,
    y: values.y ?? 0,
    footprint: values.footprint ?? { width: 1, height: 1 },
    elevationOffset: values.elevationOffset ?? 0
  });
  world.objects.add(object);
  return object;
}

function makeAssets(assetOverrides = {}) {
  const image = { label: "sprite-image" };
  const asset = {
    id: "sprite-1",
    image,
    width: 64,
    height: 96,
    anchorX: 0.5,
    anchorY: 1,
    imageSmoothingEnabled: null,
    ...assetOverrides
  };
  return { image, get: (id) => id === asset.id ? asset : null };
}

test("sprite renderer creates a bottom-center command at the elevated tile anchor", () => {
  const ctx = makeContext();
  const assets = makeAssets();
  const world = new World({ width: 2, height: 2 });
  const object = addObject(world, { x: 1, y: 1, elevationOffset: 2 });
  world.getTile(1, 1).elevation = 1;

  const renderer = new SpriteRenderer(ctx, CONFIG, assets);
  const [command] = renderer.getRenderCommands(world);

  assert.equal(command.objectId, object.id);
  assert.equal(command.depth, 2);
  assert.equal(command.width, 64);
  assert.equal(command.height, 96);
  assert.equal(command.x, -32);
  assert.equal(command.y, -72);
});

test("sprite renderer centers a multi-tile footprint before applying the asset anchor", () => {
  const renderer = new SpriteRenderer(makeContext(), CONFIG, makeAssets());
  const world = new World({ width: 6, height: 8 });
  addObject(world, { x: 0, y: 0, footprint: { width: 5, height: 7 } });

  const [command] = renderer.getRenderCommands(world);
  assert.equal(command.depth, 5);
  assert.equal(command.x, -64);
  assert.equal(command.y, 0);
});

test("sprite renderer computes depth from footprint center and sorts commands consistently", () => {
  const renderer = new SpriteRenderer(makeContext(), CONFIG, makeAssets());
  const world = new World({ width: 8, height: 8 });
  addObject(world, { id: "far", x: 3, y: 2 });
  addObject(world, { id: "near", x: 0, y: 1 });
  addObject(world, { id: "same-depth-later", x: 2, y: 1 });

  const commands = renderer.getRenderCommands(world);
  assert.deepEqual(commands.map(({ objectId }) => objectId), [
    "near", "same-depth-later", "far"
  ]);
  assert.deepEqual(commands.map(({ depth }) => depth), [1, 3, 5]);
});

test("sprite renderer uses horizontal isometric order to break equal diagonal depths", () => {
  const renderer = new SpriteRenderer(makeContext(), CONFIG, makeAssets());
  const world = new World({ width: 5, height: 5 });
  addObject(world, { id: "right-side", x: 2, y: 0 });
  addObject(world, { id: "left-side", x: 0, y: 2 });

  const commands = renderer.getRenderCommands(world);
  assert.deepEqual(commands.map(({ objectId }) => objectId), ["left-side", "right-side"]);
  assert.deepEqual(commands.map(({ secondaryDepth }) => secondaryDepth), [-2, 2]);
});

test("sprite renderer follows live anchor elevation without caching projected position", () => {
  const renderer = new SpriteRenderer(makeContext(), CONFIG, makeAssets());
  const world = new World({ width: 2, height: 2 });
  addObject(world, { x: 1, y: 0, elevationOffset: 1 });
  const tile = world.getTile(1, 0);

  const firstY = renderer.getRenderCommands(world)[0].y;
  tile.elevation = 2;
  const secondY = renderer.getRenderCommands(world)[0].y;

  assert.equal(secondY, firstY - CONFIG.tile.elevationStep * 2);
});

test("sprite renderer skips objects with missing or unloaded assets and invalid anchors", () => {
  const renderer = new SpriteRenderer(makeContext(), CONFIG, { get: () => null });
  const world = new World({ width: 2, height: 2 });
  addObject(world);
  addObject(world, { id: "invalid-position", x: 9, y: 9 });

  assert.deepEqual(renderer.getRenderCommands(world), []);
});

test("sprite renderer draws image using resolved size and restores smoothing state", () => {
  const ctx = makeContext();
  const assets = makeAssets({
    imageSmoothingEnabled: false,
    anchorX: 0,
    anchorY: 0
  });
  const renderer = new SpriteRenderer(ctx, CONFIG, assets);
  const world = new World({ width: 1, height: 1 });
  addObject(world);
  const [command] = renderer.getRenderCommands(world);

  assert.equal(renderer.draw(command), true);
  assert.deepEqual(ctx.calls.find(([name]) => name === "drawImage"), [
    "drawImage", assets.get("sprite-1").image, 0, 16, 64, 96
  ]);
  assert.equal(ctx.imageSmoothingEnabled, true);
  assert.deepEqual(ctx.calls.map(([name]) => name), ["save", "drawImage", "restore"]);
});

test("sprite renderer safely ignores draw requests when drawImage is unavailable", () => {
  const renderer = new SpriteRenderer({}, CONFIG, makeAssets());
  assert.equal(renderer.draw({ image: {}, x: 0, y: 0, width: 1, height: 1 }), false);
});
