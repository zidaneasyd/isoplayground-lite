import { CONFIG } from "./core/config.js";
import { Engine } from "./core/engine.js";

const canvas = document.querySelector("#world");
const engine = new Engine(canvas, CONFIG);
engine.start();
