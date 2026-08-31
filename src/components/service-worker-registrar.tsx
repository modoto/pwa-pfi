"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

/**
 * Mendaftarkan /sw.js dan menampilkan notifikasi ketika ada versi baru.
 * Sengaja hanya aktif di production supaya cache tidak mengganggu `next dev`.
 */
export function ServiceWorkerRegistrar() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    let registration: ServiceWorkerRegistration | undefined;

    const onUpdateFound = () => {
      const installing = registration?.installing;
      if (!installing) return;
      installing.addEventListener("statechange", () => {
        if (installing.state === "installed" && navigator.serviceWorker.controller) {
          setWaitingWorker(installing);
        }
      });
    };

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        registration = reg;
        if (reg.waiting && navigator.serviceWorker.controller) setWaitingWorker(reg.waiting);
        reg.addEventListener("updatefound", onUpdateFound);
      })
      .catch((error) => console.error("Pendaftaran service worker gagal:", error));

    // Reload sekali saat service worker baru mengambil alih.
    let refreshing = false;
    const onControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    return () => {
      registration?.removeEventListener("updatefound", onUpdateFound);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  if (!waitingWorker) return null;

  return (
    <div className="pb-safe fixed inset-x-0 bottom-20 z-50 flex justify-center px-4 md:bottom-6">
      <div className="flex w-full max-w-sm items-center gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white shadow-lg shadow-slate-900/20 dark:bg-slate-800">
        <RefreshCw className="size-4 shrink-0" aria-hidden />
        <p className="flex-1">Versi baru tersedia.</p>
        <button
          type="button"
          onClick={() => waitingWorker.postMessage("SKIP_WAITING")}
          className="rounded-full bg-white px-3 py-1.5 font-semibold text-slate-900 transition hover:bg-slate-100"
        >
          Muat ulang
        </button>
      </div>
    </div>
  );
}
