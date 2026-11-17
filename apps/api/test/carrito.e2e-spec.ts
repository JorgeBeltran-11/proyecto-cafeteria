import type { CarritoVista, MenuAdmin } from '@cafeteria/shared';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

/**
 * Carrito con la base de datos SQLite real y el catálogo real de la spec 003
 * (global-setup.ts aplica las migraciones). Comprueba que el carrito se guarda entre
 * peticiones (US2), que cada cliente ve solo el suyo y que los cambios del catálogo
 * llegan al carrito como avisos (US3). Los ids llevan el prefijo "e2e-carrito-"
 * porque la BD se comparte con el resto de tests HTTP.
 */
describe('Carrito con SQLite y catálogo real (e2e)', () => {
  let app: INestApplication<App>;
  // PENDIENTE(spec-002): cabeceras provisionales de los roles del catálogo y del cliente.
  const ADMIN = { 'X-Rol': 'admin', 'X-Usuario-Id': 'admin-e2e-carrito' };
  const PERSONAL = { 'X-Rol': 'personal', 'X-Usuario-Id': 'personal-e2e-carrito' };
  const CAFE = 'e2e-carrito-cafe';
  const PAN = 'e2e-carrito-pan';

  const http = () => request(app.getHttpServer());

  async function crearProducto(id: string, precioCentavos: number): Promise<void> {
    await http()
      .post('/catalogo/admin/productos')
      .set(ADMIN)
      .send({
        id,
        nombre: `Producto ${id}`,
        descripcion: 'De prueba',
        precioCentavos,
        imagenUrl: '/menu/taza.svg',
        imagenAlt: 'Taza',
        alergenos: [],
      })
      .expect(201);
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication<INestApplication<App>>();
    await app.init();

    // Un menú publicado, siempre disponible, con dos productos.
    await crearProducto(CAFE, 150);
    await crearProducto(PAN, 185);
    const menu = await http()
      .post('/catalogo/admin/menus')
      .set(ADMIN)
      .send({
        nombre: 'E2E carrito',
        categorias: [{ nombre: 'Todo', productoIds: [CAFE, PAN] }],
      })
      .expect(201);
    const { id, revision } = menu.body as MenuAdmin;
    await http()
      .post(`/catalogo/admin/menus/${id}/publicar`)
      .set(ADMIN)
      .send({ revision })
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });

  it('guarda el carrito con los precios del catálogo y lo devuelve en otra petición', async () => {
    const cliente = { 'X-Cliente-Id': 'e2e-persistencia' };

    await http()
      .post('/carrito/lineas')
      .set(cliente)
      .send({ productoId: CAFE, cantidad: 2 })
      .expect(200);
    await http()
      .post('/carrito/lineas')
      .set(cliente)
      .send({ productoId: PAN })
      .expect(200);

    const res = await http().get('/carrito').set(cliente).expect(200);
    const vista = res.body as CarritoVista;
    expect(vista.lineas.map((l) => [l.productoId, l.nombre, l.cantidad])).toEqual([
      [CAFE, `Producto ${CAFE}`, 2],
      [PAN, `Producto ${PAN}`, 1],
    ]);
    expect(vista.totalCentavos).toBe(2 * 150 + 185);
    expect(vista.sePuedeConfirmar).toBe(true);
  });

  it('cada cliente ve solo su carrito', async () => {
    await http()
      .post('/carrito/lineas')
      .set('X-Cliente-Id', 'e2e-cliente-a')
      .send({ productoId: PAN })
      .expect(200);

    const res = await http()
      .get('/carrito')
      .set('X-Cliente-Id', 'e2e-cliente-b')
      .expect(200);
    expect((res.body as CarritoVista).lineas).toEqual([]);
  });

  it('rechaza productos que no están en el catálogo', async () => {
    await http()
      .post('/carrito/lineas')
      .set('X-Cliente-Id', 'e2e-inexistente')
      .send({ productoId: 'e2e-carrito-no-existe' })
      .expect(409);
  });

  it('quitar y vaciar se guardan', async () => {
    const cliente = { 'X-Cliente-Id': 'e2e-vaciar' };
    await http().post('/carrito/lineas').set(cliente).send({ productoId: CAFE }).expect(200);
    await http().post('/carrito/lineas').set(cliente).send({ productoId: PAN }).expect(200);

    await http().delete(`/carrito/lineas/${CAFE}`).set(cliente).expect(200);
    let res = await http().get('/carrito').set(cliente).expect(200);
    expect((res.body as CarritoVista).lineas.map((l) => l.productoId)).toEqual([PAN]);

    await http().delete('/carrito').set(cliente).expect(200);
    res = await http().get('/carrito').set(cliente).expect(200);
    expect((res.body as CarritoVista).lineas).toEqual([]);
  });

  // Va al final: deja el pan agotado para el resto de la ejecución.
  it('si el personal agota un producto, el carrito lo avisa y no deja confirmar (US3)', async () => {
    const cliente = { 'X-Cliente-Id': 'e2e-agotado' };
    await http().post('/carrito/lineas').set(cliente).send({ productoId: PAN }).expect(200);

    await http()
      .put(`/catalogo/disponibilidad/${PAN}`)
      .set(PERSONAL)
      .send({ agotado: true })
      .expect(200);

    const res = await http().get('/carrito').set(cliente).expect(200);
    const vista = res.body as CarritoVista;
    expect(vista.avisos.map((a) => [a.tipo, a.productoId])).toEqual([['agotado', PAN]]);
    expect(vista.sePuedeConfirmar).toBe(false);

    await http().post('/carrito/lineas').set(cliente).send({ productoId: PAN }).expect(409);
  });
});
