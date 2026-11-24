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

  #traceTileDiamond(p, elevatedY, tileW, tileH) {
    const { ctx } = this;
    ctx.beginPath();
    ctx.moveTo(p.x, elevatedY);
    ctx.lineTo(p.x + tileW / 2, elevatedY + tileH / 2);
    ctx.lineTo(p.x, elevatedY + tileH);
    ctx.lineTo(p.x - tileW / 2, elevatedY + tileH / 2);
    ctx.closePath();
  }

  render(world, camera, { hoveredTileId = null, selectedTileId = null } = {}) {
    const { ctx, config } = this;
    const { width: tileW, height: tileH, elevationStep } = config.tile;
    const zoom = camera.zoom;

    ctx.clearRect(0, 0, this.width, this.height);
    ctx.fillStyle = config.colors.background;
    ctx.fillRect(0, 0, this.width, this.height);

    // These are the center of the full diamond bounds, including tile corners.
    const worldCenterX = (world.width - world.height) * tileW / 4;
    const worldCenterY = (world.width + world.height) * tileH / 4;
    const offsetX = this.width / 2 - worldCenterX * zoom + camera.x;
    const offsetY = this.height / 2 - worldCenterY * zoom + camera.y;

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(zoom, zoom);

    let hoveredOverlay = null;
    let selectedOverlay = null;

    for (const tile of world.getTiles()) {
      const { x, y, elevation = 0 } = tile;
      const isHovered = tile.id === hoveredTileId;
      const isSelected = tile.id === selectedTileId;
      const p = gridToScreen(x, y, tileW, tileH);
      const elevatedY = p.y - elevation * elevationStep;

      this.#traceTileDiamond(p, elevatedY, tileW, tileH);

      ctx.fillStyle = isSelected
        ? (config.colors.selected ?? "#6f5a9e")
        : isHovered
        ? (config.colors.hover ?? "#8f7438")
        : config.colors.ground;
      ctx.fill();

      // Base grid outline for all tiles.
      ctx.strokeStyle = config.colors.grid;
      ctx.lineWidth = 1 / zoom;
      ctx.stroke();

      if (isHovered && !isSelected) {
        hoveredOverlay = { p, elevatedY };
      }
      if (isSelected) {
        selectedOverlay = { p, elevatedY };
      }
    }

    // Draw full 4-edge active outlines on top so neighboring tiles never overlap them.
    if (hoveredOverlay) {
      this.#traceTileDiamond(hoveredOverlay.p, hoveredOverlay.elevatedY, tileW, tileH);
      ctx.strokeStyle = config.colors.hoverOutline ?? "#f0d58a";
      ctx.lineWidth = 1 / zoom;
      ctx.stroke();
    }

    if (selectedOverlay) {
      this.#traceTileDiamond(selectedOverlay.p, selectedOverlay.elevatedY, tileW, tileH);
      ctx.strokeStyle = config.colors.selectedOutline ?? "#d7c4ff";
      ctx.lineWidth = 1 / zoom;
      ctx.stroke();
    }

    ctx.restore();
  }
}