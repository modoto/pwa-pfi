"use client";

import { useState, useSyncExternalStore } from "react";
import { Download, Share } from "lucide-react";
import { cn } from "@/lib/utils";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const noopSubscribe = () => () => {};

function subscribeDisplayMode(callback: () => void) {
  const media = window.matchMedia("(display-mode: standalone)");
  media.addEventListener("change", callback);
  window.addEventListener("appinstalled", callback);
  return () => {
    media.removeEventListener("change", callback);
    window.removeEventListener("appinstalled", callback);
  };
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // Safari iOS memakai properti non-standar ini
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * Tombol "Pasang aplikasi".
 * - Android/Chrome/Edge: memakai event `beforeinstallprompt`.
 * - iOS Safari: event itu tidak ada, jadi tampilkan panduan Bagikan → Tambah ke Layar Utama.
 */
export function InstallButton({ className }: { className?: string }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [justInstalled, setJustInstalled] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);

  const standalone = useSyncExternalStore(subscribeDisplayMode, isStandalone, () => false);
  const isIos = useSyncExternalStore(
    noopSubscribe,
    () => /iphone|ipad|ipod/i.test(window.navigator.userAgent),
    () => false
  );

  useSyncExternalStore(
    (callback) => {
      const onPrompt = (event: Event) => {
        event.preventDefault();
        setDeferred(event as BeforeInstallPromptEvent);
        callback();
      };
      const onInstalled = () => {
        setJustInstalled(true);
        setDeferred(null);
        callback();
      };
      window.addEventListener("beforeinstallprompt", onPrompt);
      window.addEventListener("appinstalled", onInstalled);
      return () => {
        window.removeEventListener("beforeinstallprompt", onPrompt);
        window.removeEventListener("appinstalled", onInstalled);
      };
    },
    () => true,
    () => true
  );

  if (standalone || justInstalled) return null;
  if (!deferred && !isIos) return null;

  const handleClick = async () => {
    if (deferred) {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === "accepted") setJustInstalled(true);
      setDeferred(null);
      return;
    }
    setShowIosHint((value) => !value);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          "inline-flex h-10 items-center gap-2 rounded-full bg-brand-600 px-3 text-sm font-semibold text-white transition hover:bg-brand-700 active:scale-[0.98] sm:px-4",
          className
        )}
      >
        <Download className="size-4" aria-hidden />
        <span className="hidden xs:inline">Pasang</span>
      </button>

      {showIosHint && (
        <div className="absolute right-0 top-12 z-50 w-64 rounded-2xl border border-slate-200 bg-white p-3 text-xs leading-relaxed shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <p className="mb-2 font-semibold">Pasang di iPhone / iPad</p>
          <p className="text-slate-600 dark:text-slate-400">
            Ketuk ikon <Share className="mx-1 inline size-3.5" aria-hidden /> Bagikan di Safari, lalu
            pilih <strong>Tambah ke Layar Utama</strong>.
          </p>
        </div>
      )}
    </div>
  );
}
