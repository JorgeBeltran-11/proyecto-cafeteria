"use client";

import Link from "next/link";
import {
  useEffect,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import styles from "./identidad.module.css";

export function IdentityPage({
  eyebrow,
  title,
  description,
  children,
  wide = false,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/" aria-label="Cafetería, inicio">
          <span aria-hidden="true">☕</span>
          <span>
            CAFÉ<span>TERÍA</span>
          </span>
        </Link>
        <Link className={styles.homeLink} href="/">
          Volver a la cafetería
        </Link>
      </header>
      <div className={`${styles.layout} ${wide ? styles.wide : ""}`}>
        <section className={styles.intro}>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h1>{title}</h1>
          <p className={styles.description}>{description}</p>
          <p className={styles.promise}>
            Tu cuenta y tus datos se mantienen protegidos.
          </p>
        </section>
        <section className={styles.panel}>{children}</section>
      </div>
    </main>
  );
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
};

export function Field({
  id,
  label,
  error,
  hint,
  ...inputProps
}: FieldProps) {
  const hintId = hint && id ? `${id}-hint` : undefined;
  const errorId = error && id ? `${id}-error` : undefined;
  const describedBy = [inputProps["aria-describedby"], hintId, errorId]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <input
        {...inputProps}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={styles.input}
      />
      {hint && (
        <span className={styles.hint} id={hintId}>
          {hint}
        </span>
      )}
      {error && (
        <span className={styles.fieldError} id={errorId}>
          {error}
        </span>
      )}
    </div>
  );
}

export function Notice({
  kind,
  children,
}: {
  kind: "success" | "error" | "info";
  children: ReactNode;
}) {
  return (
    <div
      className={`${styles.notice} ${styles[kind]}`}
      role={kind === "error" ? "alert" : "status"}
    >
      {children}
    </div>
  );
}

export function SubmitButton({
  busy,
  children,
}: {
  busy: boolean;
  children: ReactNode;
}) {
  return (
    <button className={styles.submit} type="submit" disabled={busy}>
      {busy ? "Procesando…" : children}
    </button>
  );
}

export function TextLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link className={styles.textLink} href={href}>
      {children}
    </Link>
  );
}

export function RecoveryCodes({
  codes,
  onContinue,
}: {
  codes: readonly string[];
  onContinue: () => void;
}) {
  const [saved, setSaved] = useState(false);

  return (
    <section className={styles.recovery} aria-labelledby="recovery-title">
      <h2 id="recovery-title">Guarda tus códigos de recuperación</h2>
      <p>
        Se muestran una sola vez. Guárdalos en un lugar seguro; cada código se
        puede usar una sola vez.
      </p>
      <ol className={styles.codeList}>
        {codes.map((code) => (
          <li key={code}>
            <code>{code}</code>
          </li>
        ))}
      </ol>
      <label className={styles.savedCheck}>
        <input
          type="checkbox"
          checked={saved}
          onChange={(event) => setSaved(event.target.checked)}
        />
        <span>Ya guardé los códigos en un lugar seguro.</span>
      </label>
      <button
        className={styles.submit}
        type="button"
        disabled={!saved}
        onClick={onContinue}
      >
        Continuar
      </button>
    </section>
  );
}

export function useCountdown(expiresAt: number | null): number | null {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (expiresAt === null) return;
    const initial = window.setTimeout(() => setNow(Date.now()), 0);
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [expiresAt]);

  return expiresAt === null || now === null
    ? null
    : Math.max(0, Math.ceil((expiresAt - now) / 1000));
}

export function formatRemaining(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}
