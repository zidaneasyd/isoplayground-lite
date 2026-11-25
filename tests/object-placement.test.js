import test from "node:test";
import assert from "node:assert/strict";
import { ObjectPlacement } from "../src/interaction/object-placement.js";
import { WorldObject } from "../src/objects/world-object.js";
import { World } from "../src/world/world.js";

function createObject(id, x = 0, y = 0, width = 1, height = 1) {
  return new WorldObject({
    id,
    type: "prop",
    x,
    y,
    footprint: { width, height }
  });
}

test("object placement validates the World dependency", () => {
  for (const value of [null, undefined, {}, { objects: {} }]) {
    assert.throws(() => new ObjectPlacement(value), TypeError);
  }
});

test("object placement starts a new object without registering it before confirmation", () => {
  const world = new World({ width: 8, height: 8 });
  const placement = new ObjectPlacement(world);
  const object = createObject("pool-1", 2, 1, 5, 7);

  assert.equal(placement.active, false);
  assert.equal(placement.beginPlacement(object), true);
  assert.equal(placement.active, true);
  assert.equal(world.objects.size, 0);
  assert.equal(world.objects.getById("pool-1"), null);
  assert.deepEqual(placement.getPreview(), {
    mode: "place",
    objectId: "pool-1",
    x: 2,
    y: 1,
    width: 5,
    height: 7,
    anchorElevation: 0,
    elevationOffset: 0,
    elevation: 0,
    valid: true,
    reason: null,
    cells: object.footprint.getGridCells(2, 1)
  });
});

test("object placement accepts only new WorldObject instances", () => {
  const placement = new ObjectPlacement(new World({ width: 4, height: 4 }));
  assert.throws(() => placement.beginPlacement({ id: "plain" }), TypeError);
  assert.throws(() => placement.beginPlacement(null), TypeError);
  assert.equal(placement.active, false);
});

test("object placement rejects an ID already registered in the world", () => {
  const world = new World({ width: 4, height: 4 });
  world.objects.add(createObject("prop-1"));
  const placement = new ObjectPlacement(world);

  assert.throws(() => placement.beginPlacement(createObject("prop-1")), /sudah terdaftar/);
  assert.equal(placement.active, false);
  assert.equal(world.objects.size, 1);
});

test("object placement updates a preview without mutating the draft object", () => {
  const placement = new ObjectPlacement(new World({ width: 8, height: 8 }));
  const object = createObject("pool-1", 0, 0, 5, 7);
  placement.beginPlacement(object);

  placement.updatePreview(2, 1);
  const preview = placement.getPreview();
  assert.equal(preview.x, 2);
  assert.equal(preview.y, 1);
  assert.equal(preview.valid, true);
  assert.equal(object.x, 0);
  assert.equal(object.y, 0);
});

test("object placement marks a footprint crossing world bounds invalid", () => {
  const placement = new ObjectPlacement(new World({ width: 8, height: 9 }));
  placement.beginPlacement(createObject("pool-1", 0, 0, 5, 7));

  placement.updatePreview(4, 1);
  assert.equal(placement.getPreview().valid, false);
  assert.equal(placement.getPreview().reason, "out-of-bounds");
  assert.equal(placement.getPreview().cells.length, 35);
  assert.equal(placement.confirm(), false);
  assert.equal(placement.active, true);
});

test("object placement can clear the candidate when the pointer leaves the world", () => {
  const placement = new ObjectPlacement(new World({ width: 4, height: 4 }));
  placement.beginPlacement(createObject("prop-1"));

  placement.updatePreview(null, null);
  assert.equal(placement.getPreview().valid, false);
  assert.equal(placement.getPreview().reason, "no-target");
  assert.deepEqual(placement.getPreview().cells, []);
  assert.equal(placement.confirm(), false);
});

test("object placement rejects malformed preview coordinates", () => {
  const placement = new ObjectPlacement(new World({ width: 4, height: 4 }));
  placement.beginPlacement(createObject("prop-1"));

  for (const [x, y] of [[-1, 0], [0, -1], [1.5, 0], [0, NaN], [null, 1], [1, null]]) {
    assert.throws(() => placement.updatePreview(x, y), TypeError);
  }
});

test("confirm registers an object only once at the confirmed anchor", () => {
  const world = new World({ width: 8, height: 8 });
  const placement = new ObjectPlacement(world);
  const object = createObject("pool-1", 0, 0, 5, 7);
  placement.beginPlacement(object);
  placement.updatePreview(2, 1);

  assert.equal(placement.confirm(), object);
  assert.equal(placement.active, false);
  assert.equal(world.objects.getById("pool-1"), object);
  assert.equal(world.objects.size, 1);
  assert.equal(object.x, 2);
  assert.equal(object.y, 1);
  assert.equal(placement.confirm(), false);
});

test("cancel removes a new-object preview without storing or mutating the object", () => {
  const world = new World({ width: 8, height: 8 });
  const placement = new ObjectPlacement(world);
  const object = createObject("pool-1", 1, 2, 3, 2);
  placement.beginPlacement(object);
  placement.updatePreview(4, 4);

  assert.equal(placement.cancel(), true);
  assert.equal(placement.cancel(), false);
  assert.equal(placement.active, false);
  assert.equal(placement.getPreview(), null);
  assert.equal(world.objects.size, 0);
  assert.equal(object.x, 1);
  assert.equal(object.y, 2);
});

test("object placement prevents two concurrent placement sessions", () => {
  const placement = new ObjectPlacement(new World({ width: 4, height: 4 }));
  placement.beginPlacement(createObject("prop-1"));
  assert.throws(() => placement.beginPlacement(createObject("prop-2")), /masih aktif/);
  assert.throws(() => placement.beginMove("missing"), /masih aktif/);
});

