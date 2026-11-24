# Isometric World Engine — Level 1

Fondasi engine dunia isometrik ringan berbasis HTML Canvas 2D dan JavaScript ES Modules.

## Menjalankan

Jalankan folder ini melalui server lokal karena aplikasi menggunakan JavaScript ES Modules.

Contoh:

- VS Code: gunakan ekstensi Live Server.
- Node.js: `npx serve .`

Lalu buka alamat lokal yang diberikan server.

## Kontrol

- **Pan:** klik/tahan lalu geser mouse, atau geser dengan sentuhan.
- **Zoom:** gunakan scroll wheel. Titik dunia di bawah kursor dipertahankan saat zoom.
- **Batas zoom:** 0,35× sampai 3×.

## Fondasi saat ini

- Canvas responsif dengan dukungan device pixel ratio (maksimal 2×).
- Grid dunia 12 × 12.
- Tile diamond 64 × 32.
- Konversi koordinat grid ke isometrik.
- Rendering tile dalam urutan diagonal.
- Permukaan abu-abu dengan garis grid abu-abu gelap.
- Elevation dasar seragam per dunia.
- Game loop dengan delta time yang dibatasi dan pembatalan frame saat dihentikan.
- Kamera dengan pan dan zoom berbasis kursor.

Terrain berbeda, elevation per tile, object placement, collision, serta penyimpanan dunia belum termasuk tahap ini.

## Pengujian

Membutuhkan Node.js 20 atau lebih baru. Tidak ada dependency tambahan.

```bash
npm test
```

Pengujian menggunakan test runner bawaan Node.js.
