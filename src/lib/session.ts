import "server-only";
import { cookies } from "next/headers";
import type { LoginData } from "@/lib/api";
import { SESSION_COOKIE } from "@/lib/session-cookie";

/**
 * Sesi disimpan di cookie httpOnly, jadi token JWT tidak pernah bisa dibaca
 * JavaScript di browser. Isinya sengaja ringkas: token + identitas agen yang
 * dipakai untuk menyapa pengguna di UI.
 */
export { SESSION_COOKIE };

export type Session = {
  token: string;
  refreshToken: string;
  agentId: number;
  nip: string;
  agentCode: string;
  fullName: string;
  role: string;
  roleId: number;
  /** Detik epoch, hasil klaim `exp` di JWT. */
  expiresAt: number;
};

/** Baca klaim `exp` dari JWT tanpa memverifikasi tanda tangan — verifikasi tetap milik API. */
function readJwtExpiry(token: string): number | null {
  const payload = token.split(".")[1];
  if (!payload) return null;

  try {
    const json = Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
      "utf8"
    );
    const exp = (JSON.parse(json) as { exp?: number }).exp;
    return typeof exp === "number" ? exp : null;
  } catch {
    return null;
  }
}

export async function createSession(data: LoginData) {
  // Kalau JWT tidak membawa `exp`, pakai 8 jam sebagai batas aman.
  const expiresAt = readJwtExpiry(data.token) ?? Math.floor(Date.now() / 1000) + 8 * 60 * 60;

  const session: Session = {
    token: data.token,
    refreshToken: data.refreshToken,
    agentId: data.agentId,
    nip: data.nip,
    agentCode: data.agentCode,
    fullName: data.fullName,
    role: data.role,
    roleId: data.roleId,
    expiresAt,
  };

  // Base64url supaya nilai cookie bebas dari karakter yang tidak sah di header.
  const encoded = Buffer.from(JSON.stringify(session), "utf8").toString("base64url");

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, encoded, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expiresAt * 1000),
  });

  return session;
}

export async function getSession(): Promise<Session | null> {
  const raw = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!raw) return null;

  try {
    const session = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Session;
    if (!session.token || session.expiresAt * 1000 <= Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export async function deleteSession() {
  (await cookies()).delete(SESSION_COOKIE);
}
