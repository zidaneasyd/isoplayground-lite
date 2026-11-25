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
    this.attributes = new Map();
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }

    this.listeners.get(type).add(listener);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  dispatch(type) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener({ target: this });
    }
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
    "[data-elevation-decrease]",
    "[data-elevation-increase]",

    '[data-input="terrain"]',
    '[data-input="walkable"]',

    '[data-inspector-toggle="identity"]',
    '[data-inspector-body="identity"]',

    '[data-inspector-toggle="properties"]',
    '[data-inspector-body="properties"]'
  ];

  const elements = new Map(
    selectors.map((selector) => [selector, new MockElement()])
  );

  elements
    .get('[data-inspector-toggle="identity"]')
    .setAttribute("aria-expanded", "false");

  elements
    .get('[data-inspector-toggle="properties"]')
    .setAttribute("aria-expanded", "false");

  elements.get('[data-inspector-body="identity"]').hidden = true;
  elements.get('[data-inspector-body="properties"]').hidden = true;

  return {
    elements,
    querySelector: (selector) => elements.get(selector) ?? null
  };
}

test("inspector starts empty and disables all editing controls", () => {
  const root = makeInspectorRoot();
  const inspector = new TileInspector(root);

  assert.equal(
    root.elements.get("[data-inspector-status]").textContent,
    "NO TILE SELECTED"
  );

  assert.equal(
    root.elements.get("[data-inspector-empty]").hidden,
    false
  );

  assert.equal(
    root.elements.get("[data-inspector-content]").hidden,
    true
  );

  for (const selector of [
    "[data-elevation-decrease]",
    "[data-elevation-increase]",
    '[data-input="terrain"]',
    '[data-input="walkable"]'
  ]) {
    assert.equal(root.elements.get(selector).disabled, true);
  }

  inspector.destroy();
});

test("inspector foldable sections start collapsed", () => {
  const root = makeInspectorRoot();
  const inspector = new TileInspector(root);

  for (const name of ["identity", "properties"]) {
    const toggle = root.elements.get(
      `[data-inspector-toggle="${name}"]`
    );

    const body = root.elements.get(
      `[data-inspector-body="${name}"]`
    );

    assert.equal(toggle.getAttribute("aria-expanded"), "false");
    assert.equal(body.hidden, true);
  }

  inspector.destroy();
});

test("inspector sections expand and collapse independently", () => {
  const root = makeInspectorRoot();
  const inspector = new TileInspector(root);

  const identityToggle = root.elements.get(
    '[data-inspector-toggle="identity"]'
  );

  const identityBody = root.elements.get(
    '[data-inspector-body="identity"]'
  );

  const propertiesToggle = root.elements.get(
    '[data-inspector-toggle="properties"]'
  );

  const propertiesBody = root.elements.get(
    '[data-inspector-body="properties"]'
  );

  identityToggle.dispatch("click");

  assert.equal(
    identityToggle.getAttribute("aria-expanded"),
    "true"
  );

  assert.equal(identityBody.hidden, false);

  assert.equal(
    propertiesToggle.getAttribute("aria-expanded"),
    "false"
  );

  assert.equal(propertiesBody.hidden, true);

  propertiesToggle.dispatch("click");

  assert.equal(
    propertiesToggle.getAttribute("aria-expanded"),
    "true"
  );

  assert.equal(propertiesBody.hidden, false);

  assert.equal(identityBody.hidden, false);

  identityToggle.dispatch("click");

  assert.equal(
    identityToggle.getAttribute("aria-expanded"),
    "false"
  );

  assert.equal(identityBody.hidden, true);

  assert.equal(propertiesBody.hidden, false);

  propertiesToggle.dispatch("click");

  assert.equal(
    propertiesToggle.getAttribute("aria-expanded"),
    "false"
  );

  assert.equal(propertiesBody.hidden, true);

  inspector.destroy();
});

