import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { NetworkStatus } from "@/components/network-status";
import { getSession } from "@/lib/session";

/**
 * Kerangka tanpa header agen dan tab bar bawah.
 *
 * Dipakai layar-layar yang menurut desain Figma mengisi penuh dan punya bar
 * judulnya sendiri dengan tombol kembali: Detail Lead beserta seluruh alur FnA
 * dan Sales Illustration di bawahnya. Pengecekan sesi sama seperti grup (app) —
 * `proxy.ts` hanya memeriksa secara optimistik.
 */
export default async function FullscreenLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-dvh flex-col bg-pfi-bg font-jakarta">
      <NetworkStatus />

      {/* Tanpa lebar maksimum dan tanpa pemusatan — sama seperti header agen di
          grup (app) yang membentang penuh — supaya bar judul tiap halaman yang
          memakai `-mx-4 sm:-mx-6` benar-benar menempel ke tepi kiri dan kanan
          layar. Padding atas juga tidak ada: bar judul itu sendiri yang
          menyediakan padding aman untuk notch. */}
      <main className="w-full flex-1 px-4 pb-10 sm:px-6">
        {children}
      </main>
    </div>
  );
}
