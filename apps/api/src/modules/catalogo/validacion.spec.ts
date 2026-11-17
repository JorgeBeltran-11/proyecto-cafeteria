import { ErrorCatalogo } from './dominio/errores';
import {
  leerCambiosProducto,
  leerDisponibilidad,
  leerExcluir,
  leerHorario,
  leerMenuNuevo,
  leerProductoNuevo,
  validarProductoId,
} from './validacion';

function mensajeDe(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    if (e instanceof ErrorCatalogo) return e.message;
    throw e;
  }
  throw new Error('No lanzó ErrorCatalogo');
}

describe('validación de entrada del catálogo', () => {
  it('acepta un producto completo y pone valores por defecto', () => {
    expect(
      leerProductoNuevo({ id: 'capuchino', nombre: ' Capuchino ', precioCentavos: 250 }),
    ).toEqual({
      id: 'capuchino',
      nombre: 'Capuchino',
      descripcion: '',
      precioCentavos: 250,
      imagenUrl: null,
      imagenAlt: null,
      alergenos: null,
      existencias: null,
    });
  });

  it('rechaza precios con decimales (constitución VI)', () => {
    expect(
      mensajeDe(() => leerProductoNuevo({ id: 'x', nombre: 'X', precioCentavos: 2.5 })),
    ).toMatch(/entero/);
  });

  it('rechaza ids con mayúsculas o espacios', () => {
    expect(() => validarProductoId('Cafe Americano')).toThrow(ErrorCatalogo);
  });

  it('solo acepta imágenes https o rutas del sitio', () => {
    const base = { id: 'x', nombre: 'X', precioCentavos: 1 };
    expect(leerProductoNuevo({ ...base, imagenUrl: '/menu/x.svg' }).imagenUrl).toBe('/menu/x.svg');
    expect(leerProductoNuevo({ ...base, imagenUrl: 'https://cdn.ejemplo.com/x.png' }).imagenUrl).toBe(
      'https://cdn.ejemplo.com/x.png',
    );
    expect(mensajeDe(() => leerProductoNuevo({ ...base, imagenUrl: 'javascript:alert(1)' }))).toMatch(
      /https/,
    );
    expect(() => leerProductoNuevo({ ...base, imagenUrl: '//otro.com/x.png' })).toThrow(ErrorCatalogo);
  });

  it('valida los alérgenos contra la lista cerrada', () => {
    const base = { id: 'x', nombre: 'X', precioCentavos: 1 };
    expect(leerProductoNuevo({ ...base, alergenos: ['leche', 'leche'] }).alergenos).toEqual(['leche']);
    expect(leerProductoNuevo({ ...base, alergenos: [] }).alergenos).toEqual([]);
    expect(() => leerProductoNuevo({ ...base, alergenos: ['chocolate'] })).toThrow(ErrorCatalogo);
  });

  it('exige la revisión al editar (FR-011)', () => {
    expect(mensajeDe(() => leerCambiosProducto({ precioCentavos: 300 }))).toMatch(/revision/);
    expect(leerCambiosProducto({ revision: 2, precioCentavos: 300 })).toEqual({
      revision: 2,
      cambios: { precioCentavos: 300 },
    });
  });

  it('valida las franjas horarias', () => {
    expect(leerHorario([{ dias: [5, 1, 1], desde: '07:00', hasta: '11:00' }])).toEqual([
      { dias: [1, 5], desde: '07:00', hasta: '11:00' },
    ]);
    expect(leerHorario(null)).toBeNull();
    expect(mensajeDe(() => leerHorario([{ dias: [1], desde: '22:00', hasta: '02:00' }]))).toMatch(
      /dos franjas/,
    );
    expect(() => leerHorario([{ dias: [8], desde: '07:00', hasta: '08:00' }])).toThrow(ErrorCatalogo);
    expect(() => leerHorario([{ dias: [1], desde: '7:00', hasta: '08:00' }])).toThrow(ErrorCatalogo);
  });

  it('lee un menú nuevo con categorías', () => {
    expect(
      leerMenuNuevo({ nombre: 'Carta', categorias: [{ nombre: 'Bebidas', productoIds: ['capuchino'] }] }),
    ).toEqual({
      nombre: 'Carta',
      horario: null,
      categorias: [{ nombre: 'Bebidas', productoIds: ['capuchino'] }],
    });
  });

  it('la disponibilidad necesita al menos un campo', () => {
    expect(() => leerDisponibilidad({})).toThrow(ErrorCatalogo);
    expect(leerDisponibilidad({ existencias: null })).toEqual({ existencias: null });
  });

  it('lee los alérgenos a excluir de la consulta', () => {
    expect(leerExcluir(undefined)).toEqual([]);
    expect(leerExcluir('gluten, leche,gluten')).toEqual(['gluten', 'leche']);
    expect(mensajeDe(() => leerExcluir('gluten,polen'))).toMatch(/"polen"/);
  });
});
