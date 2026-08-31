"use client";

/* eslint-disable @next/next/no-img-element -- SVG statis hasil ekspor Figma. */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActivePath, navItems } from "@/lib/nav";
import { cn } from "@/lib/utils";

/**
 * Tab bar utama (desain Figma "Bottom Bar"). Tampil di semua ukuran layar —
 * desainnya memang memakai tab bar juga di tablet lanskap.
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navigasi utama"
      className="pb-safe fixed inset-x-0 bottom-0 z-40 rounded-t-2xl border-t border-pfi-line bg-white drop-shadow-[0px_-4px_2px_rgba(147,147,147,0.05)]"
    >
      <ul className="flex items-center justify-between gap-1 px-2 py-4 sm:px-5">
        {navItems.map((item) => {
          const active = isActivePath(pathname, item.href);
          return (
            <li key={item.href} className="min-w-0 flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className="flex flex-col items-center justify-center gap-2.5 rounded-[10px] px-1 py-1 transition hover:bg-pfi-hairline"
              >
                <img
                  src={active ? (item.iconActive ?? item.icon) : item.icon}
                  alt=""
                  aria-hidden
                  className={cn("size-[22px] max-w-none object-contain", !active && "opacity-90")}
                />
                <span
                  className={cn(
                    // Di HP label dibiarkan turun baris — "Informasi Polis" tidak
                    // muat satu baris pada lebar 1/6 layar.
                    "text-center text-[10px]/[13px] font-medium text-balance sm:text-[12px]/[14px]",
                    active ? "text-pfi-link" : "text-pfi-subtle"
                  )}
                >
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
