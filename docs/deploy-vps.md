# Deploy ke VPS Ubuntu (https://pwa-pfi.modoto.net)

Susunannya: **nginx** (443, sertifikat Let's Encrypt) → **`next start`** di `127.0.0.1:3555`.

Aplikasi ini **harus jalan sebagai server Node**, tidak bisa diekspor statis:

- semua panggilan ke API PFI lewat Server Action (API tidak mengirim header CORS), dan
- langkah RIPLAY memanggil `POST /api/riplay/pdf` yang menjalankan biner LibreOffice.

Data nasabah tetap di perangkat agen (SQLite WASM di OPFS) — server tidak menyimpan apa pun
selain hasil build.

## 0. Yang harus beres sebelum deploy

- **Commit dulu semua pekerjaan.** Per 2026-09-17 masih ada puluhan berkas yang belum masuk
  git, termasuk **sembilan template RIPLAY** di `public/riplay/`. Kalau deploy lewat git dan
  template itu tidak ikut, langkah RIPLAY di server akan kosong.
- **Pastikan repo GitHub-nya private.** Isinya template RIPLAY dan workbook kalkulator milik
  perusahaan.
- `public/riplay/*.docx` **wajib ikut**. `src/replay/Ringkasan ... MSL.docx` juga wajib —
  `prebuild` menyalinnya menjadi `public/riplay/riplay_personal_msl.docx`.
- `src/calculators/*.xlsm` (±28 MB) **tidak dipakai saat runtime**; isinya hanya sumber untuk
  skrip ekstraksi tabel saat pengembangan. Boleh dikecualikan supaya repo ringan.
- `public/sqlite/` memang tidak ikut git — disalin otomatis dari `node_modules` oleh
  `scripts/copy-sqlite.mjs` saat `npm ci` dan `npm run build`.

## 1. Paket di server

```bash
sudo apt update
sudo apt install -y curl git ca-certificates

# Next 16 menuntut Node >= 20.9; pakai LTS 22.
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v
```

LibreOffice untuk konversi RIPLAY ke PDF — cukup modul Writer, tidak perlu paket lengkap:

```bash
sudo apt install -y libreoffice-writer
soffice --version
```

**Fontnya jangan dilewat.** Template RIPLAY memakai Calibri (belasan ribu kali), lalu Aptos,
Roboto, Times New Roman, dan Arial. Tanpa font pengganti yang ukurannya sama, LibreOffice
memakai font lain dan tata letak PDF-nya bergeser — halaman bisa bertambah:

```bash
sudo apt install -y fonts-crosextra-carlito fonts-crosextra-caladea fonts-liberation fonts-roboto
sudo fc-cache -f
```

Carlito seukuran Calibri, Caladea seukuran Cambria, Liberation seukuran Arial/Times New Roman.
Aptos belum punya padanan bebas; kalau nanti ada halaman yang bergeser, salin berkas fontnya
dari laptop Windows ke `/usr/local/share/fonts/` lalu `sudo fc-cache -f` — periksa dulu
lisensinya, font Microsoft tidak bebas disebar.

Firewall: buka 80 dan 443 saja. Port 3555 **jangan** dibuka — nginx yang menghubunginya lewat
localhost.

```bash
sudo ufw allow 80,443/tcp
```

## 2. Pengguna dan kode

```bash
sudo adduser --system --group --home /srv/pfi-eaps pfi
cd /srv/pfi-eaps
sudo -u pfi git clone https://github.com/Modotz/pfi-eaps.git .
```

Repo private perlu kredensial. Paling rapi memakai **deploy key** (hanya-baca, khusus server):

```bash
sudo -u pfi mkdir -p /srv/pfi-eaps/.ssh
sudo -u pfi ssh-keygen -t ed25519 -C "pfi-eaps vps" -f /srv/pfi-eaps/.ssh/id_ed25519 -N ""
sudo cat /srv/pfi-eaps/.ssh/id_ed25519.pub
```

Tempel isinya di GitHub → repo → Settings → Deploy keys → Add (biarkan "Allow write access"
kosong), lalu clone dengan `git@github.com:Modotz/pfi-eaps.git`.

Tanpa git juga bisa — kirim dari laptop:

```bash
rsync -az --delete \
  --exclude node_modules --exclude .next --exclude .git --exclude src/calculators \
  ./ pfi@server:/srv/pfi-eaps/
```

## 3. Berkas `.env`

```bash
sudo -u pfi tee /srv/pfi-eaps/.env >/dev/null <<'ENV'
PFI_API_BASE_URL=https://api-pfi.modoto.net
LIBREOFFICE_PATH=/usr/bin/soffice
ENV
sudo chmod 600 /srv/pfi-eaps/.env
```

Keduanya sebenarnya opsional (base URL sudah jadi bawaan, biner LibreOffice dicari otomatis),
tapi ditulis tegas supaya tidak berubah diam-diam saat paket server diperbarui. `.env` tidak
ikut git.

## 4. Build

```bash
cd /srv/pfi-eaps
sudo -u pfi npm ci
sudo -u pfi npm run build
```

- **Jangan** pakai `--omit=dev`: TypeScript dan Tailwind dipakai saat build, dan `sharp`
  dipakai `next start` untuk optimasi `next/image`.
- `postinstall` dan `prebuild` otomatis menyalin SQLite WASM ke `public/sqlite/` dan template
  MSL ke `public/riplay/`.
- Build Next butuh ±1–2 GB RAM. Kalau VPS-nya 1 GB, tambahkan swap dulu:

  ```bash
  sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
  sudo mkswap /swapfile && sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
  ```

## 5. Layanan systemd

`/etc/systemd/system/pfi-eaps.service`:

```ini
[Unit]
Description=PFI-EAPS (Next.js)
After=network.target

[Service]
Type=simple
User=pfi
Group=pfi
WorkingDirectory=/srv/pfi-eaps
Environment=NODE_ENV=production
ExecStart=/usr/bin/node node_modules/next/dist/bin/next start -p 3555 -H 127.0.0.1
Restart=always
RestartSec=3
# LibreOffice membuat profil sementara di /tmp untuk tiap konversi.
PrivateTmp=yes
NoNewPrivileges=yes

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now pfi-eaps
sudo systemctl status pfi-eaps
sudo journalctl -u pfi-eaps -f
```

Node dijalankan langsung (bukan lewat `npm start`) supaya sinyal stop/restart dari systemd
sampai ke prosesnya, bukan berhenti di npm.

### Alternatif: PM2

Kalau lebih terbiasa dengan PM2, pakai `ecosystem.config.js` yang sudah ada di repo.
**Pilih salah satu** — systemd atau PM2, jangan dua-duanya, karena keduanya memakai port 3555.
Kalau unit systemd di atas terlanjur dipasang: `sudo systemctl disable --now pfi-eaps`.

```bash
sudo npm install -g pm2
sudo mkdir -p /var/log/pfi-eaps && sudo chown pfi:pfi /var/log/pfi-eaps

cd /srv/pfi-eaps
sudo -u pfi pm2 start ecosystem.config.js
sudo -u pfi pm2 save          # ingat daftar proses untuk dinyalakan lagi nanti
sudo -u pfi pm2 logs pfi-eaps
```

Supaya ikut hidup setelah server di-reboot, PM2 membuatkan unit systemd-nya sendiri:

```bash
sudo pm2 startup systemd -u pfi --hp /srv/pfi-eaps
# perintah di atas mencetak satu baris perintah — jalankan persis seperti yang dicetak
sudo -u pfi pm2 save
```

Catatan:

- **`.env` tetap terbaca.** PM2 tidak memuatnya, tapi Next sendiri membaca `.env` dari
  direktori kerja saat server dinyalakan — dan `cwd` sudah diarahkan ke folder aplikasi.
- **Satu proses saja** (`instances: 1`, mode fork). Menambah proses Next tidak mempercepat
  apa pun di sini, sedangkan konversi RIPLAY ke PDF sudah berat di CPU.
- **Pasang rotasi log**, karena PM2 menulis ke berkas dan bukan ke journald:

  ```bash
  sudo -u pfi pm2 install pm2-logrotate
  ```

- Berkas sementara LibreOffice tetap di `/tmp` (tanpa `PrivateTmp` milik systemd) dan tetap
  dihapus sendiri setiap konversi selesai.
- Deploy ulang: sesudah `npm run build`, jalankan `sudo -u pfi pm2 restart pfi-eaps`
  menggantikan `systemctl restart`.

Kalau pengguna `pfi` dibuat sebagai akun sistem tanpa shell, `sudo -u pfi` di atas tetap
jalan. Yang tidak jalan hanya `su - pfi`; pakai `sudo -u pfi <perintah>` saja.

## 6. nginx

Konfigurasi yang sudah ada sudah benar. Tiga penyesuaian:

1. **Naikkan `proxy_read_timeout`.** Konversi RIPLAY ke PDF memakan waktu: template MSL ±4
   detik, template MAMS ±33 detik di laptop pengembang dan bisa lebih lama di VPS. Bawaan
   nginx 60 detik akan membalas **504** di tengah konversi.

   ```nginx
   location / {
       proxy_pass http://127.0.0.1:3555/;
       proxy_read_timeout 180s;
       proxy_send_timeout 180s;
       ...
   }
   ```

2. `proxy_set_header X-Forwarded-Proto` ditulis dua kali (`$scheme` lalu `https`). Yang kedua
   yang berlaku — cukup sisakan satu baris `https` supaya tidak membingungkan nanti.

3. Pastikan ada server block **port 80 yang mengalihkan ke https** (biasanya sudah dibuat
   Certbot). PWA ini butuh secure context: service worker, OPFS, dan `crypto.randomUUID`
   tidak jalan di http.

`client_max_body_size 20M` yang sudah ada cukup — dokumen yang dikirim ke endpoint PDF
besarnya sekitar 2 MB.

```bash
sudo nginx -t && sudo systemctl reload nginx
```

## 7. Verifikasi

```bash
curl -I http://127.0.0.1:3555/login              # 200 dari aplikasi
curl -I https://pwa-pfi.modoto.net/login         # 200 lewat nginx
curl -s -o /dev/null -w '%{http_code}\n' https://pwa-pfi.modoto.net/api/riplay/pdf
# 401 saat belum login — itu benar, endpointnya memang menuntut sesi
```

Dari peramban:

1. Buka https://pwa-pfi.modoto.net lalu login.
2. Buka halaman **Profil** → tarik master data (91 tabel; yang checksum-nya tidak berubah
   dilewati).
3. Buka sebuah lead → Sales Illustration → langkah **RIPLAY**. Kalau LibreOffice dan fontnya
   beres, yang tampil **PDF**; kalau yang tampil pratinjau HTML dengan keterangan, berarti
   konversinya gagal — periksa `journalctl -u pfi-eaps`.
4. Sudah login, buka `https://pwa-pfi.modoto.net/api/riplay/pdf` di tab peramban: harus
   membalas `{"tersedia":true}`.

## 8. Deploy ulang

```bash
cd /srv/pfi-eaps
sudo -u pfi git pull
sudo -u pfi npm ci
sudo -u pfi npm run build
sudo systemctl restart pfi-eaps      # kalau pakai PM2: sudo -u pfi pm2 restart pfi-eaps
```

Build baru mengganti nama berkas aset, jadi service worker mendeteksi versi baru dan
menawarkan "Muat ulang" ke agen yang sedang membuka aplikasi.

## 9. Yang perlu diingat setelah live

- **Nomor perangkat.** Aplikasi mengirim UUID pada `deviceNumber` saat login dan menyimpannya
  di perangkat. Akun yang sebelumnya terikat ke nilai lama `"string"` perlu **direset ikatan
  perangkatnya sekali** di backoffice, kalau tidak login ditolak "Device tidak sesuai".
  Lihat [Catatan API](catatan-api.md).
- **Data ada di perangkat, bukan di server.** Pindah peramban atau perangkat berarti database
  lokal kosong dan master data harus ditarik lagi. Server boleh di-restart kapan saja.
- **Satu tab saja.** OPFS hanya mengizinkan satu pemegang berkas, jadi dua tab tidak bisa
  membuka database bersamaan.
- **JWT berumur pendek** dan belum ada refresh otomatis; sesi yang lama menganggur akan minta
  login ulang.
- Berkas sementara konversi PDF dihapus sendiri setiap selesai; tidak ada yang menumpuk di
  disk.
