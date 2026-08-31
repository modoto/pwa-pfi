/* eslint-disable @next/next/no-img-element -- SVG statis hasil ekspor Figma. */
import { getSession } from "@/lib/session";

const APP_VERSION = "V1.2";

/** Ambil maksimal dua huruf awal nama untuk avatar. */
function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export async function AppHeader() {
  const session = await getSession();

  const fullName = session?.fullName ?? "Agen";
  const role = session?.role ?? "-";
  const code = session?.agentCode ?? "-";

  return (
    <header className="pt-safe sticky top-0 z-30 border-b border-pfi-hairline bg-white">
      <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex min-w-0 items-center gap-3.5">
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-pfi-avatar-bg text-base/[24px] font-semibold text-pfi-avatar-fg">
            {initials(fullName)}
          </span>

          <div className="flex min-w-0 flex-col gap-1.5">
            <p className="truncate text-base font-bold text-pfi-heading">{fullName}</p>
            <div className="flex min-w-0 items-center gap-1.5 text-sm text-pfi-subtle">
              <span className="truncate font-medium">{role}</span>
              <span aria-hidden className="h-3 w-px shrink-0 bg-pfi-line" />
              <span className="shrink-0">{code}</span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-4 sm:gap-8">
          <p className="hidden text-base text-pfi-news-meta sm:block">Versi App {APP_VERSION}</p>

          <button
            type="button"
            aria-label="Notifikasi"
            className="relative rounded-full border border-pfi-news-line bg-white p-2.5 shadow-[0px_4px_4px_0px_rgba(0,0,0,0.05)] transition hover:bg-pfi-hairline"
          >
            <img src="/dashboard/bell.svg" alt="" aria-hidden className="size-6 max-w-none object-contain" />
            <span className="absolute right-2.5 top-2.5 size-2 rounded-full bg-pfi-down-fg" />
          </button>
        </div>
      </div>
    </header>
  );
}
