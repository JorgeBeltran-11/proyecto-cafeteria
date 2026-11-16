import { CarritoService } from './carrito.service';
import { ErrorCarrito } from './dominio/errores';
import { LIMITES_POR_DEFECTO } from './dominio/reglas';
import {
  CatalogoParaCarrito,
  type ProductoParaCarrito,
} from './puertos/catalogo.puerto';
import {
  CalculadorDescuentos,
  type DescuentoDeLinea,
  type LineaParaDescuento,
} from './puertos/descuentos.puerto';
import { SinDescuentos } from './provisional/sin-descuentos';
import { MemoriaCarritoRepositorio } from './repositorio/memoria-carrito.repositorio';

const CLIENTE = 'cliente-1';
const INICIO = new Date('2026-11-16T15:00:00.000Z');
const UN_DIA = 86_400_000;

class CatalogoFalso extends CatalogoParaCarrito {
  readonly productos = new Map<string, ProductoParaCarrito>();

  poner(parcial: Partial<ProductoParaCarrito> & { id: string }): void {
    this.productos.set(parcial.id, {
      nombre: parcial.id,
      precioCentavos: 100,
      estado: 'disponible',
      existencias: null,
      enHorario: true,
      ...this.productos.get(parcial.id),
      ...parcial,
    });
  }

  obtenerProductos(ids: readonly string[]): Promise<ProductoParaCarrito[]> {
    return Promise.resolve(
      ids.flatMap((id) => {
        const p = this.productos.get(id);
        return p ? [{ ...p }] : [];
      }),
    );
  }
}

/** Descuenta 10 centavos por unidad y registra con qué se le llamó. */
class DiezCentavosPorUnidad extends CalculadorDescuentos {
  llamadas: LineaParaDescuento[][] = [];

  calcular(lineas: readonly LineaParaDescuento[]): Promise<DescuentoDeLinea[]> {
    this.llamadas.push([...lineas]);
    return Promise.resolve(
      lineas.map((l) => ({ productoId: l.productoId, descuentoCentavos: 10 * l.cantidad })),
    );
  }
}

function preparar(descuentos: CalculadorDescuentos = new SinDescuentos()) {
  let ahora = INICIO;
  const catalogo = new CatalogoFalso();
  catalogo.poner({ id: 'capuchino', nombre: 'Capuchino', precioCentavos: 250 });
  catalogo.poner({ id: 'croissant', nombre: 'Croissant', precioCentavos: 185, existencias: 5 });
  catalogo.poner({ id: 'jugo', nombre: 'Jugo', estado: 'agotado' });
  const repositorio = new MemoriaCarritoRepositorio();
  const servicio = new CarritoService(
    repositorio,
    catalogo,
    descuentos,
    LIMITES_POR_DEFECTO,
    () => ahora,
  );
  const avanzar = (ms: number) => {
    ahora = new Date(ahora.getTime() + ms);
  };
  return { servicio, catalogo, repositorio, avanzar };
}

async function esperarError(promesa: Promise<unknown>): Promise<ErrorCarrito> {
  try {
    await promesa;
  } catch (e) {
    if (e instanceof ErrorCarrito) return e;
    throw e;
  }
  throw new Error('Se esperaba un ErrorCarrito');
}

