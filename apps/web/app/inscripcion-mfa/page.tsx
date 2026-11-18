"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Field,
  formatRemaining,
  IdentityPage,
  Notice,
  RecoveryCodes,
  SubmitButton,
  useCountdown,
} from "../identidad/components";
import { identidadApi } from "../identidad/api";
import { useIdentitySession } from "../identidad/session-provider";
import styles from "../identidad/identidad.module.css";

export default function MfaEnrollmentPage() {
  const router = useRouter();
  const { enrollment, clearEnrollment } = useIdentitySession();
  const [provisioningUri, setProvisioningUri] = useState("");
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [completionPending, setCompletionPending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [validationError, setValidationError] = useState("");
  const remaining = useCountdown(enrollment?.expiresAt ?? null);
  const expired = remaining === 0;

  useEffect(() => {
    if (!enrollment && !completionPending) router.replace("/login");
  }, [completionPending, enrollment, router]);

  async function prepareEnrollment() {
    if (!enrollment || expired) return;
    setBusy(true);
    setError("");
    try {
      const result = await identidadApi.setupRequiredMfa(enrollment.token);
      setProvisioningUri(result.qrCodeUrl);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo preparar la inscripción MFA.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setValidationError("");
    if (!/^\d{6}$/.test(code.trim())) {
      setValidationError("Escribe el código de seis dígitos de tu aplicación.");
      return;
    }
    if (!enrollment || expired) {
      setError("El desafío venció. Vuelve a iniciar sesión para comenzar otra vez.");
      return;
    }

    setBusy(true);
    try {
      const result = await identidadApi.verifyRequiredMfa({
        enrollmentToken: enrollment.token,
        code: code.trim(),
      });
      setRecoveryCodes(result.recoveryCodes);
      setCompletionPending(true);
      setCode("");
      clearEnrollment();
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

  function finishEnrollment() {
    setRecoveryCodes(null);
    setCompletionPending(false);
    clearEnrollment();
    router.replace("/login");
  }

  return (
    <IdentityPage
      eyebrow="PROTECCIÓN OBLIGATORIA"
      title="Añade un segundo factor."
      description="Antes de acceder, registra una aplicación autenticadora y confirma el primer código."
    >
      {recoveryCodes ? (
        <>
          <Notice kind="success">
            MFA quedó activado. Inicia sesión de nuevo después de guardar estos
            códigos.
          </Notice>
          <RecoveryCodes codes={recoveryCodes} onContinue={finishEnrollment} />
        </>
      ) : (
        <>
          <h2>Configura tu aplicación</h2>
          <p className={styles.panelLead}>
            Abre una aplicación autenticadora y añade la cuenta con esta URI
            TOTP. El secreto permanece en el servidor; esta dirección solo se
            muestra durante la configuración.
          </p>
          {remaining !== null && (
            <Notice kind={expired ? "error" : "info"}>
              {expired
                ? "El desafío venció. Vuelve a iniciar sesión para obtener uno nuevo."
                : `La inscripción vence en ${formatRemaining(remaining)}.`}
            </Notice>
          )}
          {provisioningUri && (
            <div className={styles.form}>
              <span className={styles.field}>
                <span className={styles.fieldLabel}>URI de aprovisionamiento</span>
                <code className={styles.provisioning}>{provisioningUri}</code>
              </span>
              <p className={styles.hint}>
                Si tu aplicación permite importar una cuenta desde una clave de
                configuración, pega la URI completa.
              </p>
            </div>
          )}
          {error && <Notice kind="error">{error}</Notice>}
          {validationError && <Notice kind="error">{validationError}</Notice>}
          {!provisioningUri && !expired && (
            <button
              className={styles.submit}
              type="button"
              disabled={busy}
              onClick={prepareEnrollment}
            >
              {busy ? "Preparando…" : "Preparar aplicación autenticadora"}
            </button>
          )}
          {provisioningUri && !expired && (
            <form className={styles.form} onSubmit={submit} noValidate>
              <Field
                id="enrollment-code"
                label="Código de verificación"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                hint="Escribe el código actual de seis dígitos."
                required
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
              <SubmitButton busy={busy}>Activar MFA</SubmitButton>
            </form>
          )}
          <div className={styles.links}>
            <button
              className={styles.textLink}
              type="button"
              onClick={() => {
                clearEnrollment();
                router.replace("/login");
              }}
            >
              Volver a iniciar sesión
            </button>
          </div>
        </>
      )}
    </IdentityPage>
  );
}
