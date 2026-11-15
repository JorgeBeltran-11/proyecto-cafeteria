import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Cliente de Prisma compartido por toda la API.
 * Si la base de datos no está disponible al arrancar, la API arranca igual
 * y GET /health informa del fallo (spec 001, caso "BD sin preparar").
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
    } catch {
      // No se registra el error completo: puede incluir la ruta de la BD.
      this.logger.warn(
        'No se pudo conectar con la base de datos al arrancar; se reintentará en cada consulta.',
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
