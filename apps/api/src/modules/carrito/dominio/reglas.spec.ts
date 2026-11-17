import type { ProductoParaCarrito } from '../puertos/catalogo.puerto';
import {
  calcularVista,
  type CarritoGuardado,
  estaCaducado,
  formatearCentavos,
  LIMITES_POR_DEFECTO,
  type LineaGuardada,
  maximoPorProducto,
  motivoNoSePuedeAnadir,
  resolverCantidad,
} from './reglas';

const AHORA = new Date('2026-11-16T15:00:00.000Z');

function producto(parcial: Partial<ProductoParaCarrito> = {}): ProductoParaCarrito {
  return {
    id: 'capuchino',
    nombre: 'Capuchino',
    precioCentavos: 250,
    estado: 'disponible',
    existencias: null,
    enHorario: true,
    ...parcial,
  };
}

function linea(parcial: Partial<LineaGuardada> = {}): LineaGuardada {
  return {
    productoId: 'capuchino',
    cantidad: 1,
    precioVistoCentavos: 250,
    anadidaEn: AHORA,
    ...parcial,
  };
}

function carrito(lineas: LineaGuardada[]): CarritoGuardado {
  return { clienteId: 'cliente-1', lineas, actualizadoEn: AHORA };
}

function mapa(...productos: ProductoParaCarrito[]): Map<string, ProductoParaCarrito> {
  return new Map(productos.map((p) => [p.id, p]));
}

describe('formatearCentavos', () => {
  it.each([
    [0, '$0,00'],
    [5, '$0,05'],
    [250, '$2,50'],
    [123456, '$1234,56'],
    [-75, '-$0,75'],
  ])('%i → %s', (centavos, texto) => {
    expect(formatearCentavos(centavos)).toBe(texto);
  });
});

describe('estaCaducado', () => {
  const hace = (dias: number) => new Date(AHORA.getTime() - dias * 86_400_000);

  it('no caduca justo a los 30 días', () => {
    expect(estaCaducado(hace(30), AHORA, 30)).toBe(false);
  });

  it('caduca pasados los 30 días', () => {
    expect(estaCaducado(new Date(hace(30).getTime() - 1), AHORA, 30)).toBe(true);
  });
});

describe('motivoNoSePuedeAnadir', () => {
  it('permite productos disponibles, también fuera de horario', () => {
    expect(motivoNoSePuedeAnadir(producto())).toBeNull();
    expect(motivoNoSePuedeAnadir(producto({ enHorario: false }))).toBeNull();
  });

  it('rechaza productos agotados, retirados o inexistentes', () => {
    expect(motivoNoSePuedeAnadir(producto({ estado: 'agotado' }))).toBe(
      'Capuchino está agotado.',
    );
    expect(motivoNoSePuedeAnadir(producto({ estado: 'retirado' }))).toMatch(
      /ya no está en el menú/,
    );
    expect(motivoNoSePuedeAnadir(undefined)).toMatch(/ya no está en el menú/);
  });
});

describe('maximoPorProducto', () => {
  it('usa el límite por producto si no hay control de existencias', () => {
    expect(maximoPorProducto(producto(), LIMITES_POR_DEFECTO)).toBe(20);
  });

  it('usa las existencias si son menores que el límite', () => {
    expect(maximoPorProducto(producto({ existencias: 5 }), LIMITES_POR_DEFECTO)).toBe(5);
  });

  it('es 0 si el producto no se puede pedir', () => {
    expect(
      maximoPorProducto(producto({ estado: 'agotado' }), LIMITES_POR_DEFECTO),
    ).toBe(0);
  });
});

