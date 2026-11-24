export function gridToScreen(x, y, tileWidth, tileHeight) {
  return {
    x: (x - y) * tileWidth / 2,
    y: (x + y) * tileHeight / 2
  };
}
