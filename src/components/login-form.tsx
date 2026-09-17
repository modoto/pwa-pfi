"use client";

import { useActionState, useId, useState } from "react";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { loginAction, type LoginFormState } from "@/app/actions/auth";
import { FIELD_NOMOR_PERANGKAT, nomorPerangkat } from "@/lib/device-number";
import { cn } from "@/lib/utils";

const inputClass =
  "w-full rounded-[10px] border border-pfi-line bg-white p-[14px] text-sm text-pfi-ink " +
  "placeholder:text-pfi-muted outline-none transition " +
  "focus:border-pfi-500 focus:ring-2 focus:ring-pfi-500/20 " +
  "disabled:cursor-not-allowed disabled:opacity-60";

export function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginFormState | undefined, FormData>(
    loginAction,
    undefined
  );
  const [showPassword, setShowPassword] = useState(false);

  const nipId = useId();
  const passwordId = useId();
  const errorId = useId();

  /**
   * Nomor perangkat dibaca saat form dikirim, bukan saat render: nilainya ada
   * di localStorage/cookie yang hanya bisa dibaca di browser, sedangkan halaman
   * ini dirender lebih dulu di server.
   */
  function kirim(formData: FormData) {
    formData.set(FIELD_NOMOR_PERANGKAT, nomorPerangkat());
    formAction(formData);
  }

  return (
    <form action={kirim} className="flex w-full flex-col gap-6" noValidate>
      <h1 className="text-2xl font-bold text-pfi-ink">Masuk ke akun Anda</h1>
      <p className="text-sm text-pfi-muted">Gunakan User ID dan password yang terdaftar.</p>

      {state?.message && (
        <p
          id={errorId}
          role="alert"
          className="rounded-[10px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700"
        >
          {state.message}
        </p>
      )}

      <div className="flex flex-col gap-2.5">
        <label htmlFor={nipId} className="text-sm/[18px] font-medium text-pfi-label">
          User ID
        </label>
        <input
          id={nipId}
          name="nip"
          type="text"
          inputMode="numeric"
          autoComplete="username"
          autoFocus
          defaultValue={state?.nip}
          placeholder="Masukan User ID"
          disabled={pending}
          aria-invalid={Boolean(state?.fieldErrors?.nip)}
          className={cn(inputClass, state?.fieldErrors?.nip && "border-rose-400")}
        />
        {state?.fieldErrors?.nip && (
          <p className="text-xs font-medium text-rose-600">{state.fieldErrors.nip}</p>
        )}
      </div>

      <div className="flex flex-col gap-2.5">
        <label htmlFor={passwordId} className="text-sm/[18px] font-medium text-pfi-label">
          Password
        </label>

        <div
          className={cn(
            "flex items-center gap-2 rounded-[10px] border border-pfi-line bg-white p-[14px] transition",
            "focus-within:border-pfi-500 focus-within:ring-2 focus-within:ring-pfi-500/20",
            state?.fieldErrors?.password && "border-rose-400"
          )}
        >
          <input
            id={passwordId}
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Masukan Password"
            disabled={pending}
            aria-invalid={Boolean(state?.fieldErrors?.password)}
            className="min-w-0 flex-1 bg-transparent text-sm text-pfi-ink outline-none placeholder:text-pfi-muted disabled:cursor-not-allowed disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => setShowPassword((visible) => !visible)}
            aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
            aria-pressed={showPassword}
            className="grid size-[22px] shrink-0 place-items-center rounded text-pfi-muted transition hover:text-pfi-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pfi-500"
          >
            {showPassword ? (
              <EyeOff className="size-[22px]" aria-hidden />
            ) : (
              <Eye className="size-[22px]" aria-hidden />
            )}
          </button>
        </div>

        {state?.fieldErrors?.password && (
          <p className="text-xs font-medium text-rose-600">{state.fieldErrors.password}</p>
        )}

        <a
          href="#"
          className="self-start text-sm font-bold text-pfi-orange underline decoration-solid underline-offset-2 hover:text-pfi-orange-dark"
        >
          Lupa password?
        </a>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] bg-pfi-orange text-base font-bold text-white transition hover:bg-pfi-orange-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pfi-orange disabled:cursor-not-allowed disabled:opacity-70"
      >
        {pending && <LoaderCircle className="size-5 animate-spin" aria-hidden />}
        {pending ? "Memproses…" : "Login"}
      </button>
    </form>
  );
}
