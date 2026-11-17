import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { HealthModule } from './health/health.module';
import { CarritoModule } from './modules/carrito/carrito.module';
import { CatalogoModule } from './modules/catalogo/catalogo.module';
import { PrismaModule } from './prisma/prisma.module';
import { IdentidadModule } from './modules/identidad/identidad.module';
import { ClientesModule } from './modules/clientes/clientes.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 5,
      },
    ]),
    PrismaModule,
    HealthModule,
    IdentidadModule,
    ClientesModule,
    CatalogoModule,
    CarritoModule,
  ],
})
export class AppModule {}
