/**
 * Reglas del carrito como funciones puras (spec 004, data-model.md).
 * No acceden a la base de datos ni a otros módulos: reciben todo lo que necesitan.
 * Todos los importes son enteros en centavos (constitución VI).
 */
import type {
  AjusteCantidad,
  AvisoCarrito,
  CarritoVista,
  LineaCarritoVista,
} from '@cafeteria/shared';
import type { ProductoParaCarrito } from '../puertos/catalogo.puerto';
import type { DescuentoDeLinea } from '../puertos/descuentos.puerto';

const MS_POR_DIA = 24 * 60 * 60 * 1000;

export interface LineaGuardada {
  productoId: string;
  cantidad: number;
  /** Precio que vio el cliente al añadir la línea o al aceptar el último cambio. */
  precioVistoCentavos: number;
  anadidaEn: Date;
}

export interface CarritoGuardado {
  clienteId: string;
  lineas: LineaGuardada[];
  actualizadoEn: Date;
}

export interface LimitesCarrito {
  /** Máximo de unidades de un mismo producto. */
  porProducto: number;
  /** Máximo de unidades en todo el carrito. */
  porCarrito: number;
  /** Días sin actividad tras los que el carrito se vacía. */
  diasInactividad: number;
}

export const LIMITES_POR_DEFECTO: LimitesCarrito = {
  porProducto: 20,
  porCarrito: 50,
  diasInactividad: 30,
};

/** Formatea centavos como "$2,50" sin pasar por coma flotante. */
export function formatearCentavos(centavos: number): string {
  const signo = centavos < 0 ? '-' : '';
  const absoluto = Math.abs(centavos);
  const enteros = Math.floor(absoluto / 100);
  const resto = String(absoluto % 100).padStart(2, '0');
  return `${signo}$${enteros},${resto}`;
}

export function estaCaducado(
  actualizadoEn: Date,
  ahora: Date,
  diasInactividad: number,
): boolean {
  return ahora.getTime() - actualizadoEn.getTime() > diasInactividad * MS_POR_DIA;
}

/** Motivo por el que no se puede añadir un producto, o null si se puede (research R9). */
export function motivoNoSePuedeAnadir(
  producto: ProductoParaCarrito | undefined,
): string | null {
  if (!producto || producto.estado === 'retirado') {
    return 'Ese producto ya no está en el menú.';
  }
  if (producto.estado === 'agotado') {
    return `${producto.nombre} está agotado.`;
  }
  return null;
}

/** Máximo de unidades del producto: mínimo entre existencias y límite por producto. */
export function maximoPorProducto(
  producto: ProductoParaCarrito | undefined,
  limites: LimitesCarrito,
): number {
  if (motivoNoSePuedeAnadir(producto) !== null || !producto) return 0;
  const existencias = producto.existencias ?? Number.POSITIVE_INFINITY;
  return Math.max(0, Math.min(limites.porProducto, existencias));
}

function unidadesDeOtrasLineas(
  lineas: readonly LineaGuardada[],
  productoId: string,
): number {
  return lineas
    .filter((l) => l.productoId !== productoId)
    .reduce((suma, l) => suma + l.cantidad, 0);
}

export interface CantidadResuelta {
  aplicada: number;
  /** Presente si se aplicó menos de lo pedido. */
  ajuste?: AjusteCantidad;
}

/**
 * Recorta la cantidad deseada de un producto a sus límites y explica por qué (research R10).
 * No valida si el producto se puede añadir: eso lo decide motivoNoSePuedeAnadir.
 */
export function resolverCantidad(params: {
  lineas: readonly LineaGuardada[];
  producto: ProductoParaCarrito;
  deseada: number;
  limites: LimitesCarrito;
}): CantidadResuelta {
  const { lineas, producto, deseada, limites } = params;
  const maxProducto = maximoPorProducto(producto, limites);
  const espacioCarrito = Math.max(
    0,
    limites.porCarrito - unidadesDeOtrasLineas(lineas, producto.id),
  );
  const limite = Math.min(maxProducto, espacioCarrito);

  if (deseada <= limite) return { aplicada: deseada };

  let motivo: string;
  if (maxProducto <= espacioCarrito) {
    const limitaExistencias =
      producto.existencias !== null &&
      producto.existencias < limites.porProducto;
    motivo = limitaExistencias
      ? `Solo quedan ${producto.existencias} unidades de ${producto.nombre}.`
      : `El máximo por producto es ${limites.porProducto} unidades.`;
  } else {
    motivo = `El carrito admite como máximo ${limites.porCarrito} unidades en total.`;
  }

  return {
    aplicada: limite,
    ajuste: {
      productoId: producto.id,
      solicitada: deseada,
      aplicada: limite,
      motivo,
    },
  };
}

