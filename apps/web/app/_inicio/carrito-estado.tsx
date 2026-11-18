"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { crearAlmacen } from "./almacen";
import { CAFES, type Cafe } from "./datos";

/** Unidades máximas de un mismo producto en el carrito. */
export const MAX_POR_PRODUCTO = 99;

type ItemGuardado = { id: string; cantidad: number };

export type ItemCarrito = {
  cafe: Cafe;
  cantidad: number;
  subtotalCentavos: number;
};

const SIN_ITEMS: ItemGuardado[] = [];

function limitar(cantidad: number): number {
  return Math.min(MAX_POR_PRODUCTO, Math.max(1, Math.round(cantidad)));
}

/** Acepta solo productos existentes con cantidades enteras válidas. */
function validarItems(dato: unknown): ItemGuardado[] {
  if (!Array.isArray(dato)) return SIN_ITEMS;
  return dato.flatMap((x): ItemGuardado[] => {
    if (typeof x !== "object" || x === null) return [];
    const { id, cantidad } = x as Record<string, unknown>;
    if (typeof id !== "string" || typeof cantidad !== "number" || !Number.isFinite(cantidad)) {
      return [];
    }
    return CAFES.some((c) => c.id === id) ? [{ id, cantidad: limitar(cantidad) }] : [];
  });
}

const almacen = crearAlmacen("cafeteria-online-loja:carrito", SIN_ITEMS, validarItems);

type ValorCarrito = {
  items: ItemCarrito[];
  /** Suma de unidades de todos los productos. */
  unidades: number;
  totalCentavos: number;
  agregar: (id: string, cantidad: number) => void;
  cambiarCantidad: (id: string, cantidad: number) => void;
  quitar: (id: string) => void;
  vaciar: () => void;
};

const ContextoCarrito = createContext<ValorCarrito | null>(null);

function agregar(id: string, cantidad: number) {
  const actuales = almacen.obtener();
  const existe = actuales.some((i) => i.id === id);
  almacen.guardar(
    existe
      ? actuales.map((i) => (i.id === id ? { id, cantidad: limitar(i.cantidad + cantidad) } : i))
      : [...actuales, { id, cantidad: limitar(cantidad) }],
  );
}

function cambiarCantidad(id: string, cantidad: number) {
  almacen.guardar(
    almacen.obtener().map((i) => (i.id === id ? { id, cantidad: limitar(cantidad) } : i)),
  );
}

function quitar(id: string) {
  almacen.guardar(almacen.obtener().filter((i) => i.id !== id));
}

function vaciar() {
  almacen.guardar(SIN_ITEMS);
}

/** Carrito del navegador compartido por las páginas del sitio (se guarda en localStorage). */
export function CarritoProvider({ children }: { children: ReactNode }) {
  const guardados = almacen.useValor();

  const valor = useMemo<ValorCarrito>(() => {
    const items = guardados.flatMap((g): ItemCarrito[] => {
      const cafe = CAFES.find((c) => c.id === g.id);
      return cafe ? [{ cafe, cantidad: g.cantidad, subtotalCentavos: cafe.precioCentavos * g.cantidad }] : [];
    });
    return {
      items,
      unidades: items.reduce((s, i) => s + i.cantidad, 0),
      totalCentavos: items.reduce((s, i) => s + i.subtotalCentavos, 0),
      agregar,
      cambiarCantidad,
      quitar,
      vaciar,
    };
  }, [guardados]);

  return <ContextoCarrito.Provider value={valor}>{children}</ContextoCarrito.Provider>;
}

export function useCarrito(): ValorCarrito {
  const valor = useContext(ContextoCarrito);
  if (!valor) throw new Error("useCarrito debe usarse dentro de <CarritoProvider>.");
  return valor;
}
