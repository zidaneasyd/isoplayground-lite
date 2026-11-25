
import test from "node:test";
import assert from "node:assert/strict";
import { TileInspector } from "../src/ui/tile-inspector.js";
import { World } from "../src/world/world.js";

class MockElement {
  constructor() {
    this.textContent = "";
    this.value = "";
    this.checked = false;
    this.indeterminate = false;
    this.disabled = false;
    this.hidden = false;
    this.dataset = {};
    this.children = [];
    this.listeners = new Map();
    this.attributes = new Map();
    this.classes = new Set();

    this.classList = {
      contains: (name) => this.classes.has(name),

      toggle: (name, force) => {
        const shouldAdd = force ?? !this.classes.has(name);

        if (shouldAdd) {
          this.classes.add(name);
        } else {
          this.classes.delete(name);
        }

        return shouldAdd;
      }
    };
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

  querySelectorAll() {
    return this.children;
  }

  contains(element) {
    return this === element || this.children.includes(element);
  }

  dispatch(type, event = {}) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener({
        target: this,
        ...event
      });
    }
  }
}

class MockDocument {
  constructor() {
    this.listeners = new Map();
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

  dispatch(type, event = {}) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
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
    "[data-inspector-identity]",

    '[data-input="elevation"]',
    "[data-elevation-decrease]",
    "[data-elevation-increase]",

    '[data-input="walkable"]',

    "[data-terrain-select]",
    "[data-terrain-trigger]",
    "[data-terrain-value]",
    "[data-terrain-menu]",

    '[data-terrain-option="default"]',
    '[data-terrain-option="grass"]',
    '[data-terrain-option="water"]',
    '[data-terrain-option="stone"]',

    '[data-inspector-toggle="identity"]',
    '[data-inspector-body="identity"]',

    '[data-inspector-toggle="properties"]',
    '[data-inspector-body="properties"]'
  ];

  const elements = new Map(
    selectors.map((selector) => [selector, new MockElement()])
  );

  const terrainMenu = elements.get("[data-terrain-menu]");

  const terrainValues = [
    "default",
    "grass",
    "water",
    "stone"
  ];

  terrainMenu.children = terrainValues.map((value) => {
    const option = elements.get(
      `[data-terrain-option="${value}"]`
    );

    option.dataset.terrainOption = value;
    option.setAttribute("aria-checked", "false");

    return option;
  });

  terrainMenu.hidden = true;

  elements.get("[data-terrain-select]").dataset.value = "default";

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

function withMockDocument(callback) {
  const previousDocument = Object.getOwnPropertyDescriptor(
    globalThis,
    "document"
  );

  const mockDocument = new MockDocument();

  Object.defineProperty(globalThis, "document", {
    configurable: true,
    writable: true,
    value: mockDocument
  });

  try {
    callback(mockDocument);
  } finally {
    if (previousDocument) {
      Object.defineProperty(
        globalThis,
        "document",
        previousDocument
      );
    } else {
      delete globalThis.document;
    }
  }
}

// --------------------------------------------------
// INITIAL STATE
// --------------------------------------------------

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
    "[data-terrain-trigger]",
    '[data-input="walkable"]'
  ]) {
    assert.equal(root.elements.get(selector).disabled, true);
  }

  assert.equal(
    root.elements.get("[data-terrain-menu]").hidden,
    true
  );

  inspector.destroy();
});

// --------------------------------------------------
// FOLDABLE SECTIONS
// --------------------------------------------------

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

// --------------------------------------------------
// TILE IDENTITY AND PROPERTY DISPLAY
// --------------------------------------------------

test("inspector displays selected tile identity and properties", () => {
  const root = makeInspectorRoot();
  const inspector = new TileInspector(root);

  const tile = new World({
    width: 2,
    height: 2
  }).getTile(1, 0);

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
    root.elements.get("[data-terrain-value]").textContent,
    "stone"
  );

  assert.equal(
    root.elements.get("[data-terrain-select]").dataset.value,
    "stone"
  );

  assert.equal(
    root.elements
      .get('[data-terrain-option="stone"]')
      .getAttribute("aria-checked"),
    "true"
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

  assert.equal(
    root.elements.get("[data-terrain-trigger]").disabled,
    false
  );

  assert.equal(
    root.elements.get('[data-input="walkable"]').disabled,
    false
  );

  inspector.destroy();
});

