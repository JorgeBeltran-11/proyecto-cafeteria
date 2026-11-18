import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const CAMPOS_CONTRATO = ['api', 'checkedAt', 'database', 'status'];
const ISO_8601_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/** Comprueba que el cuerpo cumple el esquema HealthResponse de contracts/health.openapi.yaml. */
function expectHealthResponse(body: Record<string, unknown>): void {
  expect(Object.keys(body).sort()).toEqual(CAMPOS_CONTRATO);
  for (const campo of ['status', 'api', 'database']) {
    expect(['ok', 'error']).toContain(body[campo]);
  }
  expect(body.checkedAt).toEqual(expect.stringMatching(ISO_8601_UTC));
}

async function crearApp(
  prismaFalso?: object,
): Promise<INestApplication<App>> {
  let builder = Test.createTestingModule({ imports: [AppModule] });
  if (prismaFalso) {
    builder = builder.overrideProvider(PrismaService).useValue(prismaFalso);
  }
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  await app.init();
  return app;
}

describe('GET /health', () => {
  describe('con la BD SQLite migrada', () => {
    let app: INestApplication<App>;

    beforeAll(async () => {
      app = await crearApp();
    });

    afterAll(async () => {
      await app.close();
    });

    it('responde 200 conforme al contrato', async () => {
      const res = await request(app.getHttpServer())
        .get('/health')
        .expect('Content-Type', /application\/json/)
        .expect(200);

      const body = res.body as Record<string, unknown>;
      expectHealthResponse(body);
      expect(body).toMatchObject({ status: 'ok', api: 'ok', database: 'ok' });
    });

    it('responde en menos de 1 s', async () => {
      const inicio = Date.now();
      await request(app.getHttpServer()).get('/health').expect(200);
      expect(Date.now() - inicio).toBeLessThan(1000);
    });
  });

  describe('con la BD fallando', () => {
    let app: INestApplication<App>;

    beforeAll(async () => {
      const error = new Error(
        `Can't reach database at file:/var/secreto/dev.db (DATABASE_URL)`,
      );
      app = await crearApp({
        $queryRaw: () => Promise.reject(error),
      });
    });

    afterAll(async () => {
      await app.close();
    });

    it('responde 503 con database "error"', async () => {
      const res = await request(app.getHttpServer())
        .get('/health')
        .expect('Content-Type', /application\/json/)
        .expect(503);

      const body = res.body as Record<string, unknown>;
      expectHealthResponse(body);
      expect(body).toMatchObject({
        status: 'error',
        api: 'ok',
        database: 'error',
      });
    });

    it('no filtra detalles internos en el 503', async () => {
      const res = await request(app.getHttpServer()).get('/health').expect(503);

      const texto = res.text;
      expect(texto).not.toContain('file:');
      expect(texto).not.toContain('DATABASE_URL');
      expect(texto).not.toMatch(/stack/i);
      expect(texto).not.toMatch(/[A-Za-z]:[\\/]|\/var\/|\.db\b|\\\\/);
    });

    it('responde en menos de 1 s', async () => {
      const inicio = Date.now();
      await request(app.getHttpServer()).get('/health').expect(503);
      expect(Date.now() - inicio).toBeLessThan(1000);
    });
  });
});
