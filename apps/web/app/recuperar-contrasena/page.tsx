"use client";

import { useState, type FormEvent } from "react";
import {
  Field,
  IdentityPage,
  Notice,
  SubmitButton,
  TextLink,
} from "../identidad/components";
import { identidadApi } from "../identidad/api";
import styles from "../identidad/identidad.module.css";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Escribe una dirección de correo válida.");
      return;
    }

    setBusy(true);
    try {
      const result = await identidadApi.forgotPassword(email.trim());
      setMessage(result.message);
      setEmail("");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo enviar la solicitud. Inténtalo de nuevo.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <IdentityPage
      eyebrow="RECUPERACIÓN DE CUENTA"
      title="Vuelve a entrar."
      description="Te enviaremos instrucciones para cambiar tu contraseña si tu cuenta puede recuperarla."
    >
      <h2>Solicita un enlace</h2>
      <p className={styles.panelLead}>
        Por privacidad, recibirás el mismo mensaje tanto si encontramos una
        cuenta como si no.
      </p>
      {message && <Notice kind="success">{message}</Notice>}
      {error && <Notice kind="error">{error}</Notice>}
      {!message && (
        <form className={styles.form} onSubmit={submit} noValidate>
          <Field
            id="forgot-email"
            label="Correo electrónico"
            type="email"
            autoComplete="email"
            maxLength={254}
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <SubmitButton busy={busy}>Enviar instrucciones</SubmitButton>
        </form>
      )}
      <div className={styles.links}>
        <TextLink href="/login">Volver a iniciar sesión</TextLink>
      </div>
    </IdentityPage>
  );
}
