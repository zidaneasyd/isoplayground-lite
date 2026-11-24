import test from "node:test";
import assert from "node:assert/strict";
import { TileInspector } from "../src/ui/tile-inspector.js";
import { World } from "../src/world/world.js";

class MockElement {
  constructor() {
    this.textContent = "";
    this.value = "";
    this.checked = false;
    this.disabled = false;
    this.hidden = false;
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type) {
    for (const listener of this.listeners.get(type) ?? []) listener({ target: this });
  }
}

function makeInspectorRoot() {
  const selectors = [
    "[data-inspector-status]",
    "[data-inspector-empty]",
    "[data-inspector-content]",
    '[data-value="id"]',
    '[data-value="coordinates"]',
    '[data-input="elevation"]',
    '[data-input="terrain"]',
    '[data-input="walkable"]'
  ];
  const elements = new Map(selectors.map((selector) => [selector, new MockElement()]));
  return {
    elements,
    querySelector: (selector) => elements.get(selector) ?? null
  };
}

test("inspector starts empty and clears/disables controls when no tile is selected", () => {
  const root = makeInspectorRoot();
  const inspector = new TileInspector(root);

  assert.equal(root.elements.get("[data-inspector-status]").textContent, "NO TILE SELECTED");
  assert.equal(root.elements.get("[data-inspector-empty]").hidden, false);
  assert.equal(root.elements.get("[data-inspector-content]").hidden, true);
  for (const selector of ['[data-input="elevation"]', '[data-input="terrain"]', '[data-input="walkable"]']) {
    assert.equal(root.elements.get(selector).disabled, true);
  }

  inspector.destroy();
});

test("inspector displays identity and all mutable tile properties", () => {
  const root = makeInspectorRoot();
  const inspector = new TileInspector(root);
  const tile = new World({ width: 2, height: 2 }).getTile(1, 0);
  tile.elevation = 2.5;
  tile.terrain = "stone";
  tile.walkable = false;

  inspector.setTile(tile);

  assert.equal(root.elements.get("[data-inspector-status]").textContent, "TILE SELECTED");
  assert.equal(root.elements.get("[data-inspector-empty]").hidden, true);
  assert.equal(root.elements.get("[data-inspector-content]").hidden, false);
  assert.equal(root.elements.get('[data-value="id"]').textContent, "tile-1-0");
  assert.equal(root.elements.get('[data-value="coordinates"]').textContent, "X 1  ·  Y 0");
  assert.equal(root.elements.get('[data-input="elevation"]').value, "2.5");
  assert.equal(root.elements.get('[data-input="terrain"]').value, "stone");
  assert.equal(root.elements.get('[data-input="walkable"]').checked, false);
  inspector.destroy();
});

test("inspector edits elevation, terrain, and walkable and reports each model change", () => {
  const root = makeInspectorRoot();
  const changes = [];
  const inspector = new TileInspector(root, {
    onTileChange: (tile, property) => changes.push([tile.id, property])
  });
  const tile = new World({ width: 2, height: 2 }).getTile(0, 1);
  inspector.setTile(tile);

  const elevation = root.elements.get('[data-input="elevation"]');
  elevation.value = "-1.25";
  elevation.dispatch("change");
  assert.equal(tile.elevation, -1.25);
  assert.equal(elevation.value, "-1.25");

  const terrain = root.elements.get('[data-input="terrain"]');
  terrain.value = "water";
  terrain.dispatch("change");
  assert.equal(tile.terrain, "water");
  assert.equal(terrain.value, "water");

  const walkable = root.elements.get('[data-input="walkable"]');
  walkable.checked = false;
  walkable.dispatch("change");
  assert.equal(tile.walkable, false);
  assert.deepEqual(changes, [
    [tile.id, "elevation"],
    [tile.id, "terrain"],
    [tile.id, "walkable"]
  ]);

  inspector.destroy();
});

test("inspector rejects invalid edits and restores the last valid model values", () => {
  const root = makeInspectorRoot();
  const changes = [];
  const inspector = new TileInspector(root, {
    onTileChange: (_tile, property) => changes.push(property)
  });
  const tile = new World({ width: 1, height: 1 }).getTile(0, 0);
  tile.elevation = 3;
  tile.terrain = "grass";
  inspector.setTile(tile);

  const elevation = root.elements.get('[data-input="elevation"]');
  elevation.value = "not-a-number";
  elevation.dispatch("change");
  assert.equal(tile.elevation, 3);
  assert.equal(elevation.value, "3");

  const terrain = root.elements.get('[data-input="terrain"]');
  terrain.value = "   ";
  terrain.dispatch("change");
  assert.equal(tile.terrain, "grass");
  assert.equal(terrain.value, "grass");
  assert.deepEqual(changes, []);

  inspector.destroy();
});

test("inspector follows a newly selected tile and detaches listeners on destroy", () => {
  const root = makeInspectorRoot();
  const inspector = new TileInspector(root);
  const world = new World({ width: 2, height: 2 });
  const first = world.getTile(0, 0);
  const second = world.getTile(1, 1);

  inspector.setTile(first);
  inspector.setTile(second);
  assert.equal(root.elements.get('[data-value="id"]').textContent, second.id);

  const elevation = root.elements.get('[data-input="elevation"]');
  inspector.destroy();
  assert.equal(elevation.listeners.get("change").size, 0);
  elevation.value = "9";
  elevation.dispatch("change");
  assert.equal(second.elevation, 0);
});

test("inspector validates its root and change callback", () => {
  assert.throws(() => new TileInspector(null), TypeError);
  assert.throws(() => new TileInspector(makeInspectorRoot(), { onTileChange: true }), TypeError);
});

test("inspector rejects incomplete markup and safely ignores updates after destroy", () => {
  assert.throws(() => new TileInspector({ querySelector: () => null }), /Elemen Tile Inspector tidak ditemukan/);

  const inspector = new TileInspector(makeInspectorRoot());
  assert.equal(inspector.updateTileProperty("elevation", 4), false);
  inspector.syncValues();
  inspector.destroy();
  inspector.destroy();
  inspector.setTile(new World({ width: 1, height: 1 }).getTile(0, 0));
  inspector.syncValues();
  assert.equal(inspector.updateTileProperty("elevation", 4), false);
  assert.equal(inspector.currentTile, null);
});
