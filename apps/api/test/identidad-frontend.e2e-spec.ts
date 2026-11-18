/// <reference lib="dom" />

import 'reflect-metadata';
import { createHash, randomUUID } from 'node:crypto';
import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { authenticator } from 'otplib';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { MfaService } from '../src/modules/identidad/services/mfa.service';
import { PasswordService } from '../src/modules/identidad/services/password.service';
import { PrismaService } from '../src/prisma/prisma.service';

const PASSWORD = 'Frontend-E2E-Password-123!';
const NEW_PASSWORD = 'Frontend-E2E-Password-456!';

function validMfaConfiguration(): boolean {
  const encodedKey = process.env.MFA_ENCRYPTION_KEY?.trim();
  if (!encodedKey) return false;
  const key = Buffer.from(encodedKey, 'base64');
  return key.length === 32 && key.toString('base64') === encodedKey;
}

const itWithMfa = validMfaConfiguration() ? it : it.skip;

describe('Servicio frontend contra API HTTP real', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let identidadApi: typeof import('../../web/app/identidad/api.js').identidadApi;
  let IdentityApiError: typeof import('../../web/app/identidad/api.js').IdentityApiError;
  let mailLogs: string[];
  let originalLoggerLog: PropertyDescriptor | undefined;
  let previousApiUrl: string | undefined;
  let appClosed = false;

  beforeAll(async () => {
    mailLogs = [];
    originalLoggerLog = Object.getOwnPropertyDescriptor(
      Logger.prototype,
      'log',
    );
    Object.defineProperty(Logger.prototype, 'log', {
      configurable: true,
      value: (message: unknown) => {
        if (typeof message === 'string') mailLogs.push(message);
      },
    });

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication<INestApplication<App>>();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useLogger(false);
    await app.listen(0, '127.0.0.1');
    prisma = app.get(PrismaService);

    const apiUrl = await app.getUrl();
    previousApiUrl = process.env.NEXT_PUBLIC_API_URL;
    process.env.NEXT_PUBLIC_API_URL = apiUrl;
    ({ identidadApi, IdentityApiError } = await import(
      '../../web/app/identidad/api.js'
    ));
  });

  afterAll(async () => {
    if (app && !appClosed) await app.close();
    if (originalLoggerLog) {
      Object.defineProperty(Logger.prototype, 'log', originalLoggerLog);
    }
    if (previousApiUrl === undefined) {
      delete process.env.NEXT_PUBLIC_API_URL;
    } else {
      process.env.NEXT_PUBLIC_API_URL = previousApiUrl;
    }
  });

  function confirmationTokenFromLogs(): string {
    const match = mailLogs.join('\n').match(
      /\/confirm-email\?token=([a-f0-9]{64})/i,
    );
    if (!match) {
      throw new Error('No se encontró el enlace de confirmación de prueba.');
    }
    return match[1];
  }

  async function createStaffAccount(): Promise<{ email: string }> {
    const email = `staff-${randomUUID()}@example.test`;
    const profile = await prisma.clientProfile.create({
      data: { fullName: 'Personal de integración', email },
    });
    const passwordHash = await app
      .get(PasswordService)
      .hashPassword(PASSWORD);
    await prisma.account.create({
      data: {
        clientId: profile.id,
        passwordHash,
        role: 'staff',
        status: 'active',
        emailVerifiedAt: new Date(),
      },
    });
    return { email };
  }

  it('interpreta registro, confirmación, login, refresh, logout y errores reales', async () => {
    const email = `client-${randomUUID()}@example.test`;
    const registration = await identidadApi.register({
      fullName: 'Cliente frontend de integración',
      email,
      password: PASSWORD,
      acceptsPrivacyPolicy: true,
    });
    const verificationToken = confirmationTokenFromLogs();
    const confirmation =
      await identidadApi.confirmEmail(verificationToken);
    const login = await identidadApi.login({ email, password: PASSWORD });

    expect(typeof registration.message).toBe('string');
    expect(typeof confirmation.message).toBe('string');
    expect(login.kind).toBe('tokens');
    if (login.kind !== 'tokens') {
      throw new Error('El backend no devolvió tokens para una cuenta cliente.');
    }

    const initialHash = createHash('sha256')
      .update(login.tokens.refreshToken)
      .digest('hex');
    const storedRefresh = await prisma.refreshToken.findUnique({
      where: { tokenHash: initialHash },
    });
    const rotated = await identidadApi.refresh(login.tokens.refreshToken);
    const logout = await identidadApi.logout(rotated.accessToken);
    const revokedSessionRequest = await identidadApi
      .setupMfa(rotated.accessToken)
      .then(
        () => null,
        (error: unknown) => error,
      );
    const wrongPassword = await identidadApi
      .login({ email, password: 'Wrong-Frontend-Password-123!' })
      .then(
        () => null,
        (error: unknown) => error,
      );

    expect(storedRefresh !== null).toBe(true);
    expect(storedRefresh?.tokenHash === login.tokens.refreshToken).toBe(false);
    expect(rotated.refreshToken !== login.tokens.refreshToken).toBe(true);
    expect(typeof logout.message).toBe('string');
    expect(revokedSessionRequest).toBeInstanceOf(IdentityApiError);
    expect(
      revokedSessionRequest instanceof IdentityApiError &&
        revokedSessionRequest.status === 401 &&
        revokedSessionRequest.kind === 'http',
    ).toBe(true);
    expect(wrongPassword).toBeInstanceOf(IdentityApiError);
    expect(
      wrongPassword instanceof IdentityApiError &&
        wrongPassword.status === 401 &&
        wrongPassword.kind === 'http',
    ).toBe(true);
  });

  it('interpreta inscripción obligatoria y respuestas neutrales de recuperación', async () => {
    const staff = await createStaffAccount();
    const enrollment = await identidadApi.login({
      email: staff.email,
      password: PASSWORD,
    });
    const existing = await identidadApi.forgotPassword(staff.email);
    const missing = await identidadApi.forgotPassword(
      `missing-${randomUUID()}@example.test`,
    );

    expect(enrollment.kind).toBe('enrollment');
    expect(existing.message === missing.message).toBe(true);

    if (enrollment.kind === 'enrollment') {
      const setupError = await identidadApi
        .setupRequiredMfa(enrollment.enrollmentToken)
        .then(
          () => null,
          (error: unknown) => error,
        );
      expect(setupError).toBeInstanceOf(IdentityApiError);
      expect(
        setupError instanceof IdentityApiError &&
          setupError.status === 503,
      ).toBe(true);
    }
  });

  it('pasa el token de reset y la nueva contraseña al endpoint real', async () => {
    const email = `reset-${randomUUID()}@example.test`;
    const profile = await prisma.clientProfile.create({
      data: { fullName: 'Cliente reset frontend', email },
    });
    const passwordHash = await app
      .get(PasswordService)
      .hashPassword(PASSWORD);
    const account = await prisma.account.create({
      data: {
        clientId: profile.id,
        passwordHash,
        role: 'customer',
        status: 'active',
        emailVerifiedAt: new Date(),
      },
    });
    const token = randomUUID().replace(/-/g, '').repeat(2);
    await prisma.passwordResetToken.create({
      data: {
        accountId: account.id,
        tokenHash: createHash('sha256').update(token).digest('hex'),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    const result = await identidadApi.resetPassword({
      token,
      password: NEW_PASSWORD,
    });
    const login = await identidadApi.login({
      email,
      password: NEW_PASSWORD,
    });

    expect(typeof result.message).toBe('string');
    expect(login.kind).toBe('tokens');
  });

  itWithMfa(
    'interpreta el desafío MFA cuando la clave de cifrado está configurada',
    async () => {
    const email = `mfa-${randomUUID()}@example.test`;
    const profile = await prisma.clientProfile.create({
      data: { fullName: 'Cliente MFA frontend', email },
    });
    const passwordHash = await app
      .get(PasswordService)
      .hashPassword(PASSWORD);
    const account = await prisma.account.create({
      data: {
        clientId: profile.id,
        passwordHash,
        role: 'customer',
        status: 'active',
        emailVerifiedAt: new Date(),
        mfaEnabled: true,
      },
    });
    const secret = app.get(MfaService).generateSecret();
    await prisma.mfaSecret.create({
      data: {
        accountId: account.id,
        status: 'active',
        secretEncrypted: app.get(MfaService).encryptSecret(secret),
        enabledAt: new Date(),
      },
    });

      const challenge = await identidadApi.login({
        email,
        password: PASSWORD,
      });
      expect(challenge.kind).toBe('mfa');
      if (challenge.kind !== 'mfa') {
        throw new Error('El backend no devolvió el desafío MFA esperado.');
      }

      const tokens = await identidadApi.loginMfa({
        challengeToken: challenge.challengeToken,
        code: authenticator.generate(secret),
      });
      expect(typeof tokens.accessToken).toBe('string');
      expect(tokens.expiresIn).toBeGreaterThan(0);
    },
  );

  it('clasifica el fallo de red al cerrar sesión', async () => {
    await app.close();
    appClosed = true;
    const error = await identidadApi.logout('test-access-token').then(
      () => null,
      (requestError: unknown) => requestError,
    );

    expect(error).toBeInstanceOf(IdentityApiError);
    expect(
      error instanceof IdentityApiError && error.kind === 'network',
    ).toBe(true);
  });
});
