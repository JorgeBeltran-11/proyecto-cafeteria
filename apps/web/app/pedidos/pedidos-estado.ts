"use client";

import { crearAlmacen } from "../_inicio/almacen";
import {
  ESTADOS_PEDIDO,
  NUMERACION_ANTIGUA_DESDE,
  PRIMER_NUMERO_PEDIDO,
  type EstadoPedido,
  type LineaPedido,
  type Pedido,
} from "../_inicio/datos";

const SIN_PEDIDOS: Pedido[] = [];

const esTexto = (x: unknown): x is string => typeof x === "string";
const esEntero = (x: unknown): x is number => typeof x === "number" && Number.isInteger(x);

function esLinea(x: unknown): x is LineaPedido {
  if (typeof x !== "object" || x === null) return false;
  const l = x as Record<string, unknown>;
  return esTexto(l.nombre) && esEntero(l.cantidad) && esEntero(l.precioCentavos);
}

/** Descarta lo que no tenga la forma de un pedido (datos viejos o editados a mano). */
function validarPedidos(dato: unknown): Pedido[] {
  if (!Array.isArray(dato)) return SIN_PEDIDOS;
  return dato.filter((x): x is Pedido => {
    if (typeof x !== "object" || x === null) return false;
    const p = x as Record<string, unknown>;
    return (
      esEntero(p.numero) &&
      [p.nombres, p.apellidos, p.cedula, p.celular, p.direccion, p.hora, p.fecha].every(esTexto) &&
      Array.isArray(p.productos) &&
      p.productos.every(esLinea) &&
      esEntero(p.totalCentavos) &&
      ESTADOS_PEDIDO.includes(p.estado as EstadoPedido)
    );
  });
}

/**
 * Migración de la numeración antigua (desde 1001): si algún pedido guardado la usa, renumera
 * todos de forma consecutiva desde 1 en orden de registro (el más antiguo es el #1).
 * El orden de la lista (del más reciente al más antiguo) no cambia.
 */
export function renumerarPedidos(pedidos: Pedido[]): Pedido[] | undefined {
  if (!pedidos.some((p) => p.numero >= NUMERACION_ANTIGUA_DESDE)) return undefined;
  // Orden de registro: por número ascendente; a igual número, el que está más abajo es más antiguo.
  const porRegistro = pedidos
    .map((p, i) => ({ p, i }))
    .sort((a, b) => a.p.numero - b.p.numero || b.i - a.i);
  const nuevos = new Map(porRegistro.map(({ p }, n) => [p, PRIMER_NUMERO_PEDIDO + n]));
  return pedidos.map((p) => ({ ...p, numero: nuevos.get(p) ?? p.numero }));
}

const almacen = crearAlmacen(
  "cafeteria-online-loja:pedidos",
  SIN_PEDIDOS,
  validarPedidos,
  renumerarPedidos,
);

/** Pedidos registrados en este navegador, del más reciente al más antiguo. */
export const usePedidos = almacen.useValor;

/** Siguiente número consecutivo: el más alto + 1, o 1 si no hay pedidos. */
export function siguienteNumero(pedidos: Pedido[]): number {
  return pedidos.reduce((max, p) => Math.max(max, p.numero + 1), PRIMER_NUMERO_PEDIDO);
}

export function registrarPedido(pedido: Pedido) {
  almacen.guardar([pedido, ...almacen.obtener()]);
}

export function cambiarEstado(numero: number, estado: EstadoPedido) {
  almacen.guardar(almacen.obtener().map((p) => (p.numero === numero ? { ...p, estado } : p)));
}
