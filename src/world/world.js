import { Grid } from "./grid.js";

export class World {
  constructor({ width, height, baseElevation = 0 }) {
    this.width = width;
    this.height = height;
    this.baseElevation = baseElevation;
    this.grid = new Grid(width, height);
  }

  *getTiles() {
    for (const tile of this.grid.tiles()) {
      yield {
        ...tile,
        elevation: this.baseElevation
      };
    }
  }
}