describe('CarritoService', () => {
  describe('US1: armar el carrito', () => {
    it('empieza vacío', async () => {
      const { servicio } = preparar();
      const vista = await servicio.ver(CLIENTE);
      expect(vista.lineas).toEqual([]);
      expect(vista.actualizadoEn).toBeNull();
    });

    it('añade productos y suma la cantidad si el producto ya está', async () => {
      const { servicio } = preparar();
      await servicio.anadir(CLIENTE, 'capuchino', 1);
      await servicio.anadir(CLIENTE, 'croissant', 2);
      const vista = await servicio.anadir(CLIENTE, 'capuchino', 2);

      expect(vista.lineas.map((l) => [l.productoId, l.cantidad])).toEqual([
        ['capuchino', 3],
        ['croissant', 2],
      ]);
      expect(vista.totalCentavos).toBe(3 * 250 + 2 * 185);
      expect(vista.sePuedeConfirmar).toBe(true);
    });

    it('cambia cantidades, quita con 0 y recalcula el total', async () => {
      const { servicio } = preparar();
      await servicio.anadir(CLIENTE, 'capuchino', 3);
      await servicio.anadir(CLIENTE, 'croissant', 1);

      let vista = await servicio.cambiarCantidad(CLIENTE, 'capuchino', 1);
      expect(vista.totalCentavos).toBe(250 + 185);

      vista = await servicio.cambiarCantidad(CLIENTE, 'croissant', 0);
      expect(vista.lineas.map((l) => l.productoId)).toEqual(['capuchino']);
    });

    it('quitar es idempotente y vaciar deja el carrito sin líneas', async () => {
      const { servicio } = preparar();
      await servicio.anadir(CLIENTE, 'capuchino', 1);
      await servicio.quitar(CLIENTE, 'capuchino');
      const vista = await servicio.quitar(CLIENTE, 'capuchino');
      expect(vista.lineas).toEqual([]);

      await servicio.anadir(CLIENTE, 'croissant', 1);
      expect((await servicio.vaciar(CLIENTE)).lineas).toEqual([]);
    });

    it('rechaza añadir un producto agotado o inexistente', async () => {
      const { servicio } = preparar();
      const agotado = await esperarError(servicio.anadir(CLIENTE, 'jugo', 1));
      expect(agotado.codigo).toBe('no_disponible');
      expect(agotado.message).toBe('Jugo está agotado. Elige otro producto del menú.');

      const inexistente = await esperarError(servicio.anadir(CLIENTE, 'no-existe', 1));
      expect(inexistente.codigo).toBe('no_disponible');
    });

    it('recorta a las existencias y explica el ajuste', async () => {
      const { servicio } = preparar();
      const vista = await servicio.anadir(CLIENTE, 'croissant', 9);
      expect(vista.lineas[0].cantidad).toBe(5);
      expect(vista.ajuste).toEqual({
        productoId: 'croissant',
        solicitada: 9,
        aplicada: 5,
        motivo: 'Solo quedan 5 unidades de Croissant.',
      });
    });

    it('falla con sin_espacio si no cabe ninguna unidad más', async () => {
      const { servicio } = preparar();
      await servicio.anadir(CLIENTE, 'croissant', 5);
      const error = await esperarError(servicio.anadir(CLIENTE, 'croissant', 1));
      expect(error.codigo).toBe('sin_espacio');
      expect(error.message).toMatch(/Solo quedan 5 unidades/);
    });

    it('cambiar la cantidad de un producto que no está da no_esta_en_carrito', async () => {
      const { servicio } = preparar();
      const error = await esperarError(servicio.cambiarCantidad(CLIENTE, 'capuchino', 2));
      expect(error.codigo).toBe('no_esta_en_carrito');
    });

    it('permite reducir aunque el producto se haya agotado, pero no aumentar', async () => {
      const { servicio, catalogo } = preparar();
      await servicio.anadir(CLIENTE, 'capuchino', 3);
      catalogo.poner({ id: 'capuchino', estado: 'agotado' });

      const vista = await servicio.cambiarCantidad(CLIENTE, 'capuchino', 1);
      expect(vista.lineas[0].cantidad).toBe(1);

      const error = await esperarError(servicio.cambiarCantidad(CLIENTE, 'capuchino', 2));
      expect(error.codigo).toBe('no_disponible');
    });

    it('aplica los descuentos del puerto solo a productos que se pueden pedir', async () => {
      const descuentos = new DiezCentavosPorUnidad();
      const { servicio, catalogo } = preparar(descuentos);
      await servicio.anadir(CLIENTE, 'capuchino', 2);
      await servicio.anadir(CLIENTE, 'croissant', 1);
      catalogo.poner({ id: 'croissant', estado: 'agotado' });
      descuentos.llamadas = [];

      const vista = await servicio.ver(CLIENTE);

      expect(descuentos.llamadas).toEqual([
        [{ productoId: 'capuchino', cantidad: 2, precioUnitarioCentavos: 250 }],
      ]);
      expect(vista.descuentoCentavos).toBe(20);
      expect(vista.totalCentavos).toBe(500 - 20 + 185);
    });
  });

  describe('US2: persistencia y caducidad', () => {
    it('cada cliente tiene su propio carrito', async () => {
      const { servicio } = preparar();
      await servicio.anadir(CLIENTE, 'capuchino', 1);
      expect((await servicio.ver('otro-cliente')).lineas).toEqual([]);
      expect((await servicio.ver(CLIENTE)).lineas).toHaveLength(1);
    });

    it('se vacía tras 30 días sin actividad', async () => {
      const { servicio, repositorio, avanzar } = preparar();
      await servicio.anadir(CLIENTE, 'capuchino', 1);

      avanzar(30 * UN_DIA);
      expect((await servicio.ver(CLIENTE)).lineas).toHaveLength(1);

      avanzar(1);
      expect((await servicio.ver(CLIENTE)).lineas).toEqual([]);
      expect(await repositorio.obtener(CLIENTE)).toBeNull();
    });

    it('cualquier cambio renueva el plazo', async () => {
      const { servicio, avanzar } = preparar();
      await servicio.anadir(CLIENTE, 'capuchino', 1);
      avanzar(20 * UN_DIA);
      await servicio.anadir(CLIENTE, 'croissant', 1);
      avanzar(20 * UN_DIA);
      expect((await servicio.ver(CLIENTE)).lineas).toHaveLength(2);
    });

    it('eliminarDeCliente borra el carrito', async () => {
      const { servicio, repositorio } = preparar();
      await servicio.anadir(CLIENTE, 'capuchino', 1);
      await servicio.eliminarDeCliente(CLIENTE);
      expect(await repositorio.obtener(CLIENTE)).toBeNull();
    });
  });

  describe('US3: avisos antes de pagar', () => {
    it('avisa del cambio de precio hasta que el cliente lo acepta', async () => {
      const { servicio, catalogo } = preparar();
      await servicio.anadir(CLIENTE, 'capuchino', 2);
      catalogo.poner({ id: 'capuchino', precioCentavos: 280 });

      let vista = await servicio.ver(CLIENTE);
      expect(vista.avisos.map((a) => a.tipo)).toEqual(['cambio_de_precio']);
      expect(vista.totalCentavos).toBe(560);
      expect(vista.sePuedeConfirmar).toBe(false);

      vista = await servicio.aceptarPrecios(CLIENTE);
      expect(vista.avisos).toEqual([]);
      expect(vista.sePuedeConfirmar).toBe(true);
    });

    it('un producto agotado bloquea la confirmación hasta quitarlo', async () => {
      const { servicio, catalogo } = preparar();
      await servicio.anadir(CLIENTE, 'capuchino', 1);
      await servicio.anadir(CLIENTE, 'croissant', 1);
      catalogo.poner({ id: 'croissant', estado: 'agotado' });

      expect((await servicio.ver(CLIENTE)).sePuedeConfirmar).toBe(false);
      expect((await servicio.quitar(CLIENTE, 'croissant')).sePuedeConfirmar).toBe(true);
    });
  });
});
