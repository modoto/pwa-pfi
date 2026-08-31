/**
 * Nama cookie sesi dipisah dari `session.ts` supaya bisa dipakai `proxy.ts`,
 * yang berjalan di runtime edge dan tidak boleh mengimpor modul `server-only`.
 */
export const SESSION_COOKIE = "pfi_session";
