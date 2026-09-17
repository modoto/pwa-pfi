import type { Metadata } from "next";
import { ProductDetail } from "@/components/leads/product-detail";
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Detail Produk",
};

/**
 * Detail produk. `[product]` adalah id produk di master data; keberadaannya
 * baru bisa diperiksa di browser (database lokal ada di sana), jadi keadaan
 * "tidak ditemukan" ditangani komponennya, bukan `notFound()` di server.
 */
export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string; product: string }>;
}) {
  const { id, product } = await params;
  const session = await getSession();

  return (
    <ProductDetail
      leadId={id}
      productId={decodeURIComponent(product)}
      agentName={session?.fullName ?? null}
    />
  );
}
