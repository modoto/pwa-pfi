"use server";

import { redirect } from "next/navigation";
import { loginRequest, logoutRequest } from "@/lib/api";
import { createSession, deleteSession, getSession } from "@/lib/session";

export type LoginFormState = {
  message?: string;
  fieldErrors?: { nip?: string; password?: string };
  /** Dikembalikan supaya form bisa mengisi ulang User ID setelah gagal. */
  nip?: string;
};

export async function loginAction(
  _prev: LoginFormState | undefined,
  formData: FormData
): Promise<LoginFormState> {
  const nip = String(formData.get("nip") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const fieldErrors: LoginFormState["fieldErrors"] = {};
  if (!nip) fieldErrors.nip = "User ID wajib diisi.";
  if (!password) fieldErrors.password = "Password wajib diisi.";
  // API menolak password < 8 karakter dengan 400; cegat lebih awal agar pesannya jelas.
  else if (password.length < 8) fieldErrors.password = "Password minimal 8 karakter.";

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors, nip };
  }

  const result = await loginRequest(nip, password);
  if (!result.ok) {
    return { message: result.message, nip };
  }

  await createSession(result.data);
  redirect("/");
}

export async function logoutAction() {
  const session = await getSession();

  if (session) {
    // Best-effort: sesi lokal tetap dibuang walau API logout gagal.
    await logoutRequest(session.refreshToken, session.token).catch(() => undefined);
  }

  await deleteSession();
  redirect("/login");
}
