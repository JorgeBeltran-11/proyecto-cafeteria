"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Field,
  IdentityPage,
  Notice,
  RecoveryCodes,
  SubmitButton,
} from "../../identidad/components";
import {
  identidadApi,
  isMfaFactorCode,
  type MfaSetup,
} from "../../identidad/api";
import { useIdentitySession } from "../../identidad/session-provider";
import styles from "../../identidad/identidad.module.css";

export default function SecurityPage() {
  const router = useRouter();
  const { session, markMfaEnabled, clearSession, logout } =
    useIdentitySession();
  const [setup, setSetup] = useState<MfaSetup | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [validationError, setValidationError] = useState("");
  const [notice, setNotice] = useState("");
  const [disabled, setDisabled] = useState(false);

  useEffect(() => {
    if (!session && !disabled) router.replace("/login");
  }, [disabled, router, session]);

  async function startSetup() {
    if (!session) return;
    setBusy(true);
    setError("");
    setValidationError("");
    try {
      const result = await identidadApi.setupMfa(session.accessToken);
      setSetup(result);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo preparar la configuración MFA.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function verifySetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setValidationError("");
    if (!/^\d{6}$/.test(verifyCode.trim())) {
      setValidationError("Escribe el código de seis dígitos de tu aplicación.");
      return;
    }
    if (!session) return;

    setBusy(true);
    try {
      const result = await identidadApi.verifyMfa(
        session.accessToken,
        verifyCode.trim(),
      );
      markMfaEnabled();
      setRecoveryCodes(result.recoveryCodes);
      setSetup(null);
      setVerifyCode("");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo activar MFA.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function regenerateCodes(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setValidationError("");
    if (!isMfaFactorCode(recoveryCode)) {
      setValidationError(
        "Escribe un código TOTP de seis dígitos o uno de recuperación completo.",
      );
      return;
    }
    if (!session) return;

    setBusy(true);
    try {
      const result = await identidadApi.regenerateRecoveryCodes(
        session.accessToken,
        recoveryCode.trim(),
      );
      setRecoveryCodes(result.recoveryCodes);
      setRecoveryCode("");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudieron regenerar los códigos.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function disableMfa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setValidationError("");
    if (!disablePassword || disablePassword.length > 128) {
      setValidationError("Escribe tu contraseña actual.");
      return;
    }
    if (!isMfaFactorCode(disableCode)) {
      setValidationError(
        "Escribe un código TOTP de seis dígitos o uno de recuperación completo.",
      );
      return;
    }
    if (!session) return;

    setBusy(true);
    try {
      const result = await identidadApi.disableMfa(session.accessToken, {
        password: disablePassword,
        code: disableCode.trim(),
      });
      setNotice(result.message);
      setDisabled(true);
      setDisablePassword("");
      setDisableCode("");
      clearSession();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo desactivar MFA.",
      );
    } finally {
      setBusy(false);
    }
  }

  function finishRecoveryCodes() {
    setRecoveryCodes(null);
    setNotice(
      "Los códigos se mostraron una sola vez. Guárdalos fuera de la aplicación.",
    );
  }

  return (
    <IdentityPage
      eyebrow="SEGURIDAD DE LA CUENTA"
      title="Protege tu cuenta."
      description="Configura la verificación en dos pasos y administra tus códigos de recuperación."
      wide
    >
      {disabled ? (
        <>
          <h2>MFA desactivado</h2>
          <Notice kind="success">{notice}</Notice>
          <p className={styles.panelLead}>
            El servidor revocó tus sesiones. Inicia sesión para continuar.
          </p>
          <Link className={styles.textLink} href="/login">
            Ir a iniciar sesión
          </Link>
        </>
      ) : !session ? (
        <>
          <h2>Inicia sesión para continuar</h2>
          <p className={styles.panelLead}>
            La sección de seguridad solo está disponible con una sesión activa.
          </p>
          <Link className={styles.textLink} href="/login">
            Ir a iniciar sesión
          </Link>
        </>
      ) : recoveryCodes ? (
        <RecoveryCodes
          codes={recoveryCodes}
          onContinue={finishRecoveryCodes}
        />
      ) : (
        <>
          <h2>Verificación en dos pasos</h2>
          <p className={styles.panelLead}>
            El estado se determina durante el inicio de sesión: el backend solo
            entrega una sesión directa si MFA no estaba activo.
          </p>
          <Notice kind={session.mfaEnabled ? "success" : "info"}>
            MFA está {session.mfaEnabled ? "activo" : "desactivado"} para esta
            sesión.
          </Notice>
          {error && <Notice kind="error">{error}</Notice>}
          {validationError && <Notice kind="error">{validationError}</Notice>}
          {notice && <Notice kind="success">{notice}</Notice>}

          {!session.mfaEnabled && !setup && (
            <div className={styles.form}>
              <p className={styles.panelLead}>
                Añade una aplicación autenticadora y confirma un código para
                activar MFA.
              </p>
              <button
                className={styles.submit}
                type="button"
                disabled={busy}
                onClick={startSetup}
              >
                {busy ? "Preparando…" : "Iniciar configuración de MFA"}
              </button>
            </div>
          )}

          {setup && (
            <div className={styles.form}>
              <p className={styles.panelLead}>
                Importa esta URI en una aplicación autenticadora. El servidor
                mantiene el secreto cifrado.
              </p>
              <code className={styles.provisioning}>{setup.qrCodeUrl}</code>
              <form className={styles.form} onSubmit={verifySetup} noValidate>
                <Field
                  id="security-setup-code"
                  label="Código de verificación"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  required
                  value={verifyCode}
                  onChange={(event) => setVerifyCode(event.target.value)}
                />
                <SubmitButton busy={busy}>Verificar y activar MFA</SubmitButton>
              </form>
            </div>
          )}

          {session.mfaEnabled && (
            <div className={styles.securityForms}>
              <section>
                <h2>Regenera tus códigos</h2>
                <p className={styles.panelLead}>
                  Los códigos anteriores dejarán de funcionar.
                </p>
                <form
                  className={styles.form}
                  onSubmit={regenerateCodes}
                  noValidate
                >
                  <Field
                    id="recovery-factor"
                    label="Código TOTP o de recuperación"
                    type="text"
                    inputMode="text"
                    autoComplete="one-time-code"
                    maxLength={35}
                    required
                    value={recoveryCode}
                    onChange={(event) => setRecoveryCode(event.target.value)}
                  />
                  <SubmitButton busy={busy}>Regenerar códigos</SubmitButton>
                </form>
              </section>
              <section>
                <h2>Desactiva MFA</h2>
                <p className={styles.panelLead}>
                  Necesitarás tu contraseña y un segundo factor. La acción
                  cerrará tus sesiones activas.
                </p>
                <form className={styles.form} onSubmit={disableMfa} noValidate>
                  <Field
                    id="disable-password"
                    label="Contraseña actual"
                    type="password"
                    autoComplete="current-password"
                    maxLength={128}
                    required
                    value={disablePassword}
                    onChange={(event) => setDisablePassword(event.target.value)}
                  />
                  <Field
                    id="disable-factor"
                    label="Código TOTP o de recuperación"
                    type="text"
                    inputMode="text"
                    autoComplete="one-time-code"
                    maxLength={35}
                    required
                    value={disableCode}
                    onChange={(event) => setDisableCode(event.target.value)}
                  />
                  <SubmitButton busy={busy}>Desactivar MFA</SubmitButton>
                </form>
              </section>
            </div>
          )}

          <div className={styles.links}>
            <button
              className={styles.textLink}
              type="button"
              onClick={async () => {
                try {
                  await logout();
                  router.replace("/login");
                } catch {
                  router.replace("/login");
                }
              }}
            >
              Cerrar sesión
            </button>
          </div>
        </>
      )}
    </IdentityPage>
  );
}
