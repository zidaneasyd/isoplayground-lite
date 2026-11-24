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

  #fillSideFace(points, color) {
  const { ctx } = this;

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }

  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

#drawElevationSides(world, tile, p, elevatedY, tileW, tileH, elevationStep) {
  if (!Number.isFinite(elevationStep) || elevationStep <= 0) return;

  const baseElevation = Number.isFinite(world.baseElevation)
    ? world.baseElevation
    : 0;

  // Sisi kanan: berbatasan dengan tile x + 1.
  const rightNeighbor = world.getTile(tile.x + 1, tile.y);
  const rightNeighborElevation = rightNeighbor
    ? rightNeighbor.elevation
    : baseElevation;

  const rightDepth =
    (tile.elevation - rightNeighborElevation) * elevationStep;

  if (rightDepth > 0) {
    const rightTop = {
      x: p.x + tileW / 2,
      y: elevatedY + tileH / 2
    };

    const bottomTop = {
      x: p.x,
      y: elevatedY + tileH
    };

    this.#fillSideFace(
      [
        rightTop,
        bottomTop,
        { x: bottomTop.x, y: bottomTop.y + rightDepth },
        { x: rightTop.x, y: rightTop.y + rightDepth }
      ],
      this.config.colors.sideRight
    );
  }

  // Sisi kiri: berbatasan dengan tile y + 1.
  const leftNeighbor = world.getTile(tile.x, tile.y + 1);
  const leftNeighborElevation = leftNeighbor
    ? leftNeighbor.elevation
    : baseElevation;

  const leftDepth =
    (tile.elevation - leftNeighborElevation) * elevationStep;

  if (leftDepth > 0) {
    const bottomTop = {
      x: p.x,
      y: elevatedY + tileH
    };

    const leftTop = {
      x: p.x - tileW / 2,
      y: elevatedY + tileH / 2
    };

    this.#fillSideFace(
      [
        bottomTop,
        leftTop,
        { x: leftTop.x, y: leftTop.y + leftDepth },
        { x: bottomTop.x, y: bottomTop.y + leftDepth }
      ],
      this.config.colors.sideLeft
    );
  }
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

this.#drawElevationSides(
  world,
  tile,
  p,
  elevatedY,
  tileW,
  tileH,
  elevationStep
);

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
      ctx.lineWidth = 2 / zoom;
      ctx.stroke();
    }

    if (selectedOverlay) {
      this.#traceTileDiamond(selectedOverlay.p, selectedOverlay.elevatedY, tileW, tileH);
      ctx.strokeStyle = config.colors.selectedOutline ?? "#d7c4ff";
      ctx.lineWidth = 2 / zoom;
      ctx.stroke();
    }

    ctx.restore();
  }
}