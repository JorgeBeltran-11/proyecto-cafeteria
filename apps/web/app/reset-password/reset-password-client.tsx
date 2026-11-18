"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  Field,
  IdentityPage,
  Notice,
  SubmitButton,
  TextLink,
} from "../identidad/components";
import { identidadApi } from "../identidad/api";
import styles from "../identidad/identidad.module.css";

export default function ResetPasswordClient({
  token,
}: {
  token: string | null;
}) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [resetToken, setResetToken] = useState(token);

  useEffect(() => {
    if (token) window.history.replaceState(null, "", window.location.pathname);
  }, [token]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password.length < 12 || password.length > 128) {
      setError("La contraseña debe tener entre 12 y 128 caracteres.");
      return;
    }
    if (password !== confirmation) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (!resetToken) {
      setError("El enlace de restablecimiento no es válido o ya venció.");
      return;
    }

    setBusy(true);
    try {
      const result = await identidadApi.resetPassword({
        token: resetToken,
        password,
      });
      setMessage(result.message);
      setResetToken(null);
      setPassword("");
      setConfirmation("");
    } catch (requestError) {
      if (
        requestError instanceof Error &&
        "status" in requestError &&
        (requestError.status === 400 || requestError.status === 404)
      ) {
        setResetToken(null);
        setError(requestError.message);
      } else {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "No se pudo restablecer la contraseña.",
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <IdentityPage
      eyebrow="SEGURIDAD DE LA CUENTA"
      title="Elige una contraseña nueva."
      description="Usa una contraseña que no hayas utilizado en otro servicio."
    >
      <h2>Restablece tu contraseña</h2>
      <p className={styles.panelLead}>
        Usa entre 12 y 128 caracteres. La contraseña de confirmación no se
        envía al servidor.
      </p>
      {message && (
        <>
          <Notice kind="success">{message}</Notice>
          <TextLink href="/login">Iniciar sesión</TextLink>
        </>
      )}
      {!message && !resetToken && (
        <Notice kind="error">
          El enlace de restablecimiento no es válido o ya venció. Solicita uno
          nuevo para continuar.
        </Notice>
      )}
      {!message && resetToken && (
        <>
          {error && <Notice kind="error">{error}</Notice>}
          <form className={styles.form} onSubmit={submit} noValidate>
            <Field
              id="reset-password"
              label="Nueva contraseña"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              hint="Debe tener entre 12 y 128 caracteres."
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <Field
              id="reset-password-confirm"
              label="Confirma la nueva contraseña"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />
            <SubmitButton busy={busy}>Guardar contraseña nueva</SubmitButton>
          </form>
        </>
      )}
      <div className={styles.links}>
        <TextLink href="/login">Volver a iniciar sesión</TextLink>
      </div>
    </IdentityPage>
  );
}
