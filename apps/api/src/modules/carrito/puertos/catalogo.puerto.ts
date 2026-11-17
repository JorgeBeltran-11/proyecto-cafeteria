/**
 * Lo que el carrito necesita del catálogo (contracts/dependencias.md §1).
 *
 * Lo implementa el módulo `catalogo` (spec 003) con
 * `{ provide: CatalogoParaCarrito, useExisting: CatalogoService }` y lo exporta;
 * `CarritoModule` lo recibe al importar `CatalogoModule`.
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
