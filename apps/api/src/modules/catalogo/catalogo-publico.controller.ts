import { Controller, Get, Header, Query, UseFilters } from '@nestjs/common';
import type { AlergenoVista, CartaPublica } from '@cafeteria/shared';
import { ErroresCatalogoFilter } from './catalogo.errores';
import { CatalogoService } from './catalogo.service';
import { ALERGENOS } from './dominio/alergenos';
import { leerExcluir } from './validacion';

/** Tienda: el menú vigente, sin sesión (US1). Sin caché para ver los cambios al instante (FR-006). */
@Controller('catalogo')
@UseFilters(ErroresCatalogoFilter)
export class CatalogoPublicoController {
  constructor(private readonly catalogo: CatalogoService) {}

  @Get('menu')
  @Header('Cache-Control', 'no-store')
  carta(@Query('excluir') excluir: unknown): Promise<CartaPublica> {
    return this.catalogo.carta(new Date(), leerExcluir(excluir));
  }

  @Get('alergenos')
  alergenos(): readonly AlergenoVista[] {
    return ALERGENOS;
  }
}
