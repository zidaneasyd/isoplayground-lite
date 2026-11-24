export class Camera {
  constructor(config) {
    this.x = config.x;
    this.y = config.y;
    this.zoom = config.zoom;
  }

  update(_deltaTime) {
    // Kontrol pan dan zoom akan ditambahkan pada tahap berikutnya.
  }
}
