import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Put,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import type { DisponibilidadVista } from '@cafeteria/shared';
import { ErroresCatalogoFilter } from './catalogo.errores';
import { CatalogoService } from './catalogo.service';
import { RolesProvisionalGuard } from './provisional/roles-provisional.guard';
import { Roles, type UsuarioCatalogo, UsuarioActual } from './puertos/roles';
import { leerDisponibilidad, validarProductoId } from './validacion';

/** Disponibilidad del día (US4): la cambian el personal y los administradores (FR-009). */
@Controller('catalogo/disponibilidad')
@Roles('personal', 'admin')
@UseGuards(RolesProvisionalGuard) // PENDIENTE(spec-002): cambiar por el guard de identidad
@UseFilters(ErroresCatalogoFilter)
export class DisponibilidadController {
  constructor(private readonly catalogo: CatalogoService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  listar(): Promise<DisponibilidadVista[]> {
    return this.catalogo.listarDisponibilidad();
  }

  @Put(':productoId')
  @Header('Cache-Control', 'no-store')
  cambiar(
    @UsuarioActual() usuario: UsuarioCatalogo,
    @Param('productoId') productoId: string,
    @Body() cuerpo: unknown,
  ): Promise<DisponibilidadVista> {
    return this.catalogo.cambiarDisponibilidad(
      validarProductoId(productoId),
      leerDisponibilidad(cuerpo),
      usuario,
    );
  }
}
