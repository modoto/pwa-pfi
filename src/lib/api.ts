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
  /** Channel agen, mis. "HDA" / "Banca" — menentukan kategori & sumber lead. */
  channel: string;
  channelId: number;
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

  return readEnvelope<T>(parsed, response.status);
}

/**
 * Tanda sukses di envelope API tidak konsisten dan pernah berubah: login dulu
 * membalas `{status: true}`, per 2026-09-11 membalas `{success: true}` — sama
 * seperti MasterData. Keduanya diterima di satu tempat supaya perubahan
 * serupa berikutnya tidak lagi membuat respons sukses terbaca sebagai gagal.
 */
function readEnvelope<T>(parsed: unknown, httpStatus: number): ApiResult<T> {
  const envelope = parsed as (ApiEnvelope<T> & { success?: boolean }) | null;
  const berhasil = envelope?.status === true || envelope?.success === true;

  if (!envelope || !berhasil || envelope.data === undefined) {
    return {
      ok: false,
      status: httpStatus,
      message: envelope?.message || "Respons server tidak dikenali.",
    };
  }

  return { ok: true, data: envelope.data, message: envelope.message ?? "" };
}

export function loginRequest(nip: string, password: string, deviceNumber: string) {
  return apiPost<LoginData>("/api/mobile/auth/login", { nip, password, deviceNumber });
}

export function logoutRequest(refreshToken: string, token: string) {
  return apiPost<unknown>("/api/mobile/auth/logout", { refreshToken }, { token });
}

/** Satu baris dari `/api/mobile/SyncCheckSum/sync`. */
export type SyncChecksum = {
  moduleName: string;
  tableName: string;
  /** Checksum isi tabel di server saat ini. */
  checksum: string;
  /** Checksum terakhir menurut catatan server; belum dipakai aplikasi. */
  lastChecksum: string;
  needSync: boolean;
};

/**
 * Checksum isi tiap tabel di server (per 2026-09-16, 91 tabel). Dipakai untuk
 * melewati master yang isinya tidak berubah sejak penarikan terakhir.
 *
 * Respons endpoint ini punya bentuk sendiri — `{success, hasChanges, total,
 * tables}`, tanpa `data` — jadi tidak lewat `readEnvelope`.
 */
export async function syncChecksumRequest(token: string): Promise<ApiResult<SyncChecksum[]>> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE}/api/mobile/SyncCheckSum/sync`, {
      method: "GET",
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  } catch {
    return { ok: false, status: 0, message: "Tidak dapat menghubungi server API." };
  }

  const text = await response.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    return { ok: false, status: response.status, message: readErrorMessage(parsed, response.status) };
  }

  const body = parsed as { success?: boolean; message?: string; tables?: SyncChecksum[] } | null;
  if (!body?.success || !Array.isArray(body.tables)) {
    return {
      ok: false,
      status: response.status,
      message: body?.message || "Respons checksum tidak dikenali.",
    };
  }

  return { ok: true, data: body.tables, message: body.message ?? "" };
}

/**
 * GET yang membawa token agen.
 *
 * Envelope master data tidak konsisten dengan auth: `auth/login` memakai
 * `{status: true}` sedangkan `MasterData/GetAll*` memakai `{success: true}`
 * (lihat docs/catatan-api.md), jadi keduanya diterima di sini.
 */
export async function apiGet<T>(path: string, token: string): Promise<ApiResult<T>> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: "GET",
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  } catch {
    return { ok: false, status: 0, message: "Tidak dapat menghubungi server API." };
  }

  const text = await response.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    return { ok: false, status: response.status, message: readErrorMessage(parsed, response.status) };
  }

  return readEnvelope<T>(parsed, response.status);
}
