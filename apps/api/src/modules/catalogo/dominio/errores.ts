/** Errores de negocio del catálogo; catalogo.errores.ts los traduce a HTTP. */
export type CodigoErrorCatalogo =
  | 'entrada_invalida'
  | 'no_encontrado'
  | 'ya_existe'
  | 'conflicto_edicion'
  | 'no_publicable'
  | 'sin_existencias';

export class ErrorCatalogo extends Error {
  constructor(
    readonly codigo: CodigoErrorCatalogo,
    /** Mensaje para quien usa la API: dice qué pasó y cómo corregirlo (RNF-01). */
    mensaje: string,
    /** Solo en 'no_publicable': cada cosa que falta para publicar. */
    readonly problemas: string[] = [],
  ) {
    super(mensaje);
    this.name = 'ErrorCatalogo';
  }
}
