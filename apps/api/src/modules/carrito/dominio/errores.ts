/** Errores de negocio del carrito; carrito.errores.ts los traduce a HTTP. */
export type CodigoErrorCarrito =
  | 'entrada_invalida'
  | 'no_disponible'
  | 'sin_espacio'
  | 'no_esta_en_carrito';

export class ErrorCarrito extends Error {
  constructor(
    readonly codigo: CodigoErrorCarrito,
    /** Mensaje para el cliente: dice qué pasó y cómo corregirlo (RNF-01). */
    mensaje: string,
  ) {
    super(mensaje);
    this.name = 'ErrorCarrito';
  }
}
