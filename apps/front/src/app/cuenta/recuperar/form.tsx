"use client";

import { useState } from "react";
import { forgotPassword } from "@/lib/auth-client";
import Spinner from "@/components/Spinner";

export default function RecoverForm() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setError(null);
    try {
      await forgotPassword(email.trim());
      setSent(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo enviar el enlace"
      );
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div
        role="status"
        className="rounded-2xl border border-green-200 bg-green-50 p-6 text-sm text-green-800 dark:border-green-800/40 dark:bg-green-950/20 dark:text-green-300"
      >
        <p className="font-semibold">Revisá tu correo.</p>
        <p className="mt-1">
          Si la cuenta existe, vas a recibir un enlace válido por 1 hora para
          crear una contraseña nueva.
        </p>
        <p className="mt-3 text-xs opacity-80">
          En modo desarrollo el enlace aparece en el log de user-service.
        </p>
        <a
          href="/cuenta/entrar"
          className="mt-4 inline-block font-semibold text-brand-gold hover:underline"
        >
          Volver a entrar
        </a>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-brand-navy/10 bg-white p-6 shadow-card dark:border-white/10 dark:bg-brand-navy-800">
      {error && (
        <p
          role="alert"
          className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800/40 dark:bg-red-950/20 dark:text-red-300"
        >
          {error}
        </p>
      )}
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="recover-email" className="input-label">
            Correo electrónico
          </label>
          <input
            id="recover-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            spellCheck={false}
            placeholder="vos@ejemplo.com"
            className="input-field"
            required
          />
        </div>
        <button
          type="submit"
          disabled={sending}
          className="btn-primary w-full justify-center"
        >
          {sending ? <Spinner label="Enviando…" /> : "Enviar enlace"}
        </button>
      </form>
    </div>
  );
}
