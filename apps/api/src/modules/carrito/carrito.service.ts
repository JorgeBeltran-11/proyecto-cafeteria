import { Inject, Injectable } from '@nestjs/common';
import type { AjusteCantidad, CarritoVista } from '@cafeteria/shared';
import { ErrorCarrito } from './dominio/errores';
import {
  calcularVista,
  type CarritoGuardado,
  estaCaducado,
  type LimitesCarrito,
  motivoNoSePuedeAnadir,
  resolverCantidad,
} from './dominio/reglas';
import {
  CatalogoParaCarrito,
  type ProductoParaCarrito,
} from './puertos/catalogo.puerto';
import { CalculadorDescuentos } from './puertos/descuentos.puerto';
import { CarritoRepositorio } from './repositorio/carrito.repositorio';

export const LIMITES_CARRITO = Symbol('LIMITES_CARRITO');
export const RELOJ = Symbol('RELOJ');
export type Reloj = () => Date;

/**
 * Casos de uso del carrito. Lo exporta CarritoModule para que otros módulos lo usen:
 * pedidos (spec 006) lee `ver` y llama a `vaciar`; identidad (spec 002) llama a
 * `eliminarDeCliente` al borrar una cuenta (contracts/dependencias.md §2 y §4).
 */
@Injectable()
export class CarritoService {
  constructor(
    private readonly repositorio: CarritoRepositorio,
    private readonly catalogo: CatalogoParaCarrito,
    private readonly descuentos: CalculadorDescuentos,
    @Inject(LIMITES_CARRITO) private readonly limites: LimitesCarrito,
    @Inject(RELOJ) private readonly reloj: Reloj,
  ) {}

  async ver(clienteId: string): Promise<CarritoVista> {
    const ahora = this.reloj();
    const carrito = await this.cargar(clienteId, ahora);
    return this.vista(clienteId, carrito, ahora);
  }

  /** Añade unidades de un producto; si ya está en el carrito, suma la cantidad (US1-2). */
  async anadir(
    clienteId: string,
    productoId: string,
    cantidad: number,
  ): Promise<CarritoVista> {
    const ahora = this.reloj();
    const carrito = (await this.cargar(clienteId, ahora)) ?? {
      clienteId,
      lineas: [],
      actualizadoEn: ahora,
    };
    const producto = await this.productoAnadible(productoId, ahora);
    const existente = carrito.lineas.find((l) => l.productoId === productoId);
    const actual = existente?.cantidad ?? 0;

    const { aplicada, ajuste } = this.cantidadConEspacio(
      carrito,
      producto,
      actual + cantidad,
      actual,
    );
    if (existente) {
      existente.cantidad = aplicada;
    } else {
      carrito.lineas.push({
        productoId,
        cantidad: aplicada,
        precioVistoCentavos: producto.precioCentavos,
        anadidaEn: ahora,
      });
    }

    return this.guardarYVer(carrito, ahora, ajuste);
  }

  /** Fija la cantidad de una línea. 0 la quita; reducir siempre se permite (contrato OpenAPI). */
  async cambiarCantidad(
    clienteId: string,
    productoId: string,
    cantidad: number,
  ): Promise<CarritoVista> {
    const ahora = this.reloj();
    const carrito = await this.cargar(clienteId, ahora);
    const linea = carrito?.lineas.find((l) => l.productoId === productoId);
    if (!carrito || !linea) {
      throw new ErrorCarrito(
        'no_esta_en_carrito',
        'Ese producto no está en tu carrito. Actualiza la página para ver su estado actual.',
      );
    }

    let ajuste: AjusteCantidad | undefined;
    if (cantidad === 0) {
      carrito.lineas = carrito.lineas.filter((l) => l !== linea);
    } else if (cantidad <= linea.cantidad) {
      linea.cantidad = cantidad;
    } else {
      const producto = await this.productoAnadible(productoId, ahora);
      const resuelta = this.cantidadConEspacio(
        carrito,
        producto,
        cantidad,
        linea.cantidad,
      );
      linea.cantidad = resuelta.aplicada;
      ajuste = resuelta.ajuste;
    }

    return this.guardarYVer(carrito, ahora, ajuste);
  }

  /** Quita una línea. Es idempotente: si no está, devuelve el carrito sin cambios. */
  async quitar(clienteId: string, productoId: string): Promise<CarritoVista> {
    const ahora = this.reloj();
    const carrito = await this.cargar(clienteId, ahora);
    if (!carrito || !carrito.lineas.some((l) => l.productoId === productoId)) {
      return this.vista(clienteId, carrito, ahora);
    }
    carrito.lineas = carrito.lineas.filter((l) => l.productoId !== productoId);
    return this.guardarYVer(carrito, ahora);
  }

