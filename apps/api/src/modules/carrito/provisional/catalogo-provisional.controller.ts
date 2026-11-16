/**
 * PENDIENTE(spec-003): rutas para ver y modificar los productos de prueba, de modo que se
 * puedan probar los avisos del carrito (US3). Desaparecen con el catálogo real.
 */
import {
  Body,
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  Patch,
  UseFilters,
} from '@nestjs/common';
import { ErroresCarritoFilter } from '../carrito.errores';
import { ErrorCarrito } from '../dominio/errores';
import type {
  EstadoProducto,
  ProductoParaCarrito,
} from '../puertos/catalogo.puerto';
import { leerObjeto, validarProductoId } from '../validacion';
import {
  type CambiosProductoDePrueba,
  CatalogoProvisional,
} from './catalogo-provisional';

const ESTADOS: readonly EstadoProducto[] = ['disponible', 'agotado', 'retirado'];

function soloFueraDeProduccion(): void {
  if (process.env.NODE_ENV === 'production') {
    throw new NotFoundException();
  }
}

function invalida(mensaje: string): ErrorCarrito {
  return new ErrorCarrito('entrada_invalida', mensaje);
}

function leerCambios(cuerpo: unknown): CambiosProductoDePrueba {
  const datos = leerObjeto(cuerpo);
  const cambios: CambiosProductoDePrueba = {};

  if (datos.precioCentavos !== undefined) {
    const p = datos.precioCentavos;
    if (typeof p !== 'number' || !Number.isInteger(p) || p < 0) {
      throw invalida('precioCentavos debe ser un entero mayor o igual que 0.');
    }
    cambios.precioCentavos = p;
  }
  if (datos.estado !== undefined) {
    if (!ESTADOS.includes(datos.estado as EstadoProducto)) {
      throw invalida('estado debe ser "disponible", "agotado" o "retirado".');
    }
    cambios.estado = datos.estado as EstadoProducto;
  }
  if (datos.existencias !== undefined) {
    const e = datos.existencias;
    if (e !== null && (typeof e !== 'number' || !Number.isInteger(e) || e < 0)) {
      throw invalida('existencias debe ser un entero mayor o igual que 0, o null.');
    }
    cambios.existencias = e;
  }
  if (datos.enHorario !== undefined) {
    if (typeof datos.enHorario !== 'boolean') {
      throw invalida('enHorario debe ser true o false.');
    }
    cambios.enHorario = datos.enHorario;
  }
  return cambios;
}

@Controller('catalogo-provisional/productos')
@UseFilters(ErroresCarritoFilter)
export class CatalogoProvisionalController {
  constructor(private readonly catalogo: CatalogoProvisional) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  listar(): ProductoParaCarrito[] {
    soloFueraDeProduccion();
    return this.catalogo.listar(new Date());
  }

  @Patch(':productoId')
  @Header('Cache-Control', 'no-store')
  actualizar(
    @Param('productoId') productoId: string,
    @Body() cuerpo: unknown,
  ): ProductoParaCarrito {
    soloFueraDeProduccion();
    const producto = this.catalogo.actualizar(
      validarProductoId(productoId),
      leerCambios(cuerpo),
      new Date(),
    );
    if (!producto) {
      throw new NotFoundException('Ese producto de prueba no existe.');
    }
    return producto;
  }
}
