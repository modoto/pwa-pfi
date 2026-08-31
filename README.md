# PFI-EAPS — Next.js PWA Responsif

Starter Progressive Web App dengan **Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS v4**,
dioptimalkan untuk **HP dan tablet**.

## Menjalankan

```bash
npm run dev          # http://localhost:3000
npm run build        # build produksi
npm start            # jalankan hasil build (service worker aktif di sini)
npm run gen:icons    # regenerate ikon PWA dari scripts/generate-icons.mjs
npm run lint
```

> Service worker sengaja **hanya aktif di mode production** supaya cache tidak
> mengganggu hot reload saat `npm run dev`. Untuk menguji fitur offline/install:
> `npm run build && npm start`.

## Menguji di HP / tablet

1. Jalankan `npm run start:lan`, lalu buka `http://<IP-komputer>:3000` dari perangkat (satu jaringan Wi-Fi).
2. Service worker & tombol **Pasang** butuh HTTPS (kecuali `localhost`). Untuk uji instalasi
   sesungguhnya, pakai tunnel seperti `npx cloudflared tunnel --url http://localhost:3000`
   atau deploy ke Vercel/Netlify.
3. Android/Chrome: menu ⋮ → *Install app*. iOS/Safari: tombol Bagikan → *Tambah ke Layar Utama*.

## Strategi responsif

| Lebar layar | Breakpoint | Tata letak |
|---|---|---|
| < 415px | base | 1 kolom, tab bar bawah |
| ≥ 415px | `xs` (26rem) | grid 2 kolom untuk kartu |
| ≥ 640px | `sm` | baris form sejajar, padding lebih lega |
| ≥ 768px | `md` (tablet potret) | tab bar bawah diganti **sidebar ikon**, grid 3 kolom |
| ≥ 1024px | `lg` (tablet lanskap) | sidebar melebar + label, grid 4 kolom |
| ≥ 1280px | `xl` | konten maksimal 72rem, 4 kolom katalog |

Detail lain: satuan `dvh` (aman terhadap bilah alamat mobile), utility `pt-safe` / `pb-safe`
untuk notch & home indicator iPhone, `viewportFit: "cover"`, target sentuh minimal 44px,
dan zoom tidak dikunci (`maximumScale: 5`) demi aksesibilitas.

## Struktur

```
public/
  manifest.webmanifest   # nama, ikon, shortcut, display standalone
  sw.js                  # service worker (cache & offline)
  offline.html           # halaman fallback saat offline
  icons/                 # ikon any + maskable + apple-touch
scripts/
  generate-icons.mjs     # generator ikon berbasis sharp
src/
  app/
    layout.tsx           # metadata PWA, viewport, font, AppShell
    page.tsx             # Beranda (dashboard)
    katalog/page.tsx     # grid produk responsif
    statistik/page.tsx   # grafik CSS murni
    profil/page.tsx      # preferensi + status PWA live
    globals.css          # token Tailwind v4, utility safe-area
  components/
    app-shell.tsx        # kerangka: sidebar + topbar + konten + bottom nav
    side-nav.tsx         # navigasi tablet/desktop (md & lg)
    bottom-nav.tsx       # tab bar mobile (< md)
    top-bar.tsx          # judul, pencarian, notifikasi, tombol pasang
    install-button.tsx   # beforeinstallprompt + panduan iOS
    network-status.tsx   # banner offline
    service-worker-registrar.tsx  # registrasi SW + notifikasi versi baru
    ui.tsx               # Card, Section, StatCard, Badge
  lib/
    nav.ts, utils.ts
```

## Caching service worker

| Jenis request | Strategi |
|---|---|
| Navigasi halaman | network-first → cache → `/offline.html` |
| `/_next/static`, ikon, gambar, font | cache-first + revalidate di belakang layar |
| Lainnya (mis. API) | network-first dengan fallback cache |

Naikkan `CACHE_VERSION` di [public/sw.js](public/sw.js) saat ingin memaksa semua cache lama dibuang.
Saat versi baru terdeteksi, muncul toast **"Versi baru tersedia — Muat ulang"**.

## Mengganti identitas aplikasi

1. Nama & warna: `public/manifest.webmanifest` dan `APP_NAME` di [src/app/layout.tsx](src/app/layout.tsx).
2. Ikon: edit SVG di [scripts/generate-icons.mjs](scripts/generate-icons.mjs) lalu `npm run gen:icons`.
3. Warna brand: variabel `--color-brand-*` di [src/app/globals.css](src/app/globals.css).
