import type { Metadata } from "next";
import { FnaProducts } from "@/components/leads/fna-products";

export const metadata: Metadata = {
  title: "Rekomendasi Produk",
};

/**
 * Rekomendasi Produk. Daftarnya dibaca dari database lokal di browser, jadi
 * seluruh isinya dirender komponen klien.
 */
export default async function FnaProductsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <FnaProducts leadId={id} />;
}
