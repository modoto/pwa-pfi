import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session-cookie";

/**
 * Pengecekan optimistik: hanya melihat ada/tidaknya cookie sesi supaya redirect
 * terjadi sebelum halaman dirender. Validasi sesungguhnya (termasuk masa
 * berlaku token) tetap dilakukan di `src/app/(app)/layout.tsx`.
 */
const PUBLIC_ROUTES = ["/login"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_ROUTES.includes(pathname);
  const hasSession = request.cookies.has(SESSION_COOKIE);

  if (!isPublic && !hasSession) {
    const url = new URL("/login", request.nextUrl);
    return NextResponse.redirect(url);
  }

  if (isPublic && hasSession) {
    return NextResponse.redirect(new URL("/", request.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  // Lewati API, internal Next, dan semua berkas statis (apa pun yang punya
  // ekstensi: gambar, sw.js, manifest.webmanifest, offline.html, favicon).
  // Tanpa ini, optimizer gambar Next mengambil aset tanpa cookie dan menerima
  // redirect ke /login, bukan berkas gambarnya.
  matcher: ["/((?!api|_next|.*\\.[^/]+$).*)"],
};
