import { Injectable } from '@nestjs/common';
import type {
  Alergeno,
  CartaPublica,
  DisponibilidadVista,
  EstadoMenu,
  MenuAdmin,
  MenuPublico,
  ProductoAdmin,
  VersionMenuResumen,
} from '@cafeteria/shared';
import {
  Prisma,
  type Menu as FilaMenu,
  type Producto as FilaProducto,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CatalogoParaCarrito,
  type ProductoParaCarrito,
} from '../carrito/puertos/catalogo.puerto';
import { armarCarta, type MenuParaCarta, menuPublico } from './dominio/carta';
import {
  type BorradorMenu,
  type ContenidoVersion,
  type EstadoVivo,
  estaAgotado,
  type ProductoActual,
} from './dominio/contenido';
import { ErrorCatalogo } from './dominio/errores';
import { estaEnHorario } from './dominio/horario';
import {
  armarContenido,
  problemasParaPublicar,
  resumirCambios,
} from './dominio/publicacion';
import type { UsuarioCatalogo } from './puertos/roles';
import type {
  CambiosDisponibilidad,
  CambiosMenu,
  DatosProducto,
  ProductoNuevo,
} from './validacion';

type Tx = Prisma.TransactionClient;

interface VersionPublicada extends MenuParaCarta {
  publicadaEn: Date;
}

function leerJson<T>(texto: string): T {
  return JSON.parse(texto) as T;
}

function alergenosDe(fila: FilaProducto): Alergeno[] | null {
  return fila.alergenos === null ? null : leerJson<Alergeno[]>(fila.alergenos);
}

function productoActual(fila: FilaProducto): ProductoActual {
  return {
    id: fila.id,
    nombre: fila.nombre,
    descripcion: fila.descripcion,
    precioCentavos: fila.precioCentavos,
    imagenUrl: fila.imagenUrl,
    imagenAlt: fila.imagenAlt,
    alergenos: alergenosDe(fila),
    agotado: fila.agotado,
    existencias: fila.existencias,
    retirado: fila.retirado,
  };
}

function productoAdmin(fila: FilaProducto): ProductoAdmin {
  return {
    ...productoActual(fila),
    revision: fila.revision,
    actualizadoEn: fila.actualizadoEn.toISOString(),
  };
}

function disponibilidad(fila: FilaProducto): DisponibilidadVista {
  return {
    id: fila.id,
    nombre: fila.nombre,
    agotado: fila.agotado,
    existencias: fila.existencias,
    retirado: fila.retirado,
  };
}

function menuAdmin(fila: FilaMenu): MenuAdmin {
  const borrador = leerJson<BorradorMenu>(fila.borrador);
  return {
    id: fila.id,
    estado: fila.estado as EstadoMenu,
    nombre: borrador.nombre,
    horario: borrador.horario,
    categorias: borrador.categorias,
    versionPublicada: fila.versionPublicada,
    revision: fila.revision,
    actualizadoEn: fila.actualizadoEn.toISOString(),
  };
}

function borradorDesde(contenido: ContenidoVersion): BorradorMenu {
  return {
    nombre: contenido.nombre,
    horario: contenido.horario,
    categorias: contenido.categorias.map((c) => ({
      nombre: c.nombre,
      productoIds: c.productos.map((p) => p.id),
    })),
  };
}

function datosParaPrisma(
  datos: Partial<DatosProducto>,
): Prisma.ProductoUpdateManyMutationInput {
  const { alergenos, ...resto } = datos;
  return {
    ...resto,
    ...(alergenos !== undefined
      ? { alergenos: alergenos === null ? null : JSON.stringify(alergenos) }
      : {}),
  };
}

function noEncontrado(que: string): ErrorCatalogo {
  return new ErrorCatalogo('no_encontrado', `${que} no existe.`);
}

function conflicto(que: string): ErrorCatalogo {
  return new ErrorCatalogo(
    'conflicto_edicion',
    `Otra persona guardó cambios en ${que} después de que lo abrieras. Vuelve a cargarlo, revisa sus cambios y guarda de nuevo.`,
  );
}

/**
 * Casos de uso del catálogo (spec 003). También es el adaptador del puerto del carrito
 * (contracts/dependencias.md §2) y ofrece `descontarExistencias` a pedidos (§3).
 */
