/**
 * Lo que el carrito necesita del catálogo (contracts/dependencias.md §1).
 *
 * PENDIENTE(spec-003): el módulo `catalogo` implementa esta clase y la exporta con
 * `{ provide: CatalogoParaCarrito, useExisting: CatalogoService }`. Mientras no exista,
 * `CarritoModule` usa `CatalogoProvisional` (carpeta provisional/).
 */

export type EstadoProducto = 'disponible' | 'agotado' | 'retirado';

export interface ProductoParaCarrito {
  id: string;
  nombre: string;
  /** Precio vigente en centavos (entero). */
  precioCentavos: number;
  estado: EstadoProducto;
  /** Unidades disponibles; null si el producto no controla existencias. */
  existencias: number | null;
  /** true si el menú del producto está disponible en el momento consultado. */
  enHorario: boolean;
}

/** Clase abstracta: sirve de tipo y de token de inyección en NestJS (research R1). */
export abstract class CatalogoParaCarrito {
  /** Devuelve los productos encontrados; los ids inexistentes no aparecen. */
  abstract obtenerProductos(
    ids: readonly string[],
    ahora: Date,
  ): Promise<ProductoParaCarrito[]>;
}