test("inspector switches empty, single, and multi modes from the supplied selection", () => {
  const root = makeInspectorRoot();
  const inspector = new TileInspector(root);
  const world = new World({ width: 3, height: 1 });
  const [first, second, third] = world.getTiles();

  assert.equal(root.elements.get("[data-inspector-status]").textContent, "NO TILE SELECTED");
  assert.equal(root.elements.get("[data-inspector-empty]").hidden, false);

  inspector.setTiles([first]);
  assert.equal(root.elements.get("[data-inspector-status]").textContent, "TILE SELECTED");
  assert.equal(root.elements.get("[data-value=\"id\"]").textContent, first.id);
  assert.equal(root.elements.get("[data-inspector-identity]").hidden, false);

  inspector.setTiles([first, second, third]);
  assert.equal(root.elements.get("[data-inspector-status]").textContent, "MULTI TILE SELECTED (3)");
  assert.equal(root.elements.get("[data-inspector-empty]").hidden, true);
  assert.equal(root.elements.get("[data-inspector-content]").hidden, false);
  assert.equal(root.elements.get("[data-inspector-identity]").hidden, true);
  assert.equal(root.elements.get("[data-value=\"id\"]").textContent, "—");
  assert.equal(root.elements.get("[data-value=\"coordinates\"]").textContent, "—");

  inspector.setTiles([second]);
  assert.equal(root.elements.get("[data-inspector-status]").textContent, "TILE SELECTED");
  assert.equal(root.elements.get("[data-value=\"id\"]").textContent, second.id);
  assert.equal(root.elements.get("[data-inspector-identity]").hidden, false);

  inspector.setTiles([]);
  assert.equal(root.elements.get("[data-inspector-status]").textContent, "NO TILE SELECTED");
  assert.equal(root.elements.get("[data-inspector-empty]").hidden, false);
  assert.equal(root.elements.get("[data-inspector-content]").hidden, true);
  assert.equal(root.elements.get("[data-elevation-increase]").disabled, true);
  inspector.destroy();
});

