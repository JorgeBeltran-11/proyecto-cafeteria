/**
 * Cálculo de descuentos (contracts/dependencias.md §3).
 *
 * PENDIENTE(spec-005): lo implementa el módulo de promociones. Mientras no exista,
 * `CarritoModule` usa `SinDescuentos` (carpeta provisional/), que no aplica ninguno.
 */

export interface LineaParaDescuento {
  productoId: string;
  cantidad: number;
  precioUnitarioCentavos: number;
}

export interface DescuentoDeLinea {
  productoId: string;
  /** Descuento total de la línea, en centavos (entero ≥ 0). */
  descuentoCentavos: number;
  /** Nombre de la promoción, para mostrarlo. */
  promocion?: string;
}

export abstract class CalculadorDescuentos {
  abstract calcular(
    lineas: readonly LineaParaDescuento[],
    ahora: Date,
    clienteId: string,
  ): Promise<DescuentoDeLinea[]>;
}
