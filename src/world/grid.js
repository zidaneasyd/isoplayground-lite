export class Grid {
  constructor(width, height) {
    this.width = width;
    this.height = height;
  }

  *tiles() {
    // Urutan diagonal menjaga tile dirender dari belakang ke depan.
    for (let sum = 0; sum <= this.width + this.height - 2; sum++) {
      for (let x = 0; x < this.width; x++) {
        const y = sum - x;
        if (y >= 0 && y < this.height) yield { x, y };
      }
    }
  }
}
