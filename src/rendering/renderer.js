import { gridToScreen } from "../world/coordinates.js";

export class Renderer {
  constructor(ctx, config) {
    this.ctx = ctx;
    this.config = config;
    this.width = 0;
    this.height = 0;
  }

  setViewport(width, height) {
    this.width = width;
    this.height = height;
  }

  render(world, camera) {
    const { ctx, config } = this;
    const { width: tileW, height: tileH, elevationStep } = config.tile;

    ctx.clearRect(0, 0, this.width, this.height);
    ctx.fillStyle = config.colors.background;
    ctx.fillRect(0, 0, this.width, this.height);

    // Pusatkan keseluruhan diamond dunia pada viewport.
    const worldCenterX = (world.width - world.height) * tileW / 4;
    const worldCenterY = (world.width + world.height) * tileH / 4;
    const offsetX = this.width / 2 - worldCenterX + camera.x;
    const offsetY = this.height / 2 - worldCenterY + camera.y;

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(camera.zoom, camera.zoom);

    for (const { x, y, elevation = 0 } of world.getTiles()) {
      const p = gridToScreen(x, y, tileW, tileH);
      const elevatedY = p.y - elevation * elevationStep;

      ctx.beginPath();
      ctx.moveTo(p.x, elevatedY);
      ctx.lineTo(p.x + tileW / 2, elevatedY + tileH / 2);
      ctx.lineTo(p.x, elevatedY + tileH);
      ctx.lineTo(p.x - tileW / 2, elevatedY + tileH / 2);
      ctx.closePath();

      ctx.fillStyle = config.colors.ground;
      ctx.fill();

      ctx.strokeStyle = config.colors.grid;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.restore();
  }
}
