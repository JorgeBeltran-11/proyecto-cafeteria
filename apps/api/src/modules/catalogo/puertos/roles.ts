import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

/**
 * Quién usa la administración del catálogo y con qué rol (contracts/dependencias.md §1).
 *
 * PENDIENTE(spec-002): el guard de identidad debe dejar `request.usuario` y comprobar
 * `@Roles(...)`. Hoy lo hace `RolesProvisionalGuard` (carpeta provisional/).
 */
export type RolCatalogo = 'admin' | 'personal';

export interface UsuarioCatalogo {
  id: string;
  rol: RolCatalogo;
}

export interface PeticionConUsuario extends Request {
  usuario?: UsuarioCatalogo;
}

export const ROLES_CATALOGO = 'roles-catalogo';

/** Roles que pueden usar la ruta o el controlador. */
export const Roles = (...roles: RolCatalogo[]) => SetMetadata(ROLES_CATALOGO, roles);

/** Usuario de la sesión. Requiere un guard que rellene `request.usuario`. */
export const UsuarioActual = createParamDecorator(
  (_dato: unknown, ctx: ExecutionContext): UsuarioCatalogo => {
    const peticion = ctx.switchToHttp().getRequest<PeticionConUsuario>();
    if (!peticion.usuario) {
      // Solo ocurre si alguien olvida el guard: nunca se atiende sin usuario.
      throw new UnauthorizedException('Inicia sesión como personal o administrador.');
    }
    return peticion.usuario;
  },
);
