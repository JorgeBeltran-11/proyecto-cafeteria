import type { CarritoVista } from '@cafeteria/shared';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { CarritoModule } from './carrito.module';
import { CatalogoProvisional } from './provisional/catalogo-provisional';
import { CarritoRepositorio } from './repositorio/carrito.repositorio';
import { MemoriaCarritoRepositorio } from './repositorio/memoria-carrito.repositorio';

/** Tests HTTP del carrito sin base de datos: el repositorio se sustituye por uno en memoria. */
describe('API /carrito', () => {
  let app: INestApplication<App>;
  const CLIENTE = { 'X-Cliente-Id': 'cliente-http' };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        CarritoModule,
      ],
    })
      .overrideProvider(CarritoRepositorio)
      .useValue(new MemoriaCarritoRepositorio())
      .compile();
    moduleRef.get(CatalogoProvisional).reiniciar();
    app = moduleRef.createNestApplication<INestApplication<App>>();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  it('responde 401 sin el cliente de prueba', async () => {
    const res = await http().get('/carrito').expect(401);
    expect((res.body as { message: string }).message).toMatch(/X-Cliente-Id/);
  });

  it('responde 401 con un id de cliente con formato inválido', async () => {
    await http().get('/carrito').set('X-Cliente-Id', 'con espacios').expect(401);
  });

  it('responde 401 en producción aunque llegue la cabecera', async () => {
    const anterior = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      await http().get('/carrito').set(CLIENTE).expect(401);
    } finally {
      process.env.NODE_ENV = anterior;
    }
  });

  it('devuelve el carrito vacío sin caché', async () => {
    const res = await http()
      .get('/carrito')
      .set(CLIENTE)
      .expect(200)
      .expect('Cache-Control', 'no-store');
    expect((res.body as CarritoVista).lineas).toEqual([]);
  });

  it('recorre el flujo completo: añadir, cambiar, quitar y vaciar', async () => {
    await http()
      .post('/carrito/lineas')
      .set(CLIENTE)
      .send({ productoId: 'capuchino', cantidad: 2 })
      .expect(200);
    await http()
      .post('/carrito/lineas')
      .set(CLIENTE)
      .send({ productoId: 'cafe-americano' })
      .expect(200);

    let res = await http()
      .put('/carrito/lineas/capuchino')
      .set(CLIENTE)
      .send({ cantidad: 3 })
      .expect(200);
    let vista = res.body as CarritoVista;
    expect(vista.lineas.map((l) => [l.productoId, l.cantidad])).toEqual([
      ['capuchino', 3],
      ['cafe-americano', 1],
    ]);
    expect(vista.totalCentavos).toBe(3 * 250 + 150);

    res = await http().delete('/carrito/lineas/capuchino').set(CLIENTE).expect(200);
    vista = res.body as CarritoVista;
    expect(vista.lineas.map((l) => l.productoId)).toEqual(['cafe-americano']);

    res = await http().delete('/carrito').set(CLIENTE).expect(200);
    expect((res.body as CarritoVista).lineas).toEqual([]);
  });

  it.each([
    [{ productoId: 'capuchino', cantidad: -1 }, /entero entre 1/],
    [{ productoId: 'capuchino', cantidad: 1.5 }, /entero entre 1/],
    [{ productoId: 'capuchino', cantidad: '2' }, /entero entre 1/],
    [{ productoId: '../etc' }, /productoId/],
    [{ cantidad: 1 }, /productoId/],
  ])('responde 400 con un mensaje útil para %j', async (cuerpo, mensaje) => {
    const res = await http()
      .post('/carrito/lineas')
      .set(CLIENTE)
      .send(cuerpo)
      .expect(400);
    expect((res.body as { message: string }).message).toMatch(mensaje);
  });

  it('responde 409 al añadir un producto agotado', async () => {
    const res = await http()
      .post('/carrito/lineas')
      .set(CLIENTE)
      .send({ productoId: 'jugo-naranja' })
      .expect(409);
    expect(res.body).toEqual({
      statusCode: 409,
      message: 'Jugo de naranja está agotado. Elige otro producto del menú.',
      error: 'Conflict',
    });
  });

  it('recorta a las existencias con 200 y luego responde 422 si no cabe más', async () => {
    const res = await http()
      .post('/carrito/lineas')
      .set(CLIENTE)
      .send({ productoId: 'croissant', cantidad: 9 })
      .expect(200);
    expect((res.body as CarritoVista).ajuste?.aplicada).toBe(5);

    await http()
      .post('/carrito/lineas')
      .set(CLIENTE)
      .send({ productoId: 'croissant' })
      .expect(422);
  });

  it('responde 404 al cambiar la cantidad de un producto que no está', async () => {
    await http()
      .put('/carrito/lineas/capuchino')
      .set(CLIENTE)
      .send({ cantidad: 2 })
      .expect(404);
  });

  it('avisa del cambio de precio del catálogo provisional y permite aceptarlo', async () => {
    await http()
      .post('/carrito/lineas')
      .set(CLIENTE)
      .send({ productoId: 'capuchino' })
      .expect(200);
    await http()
      .patch('/catalogo-provisional/productos/capuchino')
      .send({ precioCentavos: 280 })
      .expect(200);

    let res = await http().get('/carrito').set(CLIENTE).expect(200);
    let vista = res.body as CarritoVista;
    expect(vista.avisos[0]).toMatchObject({
      tipo: 'cambio_de_precio',
      precioAnteriorCentavos: 250,
      precioNuevoCentavos: 280,
    });
    expect(vista.sePuedeConfirmar).toBe(false);

    res = await http().post('/carrito/aceptar-precios').set(CLIENTE).expect(200);
    vista = res.body as CarritoVista;
    expect(vista.avisos).toEqual([]);
    expect(vista.sePuedeConfirmar).toBe(true);
  });

  it('el catálogo provisional valida los cambios', async () => {
    await http()
      .patch('/catalogo-provisional/productos/capuchino')
      .send({ estado: 'roto' })
      .expect(400);
    await http()
      .patch('/catalogo-provisional/productos/no-existe')
      .send({ precioCentavos: 100 })
      .expect(404);
  });
});
