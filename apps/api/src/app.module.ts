import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module';
import { CarritoModule } from './modules/carrito/carrito.module';
import { CatalogoModule } from './modules/catalogo/catalogo.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
    CatalogoModule,
    CarritoModule,
  ],
})
export class AppModule {}
