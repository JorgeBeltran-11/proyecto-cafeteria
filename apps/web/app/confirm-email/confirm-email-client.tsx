"use client";

import { useEffect, useState } from "react";
import {
  IdentityPage,
  Notice,
  TextLink,
} from "../identidad/components";
import { identidadApi, IdentityApiError } from "../identidad/api";
import styles from "../identidad/identidad.module.css";

type ConfirmationState =
  | { kind: "loading" }
  | { kind: "success"; message: string }
  | { kind: "invalid" }
  | { kind: "connection" }
  | { kind: "error"; message: string };

export default function ConfirmEmailClient({
  token,
}: {
  token: string | null;
}) {
  const [state, setState] = useState<ConfirmationState>(() =>
    token ? { kind: "loading" } : { kind: "invalid" },
  );

  useEffect(() => {
    if (!token) return;
    window.history.replaceState(null, "", window.location.pathname);
    let active = true;

    void identidadApi
      .confirmEmail(token)
      .then(({ message }) => {
        if (active) setState({ kind: "success", message });
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (
          error instanceof IdentityApiError &&
          error.kind === "http" &&
          (error.status === 400 || error.status === 404)
        ) {
          setState({ kind: "invalid" });
        } else if (
          error instanceof IdentityApiError &&
          (error.kind === "network" || error.kind === "timeout")
        ) {
          setState({ kind: "connection" });
        } else {
          setState({
            kind: "error",
            message:
              error instanceof Error
                ? error.message
                : "No se pudo confirmar el correo.",
          });
        }
      });

    return () => {
      active = false;
    };
  }, [token]);

  return (
    <IdentityPage
      eyebrow="CONFIRMACIÓN DE CORREO"
      title="Activa tu cuenta."
      description="Confirma que esta dirección de correo te pertenece."
    >
      <h2>
        {state.kind === "loading"
          ? "Verificando el enlace"
          : state.kind === "success"
            ? "Correo confirmado"
            : "No se pudo confirmar"}
      </h2>
      {state.kind === "loading" && (
        <p className={styles.panelLead} role="status">
          Estamos comprobando el enlace. Espera un momento.
        </p>
      )}
      {state.kind === "success" && (
        <>
          <Notice kind="success">{state.message}</Notice>
          <TextLink href="/login">Iniciar sesión</TextLink>
        </>
      )}
      {state.kind === "invalid" && (
        <Notice kind="error">
          El enlace de confirmación no es válido o ya venció. Si ya confirmaste
          tu correo, intenta iniciar sesión.
        </Notice>
      )}
      {state.kind === "connection" && (
        <Notice kind="error">
          No pudimos conectar con el servicio. Comprueba tu conexión e inténtalo
          de nuevo.
        </Notice>
      )}
      {state.kind === "error" && <Notice kind="error">{state.message}</Notice>}
      {state.kind !== "loading" && state.kind !== "success" && (
        <div className={styles.links}>
          <TextLink href="/login">Ir a iniciar sesión</TextLink>
          <TextLink href="/">Volver a la cafetería</TextLink>
        </div>
      )}
    </IdentityPage>
  );
}
