# AgroCode: Simulasi Otomasi Ladang dengan Kendaraan Pertanian Darat

Game edukasi dan simulasi pemrograman berbasis **Python** di mana pemain menulis skrip algoritma untuk mengotomatiskan armada kendaraan pertanian darat (traktor, penabur, pemanen, dan truk pengangkut) di atas ladang 3D interaktif dengan batasan fisik nyata seperti bahan bakar solar, medan berlumpur/berbatu, pergantian alat tempel (*implement*), kapasitas angkut gudang, dan perawatan mesin di bengkel.

### User Review & Critical Decisions

> [!IMPORTANT]
> Rencana ini telah disesuaikan sepenuhnya dengan jawaban klarifikasi Anda untuk kebutuhan **Skripsi**, mengutamakan akurasi simulasi algoritma Python, kelengkapan 10 level progresif beserta Pohon Teknologi, serta berjalan 100% mandiri secara *offline* di peramban.

- **Keputusan Terkonfirmasi 1 (Bahasa Pemrograman Python)**: Menggunakan interpreter **Python** khusus yang aman (*sandboxed step-by-step AST runner*) dengan dukungan penuh sintaks Python (`for ... in range()`, `while`, `if/elif/else`, `def`, variabel, operator logika `and/or/not`) serta API Bahasa Indonesia sesuai dokumen PDF (`traktor.maju()`, `traktor.bajak()`, `traktor.tanam()`, `traktor.panen()`, dll.) maupun alias bergaya *Field Script* (`VE01.till()`, `VE01.plant()`, `VE01.harvest()`).
- **Keputusan Terkonfirmasi 2 (Cakupan Lengkap 10 Level, Pohon Teknologi, Multi-Kendaraan & Bengkel)**: Menyertakan 10 level terstruktur (Tahap Awal, Menengah, Akhir), sistem Pohon Teknologi (*Tech Tree*) yang dibuka menggunakan hasil panen, koordinasi multi-kendaraan tanpa tabrakan, logistik pengangkut ke gudang, serta sistem keausan alat dan bengkel.
- **Keputusan Terkonfirmasi 3 (Simulasi Murni Offline)**: Berjalan 100% lokal tanpa ketergantungan API eksternal, AI asisten, atau modul bio-sains, serta menyimpan seluruh progres level, kode pemain, dan statistik evaluasi di `localStorage`.

---

### 1. Overview & Core Concept

- **What It Does**: Pemain bertindak sebagai insinyur otomasi pertanian yang memprogram kendaraan darat menggunakan bahasa Python untuk mengolah tanah, menanam bibit, memanen hasil, mengisi ulang solar di Pom Bensin, memperbaiki mesin di Bengkel, dan mengangkut hasil panen ke Gudang.
- **Target Audience / Persona**: Mahasiswa, pelajar pemrograman, dan pemain *coding puzzle* (terinspirasi dari *The Farmer Was Replaced*) yang mempelajari logika algoritma, struktur kontrol, optimasi rute (*pathfinding*), dan manajemen sumber daya fisik melalui simulasi visual 3D.
- **Key Value**: Menghadirkan tantangan komputasi yang nyata karena kendaraan darat memiliki batasan fisik (solar terbatas, lumpur yang memperlambat laju, batu penghalang, waktu bongkar-pasang alat tempel, kapasitas tangki panen, dan potensi tabrakan antar-kendaraan) lengkap dengan metrik evaluasi kuantitatif (jumlah langkah, solar terpakai, waktu tick, dan hasil panen) yang ideal untuk analisis skripsi.

---

