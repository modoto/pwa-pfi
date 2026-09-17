import { LineChart, ShieldCheck } from "lucide-react";

/**
 * Ikon pengganti foto produk menurut jenisnya — foto dari Figma belum
 * diekspor. Jenis di API: "UnitLink" atau "Tradisional".
 */
export function ProductIcon({
  productType,
  className,
}: {
  productType: string | null;
  className?: string;
}) {
  return productType === "UnitLink" ? (
    <LineChart className={className} aria-hidden />
  ) : (
    <ShieldCheck className={className} aria-hidden />
  );
}
