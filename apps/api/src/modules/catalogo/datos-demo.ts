/**
 * Menú de ejemplo para desarrollo (research R10). Solo se carga si CATALOGO_DATOS_DEMO=true,
 * fuera de producción y de los tests, y cuando todavía no existe ningún menú.
 * Los ids coinciden con los productos de prueba del carrito (spec 004).
 */
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { CatalogoService } from './catalogo.service';
import type { UsuarioCatalogo } from './puertos/roles';
import type { ProductoNuevo } from './validacion';

const SISTEMA: UsuarioCatalogo = { id: 'datos-demo', rol: 'admin' };

const PRODUCTOS: ProductoNuevo[] = [
  {
    id: 'cafe-americano',
    nombre: 'Café americano',
    descripcion: 'Café de altura de Loja, filtrado y servido en taza de 240 ml.',
    precioCentavos: 150,
    imagenUrl: '/menu/taza.svg',
    imagenAlt: 'Taza de café negro vista de lado',
    alergenos: [],
    existencias: null,
  },
  {
    id: 'capuchino',
    nombre: 'Capuchino',
    descripcion: 'Espresso doble con leche vaporizada y espuma.',
    precioCentavos: 250,
    imagenUrl: '/menu/taza.svg',
    imagenAlt: 'Taza de capuchino con espuma',
    alergenos: ['leche'],
    existencias: null,
  },
  {
    id: 'croissant',
    nombre: 'Croissant',
    descripcion: 'Croissant de mantequilla horneado cada mañana.',
    precioCentavos: 185,
    imagenUrl: '/menu/croissant.svg',
    imagenAlt: 'Croissant dorado sobre un plato',
    alergenos: ['gluten', 'leche', 'huevo'],
    existencias: 5,
  },
  {
    id: 'jugo-naranja',
    nombre: 'Jugo de naranja',
    descripcion: 'Naranjas exprimidas al momento, sin azúcar añadida.',
    precioCentavos: 300,
    imagenUrl: '/menu/vaso.svg',
    imagenAlt: 'Vaso alto de jugo de naranja',
    alergenos: [],
    existencias: null,
  },
  {
    id: 'desayuno-andino',
    nombre: 'Desayuno andino',
    descripcion: 'Mote pillo, queso fresco, huevo y café o aguita aromática.',
    precioCentavos: 650,
    imagenUrl: '/menu/plato.svg',
    imagenAlt: 'Plato con mote pillo, queso y huevo',
    alergenos: ['leche', 'huevo'],
    existencias: null,
  },
];

@Injectable()
export class DatosDemoCatalogo implements OnApplicationBootstrap {
  private readonly logger = new Logger(DatosDemoCatalogo.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly catalogo: CatalogoService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (
      this.config.get<string>('CATALOGO_DATOS_DEMO') !== 'true' ||
      process.env.NODE_ENV === 'production' ||
      process.env.NODE_ENV === 'test'
    ) {
      return;
    }
    try {
      if ((await this.prisma.menu.count()) > 0) return;
      await this.cargar();
      this.logger.log('Menú de ejemplo cargado (CATALOGO_DATOS_DEMO=true).');
    } catch {
      // La BD puede no estar preparada (pnpm db:setup): /health ya lo informa.
      this.logger.warn('No se pudo cargar el menú de ejemplo; ¿ejecutaste pnpm db:setup?');
    }
  }

  private async cargar(): Promise<void> {
    for (const producto of PRODUCTOS) {
      if (!(await this.prisma.producto.findUnique({ where: { id: producto.id } }))) {
        await this.catalogo.crearProducto(producto, SISTEMA);
      }
    }
    await this.catalogo.cambiarDisponibilidad('jugo-naranja', { agotado: true }, SISTEMA);

    const ahora = new Date();
    const carta = await this.catalogo.crearMenu(
      {
        nombre: 'Carta de la casa',
        horario: null,
        categorias: [
          { nombre: 'Bebidas', productoIds: ['cafe-americano', 'capuchino', 'jugo-naranja'] },
          { nombre: 'Panadería', productoIds: ['croissant'] },
        ],
      },
      SISTEMA,
    );
    await this.catalogo.publicar(carta.id, carta.revision, SISTEMA, ahora);

    const desayunos = await this.catalogo.crearMenu(
      {
        nombre: 'Desayunos',
        horario: [{ dias: [1, 2, 3, 4, 5, 6, 7], desde: '07:00', hasta: '11:00' }],
        categorias: [{ nombre: 'Platos', productoIds: ['desayuno-andino'] }],
      },
      SISTEMA,
    );
    await this.catalogo.publicar(desayunos.id, desayunos.revision, SISTEMA, ahora);
  }
}