test("multi inspector shows uniform and mixed values and edits every selected tile relatively", () => {
  const root = makeInspectorRoot();
  const inspector = new TileInspector(root);
  const world = new World({ width: 4, height: 1 });
  const [first, second, third, unselected] = world.getTiles();
  first.elevation = 2;
  second.elevation = 4;
  third.elevation = 6;
  first.terrain = "grass";
  second.terrain = "grass";
  third.terrain = "water";
  first.walkable = true;
  second.walkable = false;
  third.walkable = true;
  unselected.elevation = 10;
  unselected.terrain = "water";
  unselected.walkable = true;

  inspector.setTiles([first, second]);
  assert.equal(root.elements.get('[data-input="elevation"]').textContent, "Mixed");
  assert.equal(root.elements.get("[data-terrain-value]").textContent, "grass");
  assert.equal(root.elements.get('[data-input="walkable"]').indeterminate, true);

  inspector.setTiles([first, second, third]);
  assert.equal(root.elements.get('[data-input="elevation"]').textContent, "Mixed");
  assert.equal(root.elements.get("[data-terrain-value]").textContent, "Mixed");
  assert.equal(root.elements.get('[data-input="walkable"]').indeterminate, true);
  assert.equal(root.elements.get('[data-input="walkable"]').checked, false);
  assert.notEqual(first.elevation, "Mixed");
  assert.notEqual(first.terrain, "Mixed");
  assert.notEqual(first.walkable, "Mixed");
  assert.equal(inspector.updateTileProperty("elevation", "Mixed"), false);
  assert.equal(inspector.updateTileProperty("terrain", "Mixed"), false);
  assert.equal(inspector.updateTileProperty("walkable", "Mixed"), false);
  assert.deepEqual([first.elevation, second.elevation, third.elevation], [2, 4, 6]);
  assert.deepEqual([first.terrain, second.terrain, third.terrain], ["grass", "grass", "water"]);
  assert.deepEqual([first.walkable, second.walkable, third.walkable], [true, false, true]);

  const walkable = root.elements.get('[data-input="walkable"]');
  walkable.indeterminate = true;
  walkable.checked = false;
  walkable.dispatch("change");
  assert.deepEqual([first.walkable, second.walkable, third.walkable], [true, true, true]);
  assert.equal(walkable.indeterminate, false);
  walkable.checked = false;
  walkable.dispatch("change");
  assert.deepEqual([first.walkable, second.walkable, third.walkable], [false, false, false]);
  assert.equal(walkable.indeterminate, false);
  first.walkable = true;
  second.walkable = false;
  third.walkable = true;
  inspector.syncValues();
  assert.equal(walkable.indeterminate, true);

  root.elements.get("[data-elevation-increase]").dispatch("click");
  assert.deepEqual([first.elevation, second.elevation, third.elevation], [3, 5, 7]);
  assert.equal(unselected.elevation, 10);
  assert.deepEqual([first.terrain, second.terrain, third.terrain], ["grass", "grass", "water"]);
  assert.deepEqual([first.walkable, second.walkable, third.walkable], [true, false, true]);
  root.elements.get("[data-elevation-decrease]").dispatch("click");
  assert.deepEqual([first.elevation, second.elevation, third.elevation], [2, 4, 6]);

  first.elevation = -2;
  second.elevation = 0;
  third.elevation = 2;
  inspector.syncValues();
  root.elements.get("[data-elevation-decrease]").dispatch("click");
  assert.deepEqual([first.elevation, second.elevation, third.elevation], [-3, -1, 1]);
  assert.equal(root.elements.get('[data-input="elevation"]').textContent, "Mixed");

  root.elements.get('[data-terrain-option="stone"]').dispatch("click");
  assert.deepEqual([first.terrain, second.terrain, third.terrain], ["stone", "stone", "stone"]);
  assert.equal(unselected.terrain, "water");
  assert.equal(unselected.elevation, 10);
  assert.equal(unselected.walkable, true);
  assert.equal(root.elements.get("[data-terrain-value]").textContent, "stone");
  assert.deepEqual([first.elevation, second.elevation, third.elevation], [-3, -1, 1]);

  walkable.indeterminate = true;
  walkable.checked = false;
  walkable.dispatch("change");
  assert.deepEqual([first.walkable, second.walkable, third.walkable], [true, true, true]);
  assert.equal(walkable.indeterminate, false);
  walkable.checked = false;
  walkable.dispatch("change");
  assert.deepEqual([first.walkable, second.walkable, third.walkable], [false, false, false]);
  assert.equal(unselected.walkable, true);
  inspector.destroy();
});

test("multi inspector reflects external keyboard elevation changes and selection updates", () => {
  const root = makeInspectorRoot();
  const inspector = new TileInspector(root);
  const world = new World({ width: 3, height: 1 });
  const [first, second, third] = world.getTiles();
  first.elevation = 1;
  second.elevation = 1;
  inspector.setTiles([first, second]);
  assert.equal(root.elements.get('[data-input="elevation"]').textContent, "1");

  first.elevation += 1;
  second.elevation += 1;
  inspector.syncValues();
  assert.equal(root.elements.get('[data-input="elevation"]').textContent, "2");

  inspector.setTiles([third, first]);
  assert.equal(root.elements.get('[data-input="elevation"]').textContent, "Mixed");
  inspector.setTiles([third]);
  assert.equal(root.elements.get('[data-input="elevation"]').textContent, String(third.elevation));
  assert.equal(root.elements.get('[data-value="id"]').textContent, third.id);
  inspector.destroy();
});

// --------------------------------------------------
// ELEVATION
// --------------------------------------------------

