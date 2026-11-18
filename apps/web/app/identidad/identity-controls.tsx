"use client";

import Link from "next/link";
import { useState } from "react";
import { useIdentitySession } from "./session-provider";
import styles from "./identidad.module.css";

export function IdentityControls() {
  const { session, logout } = useIdentitySession();
  const [busy, setBusy] = useState(false);

  async function closeSession() {
    setBusy(true);
    await logout().catch(() => undefined);
    setBusy(false);
  }

  return (
    <div className={styles.homeControls}>
      {session ? (
        <>
          <Link className={styles.textLink} href="/cuenta/seguridad">
            <span className={styles.fullLabel}>Seguridad</span>
            <span className={styles.shortLabel}>Seguridad</span>
          </Link>
          <button
            className="header-action"
            type="button"
            onClick={closeSession}
            disabled={busy}
          >
            {busy ? (
              "Cerrando…"
            ) : (
              <>
                <span className={styles.fullLabel}>Cerrar sesión</span>
                <span className={styles.shortLabel}>Salir</span>
              </>
            )}
          </button>
        </>
      ) : (
        <>
          <Link className={styles.textLink} href="/login">
            <span className={styles.fullLabel}>Iniciar sesión</span>
            <span className={styles.shortLabel}>Entrar</span>
          </Link>
          <Link className="header-action" href="/#registro">
            <span className={styles.fullLabel}>Crear cuenta</span>
            <span className={styles.shortLabel}>Registro</span>
          </Link>
        </>
      )}
    </div>
  );
}
