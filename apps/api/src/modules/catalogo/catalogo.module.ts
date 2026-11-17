import { Module } from '@nestjs/common';
import { CatalogoParaCarrito } from '../carrito/puertos/catalogo.puerto';
import { CatalogoAdminController } from './catalogo-admin.controller';
import { CatalogoPublicoController } from './catalogo-publico.controller';
import { CatalogoService } from './catalogo.service';
import { DisponibilidadController } from './disponibilidad.controller';
import { RolesProvisionalGuard } from './provisional/roles-provisional.guard';

/**
 * Menú dinámico (spec 003). Exporta `CatalogoService` (pedidos, spec 006) y el puerto
 * `CatalogoParaCarrito` (carrito, spec 004): contracts/dependencias.md §2 y §3.
 */
@Module({
  controllers: [
    CatalogoPublicoController,
    CatalogoAdminController,
    DisponibilidadController,
  ],
  providers: [
    CatalogoService,
    { provide: CatalogoParaCarrito, useExisting: CatalogoService },
    RolesProvisionalGuard, // PENDIENTE(spec-002)
  ],
  exports: [CatalogoService, CatalogoParaCarrito],
})
export class CatalogoModule {}
