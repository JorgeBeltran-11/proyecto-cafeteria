import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { type CodigoErrorCarrito, ErrorCarrito } from './dominio/errores';

const ESTADO_HTTP: Record<CodigoErrorCarrito, HttpStatus> = {
  entrada_invalida: HttpStatus.BAD_REQUEST,
  no_esta_en_carrito: HttpStatus.NOT_FOUND,
  no_disponible: HttpStatus.CONFLICT,
  sin_espacio: HttpStatus.UNPROCESSABLE_ENTITY,
};

const NOMBRE_ERROR: Record<CodigoErrorCarrito, string> = {
  entrada_invalida: 'Bad Request',
  no_esta_en_carrito: 'Not Found',
  no_disponible: 'Conflict',
  sin_espacio: 'Unprocessable Entity',
};

/** Traduce los errores de negocio del carrito al formato de error de NestJS. */
@Catch(ErrorCarrito)
export class ErroresCarritoFilter implements ExceptionFilter<ErrorCarrito> {
  catch(error: ErrorCarrito, host: ArgumentsHost): void {
    const respuesta = host.switchToHttp().getResponse<Response>();
    const estado = ESTADO_HTTP[error.codigo];
    respuesta.status(estado).json({
      statusCode: estado,
      message: error.message,
      error: NOMBRE_ERROR[error.codigo],
    });
  }
}