describe('resolverCantidad', () => {
  it('aplica la cantidad pedida si cabe', () => {
    const r = resolverCantidad({
      lineas: [],
      producto: producto(),
      deseada: 3,
      limites: LIMITES_POR_DEFECTO,
    });
    expect(r).toEqual({ aplicada: 3 });
  });

  it('recorta a las existencias y lo explica', () => {
    const r = resolverCantidad({
      lineas: [],
      producto: producto({ existencias: 5 }),
      deseada: 9,
      limites: LIMITES_POR_DEFECTO,
    });
    expect(r.aplicada).toBe(5);
    expect(r.ajuste).toEqual({
      productoId: 'capuchino',
      solicitada: 9,
      aplicada: 5,
      motivo: 'Solo quedan 5 unidades de Capuchino.',
    });
  });

  it('recorta al máximo por producto', () => {
    const r = resolverCantidad({
      lineas: [],
      producto: producto(),
      deseada: 25,
      limites: LIMITES_POR_DEFECTO,
    });
    expect(r.aplicada).toBe(20);
    expect(r.ajuste?.motivo).toBe('El máximo por producto es 20 unidades.');
  });

  it('recorta al máximo del carrito contando las otras líneas', () => {
    const r = resolverCantidad({
      lineas: [
        linea({ productoId: 'otro', cantidad: 20 }),
        linea({ productoId: 'otro-mas', cantidad: 20 }),
        linea({ cantidad: 2 }),
      ],
      producto: producto(),
      deseada: 15,
      limites: LIMITES_POR_DEFECTO,
    });
    expect(r.aplicada).toBe(10);
    expect(r.ajuste?.motivo).toBe(
      'El carrito admite como máximo 50 unidades en total.',
    );
  });

  it('devuelve 0 si el carrito está lleno', () => {
    const r = resolverCantidad({
      lineas: [
        linea({ productoId: 'a', cantidad: 20 }),
        linea({ productoId: 'b', cantidad: 20 }),
        linea({ productoId: 'c', cantidad: 10 }),
      ],
      producto: producto(),
      deseada: 1,
      limites: LIMITES_POR_DEFECTO,
    });
    expect(r.aplicada).toBe(0);
  });
});

