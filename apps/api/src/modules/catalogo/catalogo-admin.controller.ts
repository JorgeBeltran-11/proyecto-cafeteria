import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import type {
  MenuAdmin,
  MenuPublico,
  ProductoAdmin,
  VersionMenuResumen,
} from '@cafeteria/shared';
import { ErroresCatalogoFilter } from './catalogo.errores';
import { CatalogoService } from './catalogo.service';
import { RolesProvisionalGuard } from './provisional/roles-provisional.guard';
import { Roles, type UsuarioCatalogo, UsuarioActual } from './puertos/roles';
import {
  leerCambiosMenu,
  leerCambiosProducto,
  leerMenuNuevo,
  leerObjeto,
  leerProductoNuevo,
  validarMenuId,
  validarNumeroVersion,
  validarProductoId,
  validarRevision,
} from './validacion';

/** Administración de productos y menús (US2, US3). Solo administradores (FR-009). */
@Controller('catalogo/admin')
@Roles('admin')
@UseGuards(RolesProvisionalGuard) // PENDIENTE(spec-002): cambiar por el guard de identidad
@UseFilters(ErroresCatalogoFilter)
export class CatalogoAdminController {
  constructor(private readonly catalogo: CatalogoService) {}

  // --- Productos ---

  @Get('productos')
  @Header('Cache-Control', 'no-store')
  listarProductos(): Promise<ProductoAdmin[]> {
    return this.catalogo.listarProductos();
  }

  @Get('productos/:id')
  @Header('Cache-Control', 'no-store')
  obtenerProducto(@Param('id') id: string): Promise<ProductoAdmin> {
    return this.catalogo.obtenerProducto(validarProductoId(id));
  }

  @Post('productos')
  @Header('Cache-Control', 'no-store')
  crearProducto(
    @UsuarioActual() usuario: UsuarioCatalogo,
    @Body() cuerpo: unknown,
  ): Promise<ProductoAdmin> {
    return this.catalogo.crearProducto(leerProductoNuevo(cuerpo), usuario);
  }

  @Put('productos/:id')
  @Header('Cache-Control', 'no-store')
  editarProducto(
    @UsuarioActual() usuario: UsuarioCatalogo,
    @Param('id') id: string,
    @Body() cuerpo: unknown,
  ): Promise<ProductoAdmin> {
    const { revision, cambios } = leerCambiosProducto(cuerpo);
    return this.catalogo.editarProducto(validarProductoId(id), revision, cambios, usuario);
  }

  // --- Menús ---

  @Get('menus')
  @Header('Cache-Control', 'no-store')
  listarMenus(): Promise<MenuAdmin[]> {
    return this.catalogo.listarMenus();
  }

  @Post('menus')
  @Header('Cache-Control', 'no-store')
  crearMenu(
    @UsuarioActual() usuario: UsuarioCatalogo,
    @Body() cuerpo: unknown,
  ): Promise<MenuAdmin> {
    return this.catalogo.crearMenu(leerMenuNuevo(cuerpo), usuario);
  }

  @Get('menus/:id')
  @Header('Cache-Control', 'no-store')
  obtenerMenu(@Param('id') id: string): Promise<MenuAdmin> {
    return this.catalogo.obtenerMenu(validarMenuId(id));
  }

  @Put('menus/:id')
  @Header('Cache-Control', 'no-store')
  editarMenu(
    @UsuarioActual() usuario: UsuarioCatalogo,
    @Param('id') id: string,
    @Body() cuerpo: unknown,
  ): Promise<MenuAdmin> {
    const { revision, cambios } = leerCambiosMenu(cuerpo);
    return this.catalogo.editarMenu(validarMenuId(id), revision, cambios, usuario);
  }

  @Get('menus/:id/vista-previa')
  @Header('Cache-Control', 'no-store')
  vistaPrevia(@Param('id') id: string): Promise<MenuPublico> {
    return this.catalogo.vistaPrevia(validarMenuId(id), new Date());
  }

  @Post('menus/:id/publicar')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  publicar(
    @UsuarioActual() usuario: UsuarioCatalogo,
    @Param('id') id: string,
    @Body() cuerpo: unknown,
  ): Promise<MenuAdmin> {
    const revision = validarRevision(leerObjeto(cuerpo).revision);
    return this.catalogo.publicar(validarMenuId(id), revision, usuario, new Date());
  }

  @Post('menus/:id/retirar')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  retirar(
    @UsuarioActual() usuario: UsuarioCatalogo,
    @Param('id') id: string,
  ): Promise<MenuAdmin> {
    return this.catalogo.retirar(validarMenuId(id), usuario);
  }

  @Get('menus/:id/versiones')
  @Header('Cache-Control', 'no-store')
  versiones(@Param('id') id: string): Promise<VersionMenuResumen[]> {
    return this.catalogo.versiones(validarMenuId(id));
  }

  @Post('menus/:id/versiones/:numero/restaurar')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  restaurar(
    @UsuarioActual() usuario: UsuarioCatalogo,
    @Param('id') id: string,
    @Param('numero') numero: string,
  ): Promise<MenuAdmin> {
    return this.catalogo.restaurar(
      validarMenuId(id),
      validarNumeroVersion(numero),
      usuario,
      new Date(),
    );
  }
}
