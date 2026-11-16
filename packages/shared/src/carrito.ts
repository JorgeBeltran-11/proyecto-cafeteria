// Tipos del carrito compartidos entre apps/api y apps/web (spec 004, data-model.md).
// Todos los importes son enteros en centavos (constitución VI): nunca coma flotante.

export type TipoAvisoCarrito =
  | 'agotado'
  | 'retirado'
  | 'fuera_de_horario'
  | 'cambio_de_precio'
  | 'supera_existencias'
  /** Reservado para la spec 005 (promociones); hoy no se genera. */
  | 'fin_de_promocion';

export interface AvisoCarrito {
  tipo: TipoAvisoCarrito;
  productoId: string;
  /** Texto listo para mostrar y anunciar a lectores de pantalla. */
  mensaje: string;
  /** Si es true, el pedido no se puede confirmar mientras el aviso siga activo. */
  bloqueaConfirmacion: boolean;
  /** Solo en 'cambio_de_precio'. */
  precioAnteriorCentavos?: number;
  /** Solo en 'cambio_de_precio'. */
  precioNuevoCentavos?: number;
}

export interface LineaCarritoVista {
  productoId: string;
  nombre: string;
  cantidad: number;
  /** Precio vigente según el catálogo. */
  precioUnitarioCentavos: number;
  /** precioUnitarioCentavos × cantidad. */
  subtotalCentavos: number;
  descuentoCentavos: number;
  /** subtotalCentavos − descuentoCentavos. */
  totalCentavos: number;
  /** Cantidad máxima que admite ahora la línea (0 si el producto no se puede pedir). */
  maximoPermitido: number;
}

/** Explica por qué se aplicó una cantidad menor que la pedida. */
export interface AjusteCantidad {
  productoId: string;
  solicitada: number;
  aplicada: number;
  motivo: string;
}

export interface CarritoVista {
  lineas: LineaCarritoVista[];
  totalUnidades: number;
  subtotalCentavos: number;
  descuentoCentavos: number;
  totalCentavos: number;
  avisos: AvisoCarrito[];
  /** true si hay líneas y ningún aviso bloquea la confirmación. */
  sePuedeConfirmar: boolean;
  limites: { porProducto: number; porCarrito: number };
  /** Última modificación, ISO 8601 en UTC; null si el carrito no existe todavía. */
  actualizadoEn: string | null;
  /** Solo en la respuesta de una modificación cuya cantidad se recortó. */
  ajuste?: AjusteCantidad;
}
