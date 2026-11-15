import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  // NestFactory.create carga apps/api/.env (ConfigModule) antes de conectar con la BD,
  // que ocurre en app.listen() (onModuleInit de PrismaService).
  const app = await NestFactory.create(AppModule);

  if (!process.env.DATABASE_URL) {
    console.error(
      'Falta DATABASE_URL: copia apps/api/.env.example a apps/api/.env',
    );
    await app.close();
    process.exit(1);
  }

  app.enableCors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000' });
  await app.listen(process.env.PORT ?? 3001);
}

void bootstrap();
