import { Injectable, Logger } from '@nestjs/common';
import type { ComponentStatus, HealthResponse } from '@cafeteria/shared';
import { PrismaService } from '../prisma/prisma.service';

/** Tiempo máximo de la consulta a la BD; garantiza que /health responde en < 1 s (SC-003). */
const DB_TIMEOUT_MS = 500;

class DatabaseTimeoutError extends Error {}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<HealthResponse> {
    const database = await this.checkDatabase();
    return {
      status: database,
      api: 'ok',
      database,
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * Consulta la tabla de migraciones (research R4): si la BD existe pero no se ha
   * ejecutado `pnpm db:setup`, la tabla no existe y el resultado es 'error'.
   */
  private async checkDatabase(): Promise<ComponentStatus> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new DatabaseTimeoutError()),
        DB_TIMEOUT_MS,
      );
    });

    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1 FROM _prisma_migrations LIMIT 1`,
        timeout,
      ]);
      return 'ok';
    } catch (error) {
      // No se registra el mensaje del error: puede incluir la ruta de la BD (FR-010).
      this.logger.warn(
        error instanceof DatabaseTimeoutError
          ? `La base de datos no respondió en ${DB_TIMEOUT_MS} ms`
          : 'La consulta de salud a la base de datos falló (¿falta ejecutar pnpm db:setup?)',
      );
      return 'error';
    } finally {
      clearTimeout(timer);
    }
  }
}
