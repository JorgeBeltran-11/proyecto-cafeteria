"use client";

import { useId, useState, type FormEvent } from "react";
import m from "./marco.module.css";

const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Estado = { tipo: "inicial" } | { tipo: "error"; texto: string } | { tipo: "ok"; texto: string };

/** Suscripción a promociones: valida el correo y confirma en la página (aria-live). */
export function Suscripcion() {
  const [correo, setCorreo] = useState("");
  const [estado, setEstado] = useState<Estado>({ tipo: "inicial" });
  const base = useId();
  const idCampo = `${base}-correo`;
  const idMensaje = `${base}-mensaje`;

  function alEnviar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const valor = correo.trim();
    if (!CORREO_VALIDO.test(valor)) {
      setEstado({
        tipo: "error",
        texto: "Escribe un correo válido, por ejemplo nombre@correo.com.",
      });
      return;
    }
    setEstado({
      tipo: "ok",
      texto: `¡Gracias! Te enviaremos nuestras promociones a ${valor}.`,
    });
    setCorreo("");
  }

  return (
    <form className={m.suscripcion} onSubmit={alEnviar} noValidate>
      <label htmlFor={idCampo} className={m.suscripcionEtiqueta}>
        Correo electrónico
      </label>
      <div className={m.suscripcionFila}>
        <input
          id={idCampo}
          type="email"
          inputMode="email"
          autoComplete="email"
          className={m.suscripcionCampo}
          value={correo}
          onChange={(ev) => setCorreo(ev.target.value)}
          aria-invalid={estado.tipo === "error" ? true : undefined}
          aria-describedby={idMensaje}
        />
        <button type="submit" className={m.suscripcionBoton}>
          Suscríbete
        </button>
      </div>
      <p
        id={idMensaje}
        className={estado.tipo === "error" ? m.suscripcionError : m.suscripcionOk}
        aria-live="polite"
      >
        {estado.tipo === "inicial" ? "" : estado.texto}
      </p>
    </form>
  );
}

/** Vuelve al inicio de la página (suave salvo con movimiento reducido) y lleva el foco a la marca. */
export function VolverArriba({ destino }: { destino: string }) {
  function alPulsar() {
    const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reducido ? "auto" : "smooth" });
    document.getElementById(destino)?.focus({ preventScroll: true });
  }

  return (
    <button type="button" className={m.volverArriba} onClick={alPulsar}>
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
        <path
          d="M12 19V5M5 12l7-7 7 7"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      Volver arriba
    </button>
  );
}