@Injectable()
export class CatalogoService extends CatalogoParaCarrito {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  // -------------------------------------------------------------------------
  // Tienda
  // -------------------------------------------------------------------------

  async carta(ahora: Date, excluir: readonly Alergeno[]): Promise<CartaPublica> {
    const versiones = await this.versionesPublicadas();
    const estados = await this.estadosDe(versiones);
    return armarCarta(versiones, estados, ahora, excluir);
  }

  /** El borrador tal como lo verá el cliente (US2-4). */
  async vistaPrevia(menuId: string, ahora: Date): Promise<MenuPublico> {
    const menu = await this.filaMenu(menuId);
    const borrador = leerJson<BorradorMenu>(menu.borrador);
    const productos = await this.productosActuales(
      borrador.categorias.flatMap((c) => c.productoIds),
    );
    // Los productos que aún no existen no se pueden mostrar: se omiten de la vista previa.
    const borradorExistente: BorradorMenu = {
      ...borrador,
      categorias: borrador.categorias.map((c) => ({
        ...c,
        productoIds: c.productoIds.filter((id) => productos.has(id)),
      })),
    };
    const contenido = armarContenido(borradorExistente, productos);
    const estados = new Map<string, EstadoVivo>(productos);
    return menuPublico({ id: menu.id, version: null, contenido }, estados, ahora);
  }

  // -------------------------------------------------------------------------
  // Productos (administrador)
  // -------------------------------------------------------------------------

  async listarProductos(): Promise<ProductoAdmin[]> {
    const filas = await this.prisma.producto.findMany({ orderBy: { nombre: 'asc' } });
    return filas.map(productoAdmin);
  }

  async obtenerProducto(id: string): Promise<ProductoAdmin> {
    return productoAdmin(await this.filaProducto(id));
  }

  async crearProducto(datos: ProductoNuevo, usuario: UsuarioCatalogo): Promise<ProductoAdmin> {
    const existe = await this.prisma.producto.findUnique({ where: { id: datos.id } });
    if (existe) {
      throw new ErrorCatalogo(
        'ya_existe',
        `Ya existe un producto con el id "${datos.id}": elige otro id o edita el existente.`,
      );
    }
    const fila = await this.prisma.$transaction(async (tx) => {
      const creada = await tx.producto.create({
        data: {
          ...datos,
          alergenos: datos.alergenos === null ? null : JSON.stringify(datos.alergenos),
        },
      });
      await this.registrar(tx, 'producto', creada.id, 'crear', usuario.id, { datos });
      return creada;
    });
    return productoAdmin(fila);
  }

