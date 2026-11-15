"use client";

import type { HealthResponse } from "@cafeteria/shared";
import { useEffect, useState } from "react";

/** Estados de la página (data-model.md, "Estados que ve la web"). */
type EstadoPagina = "cargando" | "todo-ok" | "bd-caida" | "api-caida";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const TIMEOUT_MS = 3000;

function esComponentStatus(valor: unknown): boolean {
  return valor === "ok" || valor === "error";
}

/** Valida en tiempo de ejecución que el cuerpo tiene la forma de HealthResponse. */
function esHealthResponse(valor: unknown): valor is HealthResponse {
  if (typeof valor !== "object" || valor === null) return false;
  const v = valor as Record<keyof HealthResponse, unknown>;
  return (
    esComponentStatus(v.status) &&
    esComponentStatus(v.api) &&
    esComponentStatus(v.database) &&
    typeof v.checkedAt === "string"
  );
}

async function consultarSalud(): Promise<EstadoPagina> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API_URL}/health`, {
      cache: "no-store",
      signal: controller.signal,
    });
    const body: unknown = await res.json();
    if (!esHealthResponse(body)) return "api-caida";
    if (res.status === 200 && body.database === "ok") return "todo-ok";
    if (res.status === 503 && body.database === "error") return "bd-caida";
    return "api-caida";
  } catch {
    // Error de red, timeout de 3 s o JSON inválido.
    return "api-caida";
  } finally {
    clearTimeout(timer);
  }
}

export function HealthStatus() {
  const [estado, setEstado] = useState<EstadoPagina>("cargando");
  // Cada pulsación de "Reintentar" incrementa el intento y relanza el efecto.
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vigente = true;
    void consultarSalud().then((resultado) => {
      // Ignora respuestas de intentos anteriores o tras desmontar el componente.
      if (vigente) setEstado(resultado);
    });
    return () => {
      vigente = false;
    };
  }, [intento]);

  function reintentar() {
    setEstado("cargando");
    setIntento((n) => n + 1);
  }

  return (
    <>
      <div role="status" aria-live="polite" className="estado">
        {estado === "cargando" && <p>Comprobando el estado de la API…</p>}
        {estado === "todo-ok" && (
          <>
            <p className="estado-ok">API en línea</p>
            <p className="estado-ok">Base de datos conectada</p>
          </>
        )}
        {estado === "bd-caida" && (
          <>
            <p className="estado-ok">API en línea</p>
            <p className="estado-error">Base de datos no disponible</p>
          </>
        )}
        {estado === "api-caida" && (
          <p>
            <span className="estado-error">API no disponible.</span> Comprueba
            que la API está en ejecución (<code>pnpm dev</code>) y pulsa
            Reintentar.
          </p>
        )}
      </div>
      {/* Nunca se deshabilita: así el foco del teclado no se pierde al pulsarlo. */}
      <button type="button" onClick={reintentar}>
        Reintentar
      </button>
    </>
  );
}
