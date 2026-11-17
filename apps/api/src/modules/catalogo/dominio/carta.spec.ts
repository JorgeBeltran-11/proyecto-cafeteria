import type { EstadoVivo, ProductoEnVersion } from './contenido';
import { armarCarta, type MenuParaCarta, menuPublico } from './carta';

/** Lunes 2026-11-16, 08:00 en Ecuador. */
const LUNES_8 = new Date('2026-11-16T08:00:00-05:00');
const LUNES_12 = new Date('2026-11-16T12:00:00-05:00');

function p(id: string, cambios: Partial<ProductoEnVersion> = {}): ProductoEnVersion {
  return {
    id,
    nombre: id,
    descripcion: '',
    precioCentavos: 200,
    imagenUrl: `/menu/${id}.svg`,
    imagenAlt: id,
    alergenos: [],
    ...cambios,
  };
}

const VIVO: EstadoVivo = { agotado: false, existencias: null, retirado: false };

function estados(extra: Record<string, Partial<EstadoVivo>> = {}): Map<string, EstadoVivo> {
  const ids = ['cafe', 'pan', 'jugo', 'tostada'];
  return new Map(ids.map((id) => [id, { ...VIVO, ...extra[id] }]));
}

const CARTA: MenuParaCarta = {
  id: 'm1',
  version: 3,
  contenido: {
    nombre: 'Carta',
    horario: null,
    categorias: [
      { nombre: 'Bebidas', productos: [p('cafe', { alergenos: ['leche'] }), p('jugo')] },
      { nombre: 'Panadería', productos: [p('pan', { alergenos: ['gluten', 'huevo'] })] },
    ],
  },
};

const DESAYUNO: MenuParaCarta = {
  id: 'm2',
  version: 1,
  contenido: {
    nombre: 'Desayunos',
    horario: [{ dias: [1, 2, 3, 4, 5], desde: '07:00', hasta: '11:00' }],
    categorias: [
      { nombre: 'Bebidas', productos: [p('cafe', { alergenos: ['leche'] })] },
      { nombre: 'Platos', productos: [p('tostada')] },
    ],
  },
};

describe('carta pública', () => {
  it('muestra categorías y productos disponibles', () => {
    const menu = menuPublico(CARTA, estados(), LUNES_8);
    expect(menu.version).toBe(3);
    expect(menu.disponibleAhora).toBe(true);
    expect(menu.categorias.map((c) => c.nombre)).toEqual(['Bebidas', 'Panadería']);
    expect(menu.categorias[1].productos[0].alergenos.map((a) => a.nombre)).toEqual([
      'Gluten',
      'Huevo',
    ]);
    expect(menu.categorias[0].productos[0]).toMatchObject({
      disponibilidad: 'disponible',
      textoDisponibilidad: 'Disponible',
      sePuedePedir: true,
    });
  });

  it('un producto agotado lo dice con texto y no se puede pedir (US1-2)', () => {
    const menu = menuPublico(CARTA, estados({ jugo: { agotado: true } }), LUNES_8);
    expect(menu.categorias[0].productos[1]).toMatchObject({
      disponibilidad: 'agotado',
      textoDisponibilidad: 'Agotado',
      sePuedePedir: false,
    });
  });

  it('existencias en cero cuentan como agotado; pocas existencias se avisan', () => {
    const menu = menuPublico(
      CARTA,
      estados({ jugo: { existencias: 0 }, cafe: { existencias: 3 } }),
      LUNES_8,
    );
    expect(menu.categorias[0].productos[0].textoDisponibilidad).toBe('Disponible: quedan 3');
    expect(menu.categorias[0].productos[1].disponibilidad).toBe('agotado');
  });

  it('fuera de horario indica cuándo estará disponible (US1-3)', () => {
    const menu = menuPublico(DESAYUNO, estados(), LUNES_12);
    expect(menu.disponibleAhora).toBe(false);
    expect(menu.proximaApertura).toBe('Mañana a las 07:00');
    expect(menu.categorias[1].productos[0]).toMatchObject({
      disponibilidad: 'fuera_de_horario',
      textoDisponibilidad: 'Fuera de horario. Disponible: mañana a las 07:00',
      sePuedePedir: false,
    });
  });

  it('filtra por alérgenos a excluir y oculta categorías vacías (US1-4)', () => {
    const menu = menuPublico(CARTA, estados(), LUNES_8, ['gluten', 'leche']);
    expect(menu.categorias).toEqual([
      expect.objectContaining({ nombre: 'Bebidas', productos: [expect.objectContaining({ id: 'jugo' })] }),
    ]);
  });

  it('oculta productos retirados', () => {
    const menu = menuPublico(CARTA, estados({ pan: { retirado: true } }), LUNES_8);
    expect(menu.categorias.map((c) => c.nombre)).toEqual(['Bebidas']);
  });

  it('dos menús vigentes: un producto aparece una sola vez por categoría', () => {
    const carta = armarCarta([DESAYUNO, CARTA], estados(), LUNES_8);
    expect(carta.menus.map((m) => m.nombre)).toEqual(['Carta', 'Desayunos']);
    const desayuno = carta.menus[1];
    expect(desayuno.categorias.map((c) => c.nombre)).toEqual(['Platos']);
  });

  it('los menús abiertos van primero', () => {
    const carta = armarCarta([CARTA, DESAYUNO], estados(), LUNES_12);
    expect(carta.menus.map((m) => m.disponibleAhora)).toEqual([true, false]);
    expect(carta.generadaEn).toBe(LUNES_12.toISOString());
  });
});