### 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Layar Judul (*Title Screen*)**: Menampilkan diorama 3D ladang hidup di latar belakang dengan traktor yang sedang bekerja otomatis, logo vektor kustom, tombol **Mulai Bermain**, pemilihan **10 Level Tantangan**, serta akses cepat ke **Pohon Teknologi** dan **Panduan API Python**.
  2. **Tampilan Bermain & Simulasi (*Active Play & Split/Dock Workspace*)**:
     - **Mode Landscape / Desktop**: Viewport 3D Three.js layar penuh dengan kontrol kamera isometrik yang mulus, dilengkapi panel **Field Script Editor (Python)** bergaya terminal modern di sisi kiri dan HUD **Statistik Ladang & Status Mesin** yang ringkas di sisi kanan, serta *dock* kontrol simulasi yang dapat dilipat (*collapsible*) di bagian bawah.
     - **Mode Mobile / Portrait**: Layar terbagi dua secara ergonomis—bagian atas untuk visualisasi ladang 3D dan bagian bawah untuk editor kode Python lengkap dengan baris **Tombol Cepat (*Quick Snippet Bar*)** agar pemain dapat menyisipkan perintah (`maju()`, `belok_kanan()`, `bajak()`, `tanam()`, `panen()`, `for`, `if`) dengan satu sentuhan tanpa harus mengetik panjang.
  3. **Siklus Eksekusi & Evaluasi (*Core Loop*)**:
     - Pemain menulis/mengubah kode Python -> Menekan **Jalankan (Run)** atau **Langkah demi Langkah (Step)** -> Baris kode yang sedang dieksekusi disorot secara *real-time* seiring pergerakan traktor 3D di ladang -> Jika terjadi kesalahan sintaks atau kehabisan bensin/tabrakan, muncul pesan *error* yang jelas dalam Bahasa Indonesia beserta nomor barisnya.
  4. **Modal Hasil Level & Pohon Teknologi**: Setelah target panen tercapai dalam batas waktu/bahan bakar level, muncul ringkasan efisiensi (Skor Bintang 1–3, Total Panen, Solar Terpakai, Total Tick) dan tombol untuk membuka alat/API baru di **Pohon Teknologi**.

- **Visual Identity & Theme**:
  - *Aesthetic Direction*: **Tactile Agricultural Diorama & Field Terminal** (menggabungkan visual ladang 3D bergaya isometrik hangat seperti ilustrasi pada halaman 1 PDF dengan antarmuka editor kode *dark-slate* beraksen hijau zamrud dan kuning amber).
  - *Color Palette & Mood*:
    - Kanvas Ladang 3D: Tanah subur (`#5C4033`), tanah telah dibajak (`#3E2723`), lumpur basah (`#2D1E17`), batu granit (`#78716C`), jalan beraspal/kerikil (`#9CA3AF`), dan atmosfer langit cerah hangat (`#E0F2FE` ke `#FEF3C7`).
    - Antarmuka Editor & HUD (`rgba` solid tanpa *backdrop-blur* di atas WebGL): Permukaan terminal gelap (`#18181B` / `#1E2229`), teks utama (`#F4F4F5`), aksen indikator aktif hijau pertanian (`#22C55E`), indikator solar/energi kuning amber (`#F59E0B`), dan peringatan kerusakan merah (`#EF4444`).
  - *Typography & Hierarchy*:
    - *Display & UI Heading*: `Plus Jakarta Sans` (tegas, modern, dan sangat terbaca di layar mobile maupun desktop).
    - *Code Editor & Telemetry*: `JetBrains Mono` dengan `tabular-nums` untuk penomoran baris kode, koordinat grid `(X, Y)`, persentase bahan bakar, dan kondisi alat tempel.

- **Interactive Feedback & Motion**:
  - **Model 3D Komposit (3–12 Bagian)**: Setiap kendaraan (Traktor, Penabur, Pemanen Combine, Truk Pengangkut) dirakit dari grup geometri 3D terpisah (sasis utama, kabin kaca, roda depan/belakang berputar, cerobong knalpot, serta *implement* bajak/penabur/header pemanen yang tampak berganti secara visual saat fungsi `pasang_alat()` dipanggil).
  - **Efek Suara Prosedural (Web Audio API)**: Suara deru mesin traktor, efek membajak tanah, menabur benih, memanen, pengisian solar di Pom Bensin, perbaikan di Bengkel, dan peringatan error (dengan tombol *Mute* di HUD).

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Interpreter Python Sandboxed Berbasis Step-Generator di Browser**
  - *Chosen Approach*: Membangun *tokenizer*, *indentation-aware parser*, dan *AST evaluator* Python khusus di TypeScript yang mengeksekusi kode langkah demi langkah (*tick-by-tick*) dengan batas waktu eksekusi (*execution timeout* & *infinite-loop guard*).
  - *Why*: Memenuhi syarat utama di PDF ("Jangan langsung memakai Python penuh di Android karena berat dan rawan keamanan") sekaligus memenuhi kebutuhan skripsi Anda untuk menggunakan sintaks Python asli (`for baris in range(5):`, `while True:`, `if traktor.bahan_bakar < 20:`, `elif`, `else`, `def`). Selain itu, eksekusi per langkah memungkinkan sorotan baris kode (*active line highlighting*) yang sinkron dengan animasi 3D kendaraan.
  - *Alternatives Considered*: Pyodide/WebAssembly penuh (terlalu berat ~15MB dan sulit dihentikan saat terjadi *infinite loop* di perangkat mobile).

