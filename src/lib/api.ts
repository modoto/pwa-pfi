import "server-only";

/**
 * Klien tipis untuk API PFI.
 *
 * Semua panggilan dilakukan dari sisi server (Server Action / Route Handler)
 * karena API tidak mengirim header CORS — fetch langsung dari browser akan
 * diblokir. Efek sampingnya bagus: token tidak pernah menyentuh JavaScript
 * di browser.
 */
export const API_BASE = (process.env.PFI_API_BASE_URL ?? "https://api-pfi.modoto.net").replace(
  /\/+$/,
  ""
);

/** Bentuk respons standar API: { status, message, data }. */
export type ApiEnvelope<T> = {
  status: boolean;
  message: string;
  data?: T;
};

/** Payload sukses POST /api/mobile/auth/login. */
export type LoginData = {
  token: string;
  refreshToken: string;
  agentId: number;
  nip: string;
  agentCode: string;
  fullName: string;
  role: string;
  roleId: number;
  isExpiredLogin: boolean;
  isFirstLogin: boolean;
};

/** ProblemDetails ASP.NET saat body gagal validasi (HTTP 400). */
type ProblemDetails = {
  title?: string;
  errors?: Record<string, string[]>;
};

export type ApiResult<T> =
  | { ok: true; data: T; message: string }
  | { ok: false; status: number; message: string };

/** Ambil pesan yang layak ditampilkan ke pengguna dari body error apa pun. */
function readErrorMessage(body: unknown, httpStatus: number): string {
  if (body && typeof body === "object") {
    const envelope = body as ApiEnvelope<unknown> & ProblemDetails;
    if (typeof envelope.message === "string" && envelope.message) return envelope.message;

    // ProblemDetails: ambil pesan validasi pertama supaya tetap informatif.
    const firstError = Object.values(envelope.errors ?? {})[0]?.[0];
    if (firstError) return firstError;

    if (typeof envelope.title === "string" && envelope.title) return envelope.title;
  }
  return `Terjadi kesalahan pada server (HTTP ${httpStatus}).`;
}

export async function apiPost<T>(
  path: string,
  body: unknown,
  options?: { token?: string; signal?: AbortSignal }
): Promise<ApiResult<T>> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(options?.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: options?.signal,
    });
  } catch {
    return { ok: false, status: 0, message: "Tidak dapat terhubung ke server. Cek koneksi Anda." };
  }

  const raw = await response.text();
  let parsed: unknown = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    // Biarkan null — ditangani sebagai error non-JSON di bawah.
  }

  if (!response.ok) {
    return { ok: false, status: response.status, message: readErrorMessage(parsed, response.status) };
  }

  const envelope = parsed as ApiEnvelope<T> | null;
  if (!envelope || envelope.status !== true || envelope.data === undefined) {
    return {
      ok: false,
      status: response.status,
      message: envelope?.message || "Respons server tidak dikenali.",
    };
  }

  return { ok: true, data: envelope.data, message: envelope.message };
}

export function loginRequest(nip: string, password: string) {
  return apiPost<LoginData>("/api/mobile/auth/login", { nip, password });
}

export function logoutRequest(refreshToken: string, token: string) {
  return apiPost<unknown>("/api/mobile/auth/logout", { refreshToken }, { token });
}
