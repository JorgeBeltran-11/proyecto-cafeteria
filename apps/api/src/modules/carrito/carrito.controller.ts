import {
  Body,
  Controller,
  Delete,
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
import type { CarritoVista } from '@cafeteria/shared';
import { ErroresCarritoFilter } from './carrito.errores';
import { CarritoService } from './carrito.service';
import { SesionProvisionalGuard } from './provisional/sesion-provisional.guard';
import { ClienteActual } from './puertos/sesion';
import { leerObjeto, validarCantidad, validarProductoId } from './validacion';

/** API del carrito (contracts/carrito.openapi.yaml). Todas las rutas actúan sobre el carrito propio. */
@Controller('carrito')
@UseGuards(SesionProvisionalGuard) // PENDIENTE(spec-002): cambiar por el guard de identidad
@UseFilters(ErroresCarritoFilter)
export class CarritoController {
  constructor(private readonly carrito: CarritoService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  ver(@ClienteActual() clienteId: string): Promise<CarritoVista> {
    return this.carrito.ver(clienteId);
  }

  @Delete()
  @Header('Cache-Control', 'no-store')
  vaciar(@ClienteActual() clienteId: string): Promise<CarritoVista> {
    return this.carrito.vaciar(clienteId);
  }

  @Post('lineas')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  anadir(
    @ClienteActual() clienteId: string,
    @Body() cuerpo: unknown,
  ): Promise<CarritoVista> {
    const datos = leerObjeto(cuerpo);
    const productoId = validarProductoId(datos.productoId);
    const cantidad =
      datos.cantidad === undefined ? 1 : validarCantidad(datos.cantidad, 1);
    return this.carrito.anadir(clienteId, productoId, cantidad);
  }

  @Put('lineas/:productoId')
  @Header('Cache-Control', 'no-store')
  cambiarCantidad(
    @ClienteActual() clienteId: string,
    @Param('productoId') productoId: string,
    @Body() cuerpo: unknown,
  ): Promise<CarritoVista> {
    const cantidad = validarCantidad(leerObjeto(cuerpo).cantidad, 0);
    return this.carrito.cambiarCantidad(
      clienteId,
      validarProductoId(productoId),
      cantidad,
    );
  }

  @Delete('lineas/:productoId')
  @Header('Cache-Control', 'no-store')
  quitar(
    @ClienteActual() clienteId: string,
    @Param('productoId') productoId: string,
  ): Promise<CarritoVista> {
    return this.carrito.quitar(clienteId, validarProductoId(productoId));
  }

  @Post('aceptar-precios')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  aceptarPrecios(@ClienteActual() clienteId: string): Promise<CarritoVista> {
    return this.carrito.aceptarPrecios(clienteId);
  }
}
