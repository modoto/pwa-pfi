"use client";

/**
 * Sisipkan gambar tanda tangan ke dokumen RIPLAY.
 *
 * Tanda tangan digambar di kanvas pada langkah terakhir ilustrasi dan disimpan
 * sebagai PNG data URL (`lead_illustration_fields`). Di sini PNG itu dimasukkan
 * ke berkas .docx sebagai gambar sungguhan — bukan teks — sehingga ikut terbawa
 * ke pratinjau, PDF, dan berkas yang diunduh lewat satu jalur yang sama.
 *
 * Templatenya tidak punya penanda untuk tanda tangan, jadi tempatnya dicari:
 * blok tanda tangan selalu di akhir dokumen, berisi label ("Tenaga Pemasar yang
 * Menjelaskan", "Calon Pemegang Polis"), beberapa paragraf kosong sebagai ruang
 * tanda tangan, lalu namanya. Gambar ditaruh di paragraf kosong tepat di atas
 * nama — ruang yang memang disediakan — supaya tata letak halaman tidak bergeser.
 * Kalau blok itu tidak dikenali, dokumen dibiarkan apa adanya.
 */

import type JSZip from "jszip";
import { TOKEN_PATTERN, normalizeToken } from "@/lib/riplay-fill";

export type TandaTanganRiplay = {
  /** PNG data URL tanda tangan calon pemegang polis. */
  pemegangPolis?: string;
  /** PNG data URL tanda tangan tenaga pemasar. */
  tenagaPemasar?: string;
};

/** 1 cm = 360.000 EMU (satuan ukuran gambar di OOXML). */
const EMU_PER_CM = 360_000;
const TINGGI_MAKS = 1.4 * EMU_PER_CM;
const LEBAR_MAKS = 4 * EMU_PER_CM;

/** Hanya paragraf di bagian akhir dokumen yang dianggap blok tanda tangan. */
const AWAL_EKOR = 0.8;

const PARAGRAF = /<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g;
const TEKS = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
const PENUTUP_PARAGRAF = /<\/w:p>$/;
const PPR = /<w:pPr>[\s\S]*?<\/w:pPr>/;
const BUKA_PARAGRAF = /^<w:p(?:\s[^>]*)?>/;

/** Penanda nama pada blok tanda tangan, sesuai ejaan tiap template. */
const NAMA_AGEN = new Set(["nameofagent", "agentsname", "agentname"]);
const NAMA_PP = new Set(["nameofpolicyholder", "policyholdername", "policyholdersname"]);

const teksParagraf = (paragraf: string) =>
  [...paragraf.matchAll(TEKS)]
    .map((m) => m[1])
    .join("")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();

/** PNG data URL → byte dan ukuran piksel; `null` kalau isinya bukan PNG. */
function bacaPng(dataUrl: string): { bytes: Uint8Array; lebar: number; tinggi: number } | null {
  const pemisah = dataUrl.indexOf(",");
  if (!dataUrl.startsWith("data:image/png") || pemisah < 0) return null;

  try {
    const biner = atob(dataUrl.slice(pemisah + 1));
    const bytes = new Uint8Array(biner.length);
    for (let i = 0; i < biner.length; i++) bytes[i] = biner.charCodeAt(i);

    // Ukuran ada di chunk IHDR: 8 byte tanda tangan PNG + 8 byte kepala chunk.
    const view = new DataView(bytes.buffer);
    const lebar = view.getUint32(16);
    const tinggi = view.getUint32(20);
    if (!lebar || !tinggi) return null;

    return { bytes, lebar, tinggi };
  } catch {
    return null;
  }
}

/** Ukuran gambar di dokumen: setinggi ruang tanda tangan, rasinya dijaga. */
function ukuran(lebarPiksel: number, tinggiPiksel: number) {
  let tinggi = TINGGI_MAKS;
  let lebar = (lebarPiksel / tinggiPiksel) * tinggi;

  if (lebar > LEBAR_MAKS) {
    lebar = LEBAR_MAKS;
    tinggi = (tinggiPiksel / lebarPiksel) * lebar;
  }

  return { lebar: Math.round(lebar), tinggi: Math.round(tinggi) };
}

/**
 * Run berisi gambar sebaris (`wp:inline`).
 *
 * Namespace `a` dan `pic` dideklarasikan di elemennya sendiri karena sebagian
 * template tidak mendeklarasikannya di akar dokumen.
 */