- **Decision 2: Dukungan Ganda API Bahasa Indonesia & Field Script Objek**
  - *Chosen Approach*: Mendukung penuh fungsi berbahasa Indonesia dari Bagian 4 PDF (`traktor.maju()`, `traktor.belok_kanan()`, `traktor.belok_kiri()`, `traktor.bajak()`, `traktor.tanam("wortel")`, `traktor.panen()`, `traktor.ke_pom_bensin()`, `traktor.isi_bahan_bakar()`, `traktor.ke_bengkel()`, `traktor.kirim_ke_gudang()`, `traktor.pasang_alat("bajak")`, `cek_tanah()`, `tanaman_siap()`, `status()`) sekaligus mendukung sintaks multi-kendaraan (`pengangkut.maju()`, `pemanen.panen()`, atau `VE01.till()`, `VE01.plant()`, `VE01.harvest()`).
  - *Why*: Memudahkan pengujian dan demonstrasi skripsi baik menggunakan contoh kode di teks dokumen maupun contoh skrip pada gambar konsep di halaman 1 PDF.

- **Decision 3: Penyimpanan Lokal (`localStorage`) & Ekspor Data Evaluasi**
  - *Chosen Approach*: Menyimpan seluruh progres 10 level, item Pohon Teknologi yang terbuka, hasil panen tersimpan, dan kode Python terakhir pemain di setiap level ke dalam `localStorage`, ditambah fitur **Reset Progres** dan **Unduh Log Simulasi (CSV/JSON)** untuk lampiran data skripsi.
  - *Why*: Memastikan aplikasi berjalan 100% *offline* tanpa memerlukan koneksi server atau login eksternal, serta siap dibungkus ke Android menggunakan Capacitor/PWA kapan saja.

---

### 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        AGROCODE GAME SHELL (React)                          │
│  ┌───────────────┐   ┌───────────────────────────┐   ┌───────────────────┐  │
│  │ Title Screen  │──▶│  Active Simulation View   │──▶│ Victory / Summary │  │
│  │ & Level Select│   │  (Desktop & Mobile Split) │   │ & Tech Tree Modal │  │
│  └───────────────┘   └─────────────┬─────────────┘   └───────────────────┘  │
└────────────────────────────────────┼────────────────────────────────────────┘
                                     │
        ┌────────────────────────────┼────────────────────────────┐
        ▼                            ▼                            ▼
┌──────────────────────┐  ┌─────────────────────────┐  ┌──────────────────────┐
│ PYTHON CODE EDITOR   │  │ SIMULATION ENGINE       │  │ 3D THREE.JS VIEWPORT │
│ • Line Numbers &     │  │ • Indentation Parser    │  │ • Procedural 3D      │
│   Syntax Highlight   │  │ • Step-by-Step AST VM   │  │   Vehicles & Tools   │
│ • Active Line Cursor │─▶│ • Multi-Vehicle Tick    │─▶│ • Grid Terrain (Mud, │
│ • Mobile Quick-Touch │  │   & Collision Detector  │  │   Road, Rock, Crops) │
│   Snippet Bar        │  │ • Fuel, Tool Wear &     │  │ • Buildings (Fuel,   │
│ • API Docs & Hints   │  │   Warehouse Logistics   │  │   Warehouse, Repair) │
└──────────────────────┘  └─────────────┬───────────┘  └──────────────────────┘
                                        │
                                        ▼
                          ┌─────────────────────────┐
                          │ PERSISTENCE & TELEMETRY │
                          │ • localStorage Save     │
                          │ • 10 Level Definitions  │
                          │ • Tech Tree Unlocks     │
                          │ • Web Audio Synth SFX   │
                          └─────────────────────────┘