describe('calcularVista', () => {
  it('devuelve un carrito vacío que no se puede confirmar', () => {
    const vista = calcularVista({
      carrito: null,
      productos: new Map(),
      descuentos: [],
      limites: LIMITES_POR_DEFECTO,
    });
    expect(vista).toEqual({
      lineas: [],
      totalUnidades: 0,
      subtotalCentavos: 0,
      descuentoCentavos: 0,
      totalCentavos: 0,
      avisos: [],
      sePuedeConfirmar: false,
      limites: { porProducto: 20, porCarrito: 50 },
      actualizadoEn: null,
    });
  });

  it('calcula totales exactos en centavos', () => {
    const vista = calcularVista({
      carrito: carrito([
        linea({ cantidad: 3 }),
        linea({
          productoId: 'croissant',
          cantidad: 2,
          precioVistoCentavos: 185,
          anadidaEn: new Date(AHORA.getTime() + 1),
        }),
      ]),
      productos: mapa(
        producto(),
        producto({ id: 'croissant', nombre: 'Croissant', precioCentavos: 185 }),
      ),
      descuentos: [],
      limites: LIMITES_POR_DEFECTO,
    });

    expect(vista.lineas.map((l) => [l.productoId, l.totalCentavos])).toEqual([
      ['capuchino', 750],
      ['croissant', 370],
    ]);
    expect(vista.totalUnidades).toBe(5);
    expect(vista.subtotalCentavos).toBe(1120);
    expect(vista.totalCentavos).toBe(1120);
    expect(vista.sePuedeConfirmar).toBe(true);
    expect(vista.actualizadoEn).toBe(AHORA.toISOString());
  });

  it('ordena las líneas por orden de llegada', () => {
    const vista = calcularVista({
      carrito: carrito([
        linea({ productoId: 'b', anadidaEn: new Date(AHORA.getTime() + 10) }),
        linea({ productoId: 'a' }),
      ]),
      productos: mapa(producto({ id: 'a' }), producto({ id: 'b' })),
      descuentos: [],
      limites: LIMITES_POR_DEFECTO,
    });
    expect(vista.lineas.map((l) => l.productoId)).toEqual(['a', 'b']);
  });

  it('aplica descuentos recortados entre 0 y el subtotal', () => {
    const vista = calcularVista({
      carrito: carrito([
        linea({ cantidad: 2 }),
        linea({ productoId: 'croissant', precioVistoCentavos: 185 }),
      ]),
      productos: mapa(
        producto(),
        producto({ id: 'croissant', precioCentavos: 185 }),
      ),
      descuentos: [
        { productoId: 'capuchino', descuentoCentavos: 9999 },
        { productoId: 'croissant', descuentoCentavos: -50 },
      ],
      limites: LIMITES_POR_DEFECTO,
    });

    expect(vista.lineas[0].descuentoCentavos).toBe(500);
    expect(vista.lineas[0].totalCentavos).toBe(0);
    expect(vista.lineas[1].descuentoCentavos).toBe(0);
    expect(vista.descuentoCentavos).toBe(500);
    expect(vista.totalCentavos).toBe(185);
  });

  it('avisa del cambio de precio con ambos precios y calcula con el nuevo', () => {
    const vista = calcularVista({
      carrito: carrito([linea({ cantidad: 2, precioVistoCentavos: 250 })]),
      productos: mapa(producto({ precioCentavos: 280 })),
      descuentos: [],
      limites: LIMITES_POR_DEFECTO,
    });

    expect(vista.totalCentavos).toBe(560);
    expect(vista.avisos).toEqual([
      {
        tipo: 'cambio_de_precio',
        productoId: 'capuchino',
        mensaje: 'El precio de Capuchino cambió de $2,50 a $2,80.',
        bloqueaConfirmacion: true,
        precioAnteriorCentavos: 250,
        precioNuevoCentavos: 280,
      },
    ]);
    expect(vista.sePuedeConfirmar).toBe(false);
  });

  it.each([
    ['agotado', producto({ estado: 'agotado' })],
    ['retirado', producto({ estado: 'retirado' })],
    ['fuera_de_horario', producto({ enHorario: false })],
  ] as const)('avisa de %s y bloquea la confirmación', (tipo, prod) => {
    const vista = calcularVista({
      carrito: carrito([linea()]),
      productos: mapa(prod),
      descuentos: [],
      limites: LIMITES_POR_DEFECTO,
    });
    expect(vista.avisos.map((a) => a.tipo)).toEqual([tipo]);
    expect(vista.avisos[0].bloqueaConfirmacion).toBe(true);
    expect(vista.sePuedeConfirmar).toBe(false);
  });

  it('trata un producto que ya no existe como retirado, con su último precio', () => {
    const vista = calcularVista({
      carrito: carrito([linea({ cantidad: 2 })]),
      productos: new Map(),
      descuentos: [],
      limites: LIMITES_POR_DEFECTO,
    });
    expect(vista.lineas[0].totalCentavos).toBe(500);
    expect(vista.lineas[0].maximoPermitido).toBe(0);
    expect(vista.avisos.map((a) => a.tipo)).toEqual(['retirado']);
  });

  it('avisa si la cantidad supera las existencias actuales', () => {
    const vista = calcularVista({
      carrito: carrito([linea({ cantidad: 8 })]),
      productos: mapa(producto({ existencias: 5 })),
      descuentos: [],
      limites: LIMITES_POR_DEFECTO,
    });
    expect(vista.avisos[0]).toMatchObject({
      tipo: 'supera_existencias',
      mensaje: expect.stringContaining('Solo quedan 5 unidades') as string,
    });
    expect(vista.lineas[0].maximoPermitido).toBe(5);
  });

  it('limita el máximo de cada línea al espacio libre del carrito', () => {
    const vista = calcularVista({
      carrito: carrito([
        linea({ productoId: 'a', cantidad: 20 }),
        linea({ productoId: 'b', cantidad: 20 }),
        linea({ cantidad: 5 }),
      ]),
      productos: mapa(producto({ id: 'a' }), producto({ id: 'b' }), producto()),
      descuentos: [],
      limites: LIMITES_POR_DEFECTO,
    });
    const capuchino = vista.lineas.find((l) => l.productoId === 'capuchino');
    expect(capuchino?.maximoPermitido).toBe(10);
  });
});