test("beginMove resolves an existing object and previews its original anchor", () => {
  const world = new World({ width: 6, height: 6 });
  const object = createObject("prop-1", 2, 3, 2, 2);
  world.objects.add(object);
  const placement = new ObjectPlacement(world);

  assert.equal(placement.beginMove("prop-1"), true);
  assert.equal(placement.getPreview().mode, "move");
  assert.equal(placement.getPreview().x, 2);
  assert.equal(placement.getPreview().y, 3);
  assert.equal(placement.getPreview().valid, true);

  const missingPlacement = new ObjectPlacement(world);
  assert.equal(missingPlacement.beginMove("missing"), false);
});

test("moving an object changes its anchor only after a valid confirmation", () => {
  const world = new World({ width: 8, height: 8 });
  const object = createObject("pool-1", 1, 1, 5, 7);
  world.objects.add(object);
  const placement = new ObjectPlacement(world);
  placement.beginMove(object.id);

  placement.updatePreview(4, 1);
  assert.equal(placement.getPreview().valid, false);
  assert.equal(object.x, 1);
  assert.equal(object.y, 1);
  assert.equal(placement.confirm(), false);

  placement.updatePreview(2, 1);
  assert.equal(placement.confirm(), object);
  assert.equal(object.x, 2);
  assert.equal(object.y, 1);
  assert.equal(world.objects.getById(object.id), object);
  assert.equal(world.objects.size, 1);
});

test("canceling a move preserves the stored object's anchor", () => {
  const world = new World({ width: 6, height: 6 });
  const object = createObject("prop-1", 2, 2, 2, 2);
  world.objects.add(object);
  const placement = new ObjectPlacement(world);
  placement.beginMove(object.id);
  placement.updatePreview(4, 4);

  assert.equal(placement.cancel(), true);
  assert.equal(object.x, 2);
  assert.equal(object.y, 2);
  assert.equal(world.objects.getById(object.id), object);
});

test("moving an object that was removed during preview cannot be confirmed", () => {
  const world = new World({ width: 6, height: 6 });
  const object = createObject("prop-1", 2, 2);
  world.objects.add(object);
  const placement = new ObjectPlacement(world);
  placement.beginMove(object.id);
  world.objects.remove(object.id);

  assert.equal(placement.getPreview().valid, false);
  assert.equal(placement.getPreview().reason, "object-removed");
  assert.equal(placement.confirm(), false);
});

test("object placement allows footprint overlap until collision rules are introduced", () => {
  const world = new World({ width: 6, height: 6 });
  world.objects.add(createObject("first", 1, 1, 3, 3));
  const placement = new ObjectPlacement(world);
  placement.beginPlacement(createObject("second", 2, 2, 3, 3));

  assert.equal(placement.getPreview().valid, true);
  assert.equal(placement.confirm().id, "second");
  assert.equal(world.objects.size, 2);
});


test("placement preview resolves the anchor tile elevation plus object offset", () => {
  const world = new World({ width: 6, height: 6 });
  world.getTile(2, 3).elevation = 4;
  const object = new WorldObject({
    id: "raised-pool",
    type: "prop",
    x: 2,
    y: 3,
    footprint: { width: 3, height: 2 },
    elevationOffset: 1.5
  });
  const placement = new ObjectPlacement(world);

  placement.beginPlacement(object);
  assert.deepEqual(
    (({ anchorElevation, elevationOffset, elevation }) => ({ anchorElevation, elevationOffset, elevation }))(placement.getPreview()),
    { anchorElevation: 4, elevationOffset: 1.5, elevation: 5.5 }
  );
  assert.equal(world.getTile(2, 3).elevation, 4);
});

test("placement preview follows live anchor elevation changes without caching tile elevation", () => {
  const world = new World({ width: 6, height: 6 });
  const anchorTile = world.getTile(2, 3);
  anchorTile.elevation = 3;
  const object = createObject("dynamic-object", 2, 3);
  const placement = new ObjectPlacement(world);
  placement.beginPlacement(object);

  assert.equal(placement.getPreview().elevation, 3);
  anchorTile.elevation = -2;
  assert.equal(placement.getPreview().anchorElevation, -2);
  assert.equal(placement.getPreview().elevation, -2);
  assert.equal(object.elevationOffset, 0);
});

test("moving an object previews the destination anchor elevation and preserves its offset", () => {
  const world = new World({ width: 8, height: 8 });
  world.getTile(1, 1).elevation = 2;
  world.getTile(4, 3).elevation = -3;
  const object = new WorldObject({
    id: "moving-object",
    type: "prop",
    x: 1,
    y: 1,
    elevationOffset: -0.5
  });
  world.objects.add(object);
  const placement = new ObjectPlacement(world);

  placement.beginMove(object.id);
  assert.equal(placement.getPreview().elevation, 1.5);
  placement.updatePreview(4, 3);
  assert.equal(placement.getPreview().anchorElevation, -3);
  assert.equal(placement.getPreview().elevation, -3.5);
  assert.equal(object.x, 1);
  assert.equal(object.y, 1);

  assert.equal(placement.confirm(), object);
  assert.equal(object.x, 4);
  assert.equal(object.y, 3);
  assert.equal(object.elevationOffset, -0.5);
  assert.equal(world.getTile(4, 3).elevation, -3);
});

test("placement reports a missing anchor tile as invalid", () => {
  const world = new World({ width: 4, height: 4 });
  world.getTile = () => null;
  const placement = new ObjectPlacement(world);
  placement.beginPlacement(createObject("missing-anchor"));

  assert.equal(placement.getPreview().valid, false);
  assert.equal(placement.getPreview().reason, "missing-anchor");
  assert.equal(placement.confirm(), false);
  assert.equal(placement.active, true);
});
