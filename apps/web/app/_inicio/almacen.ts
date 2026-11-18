"use client";

import { useSyncExternalStore } from "react";

/**
 * Valor guardado en localStorage y compartido por todos los componentes de la pestaña.
 * - Se lee perezosamente la primera vez (nunca en el servidor) y se cachea en memoria, para que
 *   `useSyncExternalStore` reciba siempre la misma referencia mientras no cambie.
 * - Todo acceso a localStorage va en try/catch: en modo privado o con el almacenamiento bloqueado
 *   el valor sigue funcionando solo en memoria.
 * - Escucha el evento `storage` para sincronizarse con otras pestañas.
 * - `migrar` (opcional) transforma datos guardados con un formato anterior: si devuelve un valor,
 *   se usa y se vuelve a guardar; si devuelve `undefined`, el dato se deja como está.
 */
export function crearAlmacen<T>(
  clave: string,
  inicial: T,
  validar: (dato: unknown) => T,
  migrar?: (dato: T) => T | undefined,
) {
  let valor: T | null = null;
  const oyentes = new Set<() => void>();

  function cargar(): T {
    try {
      const texto = window.localStorage.getItem(clave);
      if (!texto) return inicial;
      const dato = validar(JSON.parse(texto));
      const migrado = migrar?.(dato);
      if (migrado === undefined) return dato;
      try {
        window.localStorage.setItem(clave, JSON.stringify(migrado));
      } catch {
        /* Sin almacenamiento: la migración queda solo en memoria. */
      }
      return migrado;
    } catch {
      return inicial;
    }
  }

  function obtener(): T {
    if (valor === null) valor = cargar();
    return valor;
  }

  function avisar() {
    oyentes.forEach((oyente) => oyente());
  }

  function guardar(nuevo: T) {
    valor = nuevo;
    try {
      window.localStorage.setItem(clave, JSON.stringify(nuevo));
    } catch {
      /* Sin almacenamiento: el valor queda solo en memoria. */
    }
    avisar();
  }

  function alCambiarEnOtraPestana(ev: StorageEvent) {
    if (ev.key !== clave) return;
    valor = cargar();
    avisar();
  }

  function suscribir(oyente: () => void) {
    if (oyentes.size === 0) window.addEventListener("storage", alCambiarEnOtraPestana);
    oyentes.add(oyente);
    return () => {
      oyentes.delete(oyente);
      if (oyentes.size === 0) window.removeEventListener("storage", alCambiarEnOtraPestana);
    };
  }

  /** Valor actual; en el servidor y durante la hidratación devuelve `inicial`. */
  function useValor(): T {
    return useSyncExternalStore(suscribir, obtener, () => inicial);
  }

  return { obtener, guardar, useValor };
}
