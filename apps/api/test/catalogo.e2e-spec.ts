import type {
  CartaPublica,
  DisponibilidadVista,
  MenuAdmin,
  MenuPublico,
  ProductoAdmin,
  VersionMenuResumen,
} from '@cafeteria/shared';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { CatalogoParaCarrito } from '../src/modules/carrito/puertos/catalogo.puerto';
import { CatalogoModule } from '../src/modules/catalogo/catalogo.module';
import { CatalogoService } from '../src/modules/catalogo/catalogo.service';
import { ErrorCatalogo } from '../src/modules/catalogo/dominio/errores';

/**
 * Catálogo con la base de datos SQLite real (global-setup.ts aplica las migraciones).
 * Cubre US2 (borrador y publicación), US3 (versiones, conflicto, restauración) y US4 (disponibilidad).
 * Cada test usa ids propios porque la BD se comparte con el resto de tests HTTP.
 */
describe('Catálogo con SQLite (e2e)', () => {
  let app: INestApplication<App>;
  const ADMIN = { 'X-Rol': 'admin', 'X-Usuario-Id': 'admin-e2e' };
  const PERSONAL = { 'X-Rol': 'personal', 'X-Usuario-Id': 'personal-e2e' };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<INestApplication<App>>();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  /** El puerto que exporta el catálogo (el carrito aún registra su versión provisional). */
  const puertoCarrito = () =>
    app.select(CatalogoModule).get(CatalogoParaCarrito, { strict: true });

  async function crearProducto(
    id: string,
    extra: Record<string, unknown> = {},
  ): Promise<ProductoAdmin> {
    const res = await http()
      .post('/catalogo/admin/productos')
      .set(ADMIN)
      .send({
        id,
        nombre: `Producto ${id}`,
        descripcion: 'De prueba',
        precioCentavos: 250,
        imagenUrl: '/menu/taza.svg',
        imagenAlt: 'Taza',
        alergenos: [],
        ...extra,
      })
      .expect(201);
    return res.body as ProductoAdmin;
  }

  async function crearMenu(nombre: string, productoIds: string[]): Promise<MenuAdmin> {
    const res = await http()
      .post('/catalogo/admin/menus')
      .set(ADMIN)
      .send({ nombre, categorias: [{ nombre: 'Bebidas', productoIds }] })
      .expect(201);
    return res.body as MenuAdmin;
  }

  async function publicar(menu: MenuAdmin): Promise<MenuAdmin> {
    const res = await http()
      .post(`/catalogo/admin/menus/${menu.id}/publicar`)
      .set(ADMIN)
      .send({ revision: menu.revision })
      .expect(200);
    return res.body as MenuAdmin;
  }

  async function carta(consulta = ''): Promise<CartaPublica> {
    const res = await http().get(`/catalogo/menu${consulta}`).expect(200);
    return res.body as CartaPublica;
  }

  function menuEnCarta(c: CartaPublica, nombre: string): MenuPublico | undefined {
    return c.menus.find((m) => m.nombre === nombre);
  }

  async function precioEnTienda(nombreMenu: string): Promise<number | undefined> {
    return menuEnCarta(await carta(), nombreMenu)?.categorias[0].productos[0].precioCentavos;
  }

  it('las rutas de administración piden rol: 401 sin cabeceras, 403 al personal (US4-3)', async () => {
    await http().get('/catalogo/admin/productos').expect(401);
    const res = await http()
      .put('/catalogo/admin/productos/lo-que-sea')
      .set(PERSONAL)
      .send({ revision: 1, precioCentavos: 1 })
      .expect(403);
    expect((res.body as { message: string }).message).toMatch(/administrador/);
  });

  it('un borrador no se ve; publicarlo lo muestra en la tienda (US2-1, US2-3, US2-4)', async () => {
    await crearProducto('e2e-pub-cafe');
    const menu = await crearMenu('E2E publicar', ['e2e-pub-cafe']);
    expect(menu.estado).toBe('borrador');
    expect(menuEnCarta(await carta(), 'E2E publicar')).toBeUndefined();

    const previa = await http()
      .get(`/catalogo/admin/menus/${menu.id}/vista-previa`)
      .set(ADMIN)
      .expect(200);
    expect((previa.body as MenuPublico).categorias[0].productos[0].id).toBe('e2e-pub-cafe');

    expect((await publicar(menu)).versionPublicada).toBe(1);
    expect(menuEnCarta(await carta(), 'E2E publicar')?.categorias[0].productos[0]).toMatchObject({
      id: 'e2e-pub-cafe',
      precioCentavos: 250,
      sePuedePedir: true,
    });
  });

  it('bloquea la publicación si falta texto alternativo o alérgenos y dice qué falta (US2-2)', async () => {
    await crearProducto('e2e-incompleto', { imagenAlt: null, alergenos: null });
    const menu = await crearMenu('E2E incompleto', ['e2e-incompleto']);
    const res = await http()
      .post(`/catalogo/admin/menus/${menu.id}/publicar`)
      .set(ADMIN)
      .send({ revision: menu.revision })
      .expect(422);
    const cuerpo = res.body as { problemas: string[] };
    expect(cuerpo.problemas).toHaveLength(2);
    expect(cuerpo.problemas.join(' ')).toMatch(/texto alternativo/);
  });

  it('cambiar un precio crea otra versión; la anterior se conserva y se puede restaurar (US3)', async () => {
    const producto = await crearProducto('e2e-version', { precioCentavos: 250 });
    let menu = await publicar(await crearMenu('E2E versiones', ['e2e-version']));

    // Cambiar el producto no afecta a la tienda hasta publicar.
    await http()
      .put('/catalogo/admin/productos/e2e-version')
      .set(ADMIN)
      .send({ revision: producto.revision, precioCentavos: 275 })
      .expect(200);
    expect(await precioEnTienda('E2E versiones')).toBe(250);

    menu = await publicar(menu);
    expect(menu.versionPublicada).toBe(2);
    expect(await precioEnTienda('E2E versiones')).toBe(275);

    const historial = (
      await http().get(`/catalogo/admin/menus/${menu.id}/versiones`).set(ADMIN).expect(200)
    ).body as VersionMenuResumen[];
    expect(historial.map((v) => v.numero)).toEqual([2, 1]);
    expect(historial[0].publicadaPor).toBe('admin-e2e');
    expect(historial[0].cambios).toEqual(['Precio de Producto e2e-version: $2,50 → $2,75.']);

    const restaurado = (
      await http()
        .post(`/catalogo/admin/menus/${menu.id}/versiones/1/restaurar`)
        .set(ADMIN)
        .expect(200)
    ).body as MenuAdmin;
    expect(restaurado.versionPublicada).toBe(3);
    expect(await precioEnTienda('E2E versiones')).toBe(250);
  });

  it('el segundo en guardar recibe un conflicto y no sobrescribe (FR-011)', async () => {
    const menu = await crearMenu('E2E conflicto', []);
    await http()
      .put(`/catalogo/admin/menus/${menu.id}`)
      .set(ADMIN)
      .send({ revision: menu.revision, nombre: 'E2E conflicto A' })
      .expect(200);
    const res = await http()
      .put(`/catalogo/admin/menus/${menu.id}`)
      .set(ADMIN)
      .send({ revision: menu.revision, nombre: 'E2E conflicto B' })
      .expect(409);
    expect((res.body as { message: string }).message).toMatch(/Vuelve a cargarlo/);

    const actual = await http().get(`/catalogo/admin/menus/${menu.id}`).set(ADMIN).expect(200);
    expect((actual.body as MenuAdmin).nombre).toBe('E2E conflicto A');
  });

  it('el personal marca un producto agotado y la tienda lo indica (US4-1)', async () => {
    await crearProducto('e2e-agotar');
    await publicar(await crearMenu('E2E agotar', ['e2e-agotar']));

    const res = await http()
      .put('/catalogo/disponibilidad/e2e-agotar')
      .set(PERSONAL)
      .send({ agotado: true })
      .expect(200);
    expect((res.body as DisponibilidadVista).agotado).toBe(true);

    const producto = menuEnCarta(await carta(), 'E2E agotar')?.categorias[0].productos[0];
    expect(producto).toMatchObject({ textoDisponibilidad: 'Agotado', sePuedePedir: false });
  });

  it('las existencias se descuentan y al llegar a cero el producto queda agotado (US4-2)', async () => {
    await crearProducto('e2e-existencias', { existencias: 2 });
    await publicar(await crearMenu('E2E existencias', ['e2e-existencias']));

    const servicio = app.get(CatalogoService);
    await expect(
      servicio.descontarExistencias('e2e-existencias', 3, 'pedido-1'),
    ).rejects.toBeInstanceOf(ErrorCatalogo);
    await servicio.descontarExistencias('e2e-existencias', 2, 'pedido-1');

    const [paraCarrito] = await puertoCarrito().obtenerProductos(['e2e-existencias'], new Date());
    expect(paraCarrito).toMatchObject({ estado: 'agotado', existencias: 0, enHorario: true });
  });

  it('da al carrito el precio publicado y marca como retirado lo que no está publicado', async () => {
    await crearProducto('e2e-carrito', { precioCentavos: 400 });
    await crearProducto('e2e-sin-menu');
    await publicar(await crearMenu('E2E carrito', ['e2e-carrito']));

    const productos = await puertoCarrito().obtenerProductos(['e2e-carrito', 'e2e-sin-menu', 'no-existe'], new Date());
    expect(productos).toHaveLength(2);
    expect(productos.find((p) => p.id === 'e2e-carrito')).toMatchObject({
      precioCentavos: 400,
      estado: 'disponible',
    });
    expect(productos.find((p) => p.id === 'e2e-sin-menu')?.estado).toBe('retirado');
  });

  it('filtra la tienda por alérgenos y rechaza códigos desconocidos (US1-4)', async () => {
    await crearProducto('e2e-con-leche', { alergenos: ['leche'] });
    await crearProducto('e2e-sin-leche');
    await publicar(await crearMenu('E2E alergenos', ['e2e-con-leche', 'e2e-sin-leche']));

    const filtrada = menuEnCarta(await carta('?excluir=leche'), 'E2E alergenos');
    expect(filtrada?.categorias[0].productos.map((p) => p.id)).toEqual(['e2e-sin-leche']);
    await http().get('/catalogo/menu?excluir=polen').expect(400);
  });

  it('retirar un menú lo quita de la tienda', async () => {
    await crearProducto('e2e-retirar');
    const menu = await publicar(await crearMenu('E2E retirar', ['e2e-retirar']));
    await http().post(`/catalogo/admin/menus/${menu.id}/retirar`).set(ADMIN).expect(200);
    expect(menuEnCarta(await carta(), 'E2E retirar')).toBeUndefined();
  });
});
