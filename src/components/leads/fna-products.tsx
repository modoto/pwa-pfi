"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { FnaBanner, FnaHeader } from "@/components/leads/fna-chrome";
import { MasterMissing } from "@/components/master-missing";
import { jenisProduk, namaProduk } from "@/lib/products-data";
import { ProductIcon } from "@/components/leads/product-icon";
import { listProducts, type MasterProduct } from "@/lib/db/master-repo";

const CHIP_CLASS: Record<string, string> = {
  UnitLink: "bg-status-orange-bg text-status-orange-fg",
  Tradisional: "bg-status-blue-bg text-status-blue-fg",
};

/**
 * Rekomendasi Produk — daftarnya dibaca dari tabel lokal `products`
 * (hasil penarikan GetAllProduct), bukan dari API langsung.
 *
 * Semua produk aktif ditampilkan: master `mappings` sudah mengaitkan produk
 * dengan rentang skor profil risiko, tapi skornya sendiri belum bisa dihitung
 * karena soal kuesioner di desain berbeda dengan soal di master RPQ.
 */
export function FnaProducts({ leadId }: { leadId: string }) {
  const [products, setProducts] = useState<MasterProduct[] | null | undefined>(undefined);
  const [message, setMessage] = useState("");

  const fnaHref = `/leads/details/${leadId}/fna`;

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

  return (
    <div className="flex flex-col gap-6">
      <FnaHeader backHref={`${fnaHref}/risk-result`} title="Produk" />
      <FnaBanner>Rekomendasi Produk</FnaBanner>

      <div className="flex flex-col gap-2 text-center">
        <h2 className="text-xl font-bold text-pfi-heading">Pilihan Produk untuk Anda</h2>
        <p className="text-base text-pfi-muted">
          Klik salah satu produk untuk melihat detail dan ilustrasi manfaat
        </p>
      </div>

      {message && (
        <p className="rounded-[10px] border border-pfi-down-fg/30 bg-pfi-down-bg px-4 py-3 text-sm font-medium text-pfi-down-fg">
          {message}
        </p>
      )}

      {products === undefined ? (
        <p className="py-10 text-center text-sm text-pfi-muted">Memuat data lokal …</p>
      ) : products === null ? (
        <MasterMissing label="produk" />
      ) : products.length === 0 ? (
        <p className="py-10 text-center text-sm text-pfi-muted">
          Tidak ada produk aktif di master data.
        </p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
              <Link
                key={product.id}
                href={`${fnaHref}/products/${encodeURIComponent(product.id)}`}
                className="flex flex-col overflow-hidden rounded-[14px] border border-pfi-hairline bg-white shadow-card transition hover:border-pfi-link"
              >
                {/* Foto produk belum diekspor dari Figma — sementara blok berikon. */}
                <span className="grid h-44 place-items-center bg-linear-to-br from-pfi-tint to-pfi-chip-bg text-pfi-proses">
                  <ProductIcon productType={product.product_type} className="size-12" />
                </span>

                <span className="flex flex-1 flex-col gap-4 p-5">
                  <span className="flex flex-col gap-1">
                    <span className="text-lg font-bold uppercase text-pfi-heading">
                      {product.description || product.product_name}
                    </span>
                    {product.description && product.product_name && (
                      <span className="text-sm text-pfi-muted">
                        {product.product_name}
                        {product.product_code ? ` · Kode ${product.product_code}` : ""}
                      </span>
                    )}
                  </span>

                  <span
                    className={cn(
                      "w-fit rounded-full px-3 py-1.5 text-sm font-medium",
                      CHIP_CLASS[product.product_type ?? ""] ?? "bg-pfi-chip-bg text-pfi-heading"
                    )}
                  >
                    {jenisProduk(product)}
                  </span>

                  <span className="mt-auto flex items-center justify-between gap-3 border-t border-pfi-hairline pt-4">
                    <Image
                      src="/login/logo-pfi.png"
                      alt="PFI Mega Life"
                      width={96}
                      height={24}
                      className="h-6 w-auto"
                    />
                    <span
                      className="grid size-9 place-items-center rounded-full bg-pfi-tint text-pfi-link"
                      title={namaProduk(product)}
                    >
                      <ChevronRight className="size-5" aria-hidden />
                    </span>
                  </span>
                </span>
              </Link>
          ))}
        </div>
      )}

      <Link
        href={`${fnaHref}/risk-result`}
        className="rounded-[10px] border border-pfi-line bg-white px-6 py-3.5 text-center text-base font-medium text-pfi-heading transition hover:bg-pfi-hairline"
      >
        Kembali ke Hasil Analisa
      </Link>
    </div>
  );
}
