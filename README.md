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
- **Hover:** arahkan pointer ke tile untuk menyorot tile teratas yang berada di bawah pointer.
- **Selection:** klik kiri tile untuk memilihnya. Klik area kosong di dalam Canvas untuk membatalkan pilihan. Drag kamera tidak mengubah pilihan.
- **Tile Inspector:** panel kanan menampilkan ID, koordinat grid, elevation, terrain, dan walkable dari tile terpilih. Elevation, terrain, dan walkable dapat diedit; perubahan diterapkan langsung ke data tile.
- **Grid thickness:** garis grid tetap setebal 1 CSS pixel pada semua tingkat zoom, kecuali tile hover/selected yang memakai outline interaksi.
- **Batas zoom:** 0,35× sampai 3×.

## Fondasi saat ini

- Canvas responsif dengan dukungan device pixel ratio (maksimal 2×).
- Grid dunia 12 × 12.
- Tile diamond 64 × 32.
- Konversi grid-ke-isometrik dan screen-to-grid, termasuk pan, zoom, viewport, serta elevasi per tile.
- Rendering tile dalam urutan diagonal.
- Setiap tile memiliki ID stabil, koordinat `x` dan `y`, `elevation`, `terrain`, serta `walkable`.
- Data tile dapat diakses dengan `world.getTile(x, y)` atau `world.getTileById(id)`; keduanya mengembalikan referensi tile persisten.
- ID dan koordinat tile tidak dapat diubah; elevation, terrain, dan walkable dapat dimutasi dengan validasi tipe/nilai.
- Renderer membaca elevation masing-masing tile.
- Tile hover mendeteksi tile di bawah pointer menggunakan elevasi individual dan urutan render untuk menangani diamond yang bertumpuk.
- Tile selection menyimpan referensi persistent tile dan memisahkan keadaan selected dari hover.
- Tile Inspector menampilkan data tile terpilih dan menyediakan editor tervalidasi untuk elevation, terrain, serta walkable.
- Perubahan properti dari Inspector memicu pembaruan render; elevation turut memperbarui perhitungan hover di posisi pointer terakhir.
- Game loop dengan delta time yang dibatasi dan pembatalan frame saat dihentikan.
- Kamera dengan pan terbatas dan zoom berbasis kursor.

Terrain dan walkable saat ini masih berupa data tile; aturan navigasi, collision, serta perilaku gameplay belum diimplementasikan. Object placement dan penyimpanan dunia juga belum termasuk Level 2 ini.

## Pengujian

Membutuhkan Node.js 20 atau lebih baru. Tidak ada dependency tambahan.

```bash
npm test
```

Pengujian menggunakan test runner bawaan Node.js.

## Object model — Level 3.1–3.2

- `WorldObject` disimpan terpisah dari `Tile` dan memiliki anchor grid serta footprint.
- Footprint berbentuk persegi panjang dalam satuan tile: `width` mengikuti sumbu grid X dan `height` mengikuti sumbu grid Y.
- Anchor adalah koordinat awal/minimum `(x, y)`; cakupan objek memanjang ke arah koordinat positif.
- `ObjectFootprint.getGridCells(x, y)` menghasilkan semua koordinat tile yang dicakup dalam urutan diagonal grid.
- `ObjectFootprint.fitsWithinWorld(width, height, x, y)` memvalidasi agar seluruh footprint berada di dalam batas dunia.
- `ObjectFootprint.getCoveredTiles(world, x, y)` mengembalikan referensi tile persisten, atau `null` jika footprint keluar dari batas dunia.
- Footprint belum melakukan placement, deteksi tumpang tindih, collision, elevation integration, atau sprite rendering; itu ditangani tahap berikutnya.

## Object placement — Level 3.3

- `ObjectPlacement` mengelola sesi penempatan objek baru maupun pemindahan objek yang sudah tersimpan.
- `engine.beginObjectPlacement(worldObject)` memulai penempatan objek baru. Objek belum dimasukkan ke `world.objects` sebelum konfirmasi berhasil.
- `engine.beginObjectMove(objectId)` memulai pemindahan objek yang sudah tersimpan.
- Saat pointer bergerak, anchor preview mengikuti tile teratas di bawah pointer. Renderer menandai seluruh cakupan footprint dengan outline biru bila valid dan merah bila melewati batas dunia.
- Klik kiri pada Canvas mengonfirmasi penempatan/pemindahan jika footprint valid. Preview yang tidak valid tetap aktif agar anchor dapat diperbaiki.
- `Escape` atau klik kanan membatalkan sesi. Pembatalan tidak mengubah posisi objek yang telah tersimpan.
- `engine.getObjectPlacementPreview()` menyediakan snapshot mode, ID, anchor, dimensi footprint, status validasi, alasan invalid, dan daftar koordinat preview.
- `engine.confirmObjectPlacement()` dan `engine.cancelObjectPlacement()` menyediakan operasi konfirmasi/pembatalan melalui API.
- Gesture penempatan tidak mengubah tile selection. Middle mouse tetap dapat digunakan untuk menggeser kamera.
- Tumpang tindih footprint antarobjek masih diizinkan pada tahap ini. Aturan collision/occupancy belum dibuat.
- Preview hanya menggambar cakupan footprint; sprite objek belum dirender. Sprite rendering masuk tahap 3.5.

Sesi penempatan dimulai oleh kode aplikasi/fitur pemanggil dengan membuat `WorldObject` lalu memanggil `engine.beginObjectPlacement(object)`. Tahap ini belum menambahkan katalog aset atau panel Object Inspector.
