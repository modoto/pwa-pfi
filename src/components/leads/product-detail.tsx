"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, FileText } from "lucide-react";
import { FnaFooter, FnaHeader } from "@/components/leads/fna-chrome";
import { MasterMissing } from "@/components/master-missing";
import { ProductIcon } from "@/components/leads/product-icon";
import {
  JENIS_PRODUK_API,
  PRODUCT_DISCLAIMER,
  PRODUCT_ILLUSTRATIONS,
  namaProduk,
} from "@/lib/products-data";
import { listProducts, type MasterProduct } from "@/lib/db/master-repo";
import { loadStep, saveStep } from "@/lib/db/illustration-repo";
import { startProcess } from "@/lib/db/processes-repo";

/**
 * Detail produk dan ilustrasi manfaat — langkah terakhir alur FnA.
 *
 * Produknya dibaca dari tabel lokal `products`; teks ilustrasi manfaat tidak
 * ada di API, jadi diambil dari PRODUCT_ILLUSTRATIONS menurut kode produk.
 *
 * "Mulai Ilustrasi" menandai proses Sales Illustration berjalan dan, bila
 * langkah Rincian Produk di ilustrasi masih kosong, mengisinya dengan produk
 * ini supaya agen tidak memilih ulang.
 */
export function ProductDetail({
  leadId,
  productId,
  agentName,
}: {
  leadId: string;
  productId: string;
  agentName: string | null;
}) {
  const router = useRouter();
  const [pindah, setPindah] = useState(false);
  const [products, setProducts] = useState<MasterProduct[] | null | undefined>(undefined);
  const [message, setMessage] = useState("");

  const detailHref = `/leads/details/${leadId}`;
  const productsHref = `${detailHref}/fna/products`;

  useEffect(() => {
    let batal = false;

    listProducts()
      .then((rows) => {
        if (!batal) setProducts(rows);
      })
      .catch((error: unknown) => {
        if (batal) return;
        setMessage(error instanceof Error ? error.message : "Gagal membaca database lokal.");
        setProducts([]);
      });

    return () => {
      batal = true;
    };
  }, []);

  const product = products?.find((item) => item.id === productId) ?? null;

  async function mulaiIlustrasi() {
    setPindah(true);

    // Gagal menandai atau mengisi awal tidak boleh menghalangi agen melanjutkan.
    await startProcess(leadId, "ilustrasi", agentName).catch(() => {});

    if (product) {
      try {
        const tersimpan = await loadStep(leadId, "product");
        if (!tersimpan.produk_id) {
          await saveStep(
            leadId,
            "product",
            {
              jenis_produk: JENIS_PRODUK_API[product.product_type ?? ""] ?? "",
              produk_id: product.id,
              nama_produk: namaProduk(product),
            },
            agentName
          );
        }
      } catch {
        // Lanjut saja; agen tetap bisa memilih produk di langkah Rincian Produk.
      }
    }

    router.push(`${detailHref}/sales-illustration`);
  }

  if (products === undefined) {
    return (
      <div className="flex flex-col gap-6">
        <FnaHeader backHref={productsHref} title="Produk" />
        <p className="py-10 text-center text-sm text-pfi-muted">Memuat data lokal …</p>
      </div>
    );
  }

  if (products === null || !product) {
    return (
      <div className="flex flex-col gap-6">
        <FnaHeader backHref={productsHref} title="Produk" />
        {message && (
          <p className="rounded-[10px] border border-pfi-down-fg/30 bg-pfi-down-bg px-4 py-3 text-sm font-medium text-pfi-down-fg">
            {message}
          </p>
        )}
        {products === null ? (
          <MasterMissing label="produk" />
        ) : (
          <section className="flex flex-col items-center gap-3 rounded-[14px] border border-pfi-hairline bg-white p-10 text-center shadow-card">
            <p className="text-base font-bold text-pfi-heading">Produk tidak ditemukan</p>
            <p className="text-sm text-pfi-muted">
              Produk ini tidak ada lagi di master data, atau sudah tidak aktif.
            </p>
            <Link href={productsHref} className="mt-2 text-sm font-bold text-pfi-link hover:underline">
              Kembali ke Rekomendasi Produk
            </Link>
          </section>
        )}
      </div>
    );
  }

  const ilustrasi = PRODUCT_ILLUSTRATIONS[product.product_code ?? ""];

  return (
    <div className="flex flex-col gap-6">
      <FnaHeader backHref={productsHref} title="Produk" />

      <section className="-mt-6 overflow-hidden rounded-[14px] border border-pfi-hairline bg-white shadow-card">
        {/* Foto produk belum diekspor dari Figma — sementara blok berikon. */}
        <span className="grid h-56 place-items-center bg-linear-to-br from-pfi-tint to-pfi-chip-bg text-pfi-proses sm:h-72">
          <ProductIcon productType={product.product_type} className="size-16" />
        </span>

        <div className="flex flex-col gap-5 p-5 sm:p-6">
          <div className="flex flex-col gap-1">
            <p className="text-xl font-bold uppercase text-pfi-heading">
              {product.description || product.product_name}
            </p>
            {product.description && product.product_name && (
              <p className="text-sm text-pfi-muted">
                {product.product_name}
                {product.product_code ? ` · Kode ${product.product_code}` : ""}
              </p>
            )}
          </div>

          <h2 className="text-lg font-bold text-pfi-heading">Ilustrasi Manfaat</h2>

          {ilustrasi ? (
            <>
              {ilustrasi.paragraphs.map((paragraph) => (
                <p key={paragraph} className="text-base leading-relaxed text-pfi-heading">
                  {paragraph}
                </p>
              ))}

              <span className="grid h-56 place-items-center rounded-[10px] bg-linear-to-br from-pfi-tint to-pfi-chip-bg text-pfi-proses sm:h-72">
                <ProductIcon productType={product.product_type} className="size-16" />
              </span>

              <div className="flex flex-col gap-4 rounded-r-[10px] border-l-4 border-pfi-proses bg-pfi-tint-alt p-5 sm:p-6">
                {ilustrasi.highlights.map((highlight) => (
                  <p key={highlight} className="text-base leading-relaxed text-pfi-heading">
                    {highlight}
                  </p>
                ))}
              </div>
            </>
          ) : (
            <p className="rounded-[10px] bg-pfi-bg px-4 py-6 text-center text-sm text-pfi-muted">
              Ilustrasi manfaat untuk produk ini belum tersedia.
            </p>
          )}

          {/* TODO: berkas brosur belum ada di repo, jadi baris ini belum bisa diunduh. */}
          <div
            aria-disabled
            title="Berkas brosur belum tersedia"
            className="flex items-center gap-4 rounded-[10px] border border-pfi-hairline bg-pfi-bg px-4 py-4"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-full border border-pfi-orange text-pfi-orange">
              <FileText className="size-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1 truncate text-base text-pfi-heading">
              Brosur Produk – {namaProduk(product)}
            </span>
            <Download className="size-5 shrink-0 text-pfi-subtle" aria-hidden />
          </div>

          <p className="text-justify text-sm leading-relaxed text-pfi-heading">
            {PRODUCT_DISCLAIMER}
          </p>
        </div>
      </section>

      <FnaFooter
        backHref={productsHref}
        onNext={() => void mulaiIlustrasi()}
        nextLabel={pindah ? "Membuka …" : "Mulai Ilustrasi"}
      />
    </div>
  );
}
