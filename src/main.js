import { CONFIG } from "./core/config.js";
import { Engine } from "./core/engine.js";
import { TileInspector } from "./ui/tile-inspector.js";

const canvas = document.querySelector("#world");
const inspectorRoot = document.querySelector("#tile-inspector");

let engine;
const inspector = new TileInspector(inspectorRoot, {
  onTileChange: () => engine?.refreshWorldView()
});

engine = new Engine(canvas, CONFIG, {
  onSelectionChange: (_focusedTile, tiles) => inspector.setTiles(tiles),
  onElevationChange: () => inspector.syncValues()
});

engine.start();

window.addEventListener("pagehide", () => {
  engine.destroy();
  inspector.destroy();
}, { once: true });
