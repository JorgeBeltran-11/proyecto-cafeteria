"use client";

import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { identidadApi, type TokenPair } from "./api";
import styles from "./identidad.module.css";

export interface IdentitySession extends TokenPair {
  expiresAt: number;
  mfaEnabled: boolean;
}

export interface EnrollmentChallenge {
  token: string;
  expiresAt: number;
}

interface IdentitySessionContextValue {
  session: IdentitySession | null;
  sessionNotice: string;
  enrollment: EnrollmentChallenge | null;
  establishSession: (tokens: TokenPair, mfaEnabled: boolean) => void;
  markMfaEnabled: () => void;
  clearSession: () => void;
  logout: () => Promise<void>;
  startEnrollment: (token: string, expiresIn: number) => void;
  clearEnrollment: () => void;
}

const IdentitySessionContext =
  createContext<IdentitySessionContextValue | null>(null);

export function IdentitySessionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [session, setSession] = useState<IdentitySession | null>(null);
  const [sessionNotice, setSessionNotice] = useState("");
  const [enrollment, setEnrollment] = useState<EnrollmentChallenge | null>(
    null,
  );

  const establishSession = useCallback(
    (tokens: TokenPair, mfaEnabled: boolean) => {
      setSession({
        ...tokens,
        expiresAt: Date.now() + tokens.expiresIn * 1000,
        mfaEnabled,
      });
      setSessionNotice("");
      setEnrollment(null);
    },
    [],
  );

  const clearSession = useCallback(() => setSession(null), []);

  const markMfaEnabled = useCallback(() => {
    setSession((current) =>
      current ? { ...current, mfaEnabled: true } : current,
    );
  }, []);

  const startEnrollment = useCallback((token: string, expiresIn: number) => {
    setEnrollment({ token, expiresAt: Date.now() + expiresIn * 1000 });
  }, []);

  const clearEnrollment = useCallback(() => setEnrollment(null), []);

  const logout = useCallback(async () => {
    const current = session;
    setSessionNotice("");
    try {
      if (current) await identidadApi.logout(current.accessToken);
    } catch (error) {
      setSessionNotice(
        error instanceof Error
          ? `${error.message} La sesión local se cerró.`
          : "No se confirmó el cierre en el servidor; la sesión local se cerró.",
      );
      throw error;
    } finally {
      setSession(null);
      setEnrollment(null);
    }
  }, [session]);

  useEffect(() => {
    if (!session) return;

    const delay = Math.max(
      1000,
      session.expiresAt - Date.now() - 30_000,
    );
    const timer = window.setTimeout(() => {
      void identidadApi
        .refresh(session.refreshToken)
        .then((tokens) => {
          setSession((current) =>
            current?.refreshToken === session.refreshToken
              ? {
                  ...tokens,
                  expiresAt: Date.now() + tokens.expiresIn * 1000,
                  mfaEnabled: session.mfaEnabled,
                }
              : current,
          );
        })
        .catch(() => {
          setSession((current) =>
            current?.refreshToken === session.refreshToken ? null : current,
          );
          setSessionNotice(
            "La sesión terminó porque no se pudo renovar. Inicia sesión de nuevo.",
          );
        });
    }, delay);

    return () => window.clearTimeout(timer);
  }, [session]);

  const value = useMemo(
    () => ({
      session,
      sessionNotice,
      enrollment,
      establishSession,
      markMfaEnabled,
      clearSession,
      logout,
      startEnrollment,
      clearEnrollment,
    }),
    [
      session,
      sessionNotice,
      enrollment,
      establishSession,
      markMfaEnabled,
      clearSession,
      logout,
      startEnrollment,
      clearEnrollment,
    ],
  );

  return (
    <IdentitySessionContext.Provider value={value}>
      {sessionNotice && (
        <div className={styles.sessionNotice} role="alert">
          {sessionNotice} <Link href="/login">Iniciar sesión</Link>
        </div>
      )}
      {children}
    </IdentitySessionContext.Provider>
  );
}

export function useIdentitySession(): IdentitySessionContextValue {
  const context = useContext(IdentitySessionContext);
  if (!context) {
    throw new Error(
      "useIdentitySession debe usarse dentro de IdentitySessionProvider.",
    );
  }
  return context;
}
