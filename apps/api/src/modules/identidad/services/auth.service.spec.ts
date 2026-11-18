import {
  BadRequestException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { createHash } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../../prisma/prisma.service';
import { ClientesService } from '../../clientes/services/clientes.service';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { MailerService } from './mailer.service';
import { MfaService } from './mfa.service';
import { Prisma } from '@prisma/client';
import { RefreshTokenDto } from '../dto/refresh-token.dto';

jest.mock('@nestjs/jwt', () => ({
  JwtService: class JwtService {},
}));

describe('AuthService', () => {
  let service: AuthService;

  const token = 'a'.repeat(64);
  const tokenHash = createHash('sha256').update(token).digest('hex');

  const txMock = {
    emailVerificationToken: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
    },
    account: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
    },
    userSession: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    refreshToken: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
    },
    passwordResetToken: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
    },
    mfaSecret: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      updateMany: jest.fn(),
    },
    mfaRecoveryCode: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    mfaChallenge: {
      findUnique: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  const prismaMock = {
    $transaction: jest.fn(),
    account: {
      findUnique: jest.fn(),
    },
    passwordResetToken: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
    },
  };

  const clientesMock = {
    findByEmail: jest.fn(),
    registerClientProfile: jest.fn(),
    rollbackClientRegistration: jest.fn(),
  };

  const passwordsMock = {
    hashPassword: jest.fn(),
    verifyPassword: jest.fn(),
  };

  const mfaMock = {
    generateSecret: jest.fn(),
    createProvisioningUri: jest.fn(),
    encryptSecret: jest.fn(),
    decryptSecret: jest.fn(),
    verifyTotp: jest.fn(),
    generateRecoveryCodes: jest.fn(),
    isRecoveryCode: jest.fn(),
    hashRecoveryCode: jest.fn(),
    hashChallengeToken: jest.fn(),
  };

  const mailerMock = {
    assertConfigured: jest.fn(),
    sendEmailVerification: jest.fn(),
    sendPasswordReset: jest.fn(),
  };

  const jwtMock = {
    signAsync: jest.fn(),
    decode: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    clientesMock.findByEmail.mockResolvedValue(null);
    clientesMock.registerClientProfile.mockResolvedValue({
      id: 'client-1',
      email: 'leonardo@example.com',
    });
    passwordsMock.hashPassword.mockResolvedValue('argon2id-hash');
    passwordsMock.verifyPassword.mockResolvedValue(true);
    mfaMock.generateSecret.mockReturnValue('JBSWY3DPEHPK3PXP');
    mfaMock.createProvisioningUri.mockImplementation(
      (accountId: string, secret: string) =>
        `otpauth://totp/${accountId}?secret=${secret}`,
    );
    mfaMock.encryptSecret.mockImplementation(
      (secret: string) => `encrypted:${secret}`,
    );
    mfaMock.decryptSecret.mockReturnValue('JBSWY3DPEHPK3PXP');
    mfaMock.verifyTotp.mockImplementation(
      (_secret: string, code: string, now: Date) =>
        /^\d{6}$/.test(code)
          ? Math.floor(now.getTime() / 30_000)
          : null,
    );
    mfaMock.generateRecoveryCodes.mockReturnValue(
      Array.from(
        { length: 10 },
        (_, index) =>
          `${index.toString(16).padStart(8, '0')}-AAAAAAAA-BBBBBBBB-CCCCCCCC`,
      ),
    );
    mfaMock.isRecoveryCode.mockImplementation((code: string) =>
      /^[A-F0-9]{8}(?:-[A-F0-9]{8}){3}$/i.test(code),
    );
    mfaMock.hashRecoveryCode.mockImplementation((code: string) => {
      const hash = createHash('sha256')
        .update(code.replace(/-/g, '').toUpperCase())
        .digest('hex');
      return `recovery:v1:${hash}`;
    });
    mfaMock.hashChallengeToken.mockImplementation((challenge: string) =>
      createHash('sha256').update(challenge).digest('hex'),
    );
    mailerMock.assertConfigured.mockReturnValue(undefined);
    mailerMock.sendEmailVerification.mockResolvedValue(undefined);
    mailerMock.sendPasswordReset.mockResolvedValue(undefined);
    jwtMock.signAsync.mockResolvedValue('signed-access-token');
    jwtMock.decode.mockReturnValue({
      exp: Math.floor(Date.now() / 1000) + 900,
    });
    prismaMock.account.findUnique.mockResolvedValue(null);
    prismaMock.passwordResetToken.findUnique.mockResolvedValue(null);
    prismaMock.passwordResetToken.create.mockResolvedValue({ id: 'reset-1' });
    prismaMock.passwordResetToken.updateMany.mockResolvedValue({ count: 1 });
    txMock.passwordResetToken.findUnique.mockResolvedValue(null);
    txMock.passwordResetToken.updateMany.mockResolvedValue({ count: 1 });
    txMock.passwordResetToken.create.mockResolvedValue({ id: 'reset-1' });
    txMock.account.create.mockResolvedValue({
      id: 'account-1',
      clientId: 'client-1',
    });
    txMock.emailVerificationToken.create.mockResolvedValue({
      id: 'verification-1',
      accountId: 'account-1',
    });
    txMock.userSession.create.mockResolvedValue({ id: 'session-1' });
    txMock.userSession.findUnique.mockResolvedValue(null);
    txMock.userSession.findMany.mockResolvedValue([]);
    txMock.userSession.updateMany.mockResolvedValue({ count: 1 });
    txMock.refreshToken.findUnique.mockResolvedValue(null);
    txMock.refreshToken.updateMany.mockResolvedValue({ count: 1 });
    txMock.refreshToken.create.mockResolvedValue({ id: 'refresh-1' });
    txMock.account.update.mockResolvedValue({ id: 'account-1' });
    txMock.account.updateMany.mockResolvedValue({ count: 1 });
    txMock.mfaSecret.findUnique.mockResolvedValue(null);
    txMock.mfaSecret.upsert.mockResolvedValue({
      id: 'mfa-secret-1',
      accountId: 'account-1',
    });
    txMock.mfaSecret.updateMany.mockResolvedValue({ count: 1 });
    txMock.mfaRecoveryCode.findUnique.mockResolvedValue(null);
    txMock.mfaRecoveryCode.updateMany.mockResolvedValue({ count: 1 });
    txMock.mfaRecoveryCode.create.mockResolvedValue({ id: 'recovery-1' });
    txMock.mfaRecoveryCode.deleteMany.mockResolvedValue({ count: 0 });
    txMock.mfaChallenge.findUnique.mockResolvedValue(null);
    txMock.mfaChallenge.create.mockResolvedValue({ id: 'mfa-challenge-1' });
    txMock.mfaChallenge.updateMany.mockResolvedValue({ count: 1 });

    prismaMock.$transaction.mockImplementation(
      (callback: (tx: typeof txMock) => Promise<unknown>) =>
        callback(txMock),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ClientesService, useValue: clientesMock },
        { provide: PasswordService, useValue: passwordsMock },
        { provide: MailerService, useValue: mailerMock },
        { provide: MfaService, useValue: mfaMock },
        { provide: JwtService, useValue: jwtMock },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('login', () => {
    const dto = {
      email: ' LEONARDO@EXAMPLE.COM ',
      password: 'UnaClaveSegura123',
    };

    const activeAccount = {
      id: 'account-1',
      passwordHash: 'argon2id-hash',
      role: 'customer',
      status: 'active',
      emailVerifiedAt: new Date(),
      mfaEnabled: false,
    };

    it('inicia sesión, crea sesión y guarda el hash del refresh token', async () => {
      clientesMock.findByEmail.mockResolvedValue({
        id: 'client-1',
        email: 'leonardo@example.com',
      });
      prismaMock.account.findUnique.mockResolvedValue(activeAccount);

      const result = await service.login(dto);
      const loginResult = result as { refreshToken: string };

      expect(clientesMock.findByEmail).toHaveBeenCalledWith(
        'leonardo@example.com',
      );
      expect(prismaMock.account.findUnique).toHaveBeenCalledWith({
        where: { clientId: 'client-1' },
        select: {
          id: true,
          passwordHash: true,
          role: true,
          status: true,
          emailVerifiedAt: true,
          mfaEnabled: true,
        },
      });
      expect(passwordsMock.verifyPassword).toHaveBeenCalledWith(
        dto.password,
        activeAccount.passwordHash,
      );
      expect(jwtMock.signAsync).toHaveBeenCalledWith({
        sub: 'account-1',
        role: 'customer',
        sid: expect.any(String),
      });

      const session = txMock.userSession.create.mock.calls[0][0]
        .data as { id: string; accountId: string; expiresAt: Date };
      expect(session).toEqual({
        id: expect.any(String),
        accountId: 'account-1',
        expiresAt: expect.any(Date),
      });
      expect(session.expiresAt.getTime()).toBeGreaterThan(
        Date.now() + 6 * 24 * 60 * 60 * 1000,
      );

      const refresh = txMock.refreshToken.create.mock.calls[0][0]
        .data as {
        sessionId: string;
        tokenHash: string;
        familyId: string;
        expiresAt: Date;
      };
      expect(refresh.sessionId).toBe(session.id);
      expect(refresh.tokenHash).toMatch(/^[a-f0-9]{64}$/);
      expect(refresh.familyId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
      expect(refresh.expiresAt).toEqual(session.expiresAt);
      expect(refresh.tokenHash).toBe(
        createHash('sha256').update(loginResult.refreshToken).digest('hex'),
      );
      expect(refresh.tokenHash).not.toBe(loginResult.refreshToken);

      expect(txMock.account.update).toHaveBeenCalledWith({
        where: { id: 'account-1' },
        data: { lastLoginAt: expect.any(Date) },
      });
      expect(result).toEqual({
        accessToken: 'signed-access-token',
        refreshToken: expect.stringMatching(/^[a-f0-9]{64}$/),
        expiresIn: expect.any(Number),
      });
      expect(result.expiresIn).toBeGreaterThan(0);
      expect(result).not.toHaveProperty('passwordHash');
      expect(result).not.toHaveProperty('tokenHash');
      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    });

    it('rechaza un correo inexistente con respuesta genérica', async () => {
      clientesMock.findByEmail.mockResolvedValue(null);

      await expect(service.login(dto)).rejects.toThrow(
        'Credenciales incorrectas o cuenta no disponible.',
      );

      expect(prismaMock.account.findUnique).not.toHaveBeenCalled();
      expect(passwordsMock.verifyPassword).not.toHaveBeenCalled();
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('rechaza una contraseña incorrecta sin crear una sesión', async () => {
      clientesMock.findByEmail.mockResolvedValue({ id: 'client-1' });
      prismaMock.account.findUnique.mockResolvedValue(activeAccount);
      passwordsMock.verifyPassword.mockResolvedValue(false);

      await expect(service.login(dto)).rejects.toThrow(
        'Credenciales incorrectas o cuenta no disponible.',
      );

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('rechaza una cuenta pendiente de confirmación', async () => {
      clientesMock.findByEmail.mockResolvedValue({ id: 'client-1' });
      prismaMock.account.findUnique.mockResolvedValue({
        ...activeAccount,
        status: 'pending_confirmation',
        emailVerifiedAt: null,
      });

      await expect(service.login(dto)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('rechaza una cuenta inactiva', async () => {
      clientesMock.findByEmail.mockResolvedValue({ id: 'client-1' });
      prismaMock.account.findUnique.mockResolvedValue({
        ...activeAccount,
        status: 'disabled',
      });

      await expect(service.login(dto)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('devuelve un desafío sin crear tokens cuando MFA está habilitado', async () => {
      clientesMock.findByEmail.mockResolvedValue({ id: 'client-1' });
      prismaMock.account.findUnique.mockResolvedValue({
        ...activeAccount,
        mfaEnabled: true,
      });
      txMock.account.findUnique.mockResolvedValue({
        id: 'account-1',
        role: 'customer',
        status: 'active',
        emailVerifiedAt: new Date(),
        mfaEnabled: true,
      });
      txMock.mfaSecret.findUnique.mockResolvedValue({ status: 'active' });

      const result = await service.login(dto);

      expect(jwtMock.signAsync).not.toHaveBeenCalled();
      expect(txMock.userSession.create).not.toHaveBeenCalled();
      expect(txMock.refreshToken.create).not.toHaveBeenCalled();
      expect(result).toEqual({
        mfaRequired: true,
        challengeToken: expect.any(String),
        expiresIn: 300,
      });
      const challenge = txMock.mfaChallenge.create.mock.calls[0][0]
        .data as { tokenHash: string };
      expect(challenge.tokenHash).toMatch(/^[a-f0-9]{64}$/);
      expect(challenge.tokenHash).not.toBe(
        (result as { challengeToken: string }).challengeToken,
      );
    });

    it('propaga el fallo al persistir la sesión sin actualizar lastLoginAt', async () => {
      const persistenceError = new Error('session persistence failed');
      clientesMock.findByEmail.mockResolvedValue({ id: 'client-1' });
      prismaMock.account.findUnique.mockResolvedValue(activeAccount);
      txMock.userSession.create.mockRejectedValue(persistenceError);

      await expect(service.login(dto)).rejects.toBe(persistenceError);

      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
      expect(txMock.refreshToken.create).not.toHaveBeenCalled();
      expect(txMock.account.update).not.toHaveBeenCalled();
    });

    it('propaga el fallo al persistir el refresh token dentro de la transacción', async () => {
      const persistenceError = new Error('refresh persistence failed');
      clientesMock.findByEmail.mockResolvedValue({ id: 'client-1' });
      prismaMock.account.findUnique.mockResolvedValue(activeAccount);
      txMock.refreshToken.create.mockRejectedValue(persistenceError);

      await expect(service.login(dto)).rejects.toBe(persistenceError);

      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
      expect(txMock.account.update).not.toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    const dto: RefreshTokenDto = {
      refreshToken: token,
    };

    const makeRefreshRecord = (options?: {
      tokenExpiresAt?: Date;
      revokedAt?: Date | null;
      replacedByTokenId?: string | null;
      sessionExpiresAt?: Date;
      sessionRevokedAt?: Date | null;
      accountStatus?: string;
      mfaEnabled?: boolean;
    }) => {
      const sessionExpiresAt =
        options?.sessionExpiresAt ??
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      return {
        id: 'refresh-1',
        sessionId: 'session-1',
        familyId: 'family-1',
        expiresAt:
          options?.tokenExpiresAt ??
          new Date(Date.now() + 60 * 60 * 1000),
        revokedAt: options?.revokedAt ?? null,
        replacedByTokenId: options?.replacedByTokenId ?? null,
        session: {
          id: 'session-1',
          accountId: 'account-1',
          expiresAt: sessionExpiresAt,
          revokedAt: options?.sessionRevokedAt ?? null,
          account: {
            id: 'account-1',
            role: 'customer',
            status: options?.accountStatus ?? 'active',
            mfaEnabled: options?.mfaEnabled ?? false,
          },
        },
      };
    };

    it('rota el refresh token y conserva sesión y familia', async () => {
      const record = makeRefreshRecord();
      txMock.refreshToken.findUnique.mockResolvedValue(record);

      const result = await service.refresh(dto);

      expect(txMock.refreshToken.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tokenHash: createHash('sha256')
              .update(dto.refreshToken)
              .digest('hex'),
          },
        }),
      );
      expect(txMock.refreshToken.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'refresh-1',
          revokedAt: null,
          expiresAt: { gt: expect.any(Date) },
        },
        data: {
          revokedAt: expect.any(Date),
          replacedByTokenId: expect.any(String),
        },
      });

      const revokedToken =
        txMock.refreshToken.updateMany.mock.calls[0][0].data;
      const nextToken = txMock.refreshToken.create.mock.calls[0][0]
        .data as {
        id: string;
        sessionId: string;
        tokenHash: string;
        familyId: string;
        expiresAt: Date;
      };
      expect(nextToken.id).toBe(revokedToken.replacedByTokenId);
      expect(nextToken.sessionId).toBe('session-1');
      expect(nextToken.familyId).toBe('family-1');
      expect(nextToken.expiresAt).toEqual(record.session.expiresAt);
      expect(nextToken.tokenHash).toBe(
        createHash('sha256').update(result.refreshToken).digest('hex'),
      );
      expect(nextToken.tokenHash).not.toBe(result.refreshToken);
      expect(result.refreshToken).not.toBe(dto.refreshToken);
      expect(jwtMock.signAsync).toHaveBeenCalledWith({
        sub: 'account-1',
        role: 'customer',
        sid: 'session-1',
      });
      expect(result).toEqual({
        accessToken: 'signed-access-token',
        refreshToken: expect.stringMatching(/^[a-f0-9]{64}$/),
        expiresIn: expect.any(Number),
      });
    });

    it('rechaza un refresh token inexistente sin revocar ninguna sesión', async () => {
      txMock.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.refresh(dto)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(txMock.refreshToken.updateMany).not.toHaveBeenCalled();
      expect(txMock.userSession.updateMany).not.toHaveBeenCalled();
      expect(jwtMock.signAsync).not.toHaveBeenCalled();
    });

    it('rechaza un refresh token caducado', async () => {
      txMock.refreshToken.findUnique.mockResolvedValue(
        makeRefreshRecord({
          tokenExpiresAt: new Date(Date.now() - 1000),
        }),
      );

      await expect(service.refresh(dto)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(txMock.refreshToken.updateMany).not.toHaveBeenCalled();
      expect(txMock.userSession.updateMany).not.toHaveBeenCalled();
    });

    it('rechaza un token revocado que no fue reemplazado', async () => {
      txMock.refreshToken.findUnique.mockResolvedValue(
        makeRefreshRecord({ revokedAt: new Date() }),
      );

      await expect(service.refresh(dto)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(txMock.refreshToken.updateMany).not.toHaveBeenCalled();
      expect(txMock.userSession.updateMany).not.toHaveBeenCalled();
    });

    it('rechaza un token asociado a una sesión revocada', async () => {
      txMock.refreshToken.findUnique.mockResolvedValue(
        makeRefreshRecord({ sessionRevokedAt: new Date() }),
      );

      await expect(service.refresh(dto)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(txMock.refreshToken.updateMany).not.toHaveBeenCalled();
      expect(jwtMock.signAsync).not.toHaveBeenCalled();
    });

    it('rechaza un token asociado a una sesión caducada', async () => {
      txMock.refreshToken.findUnique.mockResolvedValue(
        makeRefreshRecord({
          sessionExpiresAt: new Date(Date.now() - 1000),
        }),
      );

      await expect(service.refresh(dto)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(txMock.refreshToken.updateMany).not.toHaveBeenCalled();
      expect(jwtMock.signAsync).not.toHaveBeenCalled();
    });

    it('rechaza un token asociado a una cuenta inactiva', async () => {
      txMock.refreshToken.findUnique.mockResolvedValue(
        makeRefreshRecord({ accountStatus: 'disabled' }),
      );

      await expect(service.refresh(dto)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(txMock.refreshToken.updateMany).not.toHaveBeenCalled();
      expect(jwtMock.signAsync).not.toHaveBeenCalled();
    });

    it('revoca la familia y la sesión si se reutiliza un token rotado', async () => {
      txMock.refreshToken.findUnique.mockResolvedValue(
        makeRefreshRecord({
          revokedAt: new Date(),
          replacedByTokenId: 'refresh-2',
        }),
      );

      await expect(service.refresh(dto)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(txMock.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { familyId: 'family-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(txMock.userSession.updateMany).toHaveBeenCalledWith({
        where: { id: 'session-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(txMock.refreshToken.create).not.toHaveBeenCalled();
      expect(jwtMock.signAsync).not.toHaveBeenCalled();
    });

    it('permite renovar solo una vez cuando dos solicitudes compiten', async () => {
      let latestToken = makeRefreshRecord();

      txMock.refreshToken.findUnique.mockImplementation(
        async (args: { where: { tokenHash?: string; id?: string } }) => {
          if (args.where.tokenHash) {
            return { ...latestToken };
          }

          return {
            revokedAt: latestToken.revokedAt,
            replacedByTokenId: latestToken.replacedByTokenId,
          };
        },
      );
      txMock.refreshToken.updateMany.mockImplementation(
        async (args: {
          where: { id?: string; familyId?: string; revokedAt?: null };
          data: { revokedAt: Date; replacedByTokenId?: string };
        }) => {
          if (args.where.id) {
            if (latestToken.revokedAt) {
              return { count: 0 };
            }

            latestToken = {
              ...latestToken,
              revokedAt: args.data.revokedAt,
              replacedByTokenId: args.data.replacedByTokenId ?? null,
            };
            return { count: 1 };
          }

          return { count: 1 };
        },
      );

      const results = await Promise.allSettled([
        service.refresh(dto),
        service.refresh(dto),
      ]);

      expect(
        results.filter((result) => result.status === 'fulfilled'),
      ).toHaveLength(1);
      expect(
        results.filter((result) => result.status === 'rejected'),
      ).toHaveLength(1);
      expect(txMock.refreshToken.create).toHaveBeenCalledTimes(1);
      expect(txMock.userSession.updateMany).toHaveBeenCalledTimes(1);
    });

    it('propaga errores de persistencia sin devolver nuevos tokens', async () => {
      const persistenceError = new Error('refresh persistence failed');
      txMock.refreshToken.findUnique.mockResolvedValue(makeRefreshRecord());
      txMock.refreshToken.create.mockRejectedValue(persistenceError);

      await expect(service.refresh(dto)).rejects.toBe(persistenceError);

      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
      expect(txMock.refreshToken.updateMany).toHaveBeenCalledTimes(1);
    });
  });

  describe('logout', () => {
    const accountId = 'account-1';
    const sessionId = 'session-1';

    it('revoca la sesión y todos sus refresh tokens activos', async () => {
      txMock.userSession.findUnique.mockResolvedValue({
        accountId,
        revokedAt: null,
      });

      const result = await service.logout(accountId, sessionId);

      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
      expect(txMock.userSession.findUnique).toHaveBeenCalledWith({
        where: { id: sessionId },
        select: { accountId: true, revokedAt: true },
      });
      expect(txMock.userSession.updateMany).toHaveBeenCalledWith({
        where: { id: sessionId, accountId, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(txMock.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { sessionId, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(result).toEqual({ message: 'Sesión cerrada correctamente.' });
      expect(result).not.toHaveProperty('accessToken');
      expect(result).not.toHaveProperty('refreshToken');
    });

    it('rechaza una sesión inexistente', async () => {
      txMock.userSession.findUnique.mockResolvedValue(null);

      await expect(service.logout(accountId, sessionId)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(txMock.userSession.updateMany).not.toHaveBeenCalled();
      expect(txMock.refreshToken.updateMany).not.toHaveBeenCalled();
    });

    it('no permite revocar una sesión perteneciente a otra cuenta', async () => {
      txMock.userSession.findUnique.mockResolvedValue({
        accountId: 'another-account',
        revokedAt: null,
      });

      await expect(service.logout(accountId, sessionId)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(txMock.userSession.updateMany).not.toHaveBeenCalled();
      expect(txMock.refreshToken.updateMany).not.toHaveBeenCalled();
    });

    it('responde exitosamente si la sesión ya estaba revocada', async () => {
      txMock.userSession.findUnique.mockResolvedValue({
        accountId,
        revokedAt: new Date(),
      });

      await expect(service.logout(accountId, sessionId)).resolves.toEqual({
        message: 'Sesión cerrada correctamente.',
      });

      expect(txMock.userSession.updateMany).not.toHaveBeenCalled();
      expect(txMock.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { sessionId, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('permite repetir el cierre sin errores ni revocar otra sesión', async () => {
      let revokedAt: Date | null = null;
      txMock.userSession.findUnique.mockImplementation(async () => ({
        accountId,
        revokedAt,
      }));
      txMock.userSession.updateMany.mockImplementation(async (args) => {
        if (revokedAt) {
          return { count: 0 };
        }

        revokedAt = args.data.revokedAt;
        return { count: 1 };
      });

      const first = await service.logout(accountId, sessionId);
      const second = await service.logout(accountId, sessionId);

      expect(first).toEqual(second);
      expect(txMock.userSession.updateMany).toHaveBeenCalledTimes(1);
      expect(txMock.refreshToken.updateMany).toHaveBeenCalledTimes(2);
    });

    it('propaga los fallos de persistencia de la transacción', async () => {
      const transactionError = new Error('logout transaction failed');
      txMock.userSession.findUnique.mockResolvedValue({
        accountId,
        revokedAt: null,
      });
      txMock.refreshToken.updateMany.mockRejectedValue(transactionError);

      await expect(
        service.logout(accountId, sessionId),
      ).rejects.toBe(transactionError);

      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    });

    it('no permite renovar los refresh tokens revocados por logout', async () => {
      txMock.userSession.findUnique.mockResolvedValue({
        accountId,
        revokedAt: null,
      });
      await service.logout(accountId, sessionId);

      txMock.refreshToken.findUnique.mockResolvedValue({
        id: 'refresh-1',
        sessionId,
        familyId: 'family-1',
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: new Date(),
        replacedByTokenId: null,
        session: {
          id: sessionId,
          accountId,
          expiresAt: new Date(Date.now() + 60_000),
          revokedAt: null,
          account: {
            id: accountId,
            role: 'customer',
            status: 'active',
            mfaEnabled: false,
          },
        },
      });

      await expect(
        service.refresh({ refreshToken: token }),
      ).rejects.toThrow(UnauthorizedException);
      expect(jwtMock.signAsync).not.toHaveBeenCalled();
    });
  });

  describe('register', () => {
    const dto = {
      fullName: ' Leonardo Mendieta ',
      email: ' LEONARDO@EXAMPLE.COM ',
      password: 'UnaClaveSegura123',
      acceptsPrivacyPolicy: true,
    };

    it('registra el perfil, la cuenta y el token con una expiración de 30 minutos', async () => {
      const before = Date.now();
      const result = await service.register(dto);

      expect(clientesMock.findByEmail).toHaveBeenCalledWith(
        'leonardo@example.com',
      );
      expect(passwordsMock.hashPassword).toHaveBeenCalledWith(dto.password);
      expect(clientesMock.registerClientProfile).toHaveBeenCalledWith({
        fullName: dto.fullName,
        email: 'leonardo@example.com',
      });
      expect(txMock.account.create).toHaveBeenCalledWith({
        data: {
          clientId: 'client-1',
          passwordHash: 'argon2id-hash',
          role: 'customer',
          status: 'pending_confirmation',
        },
      });
      expect(txMock.emailVerificationToken.create).toHaveBeenCalledWith({
        data: {
          accountId: 'account-1',
          tokenHash: expect.any(String),
          expiresAt: expect.any(Date),
        },
      });

      const tokenData = txMock.emailVerificationToken.create.mock.calls[0][0]
        .data as { tokenHash: string; expiresAt: Date };
      expect(tokenData.tokenHash).toMatch(/^[a-f0-9]{64}$/);
      expect(tokenData.expiresAt.getTime()).toBeGreaterThanOrEqual(
        before + 30 * 60 * 1000,
      );
      expect(tokenData.expiresAt.getTime()).toBeLessThanOrEqual(
        Date.now() + 30 * 60 * 1000,
      );

      expect(mailerMock.sendEmailVerification).toHaveBeenCalledWith(
        'leonardo@example.com',
        expect.stringMatching(/^[a-f0-9]{64}$/),
      );
      expect(result.message).toBe(
        'Si los datos son válidos, recibirás instrucciones en tu correo electrónico.',
      );
    });

    it('devuelve una respuesta genérica si el perfil ya existe', async () => {
      clientesMock.findByEmail.mockResolvedValue({ id: 'existing-client' });

      const result = await service.register(dto);

      expect(result.message).toBe(
        'Si los datos son válidos, recibirás instrucciones en tu correo electrónico.',
      );
      expect(passwordsMock.hashPassword).not.toHaveBeenCalled();
      expect(clientesMock.registerClientProfile).not.toHaveBeenCalled();
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('compensa el perfil si falla la creación de la cuenta', async () => {
      txMock.account.create.mockRejectedValue(new Error('account failed'));

      await expect(service.register(dto)).rejects.toThrow('account failed');

      expect(prismaMock.account.findUnique).toHaveBeenCalledWith({
        where: { clientId: 'client-1' },
        select: { id: true },
      });
      expect(clientesMock.rollbackClientRegistration).toHaveBeenCalledWith(
        'client-1',
        'leonardo@example.com',
      );
    });

    it('revierte el registro y propaga el error si falla la cuenta y no existe una asociada', async () => {
      const originalError = new Error('account creation failed');
      txMock.account.create.mockRejectedValue(originalError);
      prismaMock.account.findUnique.mockResolvedValue(null);

      await expect(service.register(dto)).rejects.toBe(originalError);

      expect(clientesMock.registerClientProfile).toHaveBeenCalledWith({
        fullName: dto.fullName,
        email: 'leonardo@example.com',
      });
      expect(prismaMock.account.findUnique).toHaveBeenCalledWith({
        where: { clientId: 'client-1' },
        select: { id: true },
      });
      expect(clientesMock.rollbackClientRegistration).toHaveBeenCalledWith(
        'client-1',
        'leonardo@example.com',
      );
      expect(mailerMock.sendEmailVerification).not.toHaveBeenCalled();
    });

    it('compensa el perfil si falla la creación del token', async () => {
      txMock.emailVerificationToken.create.mockRejectedValue(
        new Error('token failed'),
      );

      await expect(service.register(dto)).rejects.toThrow('token failed');

      expect(clientesMock.rollbackClientRegistration).toHaveBeenCalledWith(
        'client-1',
        'leonardo@example.com',
      );
    });

    it('no compensa si ya existe una cuenta asociada', async () => {
      prismaMock.account.findUnique.mockResolvedValue({ id: 'account-1' });
      txMock.account.create.mockRejectedValue(new Error('account failed'));

      await expect(service.register(dto)).rejects.toThrow('account failed');

      expect(clientesMock.rollbackClientRegistration).not.toHaveBeenCalled();
    });

    it('no compensa si no puede comprobarse la existencia de la cuenta', async () => {
      prismaMock.account.findUnique.mockRejectedValue(
        new Error('database unavailable'),
      );
      txMock.account.create.mockRejectedValue(new Error('account failed'));

      await expect(service.register(dto)).rejects.toThrow('account failed');

      expect(clientesMock.rollbackClientRegistration).not.toHaveBeenCalled();
    });

    it('devuelve una respuesta genérica ante conflictos P2002', async () => {
      const conflict = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '6.19.3',
        },
      );
      txMock.account.create.mockRejectedValue(conflict);

      const result = await service.register(dto);

      expect(result.message).toBe(
        'Si los datos son válidos, recibirás instrucciones en tu correo electrónico.',
      );
    });

    it('mantiene la cuenta pendiente si falla el envío del correo', async () => {
      mailerMock.sendEmailVerification.mockRejectedValue(
        new Error('smtp unavailable'),
      );

      await expect(service.register(dto)).rejects.toThrow(
        'No fue posible enviar el correo.',
      );

      expect(clientesMock.rollbackClientRegistration).not.toHaveBeenCalled();
      expect(prismaMock.account.findUnique).not.toHaveBeenCalled();
    });

    it('valida la configuración del correo antes de registrar', async () => {
      mailerMock.assertConfigured.mockImplementation(() => {
        throw new Error('correo no configurado');
      });

      await expect(service.register(dto)).rejects.toThrow(
        'correo no configurado',
      );

      expect(clientesMock.findByEmail).not.toHaveBeenCalled();
    });
  });

  it('confirma un token válido, lo consume y activa la cuenta', async () => {
    const verification = {
      id: 'verification-1',
      accountId: 'account-1',
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    };

    const account = {
      id: 'account-1',
      status: 'active',
      emailVerifiedAt: new Date(),
    };

    txMock.emailVerificationToken.findUnique.mockResolvedValue(verification);
    txMock.emailVerificationToken.updateMany.mockResolvedValue({ count: 1 });
    txMock.account.update.mockResolvedValue(account);

    const result = await service.confirmEmail({ token });

    expect(txMock.emailVerificationToken.findUnique).toHaveBeenCalledWith({
      where: { tokenHash },
    });

    expect(txMock.emailVerificationToken.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'verification-1',
        usedAt: null,
        expiresAt: expect.objectContaining({ gt: expect.any(Date) }),
      },
      data: { usedAt: expect.any(Date) },
    });

    expect(txMock.account.update).toHaveBeenCalledWith({
      where: { id: 'account-1' },
      data: {
        status: 'active',
        emailVerifiedAt: expect.any(Date),
      },
    });

    expect(result).toEqual({
      message: 'Correo electrónico confirmado correctamente.',
    });
  });

  it('rechaza un token reutilizado aunque la cuenta ya esté confirmada', async () => {
    const verification = {
      id: 'verification-1',
      accountId: 'account-1',
      usedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    };

    txMock.emailVerificationToken.findUnique.mockResolvedValue(verification);

    await expect(service.confirmEmail({ token })).rejects.toThrow(
      BadRequestException,
    );

    expect(txMock.account.findUnique).not.toHaveBeenCalled();
    expect(txMock.emailVerificationToken.updateMany).not.toHaveBeenCalled();
    expect(txMock.account.update).not.toHaveBeenCalled();
  });

  it('rechaza un token utilizado si la cuenta no está confirmada', async () => {
    txMock.emailVerificationToken.findUnique.mockResolvedValue({
      id: 'verification-1',
      accountId: 'account-1',
      usedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });

    txMock.account.findUnique.mockResolvedValue({
      id: 'account-1',
      status: 'pending_confirmation',
      emailVerifiedAt: null,
    });

    await expect(service.confirmEmail({ token })).rejects.toThrow(
      BadRequestException,
    );

    expect(txMock.emailVerificationToken.updateMany).not.toHaveBeenCalled();
    expect(txMock.account.update).not.toHaveBeenCalled();
  });

  it('rechaza un token inexistente', async () => {
    txMock.emailVerificationToken.findUnique.mockResolvedValue(null);

    await expect(service.confirmEmail({ token })).rejects.toThrow(
      BadRequestException,
    );

    expect(txMock.account.findUnique).not.toHaveBeenCalled();
    expect(txMock.emailVerificationToken.updateMany).not.toHaveBeenCalled();
    expect(txMock.account.update).not.toHaveBeenCalled();
  });

  it('rechaza un token caducado', async () => {
    txMock.emailVerificationToken.findUnique.mockResolvedValue({
      id: 'verification-1',
      accountId: 'account-1',
      usedAt: null,
      expiresAt: new Date(Date.now() - 60_000),
    });

    await expect(service.confirmEmail({ token })).rejects.toThrow(
      BadRequestException,
    );

    expect(txMock.emailVerificationToken.updateMany).not.toHaveBeenCalled();
    expect(txMock.account.update).not.toHaveBeenCalled();
  });

  it('rechaza el token si otro proceso ya lo consumió', async () => {
    txMock.emailVerificationToken.findUnique.mockResolvedValue({
      id: 'verification-1',
      accountId: 'account-1',
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });

    txMock.emailVerificationToken.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.confirmEmail({ token })).rejects.toThrow(
      BadRequestException,
    );

    expect(txMock.account.update).not.toHaveBeenCalled();
  });

  describe('forgotPassword', () => {
    const dto = { email: ' LEONARDO@EXAMPLE.COM ' };
    const activeAccount = {
      id: 'account-1',
      status: 'active',
      emailVerifiedAt: new Date(),
    };

    it('crea y envía un token almacenando solo su hash', async () => {
      clientesMock.findByEmail.mockResolvedValue({
        id: 'client-1',
        email: 'leonardo@example.com',
      });
      prismaMock.account.findUnique.mockResolvedValue(activeAccount);
      type StoredResetToken = {
        accountId: string;
        tokenHash: string;
        expiresAt: Date;
      };
      let storedToken: StoredResetToken | undefined;
      let mailedToken: string | undefined;
      prismaMock.passwordResetToken.create.mockImplementationOnce(
        (args: { data: StoredResetToken }): Promise<{ id: string }> => {
          storedToken = args.data;
          return Promise.resolve({ id: 'reset-1' });
        },
      );
      mailerMock.sendPasswordReset.mockImplementationOnce(
        (_email: string, resetToken: string): Promise<void> => {
          mailedToken = resetToken;
          return Promise.resolve();
        },
      );
      const before = Date.now();

      const result = await service.forgotPassword(dto);

      expect(clientesMock.findByEmail).toHaveBeenCalledWith(
        'leonardo@example.com',
      );
      expect(prismaMock.account.findUnique).toHaveBeenCalledWith({
        where: { clientId: 'client-1' },
        select: { id: true, status: true, emailVerifiedAt: true },
      });
      if (!storedToken || !mailedToken) {
        throw new Error('No se capturaron los datos del token de recuperación.');
      }
      const stored = storedToken;
      expect(stored.accountId).toBe('account-1');
      expect(stored.tokenHash).toBe(
        createHash('sha256').update(mailedToken).digest('hex'),
      );
      expect(stored.expiresAt).toBeInstanceOf(Date);
      expect(stored.tokenHash).toMatch(/^[a-f0-9]{64}$/);
      expect(stored.tokenHash).not.toBe(mailedToken);
      expect(stored.expiresAt.getTime()).toBeGreaterThanOrEqual(
        before + 30 * 60 * 1000,
      );
      expect(stored.expiresAt.getTime()).toBeLessThanOrEqual(
        Date.now() + 30 * 60 * 1000,
      );
      expect(mailerMock.sendPasswordReset).toHaveBeenCalledWith(
        'leonardo@example.com',
        expect.stringMatching(/^[a-f0-9]{64}$/),
      );
      expect(result.message).toBe(
        'Si la cuenta puede recuperar su contraseña, recibirás instrucciones en tu correo electrónico.',
      );
      expect(JSON.stringify(result)).not.toContain(mailedToken);
      expect(JSON.stringify(result)).not.toContain('leonardo@example.com');
    });

    it('responde de forma genérica si el correo no existe', async () => {
      const result = await service.forgotPassword(dto);

      expect(result.message).toBe(
        'Si la cuenta puede recuperar su contraseña, recibirás instrucciones en tu correo electrónico.',
      );
      expect(prismaMock.account.findUnique).not.toHaveBeenCalled();
      expect(prismaMock.passwordResetToken.create).not.toHaveBeenCalled();
      expect(mailerMock.sendPasswordReset).not.toHaveBeenCalled();
    });

    it.each([
      ['sin cuenta asociada', null],
      ['cuenta inactiva', { ...activeAccount, status: 'inactive' }],
      ['correo sin confirmar', { ...activeAccount, emailVerifiedAt: null }],
    ])('no crea ni envía tokens para una %s', async (_label, account) => {
      clientesMock.findByEmail.mockResolvedValue({ id: 'client-1' });
      prismaMock.account.findUnique.mockResolvedValue(account);

      const result = await service.forgotPassword(dto);

      expect(result.message).toBe(
        'Si la cuenta puede recuperar su contraseña, recibirás instrucciones en tu correo electrónico.',
      );
      expect(prismaMock.passwordResetToken.create).not.toHaveBeenCalled();
      expect(mailerMock.sendPasswordReset).not.toHaveBeenCalled();
    });

    it('invalida el token y conserva la respuesta genérica si falla el correo', async () => {
      const errorLog = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      clientesMock.findByEmail.mockResolvedValue({ id: 'client-1' });
      prismaMock.account.findUnique.mockResolvedValue(activeAccount);
      mailerMock.sendPasswordReset.mockRejectedValue(
        new Error('SMTP failed with private details'),
      );
      let storedTokenHash: string | undefined;
      type CleanupUpdate = {
        where: { tokenHash: string; usedAt: null };
        data: { usedAt: Date };
      };
      let cleanupUpdate: CleanupUpdate | undefined;
      prismaMock.passwordResetToken.create.mockImplementationOnce(
        (args: { data: { tokenHash: string } }): Promise<{ id: string }> => {
          storedTokenHash = args.data.tokenHash;
          return Promise.resolve({ id: 'reset-1' });
        },
      );
      prismaMock.passwordResetToken.updateMany.mockImplementationOnce(
        (args: CleanupUpdate): Promise<{ count: number }> => {
          cleanupUpdate = args;
          return Promise.resolve({ count: 1 });
        },
      );

      const result = await service.forgotPassword(dto);

      if (!storedTokenHash || !cleanupUpdate) {
        throw new Error('No se capturó el hash del token de recuperación.');
      }
      expect(cleanupUpdate.where.tokenHash).toBe(storedTokenHash);
      expect(cleanupUpdate.where.usedAt).toBeNull();
      expect(cleanupUpdate.data.usedAt).toBeInstanceOf(Date);
      expect(result.message).toBe(
        'Si la cuenta puede recuperar su contraseña, recibirás instrucciones en tu correo electrónico.',
      );
      expect(JSON.stringify(result)).not.toContain('SMTP');
      expect(errorLog).toHaveBeenCalledWith(
        'No se pudo enviar un correo de restablecimiento de contraseña.',
      );
      errorLog.mockRestore();
    });
  });

  describe('resetPassword', () => {
    type ResetTokenRecord = {
      id: string;
      accountId: string;
      usedAt: Date | null;
      expiresAt: Date;
      account: {
        status: string;
        emailVerifiedAt: Date | null;
      };
    };
    const dto = {
      token,
      password: 'NuevaClaveSegura123',
    };
    const validResetToken = (): ResetTokenRecord => ({
      id: 'reset-1',
      accountId: 'account-1',
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      account: {
        status: 'active',
        emailVerifiedAt: new Date(),
      },
    });

    beforeEach(() => {
      prismaMock.passwordResetToken.findUnique.mockResolvedValue(
        validResetToken(),
      );
      txMock.passwordResetToken.findUnique.mockResolvedValue(
        validResetToken(),
      );
      txMock.userSession.findMany.mockResolvedValue([
        { id: 'session-1' },
        { id: 'session-2' },
      ]);
    });

    it('consume el token, actualiza la contraseña e invalida sesiones y tokens', async () => {
      type TokenUpdate = {
        where: {
          id?: string | { not: string };
          accountId?: string;
          usedAt: null;
          expiresAt: { gt: Date };
        };
        data: { usedAt: Date };
      };
      type SessionUpdate = {
        where: { accountId: string; revokedAt: null };
        data: { revokedAt: Date };
      };
      type RefreshUpdate = {
        where: { sessionId: { in: string[] }; revokedAt: null };
        data: { revokedAt: Date };
      };
      const tokenUpdates: TokenUpdate[] = [];
      let sessionUpdate: SessionUpdate | undefined;
      let refreshUpdate: RefreshUpdate | undefined;
      const captureTokenUpdate = (args: TokenUpdate): Promise<{ count: number }> => {
        tokenUpdates.push(args);
        return Promise.resolve({ count: 1 });
      };
      txMock.passwordResetToken.updateMany
        .mockImplementationOnce(captureTokenUpdate)
        .mockImplementationOnce(captureTokenUpdate);
      txMock.userSession.updateMany.mockImplementationOnce(
        (args: SessionUpdate): Promise<{ count: number }> => {
          sessionUpdate = args;
          return Promise.resolve({ count: 2 });
        },
      );
      txMock.refreshToken.updateMany.mockImplementationOnce(
        (args: RefreshUpdate): Promise<{ count: number }> => {
          refreshUpdate = args;
          return Promise.resolve({ count: 2 });
        },
      );

      const result = await service.resetPassword(dto);

      expect(prismaMock.passwordResetToken.findUnique).toHaveBeenCalledWith({
        where: { tokenHash },
        select: {
          id: true,
          accountId: true,
          expiresAt: true,
          usedAt: true,
          account: {
            select: { status: true, emailVerifiedAt: true },
          },
        },
      });
      expect(txMock.passwordResetToken.findUnique).toHaveBeenCalledWith({
        where: { tokenHash },
        select: {
          id: true,
          accountId: true,
          expiresAt: true,
          usedAt: true,
          account: {
            select: { status: true, emailVerifiedAt: true },
          },
        },
      });
      expect(tokenUpdates).toHaveLength(2);
      expect(tokenUpdates[0].where.id).toBe('reset-1');
      expect(tokenUpdates[0].where.usedAt).toBeNull();
      expect(tokenUpdates[0].where.expiresAt.gt).toBeInstanceOf(Date);
      expect(tokenUpdates[0].data.usedAt).toBeInstanceOf(Date);
      expect(txMock.account.update).toHaveBeenCalledWith({
        where: { id: 'account-1' },
        data: { passwordHash: 'argon2id-hash' },
      });
      expect(passwordsMock.hashPassword).toHaveBeenCalledWith(dto.password);
      expect(tokenUpdates[1].where.accountId).toBe('account-1');
      expect(tokenUpdates[1].where.id).toEqual({ not: 'reset-1' });
      expect(tokenUpdates[1].data.usedAt).toBeInstanceOf(Date);
      if (!sessionUpdate || !refreshUpdate) {
        throw new Error('No se capturaron las revocaciones de sesión.');
      }
      expect(sessionUpdate.where).toEqual({
        accountId: 'account-1',
        revokedAt: null,
      });
      expect(sessionUpdate.data.revokedAt).toBeInstanceOf(Date);
      expect(refreshUpdate.where).toEqual({
        sessionId: { in: ['session-1', 'session-2'] },
        revokedAt: null,
      });
      expect(refreshUpdate.data.revokedAt).toBeInstanceOf(Date);
      expect(result).toEqual({
        message:
          'La contraseña se restableció correctamente. Inicia sesión con la nueva contraseña.',
      });
      expect(result).not.toHaveProperty('accessToken');
      expect(result).not.toHaveProperty('refreshToken');
      expect(jwtMock.signAsync).not.toHaveBeenCalled();
      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    });

    const invalidTokens: Array<[string, ResetTokenRecord | null]> = [
      ['inexistente', null],
      [
        'caducado',
        { ...validResetToken(), expiresAt: new Date(Date.now() - 60_000) },
      ],
      ['utilizado', { ...validResetToken(), usedAt: new Date() }],
      [
        'asociado a una cuenta inactiva',
        {
          ...validResetToken(),
          account: { status: 'inactive', emailVerifiedAt: new Date() },
        },
      ],
      [
        'asociado a un correo sin confirmar',
        {
          ...validResetToken(),
          account: { status: 'active', emailVerifiedAt: null },
        },
      ],
    ];

    it.each(invalidTokens)('rechaza un token %s', async (_label, resetToken) => {
      prismaMock.passwordResetToken.findUnique.mockResolvedValue(resetToken);

      await expect(service.resetPassword(dto)).rejects.toThrow(
        BadRequestException,
      );

      expect(passwordsMock.hashPassword).not.toHaveBeenCalled();
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('rechaza el restablecimiento si el token se consume concurrentemente', async () => {
      txMock.passwordResetToken.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.resetPassword(dto)).rejects.toThrow(
        BadRequestException,
      );

      expect(txMock.account.update).not.toHaveBeenCalled();
      expect(txMock.userSession.updateMany).not.toHaveBeenCalled();
      expect(txMock.refreshToken.updateMany).not.toHaveBeenCalled();
    });

    it('propaga un fallo de persistencia dentro de la transacción', async () => {
      const databaseError = new Error('database unavailable');
      txMock.refreshToken.updateMany.mockRejectedValue(databaseError);

      await expect(service.resetPassword(dto)).rejects.toBe(databaseError);

      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('MFA', () => {
    const activeAccount = {
      id: 'account-1',
      status: 'active',
      role: 'customer',
      emailVerifiedAt: new Date(),
      mfaEnabled: false,
    };

    const challenge = (overrides = {}) => ({
      id: 'challenge-1',
      accountId: 'account-1',
      purpose: 'login',
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
      account: {
        role: 'customer',
        status: 'active',
        emailVerifiedAt: new Date(),
        mfaEnabled: true,
      },
      ...overrides,
    });

    it('crea una configuración pendiente y persiste el secreto cifrado', async () => {
      txMock.account.findUnique.mockResolvedValue(activeAccount);

      const result = await service.setupMfa('account-1');

      expect(result).toEqual({
        qrCodeUrl:
          'otpauth://totp/account-1?secret=JBSWY3DPEHPK3PXP',
        status: 'pending_activation',
      });
      expect(txMock.mfaSecret.upsert).toHaveBeenCalledWith({
        where: { accountId: 'account-1' },
        create: {
          accountId: 'account-1',
          status: 'pending_activation',
          secretEncrypted: 'encrypted:JBSWY3DPEHPK3PXP',
        },
        update: {
          status: 'pending_activation',
          secretEncrypted: 'encrypted:JBSWY3DPEHPK3PXP',
          enabledAt: null,
          lastVerifiedAt: null,
        },
      });
    });

    it('rechaza la activación cuando el código TOTP es incorrecto', async () => {
      txMock.account.findUnique.mockResolvedValue(activeAccount);
      txMock.mfaSecret.findUnique.mockResolvedValue({
        id: 'mfa-secret-1',
        status: 'pending_activation',
        secretEncrypted: 'encrypted-secret',
        lastVerifiedAt: null,
      });
      mfaMock.verifyTotp.mockReturnValue(null);

      await expect(
        service.verifyMfa('account-1', { code: '000000' }),
      ).rejects.toThrow(BadRequestException);

      expect(txMock.account.updateMany).not.toHaveBeenCalled();
      expect(txMock.mfaRecoveryCode.create).not.toHaveBeenCalled();
    });

    it('activa MFA solo tras verificar TOTP y devuelve códigos de recuperación', async () => {
      txMock.account.findUnique.mockResolvedValue(activeAccount);
      txMock.mfaSecret.findUnique.mockResolvedValue({
        id: 'mfa-secret-1',
        status: 'pending_activation',
        secretEncrypted: 'encrypted-secret',
        lastVerifiedAt: null,
      });

      const result = await service.verifyMfa('account-1', {
        code: '123456',
      });

      expect(txMock.account.updateMany).toHaveBeenCalledWith({
        where: { id: 'account-1', status: 'active', mfaEnabled: false },
        data: { mfaEnabled: true },
      });
      expect(txMock.mfaSecret.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'mfa-secret-1',
            status: 'pending_activation',
            lastVerifiedAt: null,
          },
          data: expect.objectContaining({ status: 'active' }),
        }),
      );
      expect(txMock.mfaRecoveryCode.create).toHaveBeenCalledTimes(10);
      expect(txMock.mfaRecoveryCode.create.mock.calls[0][0].data.codeHash)
        .toMatch(/^recovery:v1:[a-f0-9]{64}$/);
      expect(txMock.userSession.updateMany).toHaveBeenCalledWith({
        where: { accountId: 'account-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(result).toEqual({
        status: 'active',
        recoveryCodes: expect.any(Array),
      });
      expect((result as { recoveryCodes: string[] }).recoveryCodes).toHaveLength(
        10,
      );
    });

    it('usa un desafío de inscripción para staff sin emitir tokens', async () => {
      clientesMock.findByEmail.mockResolvedValue({ id: 'client-1' });
      prismaMock.account.findUnique.mockResolvedValue({
        ...activeAccount,
        role: 'staff',
      });
      txMock.account.findUnique.mockResolvedValue({
        ...activeAccount,
        role: 'staff',
      });

      const result = await service.login({
        email: 'leonardo@example.com',
        password: 'UnaClaveSegura123',
      });

      expect(result).toEqual({
        mfaSetupRequired: true,
        enrollmentToken: expect.any(String),
        expiresIn: 300,
      });
      expect(jwtMock.signAsync).not.toHaveBeenCalled();
      expect(txMock.userSession.create).not.toHaveBeenCalled();
      expect(txMock.refreshToken.create).not.toHaveBeenCalled();
      expect(txMock.mfaChallenge.create.mock.calls[0][0].data.purpose)
        .toBe('enrollment');
    });

    it('prepara la inscripción obligatoria usando solo el desafío de staff', async () => {
      txMock.mfaChallenge.findUnique.mockResolvedValue(
        challenge({
          purpose: 'enrollment',
          account: {
            role: 'staff',
            status: 'active',
            emailVerifiedAt: new Date(),
            mfaEnabled: false,
          },
        }),
      );

      const result = await service.setupMfaForRequiredEnrollment({
        enrollmentToken: 'enrollment-token',
      });

      expect(result).toEqual({
        qrCodeUrl:
          'otpauth://totp/account-1?secret=JBSWY3DPEHPK3PXP',
        status: 'pending_activation',
      });
      expect(txMock.mfaSecret.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            accountId: 'account-1',
            status: 'pending_activation',
            secretEncrypted: 'encrypted:JBSWY3DPEHPK3PXP',
          }),
        }),
      );
      expect(txMock.userSession.create).not.toHaveBeenCalled();
      expect(jwtMock.signAsync).not.toHaveBeenCalled();
    });

    it('activa el MFA requerido para staff y consume el desafío sin crear sesión', async () => {
      txMock.mfaChallenge.findUnique.mockResolvedValue(
        challenge({
          purpose: 'enrollment',
          account: {
            role: 'staff',
            status: 'active',
            emailVerifiedAt: new Date(),
            mfaEnabled: false,
          },
        }),
      );
      txMock.account.findUnique.mockResolvedValue({
        ...activeAccount,
        role: 'staff',
      });
      txMock.mfaSecret.findUnique.mockResolvedValue({
        id: 'mfa-secret-1',
        status: 'pending_activation',
        secretEncrypted: 'encrypted-secret',
        lastVerifiedAt: null,
      });

      const result = await service.verifyRequiredMfaEnrollment({
        enrollmentToken: 'enrollment-token',
        code: '123456',
      });

      expect(txMock.account.updateMany).toHaveBeenCalledWith({
        where: { id: 'account-1', status: 'active', mfaEnabled: false },
        data: { mfaEnabled: true },
      });
      expect(txMock.mfaChallenge.updateMany).toHaveBeenCalledTimes(1);
      expect(txMock.mfaRecoveryCode.create).toHaveBeenCalledTimes(10);
      expect(txMock.userSession.create).not.toHaveBeenCalled();
      expect(jwtMock.signAsync).not.toHaveBeenCalled();
      expect(result).toEqual({
        status: 'active',
        recoveryCodes: expect.any(Array),
      });
    });

    it('crea una sesión después de consumir el desafío y verificar TOTP', async () => {
      txMock.mfaChallenge.findUnique.mockResolvedValue(challenge());
      txMock.mfaSecret.findUnique.mockResolvedValue({
        id: 'mfa-secret-1',
        status: 'active',
        secretEncrypted: 'encrypted-secret',
      });

      const result = await service.completeMfaLogin({
        challengeToken: 'challenge-token',
        code: '123456',
      });

      expect(txMock.mfaChallenge.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'challenge-1',
            usedAt: null,
            expiresAt: { gt: expect.any(Date) },
          },
        }),
      );
      expect(txMock.mfaSecret.updateMany).toHaveBeenCalled();
      expect(txMock.userSession.create).toHaveBeenCalledTimes(1);
      expect(txMock.refreshToken.create).toHaveBeenCalledTimes(1);
      expect(txMock.account.update).toHaveBeenCalledWith({
        where: { id: 'account-1' },
        data: { lastLoginAt: expect.any(Date) },
      });
      expect(result).toEqual({
        accessToken: 'signed-access-token',
        refreshToken: expect.stringMatching(/^[a-f0-9]{64}$/),
        expiresIn: expect.any(Number),
      });
    });

    it.each([
      ['caducado', { expiresAt: new Date(Date.now() - 1_000) }],
      ['utilizado', { usedAt: new Date() }],
    ])('rechaza un desafío MFA %s', async (_label, overrides) => {
      txMock.mfaChallenge.findUnique.mockResolvedValue(challenge(overrides));

      await expect(
        service.completeMfaLogin({
          challengeToken: 'challenge-token',
          code: '123456',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(txMock.userSession.create).not.toHaveBeenCalled();
      expect(jwtMock.signAsync).not.toHaveBeenCalled();
    });

    it('no crea sesión si otro proceso consumió el desafío primero', async () => {
      txMock.mfaChallenge.findUnique.mockResolvedValue(challenge());
      txMock.mfaSecret.findUnique.mockResolvedValue({
        id: 'mfa-secret-1',
        status: 'active',
        secretEncrypted: 'encrypted-secret',
      });
      txMock.mfaChallenge.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.completeMfaLogin({
          challengeToken: 'challenge-token',
          code: '123456',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(txMock.userSession.create).not.toHaveBeenCalled();
    });

    it('consume un código de recuperación de forma condicional durante el login', async () => {
      const recoveryCode = '00000000-AAAAAAAA-BBBBBBBB-CCCCCCCC';
      txMock.mfaChallenge.findUnique.mockResolvedValue(challenge());
      txMock.mfaRecoveryCode.findUnique.mockResolvedValue({
        id: 'recovery-1',
        accountId: 'account-1',
        usedAt: null,
        expiresAt: null,
      });

      await service.completeMfaLogin({
        challengeToken: 'challenge-token',
        code: recoveryCode,
      });

      expect(txMock.mfaRecoveryCode.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'recovery-1',
            accountId: 'account-1',
            usedAt: null,
          }),
        }),
      );
      expect(txMock.userSession.create).toHaveBeenCalledTimes(1);
    });

    it('rechaza un código de recuperación reutilizado', async () => {
      txMock.mfaChallenge.findUnique.mockResolvedValue(challenge());
      txMock.mfaRecoveryCode.findUnique.mockResolvedValue({
        id: 'recovery-1',
        accountId: 'account-1',
        usedAt: null,
        expiresAt: null,
      });
      txMock.mfaRecoveryCode.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.completeMfaLogin({
          challengeToken: 'challenge-token',
          code: '00000000-AAAAAAAA-BBBBBBBB-CCCCCCCC',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(txMock.userSession.create).not.toHaveBeenCalled();
    });

    it('desactiva MFA tras validar contraseña y factor, y revoca las sesiones', async () => {
      txMock.account.findUnique.mockResolvedValue({
        ...activeAccount,
        mfaEnabled: true,
        passwordHash: 'argon2id-hash',
      });
      txMock.mfaSecret.findUnique.mockResolvedValue({
        id: 'mfa-secret-1',
        status: 'active',
        secretEncrypted: 'encrypted-secret',
      });
      txMock.userSession.findMany.mockResolvedValue([{ id: 'session-1' }]);

      const result = await service.disableMfa('account-1', {
        password: 'UnaClaveSegura123',
        code: '123456',
      });

      expect(txMock.account.updateMany).toHaveBeenCalledWith({
        where: { id: 'account-1', status: 'active', mfaEnabled: true },
        data: { mfaEnabled: false },
      });
      expect(txMock.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { sessionId: { in: ['session-1'] }, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(result).not.toHaveProperty('accessToken');
    });

    it('regenera los códigos e invalida los anteriores tras verificar un factor', async () => {
      txMock.account.findUnique.mockResolvedValue({
        status: 'active',
        mfaEnabled: true,
      });
      txMock.mfaSecret.findUnique.mockResolvedValue({
        id: 'mfa-secret-1',
        status: 'active',
        secretEncrypted: 'encrypted-secret',
      });

      const result = await service.regenerateMfaRecoveryCodes('account-1', {
        code: '123456',
      });

      expect(txMock.mfaRecoveryCode.deleteMany).toHaveBeenCalledWith({
        where: {
          accountId: 'account-1',
          codeHash: { startsWith: 'recovery:v1:' },
        },
      });
      expect(txMock.mfaRecoveryCode.create).toHaveBeenCalledTimes(10);
      expect(result).toEqual({
        status: 'active',
        recoveryCodes: expect.any(Array),
      });
    });

    it('propaga fallos transaccionales al guardar la configuración', async () => {
      const databaseError = new Error('database unavailable');
      txMock.mfaSecret.upsert.mockRejectedValue(databaseError);
      txMock.account.findUnique.mockResolvedValue(activeAccount);

      await expect(service.setupMfa('account-1')).rejects.toBe(databaseError);
    });
  });
});