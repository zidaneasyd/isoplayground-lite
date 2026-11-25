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

## Object elevation integration — Level 3.4

- `WorldObject.elevationOffset` adalah offset elevasi relatif objek dalam unit elevasi dunia. Nilai finite positif mengangkat objek, nilai negatif menurunkannya, dan default-nya `0`.
- Elevasi efektif objek dihitung secara dinamis sebagai `world.getTile(object.x, object.y).elevation + object.elevationOffset`. Elevasi tile tidak disalin ke model objek, sehingga perubahan elevation pada anchor langsung diikuti objek.
- Untuk footprint multi-tile, tile anchor `(x, y)` menentukan bidang dasar vertikal objek. Elevasi tile lain yang masuk footprint tidak dirata-ratakan atau dimutasi; aturan permukaan miring/penyangga belum termasuk tahap ini.
- `resolveObjectElevation(world, object, anchor?)` mengembalikan elevasi anchor, offset, dan elevasi efektif. Parameter `anchor` memungkinkan penghitungan kandidat lokasi saat memindahkan objek tanpa mengubah anchor tersimpan.
- `getObjectWorldPosition(world, object, tileConfig, anchor?)` mengubah anchor dan elevasi efektif menjadi titik ground-anchor pada ruang isometrik. Transformasi kamera tetap diterapkan bersama transformasi Canvas Renderer, sehingga pan dan zoom tidak membutuhkan posisi objek yang disimpan ulang.
- Object placement preview memuat `anchorElevation`, `elevationOffset`, dan `elevation`. Seluruh sel footprint preview digambar pada bidang elevasi anchor yang sama. Preview mengikuti perubahan elevation anchor sebelum konfirmasi.
- Konfirmasi placement/move hanya menyimpan koordinat anchor objek. Elevasi tile tidak diubah oleh operasi objek.
- Sprite belum dirender pada tahap ini; pemakaian posisi ground-anchor untuk sprite menjadi bagian dari tahap 3.5.


## Sprite asset dan rendering — Level 3.5

- `AssetManager` memuat dan menyimpan referensi gambar berdasarkan `assetId`. `WorldObject` hanya menyimpan ID asset, bukan instance gambar.
- `engine.loadSprite(assetId, source, options?)` memuat gambar melalui browser `Image` API. Promise selesai setelah gambar siap digunakan oleh Canvas. ID asset yang sama tidak dapat dipakai untuk sumber gambar berbeda tanpa menghapus registrasi sebelumnya.
- Opsi asset: `width` dan `height` mengatur ukuran tampilan dalam unit dunia; bila hanya salah satu yang diberikan, rasio gambar asli dipertahankan. `anchorX` dan `anchorY` menentukan titik jangkar ternormalisasi (rentang 0–1), dengan default bawah-tengah (`0.5`, `1`). `imageSmoothingEnabled` dapat mengatur smoothing khusus untuk gambar tersebut.
- `engine.assets.get(assetId)` mengembalikan metadata gambar yang sudah siap, sedangkan `engine.assets.getStatus(assetId)` memberikan status `missing`, `loading`, `loaded`, atau `error`.
- `engine.removeSprite(assetId)` menghapus asset dari registry dan menggambar ulang dunia. `engine.destroy()` membersihkan registry asset milik Engine.
- `SpriteRenderer` menghitung posisi gambar dari ground-anchor objek dan elevasi efektif Level 3.4. Untuk footprint multi-tile, titik gambar dipusatkan pada area footprint; anchor gambar bawaan berada pada bawah-tengah gambar.
- Sprite digabungkan dengan urutan render tile menggunakan depth diagonal pusat footprint (`centerX + centerY`), lalu posisi horizontal isometrik (`centerX - centerY`) sebagai pemecah seri. Tile pada titik grid yang sama digambar lebih dahulu, lalu sprite; tile yang lebih dekat ke depan digambar setelah sprite sehingga dapat menutup bagian sprite yang berada di belakangnya.
- Sprite memakai transformasi Canvas dunia yang sama dengan tile, sehingga kamera pan dan zoom berlaku tanpa menghitung ulang posisi layar. Sprite yang asset-nya belum dimuat atau gagal dimuat tidak digambar.
- Akses runtime aplikasi tersedia melalui `window.isoPlayground`, yang menyediakan `engine`, `world`, `loadSprite(...)`, dan `removeSprite(...)`.

Contoh penggunaan dari modul JavaScript aplikasi:

```js
import { WorldObject } from "./src/objects/world-object.js";

await window.isoPlayground.loadSprite("pool", "./assets/pool.png", {
  width: 320,
  height: 160,
  anchorX: 0.5,
  anchorY: 1
});

const pool = new WorldObject({
  id: "pool-01",
  type: "pool",
  name: "Swimming Pool",
  assetId: "pool",
  x: 2,
  y: 2,
  footprint: { width: 5, height: 7 }
});

window.isoPlayground.world.objects.add(pool);
window.isoPlayground.engine.refreshWorldView();
```

Tahap ini belum menyediakan UI katalog/import asset, seleksi sprite, atlas/spritesheet animation, atau collider. Pengelolaan asset dan pembuatan objek masih melalui API aplikasi.

## Level 3.6 — Object Selection & Inspector

- Object selection is independent from tile selection and resolves the topmost object whose footprint contains the clicked grid cell.
- Clicking an object selects it and opens Object Inspector; clicking an unoccupied tile returns to Tile Inspector.
- Selected object footprints receive a blue outline on the object's effective elevation plane.
- Object Inspector edits name, asset ID, anchor coordinates, footprint dimensions, elevation offset, and JSON custom properties.
- Inspector edits validate anchor bounds and the complete footprint before applying changes.
- **Move** starts the existing placement preview workflow; click a valid destination to confirm or press Escape/right-click to cancel.
- **Delete** removes the object from the world and clears its selection.
- Runtime API: `window.isoPlayground.createObject(definition)`, `beginObjectMove(objectId)`, and `removeObject(objectId)`. `createObject` begins placement; click a valid anchor on the canvas to commit it.
- Object selection does not mutate tile data. Object/tile multi-selection, collision/occupancy, and pixel-perfect sprite hit testing are not part of this stage.

## Level 3.7 — Integration & Regression Testing

- Added cross-module integration coverage for the complete object lifecycle: placement, footprint coverage, object selection notification, move confirmation, and deletion/selection cleanup.
- Added regression coverage proving invalid out-of-bounds footprints cannot be committed and failed moves do not mutate the stored anchor.
- Added integration coverage for dynamic anchor-tile elevation, relative object elevation offsets, and recalculation after moving an object.
- Added integration coverage proving registered sprite assets are drawn by the same Engine world and can be removed from the asset registry.
- The integration tests use the real Engine, World, ObjectPlacement, ObjectSelection, elevation resolver, and Renderer path with a controlled Canvas/browser test harness.
- Run the complete suite with `npm test`.
