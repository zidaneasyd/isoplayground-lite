import test from "node:test";
import assert from "node:assert/strict";
import { AssetManager } from "../src/assets/asset-manager.js";

class FakeImage {
  static instances = [];

  constructor() {
    this.naturalWidth = 96;
    this.naturalHeight = 48;
    this.onload = null;
    this.onerror = null;
    FakeImage.instances.push(this);
  }

  set src(value) {
    this._src = value;
    queueMicrotask(() => {
      if (value.includes("fail")) this.onerror?.(new Error("network failure"));
      else this.onload?.();
    });
  }

  get src() {
    return this._src;
  }
}

test("asset manager loads an image and exposes natural dimensions with bottom-center anchor", async () => {
  FakeImage.instances.length = 0;
  const manager = new AssetManager({ ImageClass: FakeImage });

  const image = await manager.load("tree", "/sprites/tree.png");
  const asset = manager.get("tree");

  assert.ok(image instanceof FakeImage);
  assert.equal(manager.getStatus("tree"), "loaded");
  assert.deepEqual({ width: asset.width, height: asset.height }, { width: 96, height: 48 });
  assert.deepEqual({ anchorX: asset.anchorX, anchorY: asset.anchorY }, { anchorX: 0.5, anchorY: 1 });
  assert.equal(asset.image, image);
});

test("asset manager scales one explicit dimension while preserving image aspect ratio", async () => {
  const manager = new AssetManager({ ImageClass: FakeImage });
  await manager.load("building", "/sprites/building.png", { width: 192, anchorX: 0, anchorY: 1 });

  const asset = manager.get("building");
  assert.equal(asset.width, 192);
  assert.equal(asset.height, 96);
  assert.equal(asset.anchorX, 0);
  assert.equal(asset.anchorY, 1);
});

test("asset manager deduplicates repeated loads for the same ID and source", async () => {
  FakeImage.instances.length = 0;
  const manager = new AssetManager({ ImageClass: FakeImage });
  const first = manager.load("pool", "/sprites/pool.png");
  const second = manager.load("pool", "/sprites/pool.png");

  assert.equal(first, second);
  assert.equal(FakeImage.instances.length, 1);
  await first;
  assert.equal(manager.size, 1);
});

test("asset manager rejects reuse of an ID for a different source or display options", () => {
  const manager = new AssetManager({ ImageClass: FakeImage });
  manager.load("tree", "/sprites/tree-a.png");
  assert.throws(() => manager.load("tree", "/sprites/tree-b.png"), /sumber gambar lain/);
  assert.throws(() => manager.load("tree", "/sprites/tree-a.png", { width: 128 }), /opsi tampilan berbeda/);
  manager.clear();
});

test("asset manager rejects invalid dimensions, anchors, and option shapes", () => {
  const manager = new AssetManager({ ImageClass: FakeImage });
  assert.throws(() => manager.load("a", "/a.png", { width: 0 }), TypeError);
  assert.throws(() => manager.load("b", "/b.png", { height: Infinity }), TypeError);
  assert.throws(() => manager.load("c", "/c.png", { anchorX: 1.1 }), TypeError);
  assert.throws(() => manager.load("d", "/d.png", { anchorY: -0.1 }), TypeError);
  assert.throws(() => manager.load("e", "/e.png", { imageSmoothingEnabled: 1 }), TypeError);
  assert.throws(() => manager.load("f", "/f.png", []), TypeError);
});

test("asset manager reports failed image loads without exposing drawable metadata", async () => {
  const manager = new AssetManager({ ImageClass: FakeImage });
  await assert.rejects(manager.load("broken", "/sprites/fail.png"), /network failure/);
  assert.equal(manager.getStatus("broken"), "error");
  assert.equal(manager.get("broken"), null);
});

test("asset manager reports missing assets and supports removal and clearing", async () => {
  const manager = new AssetManager({ ImageClass: FakeImage });
  assert.equal(manager.getStatus("unknown"), "missing");
  await manager.load("one", "/one.png");
  await manager.load("two", "/two.png");

  assert.equal(manager.remove("one"), true);
  assert.equal(manager.remove("one"), false);
  assert.equal(manager.getStatus("one"), "missing");
  assert.equal(manager.size, 1);

  manager.clear();
  assert.equal(manager.size, 0);
  assert.equal(manager.has("two"), false);
});

test("asset manager rejects loading when the Image API is unavailable", async () => {
  const manager = new AssetManager({ ImageClass: null });
  await assert.rejects(manager.load("tree", "/tree.png"), /Image API tidak tersedia/);
});
