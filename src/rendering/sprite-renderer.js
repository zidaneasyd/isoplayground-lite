import { getObjectWorldPosition } from "../objects/object-elevation.js";

function isValidWorld(world) {
  return Boolean(
    world && world.objects && typeof world.objects.getObjects === "function" &&
    typeof world.getTile === "function"
  );
}

/**
 * Builds and draws sprite commands for persistent WorldObjects.
 * Sprite ground anchors are centered over their rectangular footprint. The
 * command depth uses that footprint center so sprites can be interleaved with
 * grid tiles instead of being painted over the entire world as a final layer.
 */
export class SpriteRenderer {
  constructor(ctx, config, assetManager = null) {
    if (!ctx || typeof ctx !== "object") {
      throw new TypeError("SpriteRenderer membutuhkan Canvas 2D context.");
    }
    if (!config?.tile || typeof config.tile !== "object") {
      throw new TypeError("SpriteRenderer membutuhkan konfigurasi tile.");
    }
    if (assetManager !== null && typeof assetManager.get !== "function") {
      throw new TypeError("Asset manager harus menyediakan get().");
    }

    this.ctx = ctx;
    this.config = config;
    this.assetManager = assetManager;
  }

  /** Returns drawable sprite commands sorted by stable isometric ground depth. */
  getRenderCommands(world) {
    if (!isValidWorld(world) || !this.assetManager) return [];

    const { width: tileWidth, height: tileHeight } = this.config.tile;
    const commands = [];
    let order = 0;

    for (const object of world.objects.getObjects()) {
      order++;
      if (!object || typeof object.assetId !== "string" || object.assetId === "") continue;
      const asset = this.assetManager.get(object.assetId);
      if (!asset || !asset.image || !Number.isFinite(asset.width) || asset.width <= 0 ||
          !Number.isFinite(asset.height) || asset.height <= 0) continue;

      const position = getObjectWorldPosition(world, object, this.config.tile);
      if (!position) continue;

      const footprint = object.footprint;
      const offsetX = (footprint.width - 1) / 2;
      const offsetY = (footprint.height - 1) / 2;
      const groundX = position.x + (offsetX - offsetY) * tileWidth / 2;
      const groundY = position.y + (offsetX + offsetY) * tileHeight / 2;
      const centerX = object.x + offsetX;
      const centerY = object.y + offsetY;
      const depth = centerX + centerY;
      const secondaryDepth = centerX - centerY;

      commands.push({
        type: "sprite",
        objectId: object.id,
        depth,
        secondaryDepth,
        order,
        image: asset.image,
        x: groundX - asset.width * asset.anchorX,
        y: groundY - asset.height * asset.anchorY,
        width: asset.width,
        height: asset.height,
        imageSmoothingEnabled: asset.imageSmoothingEnabled
      });
    }

    return commands.sort((a, b) =>
      a.depth - b.depth ||
      a.secondaryDepth - b.secondaryDepth ||
      a.order - b.order
    );
  }

  /** Draws one prepared sprite command in the Renderer world transform. */
  draw(command) {
    if (!command || typeof this.ctx.drawImage !== "function") return false;

    const { ctx } = this;
    const previousSmoothing = ctx.imageSmoothingEnabled;
    ctx.save?.();
    if (command.imageSmoothingEnabled !== null && command.imageSmoothingEnabled !== undefined) {
      ctx.imageSmoothingEnabled = command.imageSmoothingEnabled;
    }

    ctx.drawImage(
      command.image,
      command.x,
      command.y,
      command.width,
      command.height
    );

    ctx.restore?.();
    if (previousSmoothing !== undefined) ctx.imageSmoothingEnabled = previousSmoothing;
    return true;
  }
}
