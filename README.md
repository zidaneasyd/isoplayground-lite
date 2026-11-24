# Isometric World Engine — Level 2: Interactive Grid Foundations

Fondasi engine dunia isometrik berbasis HTML Canvas 2D dan JavaScript ES Modules.

## Menjalankan

Jalankan folder ini melalui server lokal karena aplikasi menggunakan JavaScript ES Modules.

Contoh:

- VS Code: gunakan ekstensi Live Server.
- Node.js: `npx serve .`

Lalu buka alamat lokal yang diberikan server.

## Kontrol

- **Pan:** klik/tahan lalu geser mouse, atau geser dengan sentuhan. Pergerakan dibatasi agar setidaknya satu tile diamond tetap terlihat penuh.
- **Zoom:** gunakan scroll wheel. Titik dunia di bawah kursor dipertahankan selama batas pan memungkinkan.
- **Grid thickness:** garis grid tetap setebal 1 CSS pixel pada semua tingkat zoom.
- **Batas zoom:** 0,35× sampai 3×.

## Fondasi saat ini

- Canvas responsif dengan dukungan device pixel ratio (maksimal 2×).
- Grid dunia 12 × 12.
- Tile diamond 64 × 32.
- Konversi grid-ke-isometrik dan screen-to-grid, termasuk pan, zoom, viewport, serta elevasi dasar.
- Rendering tile dalam urutan diagonal.
- Setiap tile memiliki ID stabil dalam dunia, koordinat `x` dan `y`, `elevation`, `terrain`, serta `walkable`.
- Data tile dapat diakses dengan `world.getTile(x, y)` atau `world.getTileById(id)`.
- Elevation awal mengikuti `world.baseElevation`; terrain awal bernilai `"default"`; `walkable` awal bernilai `true`.
- ID dan koordinat tile tidak dapat diubah; elevation, terrain, dan walkable dapat dimutasi dengan validasi tipe/nilai.
- Renderer membaca elevation masing-masing tile. Terrain dan walkable saat ini masih berupa data, belum mengubah aturan gameplay.
- Tile hover mendeteksi tile di bawah pointer, memakai elevasi individual dan urutan render untuk menangani diamond yang bertumpuk.
- Hover diperbarui saat pointer bergerak, mengikuti pan/zoom, dan dibersihkan saat pointer meninggalkan Canvas atau tidak menunjuk tile.
- Tile yang sedang di-hover mendapat warna isi dan outline khusus; hover tidak mengubah data tile.
- Permukaan abu-abu dengan garis grid abu-abu gelap.
- Ketebalan garis grid tidak ikut membesar atau mengecil saat zoom.
- Game loop dengan delta time yang dibatasi dan pembatalan frame saat dihentikan.
- Kamera dengan pan terbatas dan zoom berbasis kursor.

Tile selection, tile inspector, object placement, collision, dan penyimpanan dunia belum diimplementasikan.

## Pengujian

Membutuhkan Node.js 20 atau lebih baru. Tidak ada dependency tambahan.

```bash
npm test
```

Pengujian menggunakan test runner bawaan Node.js.


### Tile Selection

Klik kiri pada tile untuk memilihnya. Referensi tile terpilih dapat dibaca melalui `engine.getSelectedTile()`. Klik area kosong di dalam Canvas untuk menghapus pilihan. Drag kamera tidak mengubah pilihan; tile terpilih memiliki warna dan outline tersendiri yang diprioritaskan di atas hover.
