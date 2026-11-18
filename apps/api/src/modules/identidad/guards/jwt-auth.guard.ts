import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../../prisma/prisma.service';

const ALLOW_REVOKED_SESSION_KEY = 'allow-revoked-session';

export const AllowRevokedSession = () =>
  SetMetadata(ALLOW_REVOKED_SESSION_KEY, true);

export interface AuthenticatedJwtUser {
  sub: string;
  role: string;
  sid: string;
}

interface AuthenticatedRequest {
  headers: {
    authorization?: string;
  };
  user?: AuthenticatedJwtUser;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request =
      context.switchToHttp().getRequest<AuthenticatedRequest>();
    const bearer = request.headers.authorization?.match(/^Bearer\s+(\S+)$/i);

    if (!bearer) {
      throw new UnauthorizedException('No autenticado.');
    }

    let payload: Record<string, unknown>;
    try {
      payload = await this.jwt.verifyAsync<Record<string, unknown>>(bearer[1]);
    } catch {
      throw new UnauthorizedException('No autenticado.');
    }

    if (
      typeof payload.sub !== 'string' ||
      typeof payload.role !== 'string' ||
      typeof payload.sid !== 'string'
    ) {
      throw new UnauthorizedException('No autenticado.');
    }

    const session = await this.prisma.userSession.findUnique({
      where: { id: payload.sid },
      select: {
        accountId: true,
        expiresAt: true,
        revokedAt: true,
        account: {
          select: {
            role: true,
            status: true,
          },
        },
      },
    });
    const allowRevokedSession =
      this.reflector.get<boolean>(
        ALLOW_REVOKED_SESSION_KEY,
        context.getHandler(),
      ) ?? false;

    if (
      !session ||
      session.accountId !== payload.sub ||
      session.account.status !== 'active' ||
      session.account.role !== payload.role ||
      session.expiresAt <= new Date() ||
      (session.revokedAt && !allowRevokedSession)
    ) {
      throw new UnauthorizedException('No autenticado.');
    }

    request.user = {
      sub: payload.sub,
      role: payload.role,
      sid: payload.sid,
    };

    return true;
  }
}
