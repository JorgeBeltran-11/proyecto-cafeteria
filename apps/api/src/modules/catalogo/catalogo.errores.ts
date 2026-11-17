import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { type CodigoErrorCatalogo, ErrorCatalogo } from './dominio/errores';

const ESTADO_HTTP: Record<CodigoErrorCatalogo, HttpStatus> = {
  entrada_invalida: HttpStatus.BAD_REQUEST,
  no_encontrado: HttpStatus.NOT_FOUND,
  ya_existe: HttpStatus.CONFLICT,
  conflicto_edicion: HttpStatus.CONFLICT,
  no_publicable: HttpStatus.UNPROCESSABLE_ENTITY,
  sin_existencias: HttpStatus.CONFLICT,
};

const NOMBRE_ERROR: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'Bad Request',
  [HttpStatus.NOT_FOUND]: 'Not Found',
  [HttpStatus.CONFLICT]: 'Conflict',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'Unprocessable Entity',
};

/** Traduce los errores de negocio del catálogo al formato de error de NestJS. */
@Catch(ErrorCatalogo)
export class ErroresCatalogoFilter implements ExceptionFilter<ErrorCatalogo> {
  catch(error: ErrorCatalogo, host: ArgumentsHost): void {
    const respuesta = host.switchToHttp().getResponse<Response>();
    const estado = ESTADO_HTTP[error.codigo];
    respuesta.status(estado).json({
      statusCode: estado,
      message: error.message,
      error: NOMBRE_ERROR[estado],
      ...(error.problemas.length > 0 ? { problemas: error.problemas } : {}),
    });
  }
}