test("inspector displays selected tile identity and properties", () => {
  const root = makeInspectorRoot();
  const inspector = new TileInspector(root);

  const tile = new World({ width: 2, height: 2 }).getTile(1, 0);

  tile.elevation = 2.5;
  tile.terrain = "stone";
  tile.walkable = false;

  inspector.setTile(tile);

  assert.equal(
    root.elements.get("[data-inspector-status]").textContent,
    "TILE SELECTED"
  );

  assert.equal(
    root.elements.get("[data-inspector-empty]").hidden,
    true
  );

  assert.equal(
    root.elements.get("[data-inspector-content]").hidden,
    false
  );

  assert.equal(
    root.elements.get('[data-value="id"]').textContent,
    "tile-1-0"
  );

  assert.equal(
    root.elements.get('[data-value="coordinates"]').textContent,
    "X 1  ·  Y 0"
  );

  assert.equal(
    root.elements.get('[data-input="elevation"]').textContent,
    "2.5"
  );

  assert.equal(
    root.elements.get('[data-input="terrain"]').value,
    "stone"
  );

  assert.equal(
    root.elements.get('[data-input="walkable"]').checked,
    false
  );

  assert.equal(
    root.elements.get("[data-elevation-decrease]").disabled,
    false
  );

  assert.equal(
    root.elements.get("[data-elevation-increase]").disabled,
    false
  );

  inspector.destroy();
});

test("plus button increases elevation by one unit", () => {
  const root = makeInspectorRoot();
  const inspector = new TileInspector(root);
  const tile = new World({ width: 1, height: 1 }).getTile(0, 0);

  inspector.setTile(tile);

  root.elements
    .get("[data-elevation-increase]")
    .dispatch("click");

  assert.equal(tile.elevation, 1);

  assert.equal(
    root.elements.get('[data-input="elevation"]').textContent,
    "1"
  );

  inspector.destroy();
});

test("minus button decreases elevation by one unit", () => {
  const root = makeInspectorRoot();
  const inspector = new TileInspector(root);
  const tile = new World({ width: 1, height: 1 }).getTile(0, 0);

  tile.elevation = 3;

  inspector.setTile(tile);

  root.elements
    .get("[data-elevation-decrease]")
    .dispatch("click");

  assert.equal(tile.elevation, 2);

  assert.equal(
    root.elements.get('[data-input="elevation"]').textContent,
    "2"
  );

  inspector.destroy();
});

test("elevation controls support negative values", () => {
  const root = makeInspectorRoot();
  const inspector = new TileInspector(root);
  const tile = new World({ width: 1, height: 1 }).getTile(0, 0);

  inspector.setTile(tile);

  root.elements
    .get("[data-elevation-decrease]")
    .dispatch("click");

  assert.equal(tile.elevation, -1);

  assert.equal(
    root.elements.get('[data-input="elevation"]').textContent,
    "-1"
  );

  root.elements
    .get("[data-elevation-decrease]")
    .dispatch("click");

  assert.equal(tile.elevation, -2);

  assert.equal(
    root.elements.get('[data-input="elevation"]').textContent,
    "-2"
  );

  inspector.destroy();
});

test("elevation controls preserve decimal values", () => {
  const root = makeInspectorRoot();
  const inspector = new TileInspector(root);
  const tile = new World({ width: 1, height: 1 }).getTile(0, 0);

  tile.elevation = 1.5;

  inspector.setTile(tile);

  root.elements
    .get("[data-elevation-increase]")
    .dispatch("click");

  assert.equal(tile.elevation, 2.5);

  assert.equal(
    root.elements.get('[data-input="elevation"]').textContent,
    "2.5"
  );

  root.elements
    .get("[data-elevation-decrease]")
    .dispatch("click");

  assert.equal(tile.elevation, 1.5);

  assert.equal(
    root.elements.get('[data-input="elevation"]').textContent,
    "1.5"
  );

  inspector.destroy();
});

test("inspector edits terrain and walkable and reports model changes", () => {
  const root = makeInspectorRoot();
  const changes = [];

  const inspector = new TileInspector(root, {
    onTileChange: (tile, property) => {
      changes.push([tile.id, property]);
    }
  });

  const tile = new World({ width: 1, height: 1 }).getTile(0, 0);

  inspector.setTile(tile);

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
    [tile.id, "terrain"],
    [tile.id, "walkable"]
  ]);

  inspector.destroy();
});

