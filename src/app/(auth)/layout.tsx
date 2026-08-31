import type { ReactNode } from "react";

/** Grup rute publik: tanpa sidebar / tab bar, halaman mengisi penuh layar. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-dvh bg-white">{children}</div>;
}