function runGambar(rId: string, nomor: number, nama: string, lebar: number, tinggi: number) {
  const NS_DRAWING = "http://schemas.openxmlformats.org/drawingml/2006/main";
  const NS_PICTURE = "http://schemas.openxmlformats.org/drawingml/2006/picture";
  const NS_RELS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

  return (
    `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">` +
    `<wp:extent cx="${lebar}" cy="${tinggi}"/>` +
    `<wp:effectExtent l="0" t="0" r="0" b="0"/>` +
    `<wp:docPr id="${nomor}" name="${nama}"/>` +
    `<wp:cNvGraphicFramePr>` +
    `<a:graphicFrameLocks xmlns:a="${NS_DRAWING}" noChangeAspect="1"/>` +
    `</wp:cNvGraphicFramePr>` +
    `<a:graphic xmlns:a="${NS_DRAWING}">` +
    `<a:graphicData uri="${NS_PICTURE}">` +
    `<pic:pic xmlns:pic="${NS_PICTURE}">` +
    `<pic:nvPicPr><pic:cNvPr id="${nomor}" name="${nama}"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill>` +
    `<a:blip xmlns:r="${NS_RELS}" r:embed="${rId}"/>` +
    `<a:stretch><a:fillRect/></a:stretch>` +
    `</pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${lebar}" cy="${tinggi}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
    `</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`
  );
}

/**
 * Ratakan tengah paragraf yang memuat tanda tangan.
 *
 * Paragraf kosong di blok tanda tangan sering membawa indentasi negatif untuk
 * merapikan teks nama (`w:ind w:left="-62"`); dipakai apa adanya, gambarnya
 * keluar dari tepi sel. Urutan anak `w:pPr` mengikuti skema OOXML — `w:jc`
 * sebelum `w:rPr`.
 */
function pusatkan(paragraf: string): string {
  const pPr = PPR.exec(paragraf)?.[0];

  if (!pPr) {
    return paragraf.replace(
      BUKA_PARAGRAF,
      (buka) => `${buka}<w:pPr><w:jc w:val="center"/></w:pPr>`
    );
  }

  const bersih = pPr
    .replace(/<w:ind\b[^>]*\/>/g, "")
    .replace(/<w:ind\b[^>]*>[\s\S]*?<\/w:ind>/g, "")
    .replace(/<w:jc\b[^>]*\/>/g, "");

  const jc = '<w:jc w:val="center"/>';
  const baru = bersih.includes("<w:rPr>")
    ? bersih.replace("<w:rPr>", `${jc}<w:rPr>`)
    : bersih.replace("</w:pPr>", `${jc}</w:pPr>`);

  return paragraf.replace(PPR, baru);
}

type Paragraf = { xml: string; mulai: number; akhir: number; teks: string };

const BARIS = "<w:tr";
const TUTUP_BARIS = "</w:tr>";
const SEL = /<w:tc>[\s\S]*?<\/w:tc>/g;

type Baris = { awal: number; akhir: number };

/** Baris tabel yang memuat `posisi`. */
function barisTabel(xml: string, posisi: number): Baris | null {
  const awal = xml.lastIndexOf(BARIS, posisi);
  if (awal < 0) return null;

  const akhir = xml.indexOf(TUTUP_BARIS, posisi);
  if (akhir < 0) return null;

  return { awal, akhir: akhir + TUTUP_BARIS.length };
}

/** Baris tetangga di tabel yang sama; `null` kalau tabelnya sudah habis. */
function barisTetangga(xml: string, baris: Baris, arah: -1 | 1): Baris | null {
  if (arah < 0) {
    const tetangga = barisTabel(xml, baris.awal - 1);
    if (!tetangga || xml.slice(tetangga.akhir, baris.awal).includes("<w:tbl")) return null;
    return tetangga;
  }

  const awal = xml.indexOf(BARIS, baris.akhir);
  if (awal < 0 || xml.slice(baris.akhir, awal).includes("</w:tbl>")) return null;

  return barisTabel(xml, awal + BARIS.length);
}

/**
 * Ruang tanda tangan di kolom yang sama dengan nama.
 *
 * Blok tanda tangan disusun sebagai tabel dengan banyak kolom sempit: paragraf
 * kosong tepat sebelum nama di urutan dokumen sering berada di **sel lain**
 * selebar setengah sentimeter, dan gambar yang ditaruh di situ meleset dari
 * kotaknya. Yang dicari karena itu sel kosong di kolom yang sama, satu-dua
 * baris di atas (atau di bawah, bila yang ketemu hanya labelnya).
 */
function ruangSekolom(
  xml: string,
  paragraf: Paragraf[],
  indeks: number,
  arah: -1 | 1,
  terpakai: Set<number>
): number | null {
  const posisi = paragraf[indeks].mulai;
  const baris = barisTabel(xml, posisi);
  if (!baris) return null;

  const isiBaris = xml.slice(baris.awal, baris.akhir);
  const sel = [...isiBaris.matchAll(SEL)];
  const kolom = sel.findIndex(
    (s) => baris.awal + s.index <= posisi && posisi < baris.awal + s.index + s[0].length
  );
  if (kolom < 0) return null;

  let sekarang = baris;

  for (let langkah = 0; langkah < 3; langkah++) {
    const tetangga = barisTetangga(xml, sekarang, arah);
    if (!tetangga) return null;
    sekarang = tetangga;

    const selTetangga = [...xml.slice(tetangga.awal, tetangga.akhir).matchAll(SEL)];
    const kotak = selTetangga[kolom];
    if (!kotak) continue;

    // Paragraf terdekat ke nama: yang terakhir bila naik, yang pertama bila turun.
    const isi = [...kotak[0].matchAll(PARAGRAF)];
    const dipilih = arah < 0 ? isi.at(-1) : isi[0];
    if (!dipilih) continue;

    const mulai = tetangga.awal + kotak.index + dipilih.index;
    const nomor = paragraf.findIndex((p) => p.mulai === mulai);
    if (nomor < 0 || terpakai.has(nomor) || paragraf[nomor].teks !== "") continue;

    return nomor;
  }

  return null;
}

/** Paragraf kosong terdekat ke arah `langkah`, melewati yang sudah terpakai. */
function ruangKosong(
  paragraf: Paragraf[],
  dari: number,
  langkah: -1 | 1,
  terpakai: Set<number>,
  batas = 5
): number | null {
  for (let i = 1; i <= batas; i++) {
    const posisi = dari + langkah * i;
    if (posisi < 0 || posisi >= paragraf.length) return null;
    if (terpakai.has(posisi)) continue;
    if (paragraf[posisi].teks === "") return posisi;
  }

  return null;
}

/** Satu pihak yang tanda tangannya disisipkan. */
type Pihak = {
  data: string;
  /** Penanda nama di blok tanda tangan, mis. `<Name of Agent>`. */
  penanda: Set<string>;
  /** Nama tanpa kurung sudut — sebagian template lupa memberi penandanya. */
  namaPolos: RegExp;
  /** Label blok, dipakai bila templatenya tidak memuat nama sama sekali. */
  label: RegExp;
  berkas: string;
  judul: string;
};

/**
 * Cari paragraf yang akan memuat gambar.
 *
 * Paragraf nama dipakai lebih dulu: tanda tangan duduk di ruang kosong tepat di
 * atasnya. Template yang tidak memuat nama — Mega Warisan — memakai labelnya,
 * dan ruang kosongnya ada di bawah label.
 */
function cariRuang(
  xml: string,
  paragraf: Paragraf[],
  pihak: Pihak,
  terpakai: Set<number>
): number | null {
  const ekor = Math.floor(paragraf.length * AWAL_EKOR);
  let nama = -1;
  let label = -1;

  for (let i = ekor; i < paragraf.length; i++) {
    const teks = paragraf[i].teks;

    for (const cocok of teks.matchAll(TOKEN_PATTERN)) {
      if (pihak.penanda.has(normalizeToken(cocok[1] ?? cocok[2] ?? ""))) nama = i;
    }

    if (pihak.namaPolos.test(teks)) nama = i;
    if (pihak.label.test(teks)) label = i;
  }

  if (nama >= 0) {
    return ruangSekolom(xml, paragraf, nama, -1, terpakai) ?? ruangKosong(paragraf, nama, -1, terpakai);
  }

  if (label >= 0) {
    return ruangSekolom(xml, paragraf, label, 1, terpakai) ?? ruangKosong(paragraf, label, 1, terpakai);
  }

  return null;
}

/** Daftarkan gambar di `word/_rels/document.xml.rels`, kembalikan rId-nya. */
async function daftarkanGambar(zip: JSZip, berkas: string): Promise<string> {
  const path = "word/_rels/document.xml.rels";
  const rels = (await zip.file(path)?.async("string")) ?? "";
  const nomor = Math.max(0, ...[...rels.matchAll(/Id="rId(\d+)"/g)].map((m) => Number(m[1]))) + 1;
  const rId = `rId${nomor}`;

  zip.file(
    path,
    rels.replace(
      "</Relationships>",
      `<Relationship Id="${rId}" ` +
        `Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" ` +
        `Target="media/${berkas}"/></Relationships>`
    )
  );

  return rId;
}

