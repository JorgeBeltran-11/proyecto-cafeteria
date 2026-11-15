import { PrismaService } from '../prisma/prisma.service';
import { HealthService } from './health.service';

const ISO_8601_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function crearServicio(queryRaw: jest.Mock): HealthService {
  const prisma = { $queryRaw: queryRaw } as unknown as PrismaService;
  return new HealthService(prisma);
}

describe('HealthService', () => {
  it('informa de todo "ok" cuando la consulta a la BD resuelve', async () => {
    const service = crearServicio(jest.fn().mockResolvedValue([{ 1: 1 }]));

    const result = await service.check();

    expect(result).toEqual({
      status: 'ok',
      api: 'ok',
      database: 'ok',
      checkedAt: expect.any(String) as string,
    });
  });

  it('informa database "error" cuando la consulta a la BD falla', async () => {
    const service = crearServicio(
      jest.fn().mockRejectedValue(new Error('no such table: _prisma_migrations')),
    );

    const result = await service.check();

    expect(result.status).toBe('error');
    expect(result.api).toBe('ok');
    expect(result.database).toBe('error');
  });

  it('informa database "error" en menos de 1 s si la BD no responde nunca', async () => {
    const service = crearServicio(
      jest.fn().mockReturnValue(new Promise<never>(() => undefined)),
    );

    const inicio = Date.now();
    const result = await service.check();
    const duracion = Date.now() - inicio;

    expect(result.status).toBe('error');
    expect(result.database).toBe('error');
    expect(duracion).toBeLessThan(1000);
  });

  it('devuelve checkedAt en formato ISO 8601 UTC', async () => {
    const service = crearServicio(jest.fn().mockResolvedValue([]));

    const { checkedAt } = await service.check();

    expect(checkedAt).toMatch(ISO_8601_UTC);
    expect(new Date(checkedAt).toISOString()).toBe(checkedAt);
  });
});