  async editarProducto(
    id: string,
    revision: number,
    cambios: Partial<DatosProducto>,
    usuario: UsuarioCatalogo,
  ): Promise<ProductoAdmin> {
    const antes = await this.filaProducto(id);
    const fila = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.producto.updateMany({
        where: { id, revision },
        data: { ...datosParaPrisma(cambios), revision: { increment: 1 } },
      });
      if (count === 0) throw conflicto(`el producto "${antes.nombre}"`);

      const detalle: Record<string, [unknown, unknown]> = {};
      const previo = productoActual(antes);
      for (const [campo, valor] of Object.entries(cambios)) {
        const anterior = previo[campo as keyof ProductoActual];
        if (JSON.stringify(anterior) !== JSON.stringify(valor)) detalle[campo] = [anterior, valor];
      }
      await this.registrar(tx, 'producto', id, 'editar', usuario.id, detalle);
      return tx.producto.findUniqueOrThrow({ where: { id } });
    });
    return productoAdmin(fila);
  }

  // -------------------------------------------------------------------------
  // Menús (administrador)
  // -------------------------------------------------------------------------

  async listarMenus(): Promise<MenuAdmin[]> {
    const filas = await this.prisma.menu.findMany({ orderBy: { creadoEn: 'asc' } });
    return filas.map(menuAdmin);
  }

  async obtenerMenu(id: string): Promise<MenuAdmin> {
    return menuAdmin(await this.filaMenu(id));
  }

  async crearMenu(datos: Required<CambiosMenu>, usuario: UsuarioCatalogo): Promise<MenuAdmin> {
    const borrador: BorradorMenu = {
      nombre: datos.nombre,
      horario: datos.horario,
      categorias: datos.categorias,
    };
    const fila = await this.prisma.$transaction(async (tx) => {
      const creada = await tx.menu.create({
        data: { estado: 'borrador', borrador: JSON.stringify(borrador) },
      });
      await this.registrar(tx, 'menu', creada.id, 'crear', usuario.id, { nombre: datos.nombre });
      return creada;
    });
    return menuAdmin(fila);
  }

  async editarMenu(
    id: string,
    revision: number,
    cambios: CambiosMenu,
    usuario: UsuarioCatalogo,
  ): Promise<MenuAdmin> {
    const actual = await this.filaMenu(id);
    const borrador: BorradorMenu = { ...leerJson<BorradorMenu>(actual.borrador), ...cambios };
    const fila = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.menu.updateMany({
        where: { id, revision },
        data: { borrador: JSON.stringify(borrador), revision: { increment: 1 } },
      });
      if (count === 0) throw conflicto(`el menú "${borrador.nombre}"`);
      await this.registrar(tx, 'menu', id, 'editar', usuario.id, { campos: Object.keys(cambios) });
      return tx.menu.findUniqueOrThrow({ where: { id } });
    });
    return menuAdmin(fila);
  }

  /** Publica el borrador como una versión nueva e inmutable (US2, US3, FR-004, FR-005). */
  async publicar(
    id: string,
    revision: number,
    usuario: UsuarioCatalogo,
    ahora: Date,
  ): Promise<MenuAdmin> {
    const menu = await this.filaMenu(id);
    const borrador = leerJson<BorradorMenu>(menu.borrador);
    if (menu.revision !== revision) throw conflicto(`el menú "${borrador.nombre}"`);

    const productos = await this.productosActuales(
      borrador.categorias.flatMap((c) => c.productoIds),
    );
    const problemas = problemasParaPublicar(borrador, productos);
    if (problemas.length > 0) {
      throw new ErrorCatalogo(
        'no_publicable',
        `No se puede publicar "${borrador.nombre}": corrige ${problemas.length === 1 ? 'el problema' : `los ${problemas.length} problemas`} de la lista.`,
        problemas,
      );
    }
    const contenido = armarContenido(borrador, productos);
    return this.nuevaVersion(menu, revision, contenido, usuario, ahora, null);
  }

  async retirar(id: string, usuario: UsuarioCatalogo): Promise<MenuAdmin> {
    const menu = await this.filaMenu(id);
    const fila = await this.prisma.$transaction(async (tx) => {
      const actualizado = await tx.menu.update({
        where: { id },
        data: { estado: 'retirado', revision: { increment: 1 } },
      });
      await this.registrar(tx, 'menu', id, 'retirar', usuario.id, { estadoAnterior: menu.estado });
      return actualizado;
    });
    return menuAdmin(fila);
  }

  /** Historial de versiones, de la más reciente a la más antigua (US3-4). */
  async versiones(menuId: string): Promise<VersionMenuResumen[]> {
    await this.filaMenu(menuId);
    const filas = await this.prisma.versionMenu.findMany({
      where: { menuId },
      orderBy: { numero: 'desc' },
    });
    return filas.map((v) => ({
      numero: v.numero,
      publicadaPor: v.publicadaPor,
      publicadaEn: v.publicadaEn.toISOString(),
      cambios: leerJson<string[]>(v.cambios),
      restauradaDe: v.restauradaDe,
    }));
  }

  /** Vuelve a publicar el contenido de una versión anterior como versión nueva (US3-3). */
  async restaurar(
    menuId: string,
    numero: number,
    usuario: UsuarioCatalogo,
    ahora: Date,
  ): Promise<MenuAdmin> {
    const menu = await this.filaMenu(menuId);
    const origen = await this.prisma.versionMenu.findUnique({
      where: { menuId_numero: { menuId, numero } },
    });
    if (!origen) throw noEncontrado(`La versión ${numero} de este menú`);
    const contenido = leerJson<ContenidoVersion>(origen.contenido);
    return this.nuevaVersion(menu, menu.revision, contenido, usuario, ahora, numero);
  }

  // -------------------------------------------------------------------------
  // Disponibilidad (personal y administrador)
  // -------------------------------------------------------------------------

  async listarDisponibilidad(): Promise<DisponibilidadVista[]> {
    const filas = await this.prisma.producto.findMany({
      where: { retirado: false },
      orderBy: { nombre: 'asc' },
    });
    return filas.map(disponibilidad);
  }

  /** Cambio rápido del día (US4-1): no crea versiones ni pide revisión. */
  async cambiarDisponibilidad(
    id: string,
    cambios: CambiosDisponibilidad,
    usuario: UsuarioCatalogo,
  ): Promise<DisponibilidadVista> {
    const antes = await this.filaProducto(id);
    const fila = await this.prisma.$transaction(async (tx) => {
      const actualizado = await tx.producto.update({ where: { id }, data: cambios });
      await this.registrar(tx, 'producto', id, 'disponibilidad', usuario.id, {
        antes: { agotado: antes.agotado, existencias: antes.existencias },
        despues: cambios,
      });
      return actualizado;
    });
    return disponibilidad(fila);
  }

  /**
   * Resta existencias de una venta confirmada (US4-2, contracts/dependencias.md §3).
   * Actualización condicional: nunca deja existencias negativas aunque haya ventas simultáneas.
   * Si el producto no controla existencias, no hace nada.
   */
  async descontarExistencias(
    productoId: string,
    cantidad: number,
    usuarioId: string,
  ): Promise<void> {
    if (!Number.isInteger(cantidad) || cantidad < 1) {
      throw new ErrorCatalogo('entrada_invalida', 'La cantidad a descontar debe ser un entero mayor que 0.');
    }
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.producto.updateMany({
        where: { id: productoId, existencias: { gte: cantidad } },
        data: { existencias: { decrement: cantidad } },
      });
      if (count === 0) {
        const fila = await tx.producto.findUnique({ where: { id: productoId } });
        if (!fila) throw noEncontrado(`El producto "${productoId}"`);
        if (fila.existencias === null) return;
        throw new ErrorCatalogo(
          'sin_existencias',
          `Solo quedan ${fila.existencias} unidades de "${fila.nombre}".`,
        );
      }
      await this.registrar(tx, 'producto', productoId, 'disponibilidad', usuarioId, {
        venta: cantidad,
      });
    });
  }

  // -------------------------------------------------------------------------
  // Puerto del carrito (spec 004)
  // -------------------------------------------------------------------------

  async obtenerProductos(
    ids: readonly string[],
    ahora: Date,
  ): Promise<ProductoParaCarrito[]> {
    if (ids.length === 0) return [];
    const [filas, versiones] = await Promise.all([
      this.prisma.producto.findMany({ where: { id: { in: [...ids] } } }),
      this.versionesPublicadas(),
    ]);
    // La versión publicada más reciente manda en nombre y precio (research R5).
    const recientes = [...versiones].sort(
      (a, b) => b.publicadaEn.getTime() - a.publicadaEn.getTime(),
    );

    return filas.map((fila): ProductoParaCarrito => {
      const menus = recientes.filter((v) =>
        v.contenido.categorias.some((c) => c.productos.some((p) => p.id === fila.id)),
      );
      const enVersion = menus[0]?.contenido.categorias
        .flatMap((c) => c.productos)
        .find((p) => p.id === fila.id);

      if (!enVersion || fila.retirado) {
        return {
          id: fila.id,
          nombre: enVersion?.nombre ?? fila.nombre,
          precioCentavos: enVersion?.precioCentavos ?? fila.precioCentavos,
          estado: 'retirado',
          existencias: fila.existencias,
          enHorario: false,
        };
      }
      return {
        id: fila.id,
        nombre: enVersion.nombre,
        precioCentavos: enVersion.precioCentavos,
        estado: estaAgotado(fila) ? 'agotado' : 'disponible',
        existencias: fila.existencias,
        enHorario: menus.some((m) => estaEnHorario(m.contenido.horario, ahora)),
      };
    });
  }

  // -------------------------------------------------------------------------
  // Auxiliares
  // -------------------------------------------------------------------------

  private async filaProducto(id: string): Promise<FilaProducto> {
    const fila = await this.prisma.producto.findUnique({ where: { id } });
    if (!fila) throw noEncontrado(`El producto "${id}"`);
    return fila;
  }

  private async filaMenu(id: string): Promise<FilaMenu> {
    const fila = await this.prisma.menu.findUnique({ where: { id } });
    if (!fila) throw noEncontrado('Ese menú');
    return fila;
  }

  private async productosActuales(ids: readonly string[]): Promise<Map<string, ProductoActual>> {
    const filas = await this.prisma.producto.findMany({
      where: { id: { in: [...new Set(ids)] } },
    });
    return new Map(filas.map((f) => [f.id, productoActual(f)]));
  }

  /** Versión publicada de cada menú en estado `publicado`. */
  private async versionesPublicadas(): Promise<VersionPublicada[]> {
    const menus = await this.prisma.menu.findMany({
      where: { estado: 'publicado', versionPublicada: { not: null } },
      select: { id: true, versionPublicada: true },
    });
    if (menus.length === 0) return [];
    const filas = await this.prisma.versionMenu.findMany({
      where: {
        OR: menus.map((m) => ({ menuId: m.id, numero: m.versionPublicada ?? 0 })),
      },
    });
    return filas.map((v) => ({
      id: v.menuId,
      version: v.numero,
      contenido: leerJson<ContenidoVersion>(v.contenido),
      publicadaEn: v.publicadaEn,
    }));
  }

  private async estadosDe(versiones: readonly MenuParaCarta[]): Promise<Map<string, EstadoVivo>> {
    const ids = versiones.flatMap((v) =>
      v.contenido.categorias.flatMap((c) => c.productos.map((p) => p.id)),
    );
    const filas = await this.prisma.producto.findMany({
      where: { id: { in: [...new Set(ids)] } },
      select: { id: true, agotado: true, existencias: true, retirado: true },
    });
    return new Map(filas.map((f) => [f.id, f]));
  }

  private async nuevaVersion(
    menu: FilaMenu,
    revision: number,
    contenido: ContenidoVersion,
    usuario: UsuarioCatalogo,
    ahora: Date,
    restauradaDe: number | null,
  ): Promise<MenuAdmin> {
    const fila = await this.prisma.$transaction(async (tx) => {
      const ultima = await tx.versionMenu.findFirst({
        where: { menuId: menu.id },
        orderBy: { numero: 'desc' },
      });
      const numero = (ultima?.numero ?? 0) + 1;
      const anterior = ultima ? leerJson<ContenidoVersion>(ultima.contenido) : null;
      const cambios = resumirCambios(anterior, contenido);
      if (restauradaDe !== null) cambios.unshift(`Restaurada la versión ${restauradaDe}.`);

      const { count } = await tx.menu.updateMany({
        where: { id: menu.id, revision },
        data: {
          estado: 'publicado',
          versionPublicada: numero,
          borrador: JSON.stringify(borradorDesde(contenido)),
          revision: { increment: 1 },
        },
      });
      if (count === 0) throw conflicto(`el menú "${contenido.nombre}"`);

      await tx.versionMenu.create({
        data: {
          menuId: menu.id,
          numero,
          contenido: JSON.stringify(contenido),
          cambios: JSON.stringify(cambios),
          publicadaPor: usuario.id,
          publicadaEn: ahora,
          restauradaDe,
        },
      });
      await this.registrar(
        tx,
        'menu',
        menu.id,
        restauradaDe === null ? 'publicar' : 'restaurar',
        usuario.id,
        { version: numero, cambios },
      );
      return tx.menu.findUniqueOrThrow({ where: { id: menu.id } });
    });
    return menuAdmin(fila);
  }

  /** Registro de auditoría del catálogo (FR-012). */
  private async registrar(
    tx: Tx,
    entidad: 'producto' | 'menu',
    entidadId: string,
    accion: 'crear' | 'editar' | 'publicar' | 'retirar' | 'restaurar' | 'disponibilidad',
    usuarioId: string,
    detalle: unknown,
  ): Promise<void> {
    await tx.cambioCatalogo.create({
      data: {
        entidad,
        entidadId,
        accion,
        usuarioId,
        detalle: JSON.stringify(detalle),
      },
    });
  }
}
