export type NavItem = {
  href: string;
  label: string;
  /** Ikon hasil ekspor Figma; varian `fill` dipakai saat tab aktif. */
  icon: string;
  iconActive?: string;
};

export const navItems: NavItem[] = [
  { href: "/", label: "Beranda", icon: "/nav/beranda.svg", iconActive: "/nav/beranda-fill.svg" },
  { href: "/leads", label: "Leads", icon: "/nav/leads.svg", iconActive: "/nav/leads-fill.svg" },
  { href: "/informasi-polis", label: "Informasi Polis", icon: "/nav/polis.svg" },
  { href: "/kalender", label: "Kalender", icon: "/nav/kalender.svg" },
  { href: "/laporan", label: "Laporan", icon: "/nav/laporan.svg" },
  { href: "/profil", label: "Profil", icon: "/nav/profil.svg" },
];

export function isActivePath(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
