/* eslint-disable @next/next/no-img-element -- Aset di bawah adalah SVG statis dekoratif;
   next/image tidak mengoptimalkan SVG, jadi <img> justru lebih ringan di sini. */
import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Login",
  description: "Masuk ke Distribution System PFI Mega Life.",
};

const HIGHLIGHTS = [
  "Buat E-App & SPAJ langsung dari perangkat",
  "Pantau performa & komisi real-time",
  "Kelola aktivitas & jadwal kunjungan",
];

const APP_VERSION = "V1.2";
const LAST_UPDATE = "12/03/2026";

function Logo({ className }: { className?: string }) {
  return (
    <div className={className}>
      <Image
        src="/login/logo-pfi.png"
        alt="PFI Mega Life"
        width={108}
        height={76}
        priority
        className="h-[76px] w-[108px] object-contain"
      />
    </div>
  );
}

export default async function LoginPage() {
  // Sudah punya sesi? Tidak perlu login lagi.
  if (await getSession()) redirect("/");

  return (
    <div className="flex min-h-dvh flex-col font-jakarta lg:grid lg:grid-cols-2">
      {/* ---------- Panel kiri (tablet lanskap ke atas) ---------- */}
      <aside className="relative hidden overflow-hidden lg:block">
        {/* Gradien latar diekspor dari Figma; SVG-nya memang dirancang untuk direntangkan. */}
        <div
          aria-hidden
          className="absolute inset-0 bg-[url('/login/bg-panel.svg')] bg-[length:100%_100%] bg-no-repeat"
        />

        {/* Ornamen dekoratif — posisi relatif terhadap panel, mengikuti Figma. */}
        <div aria-hidden className="absolute inset-0 overflow-hidden">
          <img
            src="/login/deco-1.svg"
            alt=""
            className="absolute left-[-7.61%] top-[-6.32%] h-[302px] w-[302px] max-w-none object-contain"
          />
          <img
            src="/login/deco-2.svg"
            alt=""
            className="absolute left-[60.03%] top-[62.06%] h-[382px] w-[382px] max-w-none object-contain"
          />
          <img
            src="/login/deco-square.svg"
            alt=""
            className="absolute left-[67.35%] top-[51.52%] h-[152px] w-[152px] max-w-none object-contain"
          />
          <img
            src="/login/deco-dot.svg"
            alt=""
            className="absolute left-[80.97%] top-[16.74%] h-[14px] w-[14px] max-w-none object-contain"
          />
        </div>

        <Logo className="absolute left-[50px] top-[50px] rounded-[10px] bg-white/90 p-[10px]" />

        <div className="absolute left-[50px] top-1/2 flex w-[408px] -translate-y-1/2 flex-col gap-8">
          <div className="flex flex-col gap-3.5">
            <p className="text-[40px] font-bold leading-normal text-white">Distribution System</p>
            <div className="flex flex-col gap-1 text-xl leading-normal text-white/94">
              <p>Satu portal untuk kelola lead, agen, ilustrasi,</p>
              <p>dan produksi Anda.</p>
            </div>
          </div>

          <ul className="flex flex-col gap-3">
            {HIGHLIGHTS.map((item) => (
              <li key={item} className="flex items-center gap-3.5">
                <img
                  src="/login/check.svg"
                  alt=""
                  aria-hidden
                  className="size-[30px] max-w-none object-contain shrink-0"
                />
                <span className="text-base font-bold leading-normal text-white">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="absolute bottom-[50px] left-[50px] flex items-center gap-5 text-base text-white">
          <span>Versi App {APP_VERSION}</span>
          <img src="/login/dot.svg" alt="" aria-hidden className="size-[6px] max-w-none object-contain shrink-0" />
          <span>Update terakhir {LAST_UPDATE}</span>
        </p>
      </aside>

      {/* ---------- Header ringkas untuk HP & tablet potret ---------- */}
      <div className="relative overflow-hidden bg-[url('/login/bg-panel.svg')] bg-[length:100%_100%] bg-no-repeat px-5 pb-8 pt-safe lg:hidden">
        <div className="flex flex-col gap-5 pt-8">
          <Logo className="w-fit rounded-[10px] bg-white/90 p-[10px]" />
          <div className="flex flex-col gap-2">
            <p className="text-[28px] font-bold leading-tight text-white xs:text-[32px]">
              Distribution System
            </p>
            <p className="text-base leading-normal text-white/94">
              Satu portal untuk kelola lead, agen, ilustrasi, dan produksi Anda.
            </p>
          </div>
        </div>
      </div>

      {/* ---------- Panel kanan: form ---------- */}
      <main className="flex flex-1 items-start justify-center px-5 py-10 pb-safe sm:px-8 lg:items-center">
        <div className="w-full max-w-[460px]">
          <LoginForm />

          <p className="mt-10 flex items-center gap-3 text-xs text-pfi-muted lg:hidden">
            <span>Versi App {APP_VERSION}</span>
            <span aria-hidden className="size-[6px] rounded-full bg-pfi-muted/40" />
            <span>Update terakhir {LAST_UPDATE}</span>
          </p>
        </div>
      </main>
    </div>
  );
}
