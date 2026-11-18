"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Field,
  formatRemaining,
  IdentityPage,
  Notice,
  SubmitButton,
  TextLink,
  useCountdown,
} from "../identidad/components";
import { identidadApi, isMfaFactorCode, type LoginResult } from "../identidad/api";
import { useIdentitySession } from "../identidad/session-provider";
import styles from "../identidad/identidad.module.css";

interface MfaChallenge {
  token: string;
  expiresAt: number;
}

function isValidLogin(email: string, password: string): boolean {
  return (
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
    password.length > 0 &&
    password.length <= 128
  );
}

function LoginForm({
  onLogin,
  busy,
  error,
}: {
  onLogin: (email: string, password: string) => Promise<void>;
  busy: boolean;
  error: string;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [validationError, setValidationError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationError("");
    if (!isValidLogin(email.trim(), password)) {
      setValidationError("Escribe un correo válido y tu contraseña.");
      return;
    }
    await onLogin(email.trim(), password);
  }

  return (
    <>
      <h2>Inicia sesión</h2>
      <p className={styles.panelLead}>
        Accede a tu cuenta con el correo y la contraseña que registraste.
      </p>
      {error && <Notice kind="error">{error}</Notice>}
      {validationError && <Notice kind="error">{validationError}</Notice>}
      <form className={styles.form} onSubmit={submit} noValidate>
        <Field
          id="login-email"
          label="Correo electrónico"
          type="email"
          autoComplete="email"
          maxLength={254}
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <Field
          id="login-password"
          label="Contraseña"
          type="password"
          autoComplete="current-password"
          maxLength={128}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <SubmitButton busy={busy}>Iniciar sesión</SubmitButton>
      </form>
      <div className={styles.links}>
        <TextLink href="/recuperar-contrasena">Olvidé mi contraseña</TextLink>
        <TextLink href="/#registro">Crear una cuenta</TextLink>
      </div>
    </>
  );
}

function MfaForm({
  challenge,
  onVerify,
  onCancel,
  busy,
  error,
}: {
  challenge: MfaChallenge;
  onVerify: (code: string) => Promise<void>;
  onCancel: () => void;
  busy: boolean;
  error: string;
}) {
  const [code, setCode] = useState("");
  const [validationError, setValidationError] = useState("");
  const remaining = useCountdown(challenge.expiresAt);
  const expired = remaining === 0;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationError("");
    const cleanCode = code.trim();
    if (!isMfaFactorCode(cleanCode)) {
      setValidationError(
        "Escribe un código de seis dígitos o uno de recuperación completo.",
      );
      return;
    }
    await onVerify(cleanCode);
  }

  return (
    <>
      <h2>Verifica tu identidad</h2>
      <p className={styles.panelLead}>
        Escribe el código de tu aplicación autenticadora o uno de tus códigos
        de recuperación.
      </p>
      {remaining !== null && (
        <Notice kind={expired ? "error" : "info"}>
          {expired
            ? "El desafío venció. Vuelve a iniciar sesión para obtener uno nuevo."
            : `El desafío vence en ${formatRemaining(remaining)}.`}
        </Notice>
      )}
      {error && <Notice kind="error">{error}</Notice>}
      {validationError && <Notice kind="error">{validationError}</Notice>}
      <form className={styles.form} onSubmit={submit} noValidate>
        <Field
          id="mfa-login-code"
          label="Código de verificación"
          type="text"
          inputMode="text"
          autoComplete="one-time-code"
          maxLength={35}
          hint="Código TOTP de seis dígitos o código de recuperación."
          required
          value={code}
          onChange={(event) => setCode(event.target.value)}
        />
        <SubmitButton busy={busy || expired}>Verificar código</SubmitButton>
      </form>
      <div className={styles.links}>
        <button className={styles.textLink} type="button" onClick={onCancel}>
          Volver al inicio de sesión
        </button>
      </div>
    </>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const {
    establishSession,
    startEnrollment,
    clearEnrollment,
  } = useIdentitySession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [challenge, setChallenge] = useState<MfaChallenge | null>(null);

  async function continueLogin(result: LoginResult) {
    if (result.kind === "tokens") {
      establishSession(result.tokens, false);
      router.replace("/");
      return;
    }

    if (result.kind === "mfa") {
      setChallenge({
        token: result.challengeToken,
        expiresAt: Date.now() + result.expiresIn * 1000,
      });
      setError("");
      return;
    }

    startEnrollment(result.enrollmentToken, result.expiresIn);
    router.push("/inscripcion-mfa");
  }

  async function login(email: string, password: string) {
    setBusy(true);
    setError("");
    try {
      const result = await identidadApi.login({ email, password });
      await continueLogin(result);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo iniciar sesión. Inténtalo de nuevo.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function verifyMfa(code: string) {
    if (!challenge) return;
    setBusy(true);
    setError("");
    try {
      const tokens = await identidadApi.loginMfa({
        challengeToken: challenge.token,
        code,
      });
      establishSession(tokens, true);
      setChallenge(null);
      router.replace("/");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo verificar el código. Inténtalo de nuevo.",
      );
    } finally {
      setBusy(false);
    }
  }

  function cancelChallenge() {
    setChallenge(null);
    setError("");
    clearEnrollment();
  }

  return (
    <IdentityPage
      eyebrow="CUENTA DE CLIENTE"
      title="Qué bueno tenerte de vuelta."
      description="Inicia sesión para continuar con tu cuenta de la cafetería."
    >
      {challenge ? (
        <MfaForm
          challenge={challenge}
          onVerify={verifyMfa}
          onCancel={cancelChallenge}
          busy={busy}
          error={error}
        />
      ) : (
        <LoginForm onLogin={login} busy={busy} error={error} />
      )}
    </IdentityPage>
  );
}
