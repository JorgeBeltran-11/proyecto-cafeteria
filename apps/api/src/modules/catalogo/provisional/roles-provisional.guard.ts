/**
 * PENDIENTE(spec-002): identifica al usuario con las cabeceras `X-Rol` y `X-Usuario-Id`.
 * NO ES SEGURO: cualquiera puede enviar cualquier rol. Por eso se desactiva con
 * NODE_ENV=production. Se sustituye por el guard de identidad (contracts/dependencias.md §1).
 */
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  type PeticionConUsuario,
  ROLES_CATALOGO,
  type RolCatalogo,
} from '../puertos/roles';

export const CABECERA_ROL = 'x-rol';
export const CABECERA_USUARIO = 'x-usuario-id';
const FORMATO_ID = /^[A-Za-z0-9_-]{1,64}$/;
const ROLES: readonly string[] = ['admin', 'personal'];

@Injectable()
export class RolesProvisionalGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    if (process.env.NODE_ENV === 'production') {
      throw new UnauthorizedException(
        'La identificación provisional está desactivada en producción.',
      );
    }

    const peticion = ctx.switchToHttp().getRequest<PeticionConUsuario>();
    const rol = peticion.headers[CABECERA_ROL];
    const id = peticion.headers[CABECERA_USUARIO];
    if (
      typeof rol !== 'string' ||
      !ROLES.includes(rol) ||
      typeof id !== 'string' ||
      !FORMATO_ID.test(id)
    ) {
      throw new UnauthorizedException(
        'Indica el rol en la cabecera X-Rol ("admin" o "personal") y tu id en X-Usuario-Id (letras, números, "-" o "_", máximo 64).',
      );
    }

    const permitidos =
      this.reflector.getAllAndOverride<RolCatalogo[] | undefined>(ROLES_CATALOGO, [
        ctx.getHandler(),
        ctx.getClass(),
      ]) ?? [];
    if (!permitidos.includes(rol as RolCatalogo)) {
      throw new ForbiddenException(
        rol === 'personal'
          ? 'El personal solo puede cambiar la disponibilidad; los precios y contenidos los cambia un administrador.'
          : 'Tu rol no tiene permiso para esta acción.',
      );
    }

    peticion.usuario = { id, rol: rol as RolCatalogo };
    return true;
  }
}
