/**
 * Mengubah koordinat grid (vertex atas tile) menjadi koordinat isometrik.
 * Dipertahankan sebagai transformasi dasar yang digunakan Renderer.
 */
export function gridToScreen(x, y, tileWidth, tileHeight) {
  return {
    x: (x - y) * tileWidth / 2,
    y: (x + y) * tileHeight / 2
  };
}

function isPositiveFinite(value) {
  return Number.isFinite(value) && value > 0;
}

function isValidWorldAndTile(world, tile) {
  return Boolean(
    world && tile &&
    isPositiveFinite(world.width) && isPositiveFinite(world.height) &&
    isPositiveFinite(tile.width) && isPositiveFinite(tile.height)
  );
}

/**
 * Invers matematis gridToScreen untuk titik pada ruang isometrik.
 * Hasilnya berada pada koordinat vertex grid, bukan koordinat layar.
 */
export function isometricToGrid(worldX, worldY, tileWidth, tileHeight) {
  if (
    !Number.isFinite(worldX) || !Number.isFinite(worldY) ||
    !isPositiveFinite(tileWidth) || !isPositiveFinite(tileHeight)
  ) return null;

  const u = worldX / (tileWidth / 2);
  const v = worldY / (tileHeight / 2);
  return {
    x: (u + v) / 2,
    y: (v - u) / 2
  };
}

/**
 * Pusat bounding diamond seluruh dunia pada ruang isometrik.
 * Rumus ini harus tetap identik dengan titik acuan yang digunakan Renderer.
 */
export function getWorldCenter(world, tile) {
  if (!isValidWorldAndTile(world, tile)) return null;

  return {
    x: (world.width - world.height) * tile.width / 4,
    y: (world.width + world.height) * tile.height / 4
  };
}

function isValidView(view) {
  if (!view || typeof view !== "object") return false;

  const { camera, world, tile, viewportWidth, viewportHeight } = view;
  return Boolean(
    camera && Number.isFinite(camera.x) && Number.isFinite(camera.y) &&
    isPositiveFinite(camera.zoom) &&
    isValidWorldAndTile(world, tile) &&
    isPositiveFinite(viewportWidth) && isPositiveFinite(viewportHeight)
  );
}

/**
 * Membalik transformasi Renderer: posisi layar (piksel CSS relatif terhadap
 * canvas) menjadi koordinat isometrik dunia. Pan, zoom, pusat dunia, dan
 * elevasi diperhitungkan.
 *
 * Jika elevasi tidak diberikan, world.baseElevation digunakan.
 */
export function screenToIso(screenX, screenY, view) {
  if (!Number.isFinite(screenX) || !Number.isFinite(screenY) || !isValidView(view)) {
    return null;
  }

  const { camera, world, tile, viewportWidth, viewportHeight } = view;
  const center = getWorldCenter(world, tile);
  if (!center) return null;

  const elevation = view.elevation === undefined
    ? (Number.isFinite(world.baseElevation) ? world.baseElevation : 0)
    : view.elevation;
  const elevationStep = tile.elevationStep === undefined ? 0 : tile.elevationStep;
  if (!Number.isFinite(elevation) || !Number.isFinite(elevationStep)) return null;

  return {
    x: (screenX - viewportWidth / 2 - camera.x) / camera.zoom + center.x,
    y: (screenY - viewportHeight / 2 - camera.y) / camera.zoom + center.y + elevation * elevationStep
  };
}

/**
 * Mengubah posisi layar menjadi koordinat grid kontinu.
 * Pada pusat tile (x, y), hasilnya tepat { x, y }. Nilai pecahan menunjukkan
 * posisi relatif di dalam tile. Fungsi ini membalik transformasi Renderer
 * termasuk pan, zoom, offset viewport, pusat dunia, dan elevasi.
 */
export function screenToGrid(screenX, screenY, view) {
  const iso = screenToIso(screenX, screenY, view);
  if (!iso) return null;

  return isometricToGrid(
    iso.x,
    iso.y - view.tile.height / 2,
    view.tile.width,
    view.tile.height
  );
}

/**
 * Mengubah posisi layar menjadi indeks tile integer {x, y} atau null bila
 * titik berada di luar dunia. Batas bersama memakai aturan half-open:
 * titik tepat pada garis batas masuk ke indeks yang lebih besar.
 */
export function screenToTile(screenX, screenY, view) {
  const grid = screenToGrid(screenX, screenY, view);
  if (!grid || !view?.world) return null;

  const x = Math.floor(grid.x + 0.5);
  const y = Math.floor(grid.y + 0.5);
  if (x < 0 || y < 0 || x >= view.world.width || y >= view.world.height) return null;
  return { x, y };
}
