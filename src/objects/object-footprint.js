function validatePositiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new TypeError(`${label} harus berupa bilangan bulat positif.`);
  }
}

function validateGridCoordinate(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${label} harus berupa bilangan bulat non-negatif.`);
  }
}

/**
 * Describes the rectangular grid area occupied by one object.
 * The object anchor is the minimum (x, y) grid coordinate; width extends
 * along +X and height extends along +Y. Returned cells follow diagonal order.
 */
export class ObjectFootprint {
  constructor(dimensions = undefined) {
    if (dimensions === undefined) {
      dimensions = { width: 1, height: 1 };
    }
    if (
      dimensions === null ||
      typeof dimensions !== "object" ||
      Array.isArray(dimensions)
    ) {
      throw new TypeError("Footprint harus berupa object berisi width dan height.");
    }

    const { width, height } = dimensions;
    validatePositiveInteger(width, "Lebar footprint");
    validatePositiveInteger(height, "Tinggi footprint");

    Object.defineProperties(this, {
      width: { value: width, enumerable: true },
      height: { value: height, enumerable: true }
    });
  }

  /** Returns every covered grid coordinate in the world's diagonal order. */
  getGridCells(anchorX, anchorY) {
    validateGridCoordinate(anchorX, "Anchor X");
    validateGridCoordinate(anchorY, "Anchor Y");

    const cells = [];
    for (let diagonal = 0; diagonal <= this.width + this.height - 2; diagonal++) {
      for (let offsetX = 0; offsetX < this.width; offsetX++) {
        const offsetY = diagonal - offsetX;
        if (offsetY < 0 || offsetY >= this.height) continue;

        cells.push({
          x: anchorX + offsetX,
          y: anchorY + offsetY
        });
      }
    }

    return cells;
  }

  /** Checks whether a grid coordinate belongs to this footprint at an anchor. */
  contains(x, y, anchorX, anchorY) {
    validateGridCoordinate(x, "Koordinat X");
    validateGridCoordinate(y, "Koordinat Y");
    validateGridCoordinate(anchorX, "Anchor X");
    validateGridCoordinate(anchorY, "Anchor Y");

    return (
      x >= anchorX &&
      x < anchorX + this.width &&
      y >= anchorY &&
      y < anchorY + this.height
    );
  }

  /** Returns whether the entire footprint fits inside the supplied world size. */
  fitsWithinWorld(worldWidth, worldHeight, anchorX, anchorY) {
    validatePositiveInteger(worldWidth, "Lebar world");
    validatePositiveInteger(worldHeight, "Tinggi world");
    validateGridCoordinate(anchorX, "Anchor X");
    validateGridCoordinate(anchorY, "Anchor Y");

    return (
      anchorX + this.width <= worldWidth &&
      anchorY + this.height <= worldHeight
    );
  }

  /**
   * Resolves the footprint to persistent tile references from a World.
   * Returns null when any part falls outside the world.
   */
  getCoveredTiles(world, anchorX, anchorY) {
    if (
      world === null ||
      typeof world !== "object" ||
      typeof world.getTile !== "function" ||
      !Number.isSafeInteger(world.width) ||
      !Number.isSafeInteger(world.height) ||
      world.width < 1 ||
      world.height < 1
    ) {
      throw new TypeError("Footprint membutuhkan World dengan ukuran dan getTile yang valid.");
    }

    if (!this.fitsWithinWorld(world.width, world.height, anchorX, anchorY)) {
      return null;
    }

    const tiles = this.getGridCells(anchorX, anchorY).map(({ x, y }) => {
      return world.getTile(x, y);
    });

    return tiles.every((tile) => tile !== null && tile !== undefined) ? tiles : null;
  }

  toJSON() {
    return {
      width: this.width,
      height: this.height
    };
  }
}
