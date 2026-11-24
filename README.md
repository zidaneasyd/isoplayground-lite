# Isometric World Engine — Level 2

Fondasi engine dunia isometrik ringan berbasis HTML Canvas 2D dan JavaScript ES Modules.

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
- Konversi koordinat grid ke isometrik dan screen-to-grid dengan pembalikan pan, zoom, offset renderer, pusat dunia, serta elevasi.
- Rendering tile dalam urutan diagonal.
- Permukaan abu-abu dengan garis grid abu-abu gelap.
- Ketebalan garis grid tidak ikut membesar atau mengecil saat zoom.
- Data persisten per tile: terrain, elevation, walkability, dan metadata tambahan. Renderer dapat memakai `config.colors.terrain[terrain]` atau `config.colors[terrain]` untuk warna terrain khusus.
- Akses dan pembaruan data tile melalui `World.getTile(x, y)` dan `World.setTile(x, y, updates)`.
- Posisi mouse tersedia melalui `Engine.screenToGrid(clientX, clientY)` dan `Engine.pointerGrid`.
- Game loop dengan delta time yang dibatasi dan pembatalan frame saat dihentikan.
- Kamera dengan pan terbatas dan zoom berbasis kursor.

Object placement, collision, serta penyimpanan dunia belum termasuk tahap ini.

## Pengujian

Membutuhkan Node.js 20 atau lebih baru. Tidak ada dependency tambahan.

```bash
npm test
```

Pengujian menggunakan test runner bawaan Node.js.