  async vaciar(clienteId: string): Promise<CarritoVista> {
    const ahora = this.reloj();
    const carrito = await this.cargar(clienteId, ahora);
    if (!carrito) return this.vista(clienteId, null, ahora);
    carrito.lineas = [];
    return this.guardarYVer(carrito, ahora);
  }

  /** El cliente acepta los precios actuales: desaparecen los avisos de cambio de precio (research R5). */
  async aceptarPrecios(clienteId: string): Promise<CarritoVista> {
    const ahora = this.reloj();
    const carrito = await this.cargar(clienteId, ahora);
    if (!carrito) return this.vista(clienteId, null, ahora);

    const productos = await this.productosDe(carrito, ahora);
    let cambio = false;
    for (const linea of carrito.lineas) {
      const producto = productos.get(linea.productoId);
      if (producto && producto.precioCentavos !== linea.precioVistoCentavos) {
        linea.precioVistoCentavos = producto.precioCentavos;
        cambio = true;
      }
    }
    return cambio
      ? this.guardarYVer(carrito, ahora)
      : this.vista(clienteId, carrito, ahora, undefined, productos);
  }

  /** Borra el carrito del cliente (eliminación de cuenta, LOPDP). */
  async eliminarDeCliente(clienteId: string): Promise<void> {
    await this.repositorio.eliminar(clienteId);
  }

  /** Lee el carrito y lo vacía si lleva demasiado tiempo sin actividad (research R4). */
  private async cargar(
    clienteId: string,
    ahora: Date,
  ): Promise<CarritoGuardado | null> {
    const carrito = await this.repositorio.obtener(clienteId);
    if (
      carrito &&
      estaCaducado(carrito.actualizadoEn, ahora, this.limites.diasInactividad)
    ) {
      await this.repositorio.eliminar(clienteId);
      return null;
    }
    return carrito;
  }

  private async productoAnadible(
    productoId: string,
    ahora: Date,
  ): Promise<ProductoParaCarrito> {
    const [producto] = await this.catalogo.obtenerProductos([productoId], ahora);
    const motivo = motivoNoSePuedeAnadir(producto);
    if (motivo !== null || !producto) {
      throw new ErrorCarrito(
        'no_disponible',
        `${motivo ?? 'Ese producto no está disponible.'} Elige otro producto del menú.`,
      );
    }
    return producto;
  }

  /** Resuelve la cantidad y falla si no cabe ni una unidad más que la actual (research R10). */
  private cantidadConEspacio(
    carrito: CarritoGuardado,
    producto: ProductoParaCarrito,
    deseada: number,
    actual: number,
  ): { aplicada: number; ajuste?: AjusteCantidad } {
    const resuelta = resolverCantidad({
      lineas: carrito.lineas,
      producto,
      deseada,
      limites: this.limites,
    });
    if (resuelta.aplicada <= actual) {
      throw new ErrorCarrito(
        'sin_espacio',
        `No puedes añadir más unidades de ${producto.nombre}. ${resuelta.ajuste?.motivo ?? ''}`.trim(),
      );
    }
    return resuelta;
  }

  private async guardarYVer(
    carrito: CarritoGuardado,
    ahora: Date,
    ajuste?: AjusteCantidad,
  ): Promise<CarritoVista> {
    carrito.actualizadoEn = ahora;
    await this.repositorio.guardar(carrito);
    return this.vista(carrito.clienteId, carrito, ahora, ajuste);
  }

  private async productosDe(
    carrito: CarritoGuardado | null,
    ahora: Date,
  ): Promise<Map<string, ProductoParaCarrito>> {
    const ids = carrito?.lineas.map((l) => l.productoId) ?? [];
    if (ids.length === 0) return new Map();
    const productos = await this.catalogo.obtenerProductos(ids, ahora);
    return new Map(productos.map((p) => [p.id, p]));
  }

  private async vista(
    clienteId: string,
    carrito: CarritoGuardado | null,
    ahora: Date,
    ajuste?: AjusteCantidad,
    productosCargados?: Map<string, ProductoParaCarrito>,
  ): Promise<CarritoVista> {
    const productos = productosCargados ?? (await this.productosDe(carrito, ahora));

    // Solo se piden descuentos para productos que se pueden pedir.
    const lineasConPrecio = (carrito?.lineas ?? []).flatMap((l) => {
      const p = productos.get(l.productoId);
      return p && motivoNoSePuedeAnadir(p) === null
        ? [{ productoId: l.productoId, cantidad: l.cantidad, precioUnitarioCentavos: p.precioCentavos }]
        : [];
    });
    const descuentos =
      lineasConPrecio.length > 0
        ? await this.descuentos.calcular(lineasConPrecio, ahora, clienteId)
        : [];

    const vista = calcularVista({
      carrito,
      productos,
      descuentos,
      limites: this.limites,
    });
    return ajuste ? { ...vista, ajuste } : vista;
  }
}
