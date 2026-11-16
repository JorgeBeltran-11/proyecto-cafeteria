/**
 * Validación de la entrada HTTP del carrito (research R6). Los mensajes dicen cómo corregir el error.
 */
import { ErrorCarrito } from './dominio/errores';

const FORMATO_PRODUCTO_ID = /^[A-Za-z0-9_-]{1,64}$/;
/** Tope de cordura: los límites reales (20 / 50) los aplica el dominio. */
const CANTIDAD_MAXIMA_ACEPTADA = 9999;

function invalida(mensaje: string): ErrorCarrito {
  return new ErrorCarrito('entrada_invalida', mensaje);
}

export function leerObjeto(cuerpo: unknown): Record<string, unknown> {
  if (typeof cuerpo !== 'object' || cuerpo === null || Array.isArray(cuerpo)) {
    throw invalida('El cuerpo de la petición debe ser un objeto JSON.');
  }
  return cuerpo as Record<string, unknown>;
}

export function validarProductoId(valor: unknown): string {
  if (typeof valor !== 'string' || !FORMATO_PRODUCTO_ID.test(valor)) {
    throw invalida(
      'productoId debe ser un texto de 1 a 64 caracteres con letras, números, "-" o "_".',
    );
  }
  return valor;
}

export function validarCantidad(valor: unknown, minimo: 0 | 1): number {
  if (
    typeof valor !== 'number' ||
    !Number.isInteger(valor) ||
    valor < minimo ||
    valor > CANTIDAD_MAXIMA_ACEPTADA
  ) {
    throw invalida(
      `La cantidad debe ser un número entero entre ${minimo} y ${CANTIDAD_MAXIMA_ACEPTADA}.`,
    );
  }
  return valor;
}
