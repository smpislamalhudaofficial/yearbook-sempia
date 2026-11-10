# Changelog

## v4.1.0 — Spreadsheet Admin Password
- Menghapus ketergantungan pada `generate-admin-hash.py` dan Script Properties `ADMIN_SALT` / `ADMIN_PASSWORD_SHA256`.
- Menambahkan password awal `sempia1234` secara otomatis ke tab `PENGATURAN`.
- Password admin dapat diganti langsung melalui kolom `value` pada baris `ADMIN_PASSWORD`.
- Setup ulang tidak menimpa password yang sudah diubah.
- Perubahan password membatalkan sesi admin yang sudah aktif pada permintaan berikutnya.
- Memperbarui README dan pengujian untuk alur pengelolaan password baru.


## v4.0.0 — GitHub Pages Frontend + Apps Script POST Bridge
- Mengembalikan GitHub Pages sebagai hosting utama frontend.
- Menggunakan Apps Script Web App sebagai backend melalui hidden iframe form POST dan response postMessage.
- Menambahkan pemeriksaan `FRONTEND_ORIGIN`, origin respons Google, dan nonce permintaan.
- Menghapus ketergantungan Cloudflare Worker dan fetch/CORS API.
- Menambahkan `setupProject()` untuk membuat Spreadsheet, folder Drive, dan tab database secara semi-otomatis.
- Dashboard admin kini menggabungkan roster master dan data profil untuk menampilkan peserta yang belum mengisi.
- Menambahkan penyimpanan beberapa akun sosial media opsional untuk siswa.
- Foto wajib hanya untuk siswa, dikompres maksimal 2 MB; formulir guru tidak meminta foto.
- Memperbarui tampilan menjadi cheerful Gen Z / pop culture, mobile-first, dan form-only (bukan yearbook digital).
- Menambahkan konfigurasi GitHub Pages, panduan instalasi, dan pemeriksaan statis.

## v3.0.0 — Apps Script Hosted Edition
- Menghapus Cloudflare Worker dan memindahkan hosting frontend ke Apps Script.

## v2.0.0 — Private Admin Workflow
- Formulir siswa/guru, kompresi foto, dashboard admin, detail profil, verifikasi dan revisi.
