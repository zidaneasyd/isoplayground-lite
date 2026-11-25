const TILE_PROPERTIES = new Set(["elevation", "terrain", "walkable"]);

/** Applies one property operation to persistent tile instances. */
export function updateTilesProperty(tiles, property, valueOrUpdater) {
  if (!TILE_PROPERTIES.has(property) || !tiles || typeof tiles[Symbol.iterator] !== "function") {
    return [];
  }

  const changes = [];
  try {
    for (const tile of tiles) {
      const previousValue = tile[property];
      const nextValue = typeof valueOrUpdater === "function"
        ? valueOrUpdater(previousValue, tile)
        : valueOrUpdater;
      if (nextValue === "Mixed") throw new TypeError("Mixed adalah keadaan tampilan, bukan nilai tile.");
      if (Object.is(previousValue, nextValue)) continue;
      tile[property] = nextValue;
      changes.push({ tile, previousValue });
    }
  } catch {
    for (let index = changes.length - 1; index >= 0; index--) {
      const { tile, previousValue } = changes[index];
      tile[property] = previousValue;
    }
    return [];
  }

  return changes.map(({ tile }) => tile);
}