```

- **Data Model & State**:
  - **Grid Tile (`TileState`)**: Koordinat `(x, z)`, tipe medan (`tanah_biasa`, `lumpur`, `batu`, `jalan`, `pom_bensin`, `gudang`, `bengkel`), status olah tanah (`belum_dibajak`, `sudah_dibajak`), tanaman (`kosong`, `wortel`, `gandum`, `jagung`), dan tahap tumbuh (`0..100%`, siap panen pada `100%`).
  - **Vehicle (`VehicleState`)**: ID (`traktor`, `pemanen`, `pengangkut`), posisi `(x, z)`, arah hadap (`utara`, `timur`, `selatan`, `barat`), bahan bakar solar (`0..maxFuel`), kondisi mesin/alat (`0..100%`), alat tempel aktif (`kosong`, `bajak`, `penabur`, `pemanen`), muatan hasil panen saat ini (`0..maxCapacity`), dan stok bibit.
  - **10 Level Kurikulum Progresif**:
    1. *Level 1 – Langkah Pertama*: 1 Traktor, lahan kecil 5x5, membajak dan menanam wortel.
    2. *Level 2 – Panen Perdana*: Menggunakan perulangan `for` untuk membajak, menanam, dan memanen satu baris penuh.
    3. *Level 3 – Manajemen Solar*: Lahan lebih luas dengan Pom Bensin; kode harus memeriksa `if traktor.bahan_bakar < 25:` dan mengisi ulang solar.
    4. *Level 4 – Pergantian Alat Tempel*: Traktor harus memasang `bajak`, `penabur`, dan `pemanen` secara berurutan dengan memperhitungkan waktu ganti alat.
    5. *Level 5 – Medan Berlumpur & Jalan Raya*: Memanfaatkan jalur jalan (`jalan`) untuk bonus kecepatan dan menghindari pemborosan solar di tanah berlumpur (`lumpur`).
    6. *Level 6 – Rintangan Batu & Sensor Tanah*: Menggunakan percabangan `cek_tanah()` untuk menghindari batu penghalang dan memeriksa kematangan tanaman (`tanaman_siap()`).
    7. *Level 7 – Perawatan & Bengkel*: Alat tempel mengalami aus setiap dipakai; kode harus memeriksa kondisi mesin (`status()`) dan menuju `bengkel` sebelum rusak.
    8. *Level 8 – Logistik Gudang & Kapasitas*: Tangki panen terbatas; traktor/pengangkut harus membawa hasil panen ke `gudang` (`kirim_ke_gudang()`) saat tangki penuh.
    9. *Level 9 – Duet Traktor & Pengangkut*: Mengontrol 2 kendaraan bekerja sama (Traktor memanen, Truk Pengangkut bolak-balik ke Gudang dan Pom Bensin).
    10. *Level 10 – Otomasi Ladang Skala Penuh*: 3 Kendaraan bekerja serentak di ladang kompleks tanpa tabrakan dengan optimasi bahan bakar dan waktu terbaik.
  - **Pohon Teknologi (`TechTreeNode`)**:
    - Membuka alat tempel baru, peningkatan kapasitas tangki solar (+50%), roda lumpur anti-selip, tangki panen ekstra, sensor pemindai jarak jauh, dan fungsi navigasi otomatis `ke(x, y)` menggunakan hasil panen wortel, gandum, dan jagung yang dikumpulkan pemain.

- **Interactive Component & State Mapping**:
  - **Tombol Kontrol Eksekusi**: *Jalankan (Run)*, *Jeda (Pause)*, *Langkah (Step 1 Tick)*, *Reset Ladang*, dan pengatur kecepatan simulasi (`1x`, `2x`, `4x`).
  - **Pemilih Kendaraan / Tab Skrip**: Pada level multi-kendaraan, pemain dapat berpindah tab skrip (`traktor.py`, `pengangkut.py`, `pemanen.py`) atau mengontrol semuanya dari satu skrip utama, serta mengklik kendaraan di viewport 3D untuk melihat inspeksi status tangki, bahan bakar, dan kondisi alat secara langsung.
