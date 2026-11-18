"use client";

import { useSyncExternalStore } from "react";

const sinSuscripcion = () => () => {};

/**
 * Años transcurridos desde `desde`, calculados en el navegador con la fecha actual. En el HTML
 * prerenderizado (sin fecha de petición) se muestra `respaldo`; así la cifra nunca se queda
 * congelada en la del día del build.
 */
export function AniosDesde({ desde, respaldo }: { desde: number; respaldo: string }) {
  const anio = useSyncExternalStore(
    sinSuscripcion,
    () => new Date().getFullYear(),
    () => null,
  );
  if (anio === null) return <>{respaldo}</>;
  const n = Math.max(anio - desde, 0);
  return <>{n === 1 ? "1 año" : `${n} años`}</>;
}
