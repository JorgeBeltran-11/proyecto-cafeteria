import type { CarritoVista } from '@cafeteria/shared';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

/**
 * Carrito con la base de datos SQLite real (global-setup.ts aplica las migraciones).
 * Comprueba que el carrito se guarda entre peticiones (US2) y que cada cliente ve solo el suyo.
 */
describe('Carrito con SQLite (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication<INestApplication<App>>();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  it('guarda el carrito y lo devuelve en otra petición (otro dispositivo)', async () => {
    const cliente = { 'X-Cliente-Id': 'e2e-persistencia' };

    await http()
      .post('/carrito/lineas')
      .set(cliente)
      .send({ productoId: 'capuchino', cantidad: 2 })
      .expect(200);
    await http()
      .post('/carrito/lineas')
      .set(cliente)
      .send({ productoId: 'cafe-americano' })
      .expect(200);

    const res = await http().get('/carrito').set(cliente).expect(200);
    const vista = res.body as CarritoVista;
    expect(vista.lineas.map((l) => [l.productoId, l.cantidad])).toEqual([
      ['capuchino', 2],
      ['cafe-americano', 1],
    ]);
    expect(vista.totalCentavos).toBe(2 * 250 + 150);
    expect(vista.actualizadoEn).not.toBeNull();
  });

  it('cada cliente ve solo su carrito', async () => {
    await http()
      .post('/carrito/lineas')
      .set('X-Cliente-Id', 'e2e-cliente-a')
      .send({ productoId: 'croissant' })
      .expect(200);

    const res = await http()
      .get('/carrito')
      .set('X-Cliente-Id', 'e2e-cliente-b')
      .expect(200);
    expect((res.body as CarritoVista).lineas).toEqual([]);
  });

  it('quitar y vaciar se guardan', async () => {
    const cliente = { 'X-Cliente-Id': 'e2e-vaciar' };
    await http()
      .post('/carrito/lineas')
      .set(cliente)
      .send({ productoId: 'capuchino' })
      .expect(200);
    await http()
      .post('/carrito/lineas')
      .set(cliente)
      .send({ productoId: 'croissant' })
      .expect(200);

    await http().delete('/carrito/lineas/capuchino').set(cliente).expect(200);
    let res = await http().get('/carrito').set(cliente).expect(200);
    expect((res.body as CarritoVista).lineas.map((l) => l.productoId)).toEqual([
      'croissant',
    ]);

    await http().delete('/carrito').set(cliente).expect(200);
    res = await http().get('/carrito').set(cliente).expect(200);
    expect((res.body as CarritoVista).lineas).toEqual([]);
  });
});