test("plus button increases elevation by one unit", () => {
  const root = makeInspectorRoot();
  const inspector = new TileInspector(root);
  const tile = new World({
    width: 1,
    height: 1
  }).getTile(0, 0);

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
  const tile = new World({
    width: 1,
    height: 1
  }).getTile(0, 0);

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
  const tile = new World({
    width: 1,
    height: 1
  }).getTile(0, 0);

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
  const tile = new World({
    width: 1,
    height: 1
  }).getTile(0, 0);

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

test("elevation button changes report model updates", () => {
  const root = makeInspectorRoot();
  const changes = [];

  const inspector = new TileInspector(root, {
    onTileChange: (tile, property) => {
      changes.push([tile.id, property]);
    }
  });

  const tile = new World({
    width: 1,
    height: 1
  }).getTile(0, 0);

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

// --------------------------------------------------
// TERRAIN DROPDOWN
// --------------------------------------------------

test("terrain dropdown starts closed", () => {
  const root = makeInspectorRoot();
  const inspector = new TileInspector(root);

  assert.equal(
    root.elements.get("[data-terrain-menu]").hidden,
    true
  );

  assert.equal(
    root.elements
      .get("[data-terrain-trigger]")
      .getAttribute("aria-expanded"),
    "false"
  );

  inspector.destroy();
});

test("terrain dropdown opens and closes from trigger", () => {
  const root = makeInspectorRoot();
  const inspector = new TileInspector(root);
  const tile = new World({
    width: 1,
    height: 1
  }).getTile(0, 0);

  inspector.setTile(tile);

  const select = root.elements.get("[data-terrain-select]");
  const trigger = root.elements.get("[data-terrain-trigger]");
  const menu = root.elements.get("[data-terrain-menu]");

  trigger.dispatch("click");

  assert.equal(select.classList.contains("open"), true);
  assert.equal(trigger.getAttribute("aria-expanded"), "true");
  assert.equal(menu.hidden, false);

  trigger.dispatch("click");

  assert.equal(select.classList.contains("open"), false);
  assert.equal(trigger.getAttribute("aria-expanded"), "false");
  assert.equal(menu.hidden, true);

  inspector.destroy();
});

test("terrain dropdown selects an option and updates tile data", () => {
  const root = makeInspectorRoot();
  const changes = [];

  const inspector = new TileInspector(root, {
    onTileChange: (tile, property) => {
      changes.push([tile.id, property]);
    }
  });

  const tile = new World({
    width: 1,
    height: 1
  }).getTile(0, 0);

  inspector.setTile(tile);

  root.elements
    .get("[data-terrain-trigger]")
    .dispatch("click");

  root.elements
    .get('[data-terrain-option="water"]')
    .dispatch("click");

  assert.equal(tile.terrain, "water");

  assert.equal(
    root.elements.get("[data-terrain-value]").textContent,
    "water"
  );

  assert.equal(
    root.elements.get("[data-terrain-select]").dataset.value,
    "water"
  );

  assert.equal(
    root.elements
      .get('[data-terrain-option="water"]')
      .getAttribute("aria-checked"),
    "true"
  );

  assert.equal(
    root.elements.get("[data-terrain-menu]").hidden,
    true
  );

  assert.equal(
    root.elements
      .get("[data-terrain-trigger]")
      .getAttribute("aria-expanded"),
    "false"
  );

  assert.deepEqual(changes, [
    [tile.id, "terrain"]
  ]);

  inspector.destroy();
});

test("terrain dropdown preserves unknown existing terrain values", () => {
  const root = makeInspectorRoot();
  const inspector = new TileInspector(root);

  const tile = new World({
    width: 1,
    height: 1
  }).getTile(0, 0);

  tile.terrain = "lava";

  inspector.setTile(tile);

  assert.equal(tile.terrain, "lava");

  assert.equal(
    root.elements.get("[data-terrain-value]").textContent,
    "lava"
  );

  assert.equal(
    root.elements.get("[data-terrain-select]").dataset.value,
    "lava"
  );

  for (const value of ["default", "grass", "water", "stone"]) {
    assert.equal(
      root.elements
        .get(`[data-terrain-option="${value}"]`)
        .getAttribute("aria-checked"),
      "false"
    );
  }

  inspector.destroy();
});

test("terrain dropdown syncs when selected tile changes", () => {
  const root = makeInspectorRoot();
  const inspector = new TileInspector(root);

  const world = new World({
    width: 2,
    height: 1
  });

  const first = world.getTile(0, 0);
  const second = world.getTile(1, 0);

  first.terrain = "grass";
  second.terrain = "water";

  inspector.setTile(first);

  assert.equal(
    root.elements.get("[data-terrain-value]").textContent,
    "grass"
  );

  assert.equal(
    root.elements
      .get('[data-terrain-option="grass"]')
      .getAttribute("aria-checked"),
    "true"
  );

  inspector.setTile(second);

  assert.equal(
    root.elements.get("[data-terrain-value]").textContent,
    "water"
  );

  assert.equal(
    root.elements
      .get('[data-terrain-option="water"]')
      .getAttribute("aria-checked"),
    "true"
  );

  assert.equal(
    root.elements
      .get('[data-terrain-option="grass"]')
      .getAttribute("aria-checked"),
    "false"
  );

  inspector.destroy();
});

test("terrain dropdown closes when selected tile changes", () => {
  const root = makeInspectorRoot();
  const inspector = new TileInspector(root);

  const world = new World({
    width: 2,
    height: 1
  });

  inspector.setTile(world.getTile(0, 0));

  root.elements
    .get("[data-terrain-trigger]")
    .dispatch("click");

  assert.equal(
    root.elements.get("[data-terrain-menu]").hidden,
    false
  );

  inspector.setTile(world.getTile(1, 0));

  assert.equal(
    root.elements.get("[data-terrain-menu]").hidden,
    true
  );

  assert.equal(
    root.elements
      .get("[data-terrain-trigger]")
      .getAttribute("aria-expanded"),
    "false"
  );

  inspector.destroy();
});

test("terrain dropdown is disabled without a selected tile", () => {
  const root = makeInspectorRoot();
  const inspector = new TileInspector(root);

  assert.equal(
    root.elements.get("[data-terrain-trigger]").disabled,
    true
  );

  assert.equal(
    root.elements.get("[data-terrain-menu]").hidden,
    true
  );

  inspector.destroy();
});

test("terrain dropdown closes when clicking outside", () => {
  withMockDocument((mockDocument) => {
    const root = makeInspectorRoot();
    const inspector = new TileInspector(root);

    const tile = new World({
      width: 1,
      height: 1
    }).getTile(0, 0);

    inspector.setTile(tile);

    root.elements
      .get("[data-terrain-trigger]")
      .dispatch("click");

    assert.equal(
      root.elements.get("[data-terrain-menu]").hidden,
      false
    );

    mockDocument.dispatch("click", {
      target: new MockElement()
    });

    assert.equal(
      root.elements.get("[data-terrain-menu]").hidden,
      true
    );

    inspector.destroy();
  });
});

test("terrain dropdown closes with Escape key", () => {
  withMockDocument((mockDocument) => {
    const root = makeInspectorRoot();
    const inspector = new TileInspector(root);

    const tile = new World({
      width: 1,
      height: 1
    }).getTile(0, 0);

    inspector.setTile(tile);

    root.elements
      .get("[data-terrain-trigger]")
      .dispatch("click");

    assert.equal(
      root.elements.get("[data-terrain-menu]").hidden,
      false
    );

    mockDocument.dispatch("keydown", {
      key: "Escape"
    });

    assert.equal(
      root.elements.get("[data-terrain-menu]").hidden,
      true
    );

    inspector.destroy();
  });
});

// --------------------------------------------------
// WALKABLE TOGGLE
// --------------------------------------------------

test("walkable toggle reflects selected tile value", () => {
  const root = makeInspectorRoot();
  const inspector = new TileInspector(root);

  const tile = new World({
    width: 1,
    height: 1
  }).getTile(0, 0);

  tile.walkable = false;

  inspector.setTile(tile);

  assert.equal(
    root.elements.get('[data-input="walkable"]').checked,
    false
  );

  tile.walkable = true;
  inspector.syncValues();

  assert.equal(
    root.elements.get('[data-input="walkable"]').checked,
    true
  );

  inspector.destroy();
});

test("walkable toggle updates tile data and reports model changes", () => {
  const root = makeInspectorRoot();
  const changes = [];

  const inspector = new TileInspector(root, {
    onTileChange: (tile, property) => {
      changes.push([tile.id, property]);
    }
  });

  const tile = new World({
    width: 1,
    height: 1
  }).getTile(0, 0);

  inspector.setTile(tile);

  const walkable = root.elements.get('[data-input="walkable"]');

  walkable.checked = false;
  walkable.dispatch("change");

  assert.equal(tile.walkable, false);

  assert.equal(
    root.elements.get('[data-input="walkable"]').checked,
    false
  );

  walkable.checked = true;
  walkable.dispatch("change");

  assert.equal(tile.walkable, true);

  assert.equal(
    root.elements.get('[data-input="walkable"]').checked,
    true
  );

  assert.deepEqual(changes, [
    [tile.id, "walkable"],
    [tile.id, "walkable"]
  ]);

  inspector.destroy();
});

// --------------------------------------------------
// TILE SELECTION AND SYNCHRONIZATION
// --------------------------------------------------

test("inspector follows newly selected tile", () => {
  const root = makeInspectorRoot();
  const inspector = new TileInspector(root);

  const world = new World({
    width: 2,
    height: 2
  });

  const first = world.getTile(0, 0);
  const second = world.getTile(1, 1);

  first.elevation = 3;
  second.elevation = -2;

  first.terrain = "grass";
  second.terrain = "water";

  inspector.setTile(first);

  assert.equal(
    root.elements.get('[data-input="elevation"]').textContent,
    "3"
  );

  assert.equal(
    root.elements.get("[data-terrain-value]").textContent,
    "grass"
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

  assert.equal(
    root.elements.get("[data-terrain-value]").textContent,
    "water"
  );

  inspector.destroy();
});

test("inspector refreshes values after external tile mutation", () => {
  const root = makeInspectorRoot();
  const inspector = new TileInspector(root);

  const tile = new World({
    width: 1,
    height: 1
  }).getTile(0, 0);

  inspector.setTile(tile);

  tile.elevation = 5;
  tile.terrain = "stone";
  tile.walkable = false;

  inspector.syncValues();

  assert.equal(
    root.elements.get('[data-input="elevation"]').textContent,
    "5"
  );

  assert.equal(
    root.elements.get("[data-terrain-value]").textContent,
    "stone"
  );

  assert.equal(
    root.elements.get('[data-input="walkable"]').checked,
    false
  );

  inspector.destroy();
});

// --------------------------------------------------
// DESTROY AND CLEANUP
// --------------------------------------------------

test("inspector detaches all element listeners on destroy", () => {
  const root = makeInspectorRoot();
  const inspector = new TileInspector(root);

  const tile = new World({
    width: 1,
    height: 1
  }).getTile(0, 0);

  inspector.setTile(tile);
  inspector.destroy();

  const listeners = [
    ["[data-elevation-decrease]", "click"],
    ["[data-elevation-increase]", "click"],
    ["[data-terrain-trigger]", "click"],
    ['[data-input="walkable"]', "change"],
    ['[data-inspector-toggle="identity"]', "click"],
    ['[data-inspector-toggle="properties"]', "click"]
  ];

  for (const value of ["default", "grass", "water", "stone"]) {
    listeners.push([
      `[data-terrain-option="${value}"]`,
      "click"
    ]);
  }

  for (const [selector, event] of listeners) {
    const element = root.elements.get(selector);

    assert.equal(
      element.listeners.get(event)?.size ?? 0,
      0,
      `${selector} should have no ${event} listeners`
    );
  }
});

test("inspector detaches document listeners on destroy", () => {
  withMockDocument((mockDocument) => {
    const root = makeInspectorRoot();
    const inspector = new TileInspector(root);

    inspector.destroy();

    assert.equal(
      mockDocument.listeners.get("click")?.size ?? 0,
      0
    );

    assert.equal(
      mockDocument.listeners.get("keydown")?.size ?? 0,
      0
    );
  });
});

test("inspector ignores interactions after destroy", () => {
  const root = makeInspectorRoot();
  const inspector = new TileInspector(root);

  const tile = new World({
    width: 1,
    height: 1
  }).getTile(0, 0);

  inspector.setTile(tile);
  inspector.destroy();

  root.elements
    .get("[data-elevation-increase]")
    .dispatch("click");

  root.elements
    .get("[data-terrain-trigger]")
    .dispatch("click");

  root.elements
    .get('[data-terrain-option="water"]')
    .dispatch("click");

  root.elements
    .get('[data-input="walkable"]')
    .dispatch("change");

  root.elements
    .get('[data-inspector-toggle="identity"]')
    .dispatch("click");

  assert.equal(tile.elevation, 0);
  assert.equal(tile.terrain, "default");
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

test("inspector destroy is idempotent", () => {
  const root = makeInspectorRoot();
  const inspector = new TileInspector(root);

  inspector.destroy();
  inspector.destroy();

  assert.equal(inspector.currentTile, null);
});

// --------------------------------------------------
// VALIDATION AND INVALID OPERATIONS
// --------------------------------------------------

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

  assert.equal(
    inspector.updateTileProperty("terrain", "water"),
    false
  );

  assert.equal(
    inspector.updateTileProperty("walkable", false),
    false
  );

  inspector.destroy();
});