function descuentoAcotado(
  descuento: DescuentoDeLinea | undefined,
  subtotal: number,
): number {
  if (!descuento || !Number.isFinite(descuento.descuentoCentavos)) return 0;
  return Math.min(subtotal, Math.max(0, Math.round(descuento.descuentoCentavos)));
}

function avisosDeLinea(
  linea: LineaGuardada,
  producto: ProductoParaCarrito | undefined,
  nombre: string,
): AvisoCarrito[] {
  const base = { productoId: linea.productoId, bloqueaConfirmacion: true };

  if (!producto || producto.estado === 'retirado') {
    return [
      {
        ...base,
        tipo: 'retirado',
        mensaje: `${nombre} ya no está en el menú. Quítalo para poder confirmar el pedido.`,
      },
    ];
  }

  const avisos: AvisoCarrito[] = [];
  if (producto.estado === 'agotado') {
    avisos.push({
      ...base,
      tipo: 'agotado',
      mensaje: `${nombre} está agotado. Quítalo para poder confirmar el pedido.`,
    });
  } else {
    if (!producto.enHorario) {
      avisos.push({
        ...base,
        tipo: 'fuera_de_horario',
        mensaje: `${nombre} no está disponible a esta hora. Podrás confirmar cuando su menú esté disponible, o quítalo.`,
      });
    }
    if (producto.existencias !== null && linea.cantidad > producto.existencias) {
      avisos.push({
        ...base,
        tipo: 'supera_existencias',
        mensaje: `Solo quedan ${producto.existencias} unidades de ${nombre}. Reduce la cantidad para poder confirmar el pedido.`,
      });
    }
  }

  if (producto.precioCentavos !== linea.precioVistoCentavos) {
    avisos.push({
      ...base,
      tipo: 'cambio_de_precio',
      mensaje: `El precio de ${nombre} cambió de ${formatearCentavos(linea.precioVistoCentavos)} a ${formatearCentavos(producto.precioCentavos)}.`,
      precioAnteriorCentavos: linea.precioVistoCentavos,
      precioNuevoCentavos: producto.precioCentavos,
    });
  }

  return avisos;
}

/** Calcula todo lo que ve el cliente a partir del carrito guardado y los datos actuales. */
export function calcularVista(params: {
  carrito: CarritoGuardado | null;
  productos: ReadonlyMap<string, ProductoParaCarrito>;
  descuentos: readonly DescuentoDeLinea[];
  limites: LimitesCarrito;
}): CarritoVista {
  const { carrito, productos, descuentos, limites } = params;
  const guardadas = [...(carrito?.lineas ?? [])].sort(
    (a, b) => a.anadidaEn.getTime() - b.anadidaEn.getTime(),
  );
  const totalUnidades = guardadas.reduce((suma, l) => suma + l.cantidad, 0);
  const descuentoPorProducto = new Map(descuentos.map((d) => [d.productoId, d]));

  const lineas: LineaCarritoVista[] = [];
  const avisos: AvisoCarrito[] = [];

  for (const linea of guardadas) {
    const producto = productos.get(linea.productoId);
    const nombre = producto?.nombre ?? 'Un producto';
    // Si el producto ya no existe, se muestra con el último precio conocido.
    const precioUnitario = producto?.precioCentavos ?? linea.precioVistoCentavos;
    const subtotal = precioUnitario * linea.cantidad;
    const descuento = descuentoAcotado(
      descuentoPorProducto.get(linea.productoId),
      subtotal,
    );
    const espacio = limites.porCarrito - (totalUnidades - linea.cantidad);

    lineas.push({
      productoId: linea.productoId,
      nombre,
      cantidad: linea.cantidad,
      precioUnitarioCentavos: precioUnitario,
      subtotalCentavos: subtotal,
      descuentoCentavos: descuento,
      totalCentavos: subtotal - descuento,
      maximoPermitido: Math.max(
        0,
        Math.min(maximoPorProducto(producto, limites), espacio),
      ),
    });
    avisos.push(...avisosDeLinea(linea, producto, nombre));
  }

  const subtotalCentavos = lineas.reduce((s, l) => s + l.subtotalCentavos, 0);
  const descuentoCentavos = lineas.reduce((s, l) => s + l.descuentoCentavos, 0);

  return {
    lineas,
    totalUnidades,
    subtotalCentavos,
    descuentoCentavos,
    totalCentavos: subtotalCentavos - descuentoCentavos,
    avisos,
    sePuedeConfirmar:
      lineas.length > 0 && !avisos.some((a) => a.bloqueaConfirmacion),
    limites: { porProducto: limites.porProducto, porCarrito: limites.porCarrito },
    actualizadoEn: carrito ? carrito.actualizadoEn.toISOString() : null,
  };
}
