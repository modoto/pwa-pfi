import type { ReactNode } from "react";
import { AppHeader } from "@/components/app-header";
import { BottomNav } from "@/components/bottom-nav";
import { NetworkStatus } from "@/components/network-status";

/**
 * Kerangka aplikasi mengikuti desain Figma: header identitas agen di atas,
 * konten di tengah, tab bar di bawah (tanpa sidebar, termasuk di layar lebar).
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-pfi-bg font-jakarta">
      <NetworkStatus />
      <AppHeader />

      <main className="mx-auto w-full max-w-[1366px] flex-1 px-4 pb-32 pt-6 sm:px-6">
        {children}
      </main>

      <BottomNav />
    </div>
  );
}
