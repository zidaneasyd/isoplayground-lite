import { CONFIG } from "./core/config.js";
import { Engine } from "./core/engine.js";
import { TileInspector } from "./ui/tile-inspector.js";
import { ObjectInspector } from "./ui/object-inspector.js";
import { WorldObject } from "./objects/world-object.js";

const canvas = document.querySelector("#world");
const inspectorRoot = document.querySelector("#tile-inspector");
const objectInspectorRoot = document.querySelector("#object-inspector");

let engine;
const inspector = new TileInspector(inspectorRoot, {
  onTileChange: () => engine?.refreshWorldView()
});
const objectInspector = new ObjectInspector(objectInspectorRoot, {
  onChange: (object, changes) => {
    if (!engine || !changes.footprint.fitsWithinWorld(
      engine.world.width, engine.world.height, changes.x, changes.y
    )) {
      throw new RangeError("Footprint objek harus berada sepenuhnya di dalam world.");
    }
    if (!engine.world.getTile(changes.x, changes.y)) {
      throw new RangeError("Anchor objek tidak berada di dalam world.");
    }
    object.name = changes.name;
    object.assetId = changes.assetId;
    object.x = changes.x;
    object.y = changes.y;
    object.footprint = changes.footprint;
    object.elevationOffset = changes.elevationOffset;
    object.properties = changes.properties;
    engine.refreshWorldView();
  },
  onMove: (id) => engine?.beginObjectMove(id),
  onDelete: (id) => engine?.removeWorldObject(id)
});

engine = new Engine(canvas, CONFIG, {
  onSelectionChange: (_focusedTile, tiles) => inspector.setTiles(tiles),
  onElevationChange: () => inspector.syncValues(),
  onObjectSelectionChange: (object) => {
    objectInspector.setObject(object);
    objectInspectorRoot.hidden = !object;
    inspectorRoot.hidden = Boolean(object);
  }
});

engine.start();

// Small runtime API for loading assets and creating/managing world objects.
const applicationApi = Object.freeze({
  engine,
  world: engine.world,
  loadSprite: (assetId, source, options) => engine.loadSprite(assetId, source, options),
  removeSprite: (assetId) => engine.removeSprite(assetId),
  createObject: (definition) => {
    const object = new WorldObject(definition);
    engine.beginObjectPlacement(object);
    return object;
  },
  beginObjectMove: (objectId) => engine.beginObjectMove(objectId),
  removeObject: (objectId) => engine.removeWorldObject(objectId)
});
window.isoPlayground = applicationApi;

window.addEventListener("pagehide", () => {
  engine.destroy();
  inspector.destroy();
  objectInspector.destroy();
  if (window.isoPlayground === applicationApi) delete window.isoPlayground;
}, { once: true });
