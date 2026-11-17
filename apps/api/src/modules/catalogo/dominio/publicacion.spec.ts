import type { BorradorMenu, ContenidoVersion, ProductoActual } from './contenido';
import {
  armarContenido,
  problemasParaPublicar,
  resumirCambios,
  textoDinero,
} from './publicacion';

function producto(id: string, cambios: Partial<ProductoActual> = {}): ProductoActual {
  return {
    id,
    nombre: id,
    descripcion: `Descripción de ${id}`,
    precioCentavos: 250,
    imagenUrl: `/menu/${id}.svg`,
    imagenAlt: `Foto de ${id}`,
    alergenos: [],
    agotado: false,
    existencias: null,
    retirado: false,
    ...cambios,
  };
}

function mapa(...productos: ProductoActual[]): Map<string, ProductoActual> {
  return new Map(productos.map((p) => [p.id, p]));
}

const BORRADOR: BorradorMenu = {
  nombre: 'Carta',
  horario: null,
  categorias: [{ nombre: 'Bebidas', productoIds: ['capuchino'] }],
};

describe('publicación de menús', () => {
  it('un borrador completo se puede publicar', () => {
    expect(problemasParaPublicar(BORRADOR, mapa(producto('capuchino')))).toEqual([]);
  });

  it('bloquea productos sin texto alternativo o sin alérgenos (FR-004)', () => {
    const problemas = problemasParaPublicar(
      BORRADOR,
      mapa(producto('capuchino', { imagenAlt: '  ', alergenos: null })),
    );
    expect(problemas).toHaveLength(2);
    expect(problemas[0]).toMatch(/texto alternativo/);
    expect(problemas[1]).toMatch(/alérgenos/);
  });

  it('bloquea productos sin imagen, inexistentes o retirados', () => {
    const borrador: BorradorMenu = {
      ...BORRADOR,
      categorias: [{ nombre: 'Bebidas', productoIds: ['a', 'b', 'c'] }],
    };
    const problemas = problemasParaPublicar(
      borrador,
      mapa(producto('a', { imagenUrl: null }), producto('c', { retirado: true })),
    );
    expect(problemas.join(' ')).toMatch(/"a" no tiene imagen/);
    expect(problemas.join(' ')).toMatch(/"b" no existe/);
    expect(problemas.join(' ')).toMatch(/"c" está retirado/);
  });

  it('bloquea un menú vacío o sin nombre', () => {
    const problemas = problemasParaPublicar(
      { nombre: ' ', horario: null, categorias: [{ nombre: 'Vacía', productoIds: [] }] },
      mapa(),
    );
    expect(problemas).toHaveLength(2);
  });

  it('bloquea un producto repetido en la misma categoría', () => {
    const problemas = problemasParaPublicar(
      { ...BORRADOR, categorias: [{ nombre: 'Bebidas', productoIds: ['capuchino', 'capuchino'] }] },
      mapa(producto('capuchino')),
    );
    expect(problemas).toEqual([expect.stringMatching(/repetido/)]);
  });

  it('la versión copia los datos actuales del producto', () => {
    const contenido = armarContenido(BORRADOR, mapa(producto('capuchino', { precioCentavos: 275 })));
    expect(contenido.categorias[0].productos[0]).toMatchObject({
      id: 'capuchino',
      precioCentavos: 275,
      alergenos: [],
    });
  });

  it('formatea el dinero con enteros', () => {
    expect(textoDinero(275)).toBe('$2,75');
    expect(textoDinero(1005)).toBe('$10,05');
    expect(textoDinero(0)).toBe('$0,00');
  });
});

describe('resumen de cambios entre versiones', () => {
  const v1: ContenidoVersion = armarContenido(
    {
      nombre: 'Carta',
      horario: null,
      categorias: [{ nombre: 'Bebidas', productoIds: ['capuchino', 'te'] }],
    },
    mapa(producto('capuchino'), producto('te', { precioCentavos: 100 })),
  );

  it('la primera versión lo dice', () => {
    expect(resumirCambios(null, v1)).toEqual(['Primera publicación.']);
  });

  it('detecta precio, productos añadidos y quitados', () => {
    const v2 = armarContenido(
      {
        nombre: 'Carta',
        horario: null,
        categorias: [{ nombre: 'Bebidas', productoIds: ['capuchino', 'jugo'] }],
      },
      mapa(producto('capuchino', { precioCentavos: 275 }), producto('jugo', { precioCentavos: 300 })),
    );
    expect(resumirCambios(v1, v2)).toEqual([
      'Precio de capuchino: $2,50 → $2,75.',
      'Producto añadido: jugo ($3,00).',
      'Producto quitado: te.',
    ]);
  });

  it('detecta horario y categorías', () => {
    const v2: ContenidoVersion = {
      ...v1,
      horario: [{ dias: [6, 7], desde: '08:00', hasta: '12:00' }],
      categorias: [{ ...v1.categorias[0], nombre: 'Cafés' }],
    };
    expect(resumirCambios(v1, v2)).toEqual([
      'Horario: Disponible a cualquier hora → Sábado y domingo de 08:00 a 12:00.',
      'Categoría añadida: Cafés.',
      'Categoría quitada: Bebidas.',
    ]);
  });

  it('sin diferencias lo indica', () => {
    expect(resumirCambios(v1, v1)).toEqual(['Sin cambios de contenido.']);
  });
});
