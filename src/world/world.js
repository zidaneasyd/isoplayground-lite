import { Grid } from "./grid.js";

export class World {
  constructor({ width, height }) {
    this.width = width;
    this.height = height;
    this.grid = new Grid(width, height);
  }

  getTiles() {
    return this.grid.tiles();
  }
}
