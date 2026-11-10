# YEARBOOK SEMPIA — GitHub Pages + Google Apps Script (v4.1)

Aplikasi ini **hanya untuk mengumpulkan biodata siswa dan guru**, bukan yearbook digital atau galeri publik. Website di-host melalui GitHub Pages. Google Apps Script bertindak sebagai backend, Google Sheets sebagai database, dan Google Drive sebagai penyimpanan foto siswa. Tidak menggunakan Cloudflare Worker.

## 1. Arsitektur

```text
Siswa / Guru / Admin
        |
        v
GitHub Pages (frontend statis)
  - index.html       formulir siswa & guru
  - admin.html       dashboard admin privat
  - assets/          CSS, JavaScript, konfigurasi
        |
        | form POST ke hidden iframe (tanpa fetch/CORS)
        | response HTML mengirim hasil dengan postMessage
        v
Google Apps Script Web App (doPost)
  - autentikasi admin dan sesi
  - validasi data dan daftar nama
  - kompresi diverifikasi ulang di server
        |
        +--------------------------+
        |                          |
        v                          v
Google Sheets                 Google Drive
Database peserta              Foto siswa (folder privat)
```

**Mengapa memakai hidden iframe form POST?** Browser mengirim form HTML lintas-origin ke endpoint Apps Script melalui iframe tersembunyi. Ini tidak memerlukan `fetch()` atau CORS. Apps Script memproses POST, lalu halaman respons mengirim hasil melalui `postMessage` hanya ke `FRONTEND_ORIGIN` yang didaftarkan. Setiap permintaan memiliki nonce acak agar respons dapat dipasangkan dengan permintaan yang benar. Apps Script mengizinkan respons dimuat di iframe menggunakan `XFrameOptionsMode.ALLOWALL`; parent hanya menerima pesan dari origin Google yang dikenal dan dengan nonce yang masih aktif.

