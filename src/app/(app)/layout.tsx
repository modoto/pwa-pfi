import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getSession } from "@/lib/session";

/**
 * Semua rute di grup ini butuh sesi. Pengecekan di sini adalah lapisan yang
 * menentukan — `proxy.ts` hanya melakukan pengecekan optimistik agar redirect
 * terjadi lebih awal.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  return <AppShell>{children}</AppShell>;
}
