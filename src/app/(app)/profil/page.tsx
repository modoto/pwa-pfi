"use client";

import { useEffect, useState } from "react";
import { LEBAR_HALAMAN } from "@/lib/utils";
import {
  Bell,
  ChevronRight,
  Database,
  LogOut,
  Moon,
  ShieldCheck,
  Smartphone,
  WifiOff,
} from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { LeadsMaintenance } from "@/components/leads-maintenance";
import { MasterDataSync } from "@/components/master-data-sync";
import { exportDatabase } from "@/lib/db/client";
import { Badge, Card, Section } from "@/components/ui";

type PwaStatus = {
  standalone: boolean;
  serviceWorker: boolean;
  online: boolean;
  viewport: string;
};

export default function ProfilPage() {
  const [notifikasi, setNotifikasi] = useState(true);
  const [hematData, setHematData] = useState(false);
  const [status, setStatus] = useState<PwaStatus | null>(null);
  const [mengekspor, setMengekspor] = useState(false);
  const [eksporError, setEksporError] = useState("");

  async function unduhDatabase() {
    setMengekspor(true);
    setEksporError("");

    try {
      await exportDatabase();
    } catch (error) {
      setEksporError(
        error instanceof Error ? error.message : "Gagal menyalin database lokal."
      );
    } finally {
      setMengekspor(false);
    }
  }

  useEffect(() => {
    const read = () =>
      setStatus({
        standalone:
          window.matchMedia("(display-mode: standalone)").matches ||
          (window.navigator as Navigator & { standalone?: boolean }).standalone === true,
        serviceWorker: Boolean(navigator.serviceWorker?.controller),
        online: navigator.onLine,
        viewport: `${window.innerWidth} × ${window.innerHeight}px`,
      });

    read();
    window.addEventListener("resize", read);
    window.addEventListener("online", read);
    window.addEventListener("offline", read);
    return () => {
      window.removeEventListener("resize", read);
      window.removeEventListener("online", read);
      window.removeEventListener("offline", read);
    };
  }, []);

  return (
    <div className={LEBAR_HALAMAN}>
      {/* Profil: menumpuk di HP, sejajar mulai sm */}
      <Card className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
        <span className="grid size-20 shrink-0 place-items-center rounded-full bg-linear-to-br from-brand-500 to-sky-500 text-2xl font-black text-white">
          MD
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold">Modotz Developer</p>
          <p className="truncate text-sm text-slate-500 dark:text-slate-400">
            modotodeveloper@gmail.com
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-2 sm:justify-start">
            <Badge tone="brand">Admin</Badge>
            <Badge tone="green">Terverifikasi</Badge>
          </div>
        </div>
        <button
          type="button"
          className="h-11 rounded-full border border-slate-200 px-5 text-sm font-semibold transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          Edit profil
        </button>
      </Card>

      <Section title="Status PWA">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {[
            {
              label: "Mode tampilan",
              value: status?.standalone ? "Standalone" : "Browser",
              icon: Smartphone,
            },
            {
              label: "Service worker",
              value: status?.serviceWorker ? "Aktif" : "Belum aktif",
              icon: ShieldCheck,
            },
            { label: "Koneksi", value: status?.online ? "Online" : "Offline", icon: WifiOff },
            { label: "Ukuran layar", value: status?.viewport ?? "—", icon: Moon },
          ].map(({ label, value, icon: Icon }) => (
            <Card key={label} className="flex flex-col gap-1">
              <span className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <Icon className="size-3.5" aria-hidden />
                {label}
              </span>
              <span className="text-sm font-bold tabular-nums">{value}</span>
            </Card>
          ))}
        </div>
      </Section>

      <Section title="Preferensi">
        <Card className="divide-y divide-slate-100 p-0 dark:divide-slate-800">
          <Toggle
            icon={Bell}
            label="Notifikasi push"
            description="Terima pemberitahuan pesanan baru"
            checked={notifikasi}
            onChange={setNotifikasi}
          />
          <Toggle
            icon={WifiOff}
            label="Hemat data"
            description="Muat gambar beresolusi rendah"
            checked={hematData}
            onChange={setHematData}
          />
          <button
            type="button"
            className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
              <ShieldCheck className="size-4" aria-hidden />
            </span>
            <span className="flex-1 text-sm font-medium">Keamanan & privasi</span>
            <ChevronRight className="size-4 text-slate-400" aria-hidden />
          </button>
        </Card>
      </Section>

      <Section title="Master Data">
        <Card>
          <MasterDataSync />
        </Card>
      </Section>

      <Section title="Data Lead">
        <Card>
          <LeadsMaintenance />
        </Card>
      </Section>

      <Section title="Database lokal">
        <Card className="flex flex-col gap-3">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Data aplikasi tersimpan di dalam browser (OPFS), bukan sebagai berkas di perangkat.
            Unduh salinannya bila ingin memeriksa isinya dengan DBeaver atau DB Browser for
            SQLite.
          </p>

          <button
            type="button"
            onClick={() => void unduhDatabase()}
            disabled={mengekspor}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 sm:w-auto sm:px-6 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <Database className="size-4" aria-hidden />
            {mengekspor ? "Menyiapkan …" : "Unduh salinan database"}
          </button>

          {eksporError && (
            <p className="text-sm font-medium text-rose-600 dark:text-rose-400">{eksporError}</p>
          )}
        </Card>
      </Section>

      <form action={logoutAction}>
        <button
          type="submit"
          className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 text-sm font-semibold text-rose-600 transition hover:bg-rose-100 sm:w-auto sm:px-8 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400"
        >
          <LogOut className="size-4" aria-hidden />
          Keluar
        </button>
      </form>
    </div>
  );
}

function Toggle({
  icon: Icon,
  label,
  description,
  checked,
  onChange,
}: {
  icon: React.ElementType;
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 p-4">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
          {description}
        </span>
      </span>
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="relative h-6 w-11 shrink-0 rounded-full bg-slate-300 transition peer-checked:bg-brand-600 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-300 after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5 dark:bg-slate-700" />
    </label>
  );
}