Dokumentasi resmi: [Apps Script Web Apps](https://developers.google.com/apps-script/guides/web) · [HTML Service](https://developers.google.com/apps-script/guides/html) · [XFrameOptionsMode](https://developers.google.com/apps-script/reference/html/x-frame-options-mode).

## 2. Fitur aplikasi

### Form siswa
- Nama dipilih dari master data admin di Google Sheets.
- Tempat dan tanggal lahir, alamat, WhatsApp.
- Hingga 5 akun sosial media opsional: Instagram, TikTok, YouTube, Facebook, X, Threads, atau Lainnya.
- Quote/kata-kata hari ini.
- Foto wajib; file JPG/PNG/WebP dikompres di browser menjadi JPEG maksimal **2 MB**.
- Persetujuan penggunaan data.

### Form guru
- Nama dipilih dari master data admin.
- Tempat dan tanggal lahir, alamat, WhatsApp.
- Kata mutiara.
- **Tidak ada kewajiban upload foto guru**.

### Dashboard admin
- Satu akun admin utama dengan password yang dikelola langsung dari tab `PENGATURAN` Google Sheets.
- Menggabungkan master roster dan data formulir sehingga daftar **Belum mengisi** selalu terlihat.
- Status: Belum mengisi, Menunggu, Terverifikasi, Perlu revisi.
- Statistik, pencarian, filter kategori/status, detail biodata, pratinjau foto siswa, verifikasi, dan permintaan revisi.
- Peserta hanya dapat mengirim ulang jika statusnya `revision`.
- Data profil dan foto tidak pernah ditampilkan ke publik.

## 3. Struktur paket

```text
YEARBOOK-SEMPIA/
├── index.html
├── admin.html
├── assets/
│   ├── css/styles.css
│   └── js/
│       ├── config.js              # isi URL Web App Apps Script di sini
│       ├── config.example.js
│       ├── api.js                 # hidden iframe form POST + postMessage response
│       ├── app.js                 # formulir siswa/guru
│       ├── admin.js               # dashboard admin
│       └── compression.js         # kompresi foto 2 MB
├── apps-script/
│   ├── Code.gs                    # backend, setup database, autentikasi
│   ├── Config.gs                  # dokumentasi konfigurasi backend
│   ├── appsscript.json
│   ├── .clasp.example.json
│   └── .claspignore
├── database/template-daftar-nama.xlsx
├── tests/static-checks.mjs
├── README.md
└── CHANGELOG.md
```

## 4. Instalasi semi-otomatis

### Langkah A — Buat project Apps Script

1. Buka [script.google.com](https://script.google.com/) menggunakan akun Google sekolah/pengelola.
2. Pilih **New project** dan beri nama `YEARBOOK SEMPIA Backend`.
3. Di project Apps Script, siapkan file berikut dari folder `apps-script/` pada paket ini:
   - `Code.gs` (ganti isi file Code.gs bawaan)
   - `Config.gs` (buat file Script)
   - `appsscript.json` (aktifkan tampilan manifest di Project Settings, lalu ganti isinya)
4. Simpan project.

Jika Anda memperbarui instalasi v4.0 yang sudah berjalan, ganti isi `Code.gs` dan `Config.gs` dengan versi baru, lalu jalankan `setupProject()` satu kali. Data lama dan password yang sudah ada di tab `PENGATURAN` tidak akan ditimpa. Jika baris `ADMIN_PASSWORD` belum ada, password awal `sempia1234` akan ditambahkan otomatis.

**Alternatif untuk pengguna teknis:** install `@google/clasp`, login dengan akun Google, salin `.clasp.example.json` menjadi `.clasp.json`, masukkan Script ID project, lalu jalankan `clasp push` dari folder `apps-script/`. Jangan commit file `.clasp.json`.

### Langkah B — Buat database dan folder otomatis

1. Di editor Apps Script, pilih fungsi `setupProject`.
2. Klik **Run** dan setujui izin Google Sheets dan Google Drive.
3. Fungsi ini akan membuat bila belum ada:
   - Spreadsheet `YEARBOOK_SEMPIA_DATABASE`.
   - Folder Drive `YEARBOOK SEMPIA DATA`.
   - Subfolder `FOTO SISWA`.
   - Tab database beserta header.
4. Fungsi aman dijalankan ulang: resource dengan ID yang sudah tersimpan akan digunakan kembali dan data lama tidak dihapus.
5. Buka spreadsheet dan folder hasil setup melalui Google Drive (cari nama di atas) atau lihat URL hasil eksekusi fungsi.
6. Tab `PENGATURAN` otomatis berisi password admin awal `sempia1234`. Jangan hapus baris `ADMIN_PASSWORD`; ubah nilai pada kolom `value` jika ingin mengganti password.

### Langkah C — Isi daftar nama

Di spreadsheet yang dibuat, isi tab `SISWA` dan `GURU` mulai baris kedua. Gunakan `database/template-daftar-nama.xlsx` sebagai contoh struktur.

| Kolom | Isi | Contoh |
|---|---|---|
| `person_id` | ID unik, jangan berubah | S001 / G001 |
| `full_name` | Nama lengkap resmi | Alya Putri |
| `class_name` | Kelas (boleh kosong untuk guru) | IX-A |
| `is_active` | TRUE atau FALSE | TRUE |
| `access_code` | Kode rahasia opsional per peserta; isi untuk meminta kode saat submit | 482915 |

**Penting:** `person_id` harus unik secara global, termasuk antara siswa dan guru. Nama dengan `is_active = TRUE` akan tersedia di dropdown. Jika peserta tidak lagi perlu mengisi, ubah menjadi `FALSE`; jangan menghapus baris jika masih diperlukan untuk arsip. Kolom `access_code` bersifat opsional: jika diisi, formulir akan meminta kode tersebut setelah nama dipilih. Untuk formulir publik yang mengumpulkan data pribadi siswa, sangat disarankan admin membuat kode unik dan membagikannya secara pribadi kepada peserta. Simpan kolom ini hanya di Google Sheets privat.

Tab `PENGATURAN` digunakan untuk pengaturan aplikasi. Baris `ADMIN_PASSWORD` menyimpan password login dashboard admin. Password awalnya adalah `sempia1234`; ubah langsung pada kolom `value` untuk menggantinya.

### Langkah D — Atur password admin

Password admin dibuat otomatis saat `setupProject()` pertama kali dijalankan. Buka spreadsheet `YEARBOOK_SEMPIA_DATABASE`, lalu masuk ke tab `PENGATURAN`.

| key | value |
|---|---|
| `ADMIN_PASSWORD` | `sempia1234` |

Untuk mengganti password, cukup ubah isi kolom `value` pada baris `ADMIN_PASSWORD`. Tidak perlu Python, terminal, hash generator, atau mengubah Script Properties. Perubahan berlaku untuk login berikutnya dan sesi admin yang sedang aktif akan diminta login ulang pada permintaan berikutnya.

**Penting:** `sempia1234` adalah password awal yang mudah ditebak. Ganti sebelum website dibagikan ke publik. Password disimpan sebagai teks di spreadsheet agar mudah dikelola; karena itu, batasi akses spreadsheet hanya untuk pengelola tepercaya. Siapa pun yang dapat melihat spreadsheet dapat membaca password tersebut.

### Langkah E — Publikasikan frontend ke GitHub Pages

1. Buat repository GitHub, misalnya `yearbook-sempia`.
2. Upload seluruh isi folder utama proyek (file `index.html`, `admin.html`, folder `assets`, dan seterusnya) ke root repository.
3. Pastikan `assets/js/config.js` berisi URL deployment Apps Script pada Langkah F. URL belum tersedia? Selesaikan Langkah F dahulu, lalu commit perubahan konfigurasi.
4. Buka **Repository → Settings → Pages**.
5. Pada **Build and deployment**, pilih **Deploy from a branch**, branch `main`, folder `/ (root)`, lalu Save.
6. Tunggu GitHub Pages menerbitkan situs.

Contoh alamat project site: `https://NAMA-AKUN.github.io/yearbook-sempia/`.

**Origin** adalah bagian domain saja, tanpa nama repository dan tanpa slash akhir. Contoh `https://NAMA-AKUN.github.io`.

### Langkah F — Konfigurasi origin dan deploy Apps Script

1. Di Apps Script buka **Project Settings → Script Properties**.
2. Tambahkan `FRONTEND_ORIGIN` dengan origin GitHub Pages persis, misalnya `https://NAMA-AKUN.github.io`. Jangan isi path `/yearbook-sempia/`.
3. Pastikan `SPREADSHEET_ID`, `ROOT_FOLDER_ID`, dan `STUDENT_FOLDER_ID` sudah dibuat oleh `setupProject()`.
4. Pilih **Deploy → New deployment → Web app**.
5. Pilih **Execute as: Me** dan **Who has access: Anyone** (atau opsi akses publik anonim yang tersedia). Ini diperlukan agar siswa/guru tidak perlu login Google untuk mengirim formulir.
6. Klik Deploy, selesaikan otorisasi, lalu salin URL Web App yang berakhiran `/exec`.
7. Buka `assets/js/config.js`, isi `GAS_WEB_APP_URL`:

```javascript
window.YEARBOOK_CONFIG = {
  GAS_WEB_APP_URL: "https://script.google.com/macros/s/DEPLOYMENT_ID/exec",
  APP_NAME: "YEARBOOK SEMPIA"
};
```

8. Commit dan push `config.js` ke repository GitHub. Tunggu GitHub Pages memperbarui situs.

> URL Web App bukan password. Tetap jangan memasukkan ID spreadsheet, ID folder, salt, hash, atau kredensial lain ke file frontend.

## 5. Cara menggunakan

### Siswa dan guru
1. Buka alamat GitHub Pages.
2. Pilih kategori Siswa atau Guru.
3. Pilih nama dari dropdown resmi.
4. Isi data yang diminta. Siswa menambahkan foto dan dapat menambahkan akun sosial media opsional.
5. Centang persetujuan dan kirim.
6. Data masuk ke Google Sheets. Foto siswa masuk ke folder privat Google Drive.

### Admin
1. Buka `https://NAMA-AKUN.github.io/yearbook-sempia/admin.html`.
2. Login menggunakan password admin utama.
3. Gunakan filter **Belum mengisi** untuk melihat peserta yang belum mengirim formulir.
4. Buka detail untuk memeriksa biodata/foto.
5. Pilih **Verifikasi** atau tulis catatan lalu **Minta revisi**.

Daftar nama dikelola di tab `SISWA` dan `GURU` pada Google Sheets. Dashboard admin saat ini untuk pemantauan dan verifikasi; tidak mengedit master roster langsung.

## 6. Keamanan dan privasi

- GitHub Pages hanya menyajikan frontend statis. Semua validasi penting dilakukan ulang di Apps Script.
- Apps Script hanya mengirim respons `postMessage` ke `FRONTEND_ORIGIN` yang sama persis dengan Script Property.
- Respons `doPost` menggunakan `XFrameOptionsMode.ALLOWALL` agar dapat dimuat di hidden iframe GitHub Pages. Parent memeriksa origin Google dan nonce acak sebelum menerima hasil. Jangan menghapus pemeriksaan tersebut.
- Deployment berjalan sebagai pemilik Apps Script sehingga file Drive tidak perlu dibagikan publik. Folder foto harus tetap **Restricted**.
- Fungsi publik hanya mengembalikan roster aktif (ID, nama, kelas, indikator apakah kode diperlukan) dan menerima submit. Nilai `access_code` tidak pernah dikirim ke browser. Dashboard, detail, foto, status, dan logout wajib membawa token admin yang divalidasi di server.
- Admin menggunakan satu password utama dari tab `PENGATURAN` dan token sesi maksimal 6 jam. Password tidak ditanam di file frontend; nilai yang dimasukkan saat login dikirim ke backend melalui POST. Mengubah password di spreadsheet membatalkan sesi lama pada permintaan berikutnya. Setelah lima kegagalan login, ada lockout sementara. Pada akses anonim, mekanisme temporary user key Google tidak selalu setara dengan pembatasan per-IP; gunakan password yang tidak mudah ditebak dan pantau aktivitas.
- Password admin tersimpan sebagai teks di tab `PENGATURAN` agar dapat diganti langsung tanpa Python. Batasi akses spreadsheet hanya untuk pengelola tepercaya. Jangan pernah membagikan spreadsheet database secara publik.
- Tanpa `access_code`, dropdown nama bukan bukti identitas: orang lain yang mengetahui nama/ID peserta berpotensi mengirim data atas nama peserta tersebut. Untuk penggunaan publik, isi kode unik per peserta pada kolom `access_code` dan distribusikan secara pribadi. Jangan menggunakan data siswa asli untuk pengujian awal. Pastikan persetujuan orang tua/wali dan kebijakan perlindungan data sekolah dipenuhi.
- Jangan menambahkan foto pribadi atau biodata ke halaman publik, repository, atau folder Drive yang dapat diakses siapa pun.

## 7. Pengujian

Jalankan pemeriksaan statis dari folder proyek:

```bash
node tests/static-checks.mjs
```

Checklist uji manual dengan data dummy:

- [ ] GitHub Pages menampilkan halaman utama dan admin.
- [ ] Hidden iframe POST menerima respons backend; tidak ada pesan konfigurasi/timeout.
- [ ] Dropdown siswa dan guru sesuai tab roster.
- [ ] Siswa wajib mengunggah foto; hasil kompresi maksimal 2 MB.
- [ ] Guru dapat mengirim tanpa foto.
- [ ] Akun sosial media siswa tersimpan dengan platform yang dipilih.
- [ ] Biodata masuk ke tab profil yang tepat.
- [ ] Foto siswa masuk ke `FOTO SISWA` dan folder tetap privat.
- [ ] Dashboard menampilkan semua nama aktif termasuk status `Belum mengisi`.
- [ ] Tanpa token admin, dashboard/detail/foto/status ditolak.
- [ ] Admin dapat melihat detail, memverifikasi, dan meminta revisi.
- [ ] Peserta berstatus `revision` dapat mengirim ulang; `pending` dan `verified` tidak.
- [ ] Logout mencabut sesi.

## 8. Pembaruan setelah perubahan kode

- **Frontend:** commit dan push ke branch yang dipakai GitHub Pages.
- **Backend:** upload/push file Apps Script, lalu **Deploy → Manage deployments → Edit → Version → New version → Deploy**.
- Jika URL deployment berubah, perbarui `GAS_WEB_APP_URL` di `assets/js/config.js`.
- Jika repository dipindah ke akun GitHub lain atau custom domain berubah, perbarui `FRONTEND_ORIGIN` di Script Properties.

## 9. Batasan yang diketahui

- Paket ini menyiapkan kode dan alur instalasi, tetapi belum dapat membuat resource di akun Google/GitHub pengguna tanpa pengguna menjalankan setup dan memberikan izin.
- Kuota Apps Script, Google Sheets, dan Google Drive berlaku. Uji dengan jumlah peserta dan ukuran foto realistis.
- GitHub Pages bersifat publik untuk frontend. Jangan taruh data peserta, kredensial, atau file rahasia di repository.
- Form ini bukan sistem yearbook digital, bukan galeri foto, dan tidak menampilkan biodata peserta ke publik.