test("elevation button changes report model updates", () => {
  const root = makeInspectorRoot();
  const changes = [];

  const inspector = new TileInspector(root, {
    onTileChange: (tile, property) => {
      changes.push([tile.id, property]);
    }
  });

  const tile = new World({ width: 1, height: 1 }).getTile(0, 0);

  inspector.setTile(tile);

  root.elements
    .get("[data-elevation-increase]")
    .dispatch("click");

  root.elements
    .get("[data-elevation-decrease]")
    .dispatch("click");

  assert.equal(tile.elevation, 0);

  assert.deepEqual(changes, [
    [tile.id, "elevation"],
    [tile.id, "elevation"]
  ]);

  inspector.destroy();
});

test("inspector follows newly selected tile", () => {
  const root = makeInspectorRoot();
  const inspector = new TileInspector(root);
  const world = new World({ width: 2, height: 2 });

  const first = world.getTile(0, 0);
  const second = world.getTile(1, 1);

  first.elevation = 3;
  second.elevation = -2;

  inspector.setTile(first);

  assert.equal(
    root.elements.get('[data-input="elevation"]').textContent,
    "3"
  );

  inspector.setTile(second);

  assert.equal(
    root.elements.get('[data-value="id"]').textContent,
    second.id
  );

  assert.equal(
    root.elements.get('[data-input="elevation"]').textContent,
    "-2"
  );

  inspector.destroy();
});

test("inspector refreshes values after external tile mutation", () => {
  const root = makeInspectorRoot();
  const inspector = new TileInspector(root);
  const tile = new World({ width: 1, height: 1 }).getTile(0, 0);

  inspector.setTile(tile);

  tile.elevation = 5;
  inspector.syncValues();

  assert.equal(
    root.elements.get('[data-input="elevation"]').textContent,
    "5"
  );

  inspector.destroy();
});

test("inspector detaches all listeners on destroy", () => {
  const root = makeInspectorRoot();
  const inspector = new TileInspector(root);
  const tile = new World({ width: 1, height: 1 }).getTile(0, 0);

  inspector.setTile(tile);
  inspector.destroy();

  const listeners = [
    ["[data-elevation-decrease]", "click"],
    ["[data-elevation-increase]", "click"],
    ['[data-input="terrain"]', "change"],
    ['[data-input="walkable"]', "change"],
    ['[data-inspector-toggle="identity"]', "click"],
    ['[data-inspector-toggle="properties"]', "click"]
  ];

  for (const [selector, event] of listeners) {
    const element = root.elements.get(selector);

    assert.equal(
      element.listeners.get(event)?.size ?? 0,
      0
    );
  }
});

test("inspector ignores button interactions after destroy", () => {
  const root = makeInspectorRoot();
  const inspector = new TileInspector(root);
  const tile = new World({ width: 1, height: 1 }).getTile(0, 0);

  inspector.setTile(tile);
  inspector.destroy();

  root.elements
    .get("[data-elevation-increase]")
    .dispatch("click");

  root.elements
    .get('[data-inspector-toggle="identity"]')
    .dispatch("click");

  assert.equal(tile.elevation, 0);
  assert.equal(inspector.currentTile, null);

  assert.equal(
    root.elements
      .get('[data-inspector-toggle="identity"]')
      .getAttribute("aria-expanded"),
    "false"
  );

  assert.equal(
    root.elements.get('[data-inspector-body="identity"]').hidden,
    true
  );
});

test("inspector validates root and change callback", () => {
  assert.throws(
    () => new TileInspector(null),
    TypeError
  );

  assert.throws(
    () => new TileInspector(makeInspectorRoot(), {
      onTileChange: true
    }),
    TypeError
  );
});

test("inspector rejects incomplete markup", () => {
  assert.throws(
    () => new TileInspector({
      querySelector: () => null
    }),
    /Elemen Tile Inspector tidak ditemukan/
  );
});

test("inspector safely ignores updates without selected tile", () => {
  const inspector = new TileInspector(makeInspectorRoot());

  assert.equal(inspector.adjustElevation(1), false);
  assert.equal(
    inspector.updateTileProperty("elevation", 4),
    false
  );

  inspector.destroy();
  inspector.destroy();
});