/** Pastikan PNG dikenali saat dokumen dibuka; sebagian template belum memuatnya. */
async function daftarkanTipePng(zip: JSZip) {
  const path = "[Content_Types].xml";
  const types = (await zip.file(path)?.async("string")) ?? "";
  if (!types || /Extension="png"/i.test(types)) return;

  zip.file(
    path,
    types.replace(/(<Types[^>]*>)/, '$1<Default Extension="png" ContentType="image/png"/>')
  );
}

/**
 * Sisipkan tanda tangan ke dokumen.
 *
 * Aman dipanggil tanpa tanda tangan atau pada template yang blok tanda
 * tangannya tidak dikenali — dokumennya tidak disentuh.
 */
export async function sisipkanTandaTangan(zip: JSZip, ttd: TandaTanganRiplay): Promise<void> {
  const pihak: Pihak[] = [];

  if (ttd.pemegangPolis) {
    pihak.push({
      data: ttd.pemegangPolis,
      penanda: NAMA_PP,
      namaPolos: /^(name of policy holder|nama calon pemegang polis)$/i,
      label: /^(calon )?pemegang polis$/i,
      berkas: "ttd-pemegang-polis.png",
      judul: "Tanda tangan calon pemegang polis",
    });
  }

  if (ttd.tenagaPemasar) {
    pihak.push({
      data: ttd.tenagaPemasar,
      penanda: NAMA_AGEN,
      namaPolos: /^name of agent$/i,
      label: /^tenaga pemasar/i,
      berkas: "ttd-tenaga-pemasar.png",
      judul: "Tanda tangan tenaga pemasar",
    });
  }

  if (pihak.length === 0) return;

  const xml = (await zip.file("word/document.xml")?.async("string")) ?? "";
  if (!xml) return;

  const paragraf: Paragraf[] = [...xml.matchAll(PARAGRAF)].map((m) => ({
    xml: m[0],
    mulai: m.index,
    akhir: m.index + m[0].length,
    teks: teksParagraf(m[0]),
  }));

  const terpakai = new Set<number>();
  const suntikan: { posisi: number; xml: string }[] = [];
  let nomor = 9001;

  for (const item of pihak) {
    const png = bacaPng(item.data);
    if (!png) continue;

    const posisi = cariRuang(xml, paragraf, item, terpakai);
    if (posisi === null) continue;

    zip.file(`word/media/${item.berkas}`, png.bytes);
    const rId = await daftarkanGambar(zip, item.berkas);
    const { lebar, tinggi } = ukuran(png.lebar, png.tinggi);

    // Paragraf kosong hanya berisi propertinya (`w:pPr`), jadi run gambar cukup
    // ditaruh di ujung — properti tetap di depan run, sesuai aturan OOXML.
    suntikan.push({
      posisi,
      xml: pusatkan(paragraf[posisi].xml).replace(
        PENUTUP_PARAGRAF,
        `${runGambar(rId, nomor, item.judul, lebar, tinggi)}</w:p>`
      ),
    });

    terpakai.add(posisi);
    nomor += 1;
  }

  if (suntikan.length === 0) return;

  let hasil = xml;
  for (const { posisi, xml: baru } of suntikan.sort((a, b) => b.posisi - a.posisi)) {
    hasil = hasil.slice(0, paragraf[posisi].mulai) + baru + hasil.slice(paragraf[posisi].akhir);
  }

  zip.file("word/document.xml", hasil);
  await daftarkanTipePng(zip);
}
