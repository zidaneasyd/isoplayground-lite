import { CONFIG } from "./core/config.js";
import { Engine } from "./core/engine.js";
import { TileInspector } from "./ui/tile-inspector.js";
import { ObjectInspector } from "./ui/object-inspector.js";
import { WorldObject } from "./objects/world-object.js";

const canvas = document.querySelector("#world");
const inspectorRoot = document.querySelector("#tile-inspector");
const objectInspectorRoot = document.querySelector("#object-inspector");
const objectForm = document.querySelector("[data-object-form]");
const toolStatus = document.querySelector("[data-tool-status]");
const spriteFile = document.querySelector("[data-sprite-file]");
const spriteSelect = objectForm.elements.assetId;
const spriteUrls = new Map();
let objectSequence = 0;

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
    if (object) setToolStatus(`Placed and selected: ${object.name}`);
  }
});

engine.start();

function newId(prefix) {
  const random = globalThis.crypto?.randomUUID?.();
  return `${prefix}-${random ?? `${Date.now().toString(36)}-${(++objectSequence).toString(36)}`}`;
}

function setToolStatus(message, isError = false) {
  toolStatus.textContent = message;
  toolStatus.style.color = isError ? "#f08a8a" : "#9bbcff";
}

function addSpriteOption(id) {
  const option = document.createElement("option");
  option.value = id;
  option.textContent = id;
  spriteSelect.append(option);
}

function removeSprite(assetId) {
  const removed = engine.removeSprite(assetId);
  if (!removed) return false;
  const url = spriteUrls.get(assetId);
  if (url) URL.revokeObjectURL(url);
  spriteUrls.delete(assetId);
  [...spriteSelect.options].find((option) => option.value === assetId)?.remove();
  return true;
}

function openObjectForm() {
  objectForm.hidden = false;
  objectForm.elements.name.focus();
}

function closeObjectForm() {
  objectForm.reset();
  objectForm.hidden = true;
  setToolStatus("");
}

const openObjectButton = document.querySelector("[data-open-object-form]");
const cancelObjectButton = document.querySelector("[data-cancel-object]");
const spriteWidth = document.querySelector("[data-sprite-width]");
const spriteHeight = document.querySelector("[data-sprite-height]");
const onOpenObject = () => openObjectForm();
const onCancelObject = () => closeObjectForm();
const onCreateObject = (event) => {
  event.preventDefault();
  const data = new FormData(objectForm);
  try {
    const width = Number(data.get("width"));
    const height = Number(data.get("height"));
    const elevationOffset = Number(data.get("elevationOffset"));
    if (!Number.isSafeInteger(width) || width < 1 || !Number.isSafeInteger(height) || height < 1) {
      throw new TypeError("Footprint harus berupa bilangan bulat positif.");
    }
    if (!Number.isFinite(elevationOffset)) throw new TypeError("Elevation offset tidak valid.");
    const object = new WorldObject({
      id: newId("object"), type: String(data.get("type")).trim(),
      name: String(data.get("name")).trim(), assetId: String(data.get("assetId") || "") || null,
      x: 0, y: 0, footprint: { width, height }, elevationOffset
    });
    engine.beginObjectPlacement(object);
    closeObjectForm();
    setToolStatus("Placement aktif: klik tile tujuan. Escape atau klik kanan membatalkan.");
  } catch (error) {
    setToolStatus(error instanceof Error ? error.message : "Objek tidak valid.", true);
  }
};
const onImportSprite = async () => {
  const file = spriteFile.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    setToolStatus("Pilih file gambar yang didukung browser.", true);
    spriteFile.value = "";
    return;
  }
  const id = newId("sprite");
  let url;
  try {
    const options = {};
    const width = spriteWidth.value.trim();
    const height = spriteHeight.value.trim();
    if (width) options.width = Number(width);
    if (height) options.height = Number(height);
    url = URL.createObjectURL(file);
    setToolStatus(`Memuat ${file.name}…`);
    await engine.loadSprite(id, url, options);
    spriteUrls.set(id, url);
    addSpriteOption(id);
    spriteSelect.value = id;
    setToolStatus(`Sprite ${file.name} siap digunakan.`);
  } catch (error) {
    engine.removeSprite(id);
    if (url) URL.revokeObjectURL(url);
    setToolStatus(error instanceof Error ? `Gagal memuat gambar: ${error.message}` : "Gagal memuat gambar.", true);
  } finally {
    spriteFile.value = "";
  }
};
const onToolKeyDown = (event) => {
  if (event.key !== "Escape") return;
  closeObjectForm();
  if (engine.getObjectPlacementPreview()) {
    engine.cancelObjectPlacement();
    setToolStatus("Placement dibatalkan.");
  }
};
const onCanvasContextMenu = () => {
  if (engine.getObjectPlacementPreview()) setToolStatus("Placement dibatalkan.");
};
const onCanvasPointerDown = (event) => {
  if (event.button === 2 && engine.getObjectPlacementPreview()) {
    setToolStatus("Placement dibatalkan.");
  }
};
openObjectButton.addEventListener("click", onOpenObject);
cancelObjectButton.addEventListener("click", onCancelObject);
objectForm.addEventListener("submit", onCreateObject);
spriteFile.addEventListener("change", onImportSprite);
window.addEventListener("keydown", onToolKeyDown);
canvas.addEventListener("contextmenu", onCanvasContextMenu);
canvas.addEventListener("pointerdown", onCanvasPointerDown);

// Small runtime API for loading assets and creating/managing world objects.
const applicationApi = Object.freeze({
  engine,
  world: engine.world,
  loadSprite: (assetId, source, options) => engine.loadSprite(assetId, source, options),
  removeSprite,
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
  openObjectButton.removeEventListener("click", onOpenObject);
  cancelObjectButton.removeEventListener("click", onCancelObject);
  objectForm.removeEventListener("submit", onCreateObject);
  spriteFile.removeEventListener("change", onImportSprite);
  window.removeEventListener("keydown", onToolKeyDown);
  canvas.removeEventListener("contextmenu", onCanvasContextMenu);
  canvas.removeEventListener("pointerdown", onCanvasPointerDown);
  for (const url of spriteUrls.values()) URL.revokeObjectURL(url);
  spriteUrls.clear();
  if (window.isoPlayground === applicationApi) delete window.isoPlayground;
}, { once: true });
