import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

/**
 * Petición con el cliente de la sesión (contracts/dependencias.md §2).
 *
 * PENDIENTE(spec-002): el guard de identidad debe dejar aquí el id del cliente.
 * Hoy lo hace `SesionProvisionalGuard` (carpeta provisional/).
 */
export interface PeticionConCliente extends Request {
  clienteId?: string;
}

/** Id del cliente de la sesión. Requiere un guard que rellene `request.clienteId`. */
export const ClienteActual = createParamDecorator(
  (_dato: unknown, ctx: ExecutionContext): string => {
    const peticion = ctx.switchToHttp().getRequest<PeticionConCliente>();
    if (!peticion.clienteId) {
      // Solo ocurre si alguien olvida el guard: nunca se atiende sin cliente.
      throw new UnauthorizedException('Inicia sesión para usar el carrito.');
    }
    return peticion.clienteId;
  },
);
