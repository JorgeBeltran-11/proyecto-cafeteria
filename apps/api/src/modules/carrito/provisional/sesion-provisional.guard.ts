/**
 * PENDIENTE(spec-002): identifica al cliente con la cabecera `X-Cliente-Id`.
 * NO ES SEGURO: cualquiera puede enviar cualquier id. Por eso se desactiva con
 * NODE_ENV=production. Se sustituye por el guard de identidad (contracts/dependencias.md §2).
 */
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { PeticionConCliente } from '../puertos/sesion';

export const CABECERA_CLIENTE = 'x-cliente-id';
const FORMATO_ID = /^[A-Za-z0-9_-]{1,64}$/;

@Injectable()
export class SesionProvisionalGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    if (process.env.NODE_ENV === 'production') {
      throw new UnauthorizedException(
        'La identificación provisional está desactivada en producción.',
      );
    }

    const peticion = ctx.switchToHttp().getRequest<PeticionConCliente>();
    const valor = peticion.headers[CABECERA_CLIENTE];
    if (typeof valor !== 'string' || !FORMATO_ID.test(valor)) {
      throw new UnauthorizedException(
        'Indica el cliente de prueba en la cabecera X-Cliente-Id (letras, números, "-" o "_", máximo 64).',
      );
    }

    peticion.clienteId = valor;
    return true;
  }
}
