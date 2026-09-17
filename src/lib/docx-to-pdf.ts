import "server-only";

/**
 * Konversi `.docx` → PDF memakai LibreOffice headless.
 *
 * Dipakai langkah RIPLAY: dokumen yang sudah diisi di perangkat dikirim ke
 * server, dikembalikan sebagai PDF, lalu ditampilkan dan disimpan di perangkat.
 * Alasannya tata letak: pratinjau HTML (docx-preview) hanya mendekati Word,
 * sedangkan LibreOffice memakai mesin tata letak yang sama dengan yang dipakai
 * mencetak — jadi PDF-nya sama dengan dokumen yang diunduh agen.
 *
 * Lokasi binernya beda antara laptop pengembang (Windows) dan server (Ubuntu),
 * jadi bisa ditentukan lewat `LIBREOFFICE_PATH`; tanpa itu dicari di lokasi
 * bawaan tiap sistem, lalu di PATH.
 */

import { execFile } from "node:child_process";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const jalankan = promisify(execFile);

/** Batas waktu satu konversi. Template RIPLAY terbesar ±40 halaman. */
const BATAS_MS = 120_000;

/** Kandidat lokasi biner LibreOffice per sistem operasi. */
const KANDIDAT: Record<string, string[]> = {
  // `soffice.com` adalah pembungkus konsol yang menunggu konversi selesai;
  // `soffice.exe` bisa langsung lepas ke latar belakang. Pemisahnya ditulis
  // garis miring — Windows menerimanya dan tidak perlu escape.
  win32: [
    "C:/Program Files/LibreOffice/program/soffice.com",
    "C:/Program Files/LibreOffice/program/soffice.exe",
    "C:/Program Files (x86)/LibreOffice/program/soffice.com",
    "C:/Program Files (x86)/LibreOffice/program/soffice.exe",
  ],
  linux: [
    "/usr/bin/soffice",
    "/usr/bin/libreoffice",
    "/usr/lib/libreoffice/program/soffice",
    "/snap/bin/libreoffice",
    "/opt/libreoffice/program/soffice",
  ],
  darwin: ["/Applications/LibreOffice.app/Contents/MacOS/soffice"],
};

const ada = async (path: string) =>
  access(path, constants.X_OK).then(
    () => true,
    () => false
  );

let tersimpan: string | null | undefined;

/** Biner LibreOffice yang dipakai, atau `null` kalau tidak ada di mesin ini. */
export async function cariLibreOffice(): Promise<string | null> {
  if (tersimpan !== undefined) return tersimpan;

  const dariEnv = process.env.LIBREOFFICE_PATH?.trim();
  if (dariEnv) {
    tersimpan = (await ada(dariEnv)) ? dariEnv : null;
    return tersimpan;
  }

  for (const kandidat of KANDIDAT[process.platform] ?? []) {
    if (await ada(kandidat)) {
      tersimpan = kandidat;
      return tersimpan;
    }
  }

  // Terakhir: percayakan ke PATH. `--version` murah dan tidak membuka dokumen.
  const diPath = process.platform === "win32" ? "soffice.com" : "soffice";
  try {
    await jalankan(diPath, ["--version"], { timeout: 20_000 });
    tersimpan = diPath;
  } catch {
    tersimpan = null;
  }

  return tersimpan;
}

/** Tunggu berkas muncul — di Windows soffice kadang selesai setelah prosesnya keluar. */
async function tungguBerkas(path: string, batasMs: number) {
  const tenggat = Date.now() + batasMs;

  while (Date.now() < tenggat) {
    if (await access(path, constants.R_OK).then(() => true, () => false)) return true;
    await new Promise((lanjut) => setTimeout(lanjut, 150));
  }

  return false;
}

export class KonversiPdfError extends Error {}

/**
 * Ubah dokumen Word menjadi PDF.
 *
 * Tiap konversi memakai profil LibreOffice sendiri di direktori sementara:
 * tanpa itu permintaan kedua yang datang bersamaan akan ditolak karena profil
 * bawaan sudah terkunci proses pertama.
 */
export async function konversiDocxKePdf(docx: Buffer): Promise<Buffer> {
  const biner = await cariLibreOffice();
  if (!biner) {
    throw new KonversiPdfError(
      "LibreOffice tidak ditemukan di server. Pasang LibreOffice atau setel LIBREOFFICE_PATH."
    );
  }

  const kerja = await mkdtemp(join(tmpdir(), "riplay-"));
  const masuk = join(kerja, "dokumen.docx");
  const keluar = join(kerja, "dokumen.pdf");

  try {
    await writeFile(masuk, docx);

    await jalankan(
      biner,
      [
        "--headless",
        "--norestore",
        "--invisible",
        "--nolockcheck",
        "--nodefault",
        "--nofirststartwizard",
        `-env:UserInstallation=${pathToFileURL(join(kerja, "profil")).href}`,
        "--convert-to",
        "pdf:writer_pdf_Export",
        "--outdir",
        kerja,
        masuk,
      ],
      { timeout: BATAS_MS, maxBuffer: 8 * 1024 * 1024, windowsHide: true }
    );

    if (!(await tungguBerkas(keluar, 15_000))) {
      throw new KonversiPdfError("LibreOffice selesai tanpa menghasilkan PDF.");
    }

    return await readFile(keluar);
  } catch (error) {
    if (error instanceof KonversiPdfError) throw error;
    throw new KonversiPdfError(
      error instanceof Error ? error.message : "Konversi dokumen ke PDF gagal."
    );
  } finally {
    await rm(kerja, { recursive: true, force: true }).catch(() => {});
  }
}
