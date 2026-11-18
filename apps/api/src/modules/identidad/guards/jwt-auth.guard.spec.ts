import { UnauthorizedException } from '@nestjs/common';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  AuthenticatedJwtUser,
  JwtAuthGuard,
} from './jwt-auth.guard';

jest.mock('@nestjs/jwt', () => ({
  JwtService: class JwtService {},
}));

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;

  const jwtMock = {
    verifyAsync: jest.fn(),
  };

  const prismaMock = {
    userSession: {
      findUnique: jest.fn(),
    },
  };

  const reflectorMock = {
    get: jest.fn(),
  };

  let request: {
    headers: { authorization?: string };
    user?: AuthenticatedJwtUser;
  };
  let handler: () => void;

  const createContext = () =>
    new ExecutionContextHost([request], undefined, handler);

  beforeEach(async () => {
    jest.clearAllMocks();
    request = { headers: {} };
    handler = () => undefined;
    prismaMock.userSession.findUnique.mockResolvedValue({
      accountId: 'account-1',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      account: {
        role: 'customer',
        status: 'active',
      },
    });
    reflectorMock.get.mockReturnValue(false);

    const module = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        { provide: JwtService, useValue: jwtMock },
        { provide: PrismaService, useValue: prismaMock },
        { provide: Reflector, useValue: reflectorMock },
      ],
    }).compile();
    guard = module.get<JwtAuthGuard>(JwtAuthGuard);
  });

  it('rechaza solicitudes sin token bearer', async () => {
    await expect(guard.canActivate(createContext())).rejects.toThrow(
      UnauthorizedException,
    );

    expect(jwtMock.verifyAsync).not.toHaveBeenCalled();
    expect(prismaMock.userSession.findUnique).not.toHaveBeenCalled();
  });

  it('rechaza tokens JWT inválidos sin exponer el error de verificación', async () => {
    request.headers.authorization = 'Bearer invalid-token';
    jwtMock.verifyAsync.mockRejectedValue(new Error('signature invalid'));

    await expect(guard.canActivate(createContext())).rejects.toThrow(
      'No autenticado.',
    );
    expect(prismaMock.userSession.findUnique).not.toHaveBeenCalled();
  });

  it('no acepta un desafío MFA como access token', async () => {
    const challengeToken = 'a'.repeat(64);
    request.headers.authorization = `Bearer ${challengeToken}`;
    jwtMock.verifyAsync.mockRejectedValue(new Error('invalid JWT'));

    await expect(guard.canActivate(createContext())).rejects.toThrow(
      'No autenticado.',
    );

    expect(jwtMock.verifyAsync).toHaveBeenCalledWith(challengeToken);
    expect(prismaMock.userSession.findUnique).not.toHaveBeenCalled();
  });

  it('rechaza tokens sin identidad o sesión', async () => {
    request.headers.authorization = 'Bearer valid-token';
    jwtMock.verifyAsync.mockResolvedValue({
      sub: 'account-1',
      role: 'customer',
    });

    await expect(guard.canActivate(createContext())).rejects.toThrow(
      UnauthorizedException,
    );
    expect(prismaMock.userSession.findUnique).not.toHaveBeenCalled();
  });

  it('rechaza JWTs asociados a sesiones inexistentes', async () => {
    request.headers.authorization = 'Bearer valid-token';
    jwtMock.verifyAsync.mockResolvedValue({
      sub: 'account-1',
      role: 'customer',
      sid: 'missing-session',
    });
    prismaMock.userSession.findUnique.mockResolvedValue(null);

    await expect(guard.canActivate(createContext())).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rechaza sesiones revocadas excepto para logout idempotente', async () => {
    request.headers.authorization = 'Bearer valid-token';
    jwtMock.verifyAsync.mockResolvedValue({
      sub: 'account-1',
      role: 'customer',
      sid: 'session-1',
    });
    prismaMock.userSession.findUnique.mockResolvedValue({
      accountId: 'account-1',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: new Date(),
      account: { role: 'customer', status: 'active' },
    });

    await expect(guard.canActivate(createContext())).rejects.toThrow(
      UnauthorizedException,
    );

    reflectorMock.get.mockReturnValue(true);
    await expect(guard.canActivate(createContext())).resolves.toBe(true);
  });

  it('adjunta solo los claims requeridos de un JWT verificado', async () => {
    request.headers.authorization = 'Bearer valid-token';
    jwtMock.verifyAsync.mockResolvedValue({
      sub: 'account-1',
      role: 'customer',
      sid: 'session-1',
      email: 'not-copied@example.com',
    });

    await expect(guard.canActivate(createContext())).resolves.toBe(true);

    expect(jwtMock.verifyAsync).toHaveBeenCalledWith('valid-token');
    expect(prismaMock.userSession.findUnique).toHaveBeenCalledWith({
      where: { id: 'session-1' },
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
    expect(request.user).toEqual({
      sub: 'account-1',
      role: 'customer',
      sid: 'session-1',
    });
  });
});
