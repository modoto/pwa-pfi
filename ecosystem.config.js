/**
 * Konfigurasi PM2 untuk menjalankan aplikasi di VPS.
 *
 * Alternatif dari unit systemd — lihat docs/deploy-vps.md. Jalankan salah satu
 * saja; keduanya memakai port yang sama.
 *
 *   pm2 start ecosystem.config.js
 *   pm2 save
 *
 * Yang dijalankan adalah biner Next langsung, bukan `npm start`, supaya sinyal
 * stop/restart dari PM2 sampai ke prosesnya dan tidak berhenti di npm.
 *
 * Berkas `.env` tidak dibaca PM2, tapi tetap terpakai: Next sendiri memuat
 * `.env` dari direktori kerja saat server dinyalakan.
 */
module.exports = {
  apps: [
    {
      name: "pfi-eaps",
      cwd: __dirname,
      script: "node_modules/next/dist/bin/next",
      // Hanya nginx yang boleh menghubungi aplikasi, jadi diikat ke localhost.
      args: "start -p 3555 -H 127.0.0.1",

      // Satu proses saja: konversi RIPLAY ke PDF memanggil LibreOffice yang
      // berat di CPU, dan menambah proses Next tidak membuatnya lebih cepat.
      instances: 1,
      exec_mode: "fork",

      env: { NODE_ENV: "production" },

      autorestart: true,
      max_memory_restart: "1G",
      // Jangan mati sendiri kalau gagal berulang saat server baru dinyalakan.
      restart_delay: 3000,

      time: true,
      out_file: "/var/log/pfi-eaps/out.log",
      error_file: "/var/log/pfi-eaps/error.log",
    },
  ],
};
