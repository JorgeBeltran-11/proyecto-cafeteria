import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CarritoController } from './carrito.controller';
import {
  CarritoService,
  LIMITES_CARRITO,
  RELOJ,
  type Reloj,
} from './carrito.service';
import { LIMITES_POR_DEFECTO, type LimitesCarrito } from './dominio/reglas';
import { CatalogoProvisional } from './provisional/catalogo-provisional';
import { CatalogoProvisionalController } from './provisional/catalogo-provisional.controller';
import { SinDescuentos } from './provisional/sin-descuentos';
import { CatalogoParaCarrito } from './puertos/catalogo.puerto';
import { CalculadorDescuentos } from './puertos/descuentos.puerto';
import { CarritoRepositorio } from './repositorio/carrito.repositorio';
import { PrismaCarritoRepositorio } from './repositorio/prisma-carrito.repositorio';

const logger = new Logger('CarritoModule');

function enteroPositivo(
  config: ConfigService,
  variable: string,
  porDefecto: number,
): number {
  const texto = config.get<string>(variable);
  if (texto === undefined || texto === '') return porDefecto;
  const valor = Number(texto);
  if (!Number.isInteger(valor) || valor < 1) {
    logger.warn(`${variable}="${texto}" no es un entero positivo; se usa ${porDefecto}.`);
    return porDefecto;
  }
  return valor;
}

/** PENDIENTE(spec-008): los límites los configurará el administrador; hoy salen del entorno. */
export function leerLimites(config: ConfigService): LimitesCarrito {
  return {
    porProducto: enteroPositivo(
      config,
      'CARRITO_MAX_UNIDADES_POR_PRODUCTO',
      LIMITES_POR_DEFECTO.porProducto,
    ),
    porCarrito: enteroPositivo(
      config,
      'CARRITO_MAX_UNIDADES_POR_CARRITO',
      LIMITES_POR_DEFECTO.porCarrito,
    ),
    diasInactividad: enteroPositivo(
      config,
      'CARRITO_DIAS_INACTIVIDAD',
      LIMITES_POR_DEFECTO.diasInactividad,
    ),
  };
}

@Module({
  controllers: [
    CarritoController,
    CatalogoProvisionalController, // PENDIENTE(spec-003)
  ],
  providers: [
    CarritoService,
    { provide: CarritoRepositorio, useClass: PrismaCarritoRepositorio },
    CatalogoProvisional, // PENDIENTE(spec-003)
    // PENDIENTE(spec-003): importar CatalogoModule y borrar esta línea.
    { provide: CatalogoParaCarrito, useExisting: CatalogoProvisional },
    // PENDIENTE(spec-005): sustituir por el calculador del módulo de promociones.
    { provide: CalculadorDescuentos, useClass: SinDescuentos },
    { provide: LIMITES_CARRITO, inject: [ConfigService], useFactory: leerLimites },
    { provide: RELOJ, useValue: (() => new Date()) satisfies Reloj },
  ],
  exports: [CarritoService],
})
export class CarritoModule {}
