import { GameLoop } from "./game-loop.js";
import { World } from "../world/world.js";
import { Camera } from "../camera/camera.js";
import { Renderer } from "../rendering/renderer.js";

export class Engine {
  constructor(canvas, config) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.config = config;
    this.world = new World(config.world);
    this.camera = new Camera(config.camera);
    this.renderer = new Renderer(this.ctx, config);
    this.loop = new GameLoop(
      (deltaTime) => this.update(deltaTime),
      () => this.render()
    );
    this.resize = this.resize.bind(this);
    window.addEventListener("resize", this.resize);
    this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(this.canvas.clientWidth * dpr);
    this.canvas.height = Math.floor(this.canvas.clientHeight * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.renderer.setViewport(
      this.canvas.clientWidth,
      this.canvas.clientHeight
    );
    this.render();
  }

  update(deltaTime) {
    this.camera.update(deltaTime);
  }

  render() {
    this.renderer.render(this.world, this.camera);
  }

  start() {
    this.loop.start();
  }

  stop() {
    this.loop.stop();
  }
}
