import 'reflect-metadata';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  INestApplication,
  Logger,
  ValidationPipe,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { authenticator } from 'otplib';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { MfaService } from '../src/modules/identidad/services/mfa.service';
import { PasswordService } from '../src/modules/identidad/services/password.service';
import { PrismaService } from '../src/prisma/prisma.service';

const PASSWORD = 'E2E-Cafeteria-Password-123!';
const INVALID_PASSWORD = 'E2E-Invalid-Password-123!';
const TEST_EMAIL_DOMAIN = 'example.test';

function responseBody(response: request.Response): Record<string, unknown> {
  const parsed: unknown = JSON.parse(response.text);
  if (!isRecord(parsed)) {
    throw new Error('La respuesta HTTP no contiene un objeto JSON.');
  }
  return parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new Error('La respuesta no contiene una lista de códigos válida.');
  }
  const codes: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') {
      throw new Error('La respuesta no contiene una lista de códigos válida.');
    }
    codes.push(item);
  }
  return codes;
}

interface AccountFixture {
  accountId: string;
  email: string;
  password: string;
}

interface Tokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface Registration {
  email: string;
  password: string;
  confirmationToken: string;
  accountId: string;
  response: request.Response;
}

function configuredMfaKeyIsValid(): boolean {
  let value = process.env.MFA_ENCRYPTION_KEY?.trim();

  if (!value) {
    const envPath = resolve(process.cwd(), '.env');
    if (existsSync(envPath)) {
      const line = readFileSync(envPath, 'utf8')
        .split(/\r?\n/)
        .find((entry) => /^\s*MFA_ENCRYPTION_KEY\s*=/.test(entry));
      const match = line?.match(
        /^\s*MFA_ENCRYPTION_KEY\s*=\s*(?:"([^"]*)"|'([^']*)'|([^#\s]*))/,
      );
      value = (match?.[1] ?? match?.[2] ?? match?.[3])?.trim();
    }
  }

  if (!value) return false;
  const key = Buffer.from(value, 'base64');
  return key.length === 32 && key.toString('base64') === value;
}

const hasMfaKey = configuredMfaKeyIsValid();
const describeMfa = hasMfaKey ? describe : describe.skip;
const itWithoutMfaKey = hasMfaKey ? it.skip : it;

describe('Identidad HTTP (SQLite y servicios reales)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let mailLogs: string[];
  let originalLoggerLog: PropertyDescriptor | undefined;

  beforeAll(() => {
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
  });

  beforeEach(async () => {
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
    await app.init();
    prisma = app.get(PrismaService);
    mailLogs.length = 0;
  });

  afterEach(async () => {
    if (app) await app.close();
  });

  afterAll(() => {
    if (originalLoggerLog) {
      Object.defineProperty(Logger.prototype, 'log', originalLoggerLog);
    }
  });

  const post = (
    path: string,
    body: Record<string, unknown>,
    accessToken?: string,
  ) => {
    let call = request(app.getHttpServer()).post(path);
    if (accessToken) {
      call = call.set('Authorization', `Bearer ${accessToken}`);
    }
    return call.send(body);
  };

  async function register(email = nextEmail()): Promise<Registration> {
    const response = await post('/auth/register', {
      fullName: 'Cliente de integración',
      email,
      password: PASSWORD,
      acceptsPrivacyPolicy: true,
    });

    const profile = await prisma.clientProfile.findUnique({
      where: { email },
    });
    const account = profile
      ? await prisma.account.findUnique({
          where: { clientId: profile.id },
        })
      : null;

    if (!account) {
      throw new Error('No se creó la cuenta de integración.');
    }

    return {
      email,
      password: PASSWORD,
      confirmationToken: confirmationTokenFromLogs(),
      accountId: account.id,
      response,
    };
  }

  function confirmationTokenFromLogs(): string {
    const match = mailLogs.join('\n').match(
      /\/confirm-email\?token=([a-f0-9]{64})/i,
    );
    if (!match) {
      throw new Error('No se encontró el enlace de confirmación de prueba.');
    }
    return match[1];
  }

  async function createAccount(
    options: {
      role?: string;
      status?: string;
      verified?: boolean;
    } = {},
  ): Promise<AccountFixture> {
    const email = nextEmail();
    const profile = await prisma.clientProfile.create({
      data: { fullName: 'Cuenta de integración', email },
    });
    const passwordHash = await app
      .get(PasswordService)
      .hashPassword(PASSWORD);
    const account = await prisma.account.create({
      data: {
        clientId: profile.id,
        passwordHash,
        role: options.role ?? 'customer',
        status: options.status ?? 'active',
        emailVerifiedAt:
          options.verified === false ? null : new Date(),
      },
    });

    return { accountId: account.id, email, password: PASSWORD };
  }

  async function registeredActiveAccount(): Promise<Registration> {
    const account = await register();
    const confirmation = await post('/auth/confirm-email', {
      token: account.confirmationToken,
    });
    expect(confirmation.status).toBe(200);
    return account;
  }

  async function login(account: AccountFixture): Promise<request.Response> {
    return post('/auth/login', {
      email: account.email,
      password: account.password,
    });
  }

  function tokensFrom(response: request.Response): Tokens {
    const body = responseBody(response);
    if (
      typeof body.accessToken !== 'string' ||
      typeof body.refreshToken !== 'string' ||
      typeof body.expiresIn !== 'number'
    ) {
      throw new Error('La respuesta no contiene el par de tokens esperado.');
    }
    return {
      accessToken: body.accessToken,
      refreshToken: body.refreshToken,
      expiresIn: body.expiresIn,
    };
  }

  async function seedResetToken(
    accountId: string,
    expiresAt = new Date(Date.now() + 60_000),
  ): Promise<string> {
    const token = randomBytes(32).toString('hex');
    await prisma.passwordResetToken.create({
      data: {
        accountId,
        tokenHash: createHash('sha256').update(token).digest('hex'),
        expiresAt,
      },
    });
    return token;
  }

  async function enableMfaFixture(
    accountId: string,
  ): Promise<{ secret: string; recoveryCodes: string[] }> {
    const mfa = app.get(MfaService);
    const secret = mfa.generateSecret();
    const now = new Date();
    await prisma.account.update({
      where: { id: accountId },
      data: { mfaEnabled: true },
    });
    await prisma.mfaSecret.create({
      data: {
        accountId,
        status: 'active',
        secretEncrypted: mfa.encryptSecret(secret),
        enabledAt: now,
      },
    });

    const recoveryCodes = mfa.generateRecoveryCodes();
    for (const code of recoveryCodes) {
      await prisma.mfaRecoveryCode.create({
        data: {
          accountId,
          codeHash: mfa.hashRecoveryCode(code),
        },
      });
    }
    return { secret, recoveryCodes };
  }

  function nextEmail(): string {
    return `identity-${randomUUID()}@${TEST_EMAIL_DOMAIN}`;
  }

  describe('Registro y confirmación de correo', () => {
    it('registra una cuenta activa solo después de confirmar el correo', async () => {
      const account = await register();
      const pending = await prisma.account.findUniqueOrThrow({
        where: { id: account.accountId },
      });
      const verification = await prisma.emailVerificationToken.findFirstOrThrow({
        where: { accountId: account.accountId },
      });
      const expectedHash = createHash('sha256')
        .update(account.confirmationToken)
        .digest('hex');
      const registrationBody = responseBody(account.response);

      expect(account.response.status).toBe(200);
      expect(pending.status).toBe('pending_confirmation');
      expect(pending.passwordHash.startsWith('$argon2id$')).toBe(true);
      expect(verification.tokenHash === expectedHash).toBe(true);
      expect(verification.tokenHash === account.confirmationToken).toBe(false);
      expect(
        JSON.stringify(registrationBody).includes(account.confirmationToken),
      ).toBe(false);

      const confirmation = await post('/auth/confirm-email', {
        token: account.confirmationToken,
      });
      expect(confirmation.status).toBe(200);
      expect(
        (await prisma.account.findUniqueOrThrow({
          where: { id: account.accountId },
        })).status,
      ).toBe('active');
    });

    it('responde de forma neutral ante un correo duplicado', async () => {
      const account = await register();
      const duplicate = await post('/auth/register', {
        fullName: 'Otro nombre',
        email: account.email,
        password: PASSWORD,
        acceptsPrivacyPolicy: true,
      });

      expect(duplicate.status).toBe(200);
      expect(
        responseBody(duplicate).message ===
          responseBody(account.response).message,
      ).toBe(true);
      const profile = await prisma.clientProfile.findUniqueOrThrow({
        where: { email: account.email },
      });
      expect(
        await prisma.account.count({
          where: { clientId: profile.id },
        }),
      ).toBe(1);
    });

    it('rechaza datos de registro inválidos', async () => {
      const email = 'correo-invalido';
      const response = await post('/auth/register', {
        fullName: '',
        email,
        password: 'corta',
        acceptsPrivacyPolicy: false,
      });

      expect(response.status).toBe(400);
      expect(
        await prisma.clientProfile.findUnique({ where: { email } }),
      ).toBeNull();
    });

    it('rechaza un token de confirmación expirado', async () => {
      const account = await register();
      await prisma.emailVerificationToken.updateMany({
        where: { accountId: account.accountId },
        data: { expiresAt: new Date(Date.now() - 1_000) },
      });

      const response = await post('/auth/confirm-email', {
        token: account.confirmationToken,
      });
      expect(response.status).toBe(400);
      expect(
        (await prisma.account.findUniqueOrThrow({
          where: { id: account.accountId },
        })).status,
      ).toBe('pending_confirmation');
    });

    it('rechaza la reutilización de un token de confirmación', async () => {
      const account = await registeredActiveAccount();
      const repeated = await post('/auth/confirm-email', {
        token: account.confirmationToken,
      });

      expect(repeated.status).toBe(400);
      expect(
        await prisma.emailVerificationToken.count({
          where: { accountId: account.accountId },
        }),
      ).toBe(1);
    });
  });

  describe('Login, sesiones y guard JWT real', () => {
    it('emite JWT verificable y persiste solo el hash del refresh token', async () => {
      const account = await registeredActiveAccount();
      const response = await login(account);
      const tokens = tokensFrom(response);
      const hash = createHash('sha256')
        .update(tokens.refreshToken)
        .digest('hex');
      const stored = await prisma.refreshToken.findUnique({
        where: { tokenHash: hash },
      });
      const claims = await app
        .get(JwtService)
        .verifyAsync<Record<string, unknown>>(tokens.accessToken);

      expect(response.status).toBe(200);
      const body = responseBody(response);
      expect('mfaRequired' in body).toBe(false);
      expect('mfaSetupRequired' in body).toBe(false);
      expect(tokens.expiresIn).toBeGreaterThan(0);
      expect(claims.sub).toBe(account.accountId);
      expect(typeof claims.sid).toBe('string');
      expect(stored !== null).toBe(true);
      expect(stored?.tokenHash === tokens.refreshToken).toBe(false);
      expect(stored?.tokenHash === hash).toBe(true);
    });

    it('rechaza credenciales incorrectas, cuenta pendiente e inactiva', async () => {
      const active = await registeredActiveAccount();
      const wrongPassword = await post('/auth/login', {
        email: active.email,
        password: INVALID_PASSWORD,
      });
      const pending = await register();
      const unverified = await login(pending);
      const inactive = await createAccount({
        status: 'inactive',
        verified: true,
      });
      const inactiveLogin = await login(inactive);

      expect(wrongPassword.status).toBe(401);
      expect(unverified.status).toBe(401);
      expect(inactiveLogin.status).toBe(401);
      expect(
        responseBody(wrongPassword).message === responseBody(unverified).message,
      ).toBe(true);
      expect(
        responseBody(unverified).message ===
          responseBody(inactiveLogin).message,
      ).toBe(true);
    });

    it.each(['staff', 'admin'])(
      'exige inscripción MFA para cuentas %s y no emite tokens',
      async (role) => {
        const account = await createAccount({ role });
        const response = await login(account);
        const body = responseBody(response);
        const token = body.enrollmentToken;
        const stored = typeof token === 'string'
          ? await prisma.mfaChallenge.findUnique({
              where: {
                tokenHash: createHash('sha256').update(token).digest('hex'),
              },
            })
          : null;

        expect(response.status).toBe(200);
        expect(body.mfaSetupRequired).toBe(true);
        expect(body.expiresIn).toBeGreaterThan(0);
        expect('accessToken' in body).toBe(false);
        expect('refreshToken' in body).toBe(false);
        expect(stored !== null).toBe(true);
        expect(stored?.tokenHash === token).toBe(false);

        if (typeof token !== 'string') {
          throw new Error('La respuesta de inscripción no incluyó el desafío.');
        }
        const protectedRequest = await post('/auth/logout', {}, token);
        expect(protectedRequest.status).toBe(401);
      },
    );

    it('rota refresh tokens; reutilizar el anterior revoca toda la familia', async () => {
      const account = await registeredActiveAccount();
      const initial = tokensFrom(await login(account));
      const initialHash = createHash('sha256')
        .update(initial.refreshToken)
        .digest('hex');
      const rotatedResponse = await post('/auth/refresh', {
        refreshToken: initial.refreshToken,
      });
      const rotated = tokensFrom(rotatedResponse);
      const rotatedHash = createHash('sha256')
        .update(rotated.refreshToken)
        .digest('hex');
      const replay = await post('/auth/refresh', {
        refreshToken: initial.refreshToken,
      });
      const familyReuse = await post('/auth/refresh', {
        refreshToken: rotated.refreshToken,
      });
      const previous = await prisma.refreshToken.findUniqueOrThrow({
        where: { tokenHash: initialHash },
      });
      const current = await prisma.refreshToken.findUniqueOrThrow({
        where: { tokenHash: rotatedHash },
      });
      const session = await prisma.userSession.findUniqueOrThrow({
        where: { id: current.sessionId },
      });

      expect(rotatedResponse.status).toBe(200);
      expect(rotated.refreshToken !== initial.refreshToken).toBe(true);
      expect(previous.revokedAt).not.toBeNull();
      expect(previous.replacedByTokenId).toBe(current.id);
      expect(replay.status).toBe(401);
      expect(familyReuse.status).toBe(401);
      expect(current.revokedAt).not.toBeNull();
      expect(session.revokedAt).not.toBeNull();
    });

    it('permite logout idempotente y rechaza luego la sesión revocada', async () => {
      const account = await registeredActiveAccount();
      const tokens = tokensFrom(await login(account));
      const unauthenticated = await post('/auth/logout', {});
      const loggedOut = await post('/auth/logout', {}, tokens.accessToken);
      const repeated = await post('/auth/logout', {}, tokens.accessToken);
      const refresh = await post('/auth/refresh', {
        refreshToken: tokens.refreshToken,
      });
      const protectedRequest = await post(
        '/auth/mfa/setup',
        {},
        tokens.accessToken,
      );

      expect(unauthenticated.status).toBe(401);
      expect(loggedOut.status).toBe(200);
      expect(repeated.status).toBe(200);
      expect(refresh.status).toBe(401);
      expect(protectedRequest.status).toBe(401);
    });
  });

  describe('Recuperación de contraseña', () => {
    it('usa la misma respuesta para correos existentes e inexistentes', async () => {
      const account = await createAccount();
      const existing = await post('/auth/forgot-password', {
        email: account.email.toUpperCase(),
      });
      const missing = await post('/auth/forgot-password', {
        email: nextEmail(),
      });
      const tokens = await prisma.passwordResetToken.findMany({
        where: { accountId: account.accountId },
      });

      expect(existing.status).toBe(200);
      expect(missing.status).toBe(200);
      const existingBody = responseBody(existing);
      const missingBody = responseBody(missing);
      expect(existingBody.message === missingBody.message).toBe(true);
      expect(JSON.stringify(existingBody).includes(account.email)).toBe(false);
      expect(tokens).toHaveLength(1);
      expect(tokens[0].tokenHash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('restablece la contraseña una vez y revoca todas las sesiones', async () => {
      const account = await registeredActiveAccount();
      const tokens = tokensFrom(await login(account));
      const resetToken = await seedResetToken(account.accountId);
      const otherResetToken = await seedResetToken(account.accountId);
      const reset = await post('/auth/reset-password', {
        token: resetToken,
        password: 'Another-E2E-Password-456!',
      });
      const replay = await post('/auth/reset-password', {
        token: resetToken,
        password: 'Another-E2E-Password-456!',
      });
      const oldRefresh = await post('/auth/refresh', {
        refreshToken: tokens.refreshToken,
      });
      const oldProtectedRequest = await post(
        '/auth/mfa/setup',
        {},
        tokens.accessToken,
      );
      const oldPasswordLogin = await post('/auth/login', {
        email: account.email,
        password: PASSWORD,
      });
      const newPasswordLogin = await post('/auth/login', {
        email: account.email,
        password: 'Another-E2E-Password-456!',
      });
      const unusedReset = await prisma.passwordResetToken.findFirstOrThrow({
        where: {
          tokenHash: createHash('sha256')
            .update(otherResetToken)
            .digest('hex'),
        },
      });

      expect(reset.status).toBe(200);
      expect(replay.status).toBe(400);
      expect(oldRefresh.status).toBe(401);
      expect(oldProtectedRequest.status).toBe(401);
      expect(oldPasswordLogin.status).toBe(401);
      expect(newPasswordLogin.status).toBe(200);
      expect(unusedReset.usedAt).not.toBeNull();
    });

    it('rechaza tokens de restablecimiento expirados', async () => {
      const account = await createAccount();
      const token = await seedResetToken(
        account.accountId,
        new Date(Date.now() - 1_000),
      );
      const response = await post('/auth/reset-password', {
        token,
        password: 'Another-E2E-Password-456!',
      });

      expect(response.status).toBe(400);
      expect(
        (await prisma.account.findUniqueOrThrow({
          where: { id: account.accountId },
        })).passwordHash.startsWith('$argon2id$'),
      ).toBe(true);
    });
  });

  itWithoutMfaKey(
    'informa que la configuración MFA no está disponible sin una clave válida',
    async () => {
      const account = await registeredActiveAccount();
      const tokens = tokensFrom(await login(account));
      const response = await post(
        '/auth/mfa/setup',
        {},
        tokens.accessToken,
      );

      expect(response.status).toBe(503);
      expect(
        JSON.stringify(responseBody(response)).toLowerCase().includes('clave'),
      ).toBe(true);
      expect(JSON.stringify(responseBody(response))).not.toContain(
        'MFA_ENCRYPTION_KEY',
      );
    },
  );

  describeMfa('MFA con secreto de configuración válido', () => {
    it('activa TOTP y almacena el secreto cifrado y los hashes de recuperación', async () => {
      const account = await registeredActiveAccount();
      const tokens = tokensFrom(await login(account));
      const setup = await post(
        '/auth/mfa/setup',
        {},
        tokens.accessToken,
      );
      const setupBody = responseBody(setup);
      const qrCodeUrl = setupBody.qrCodeUrl;
      if (typeof qrCodeUrl !== 'string') {
        throw new Error('La configuración MFA no devolvió una URI TOTP.');
      }
      const uri = new URL(qrCodeUrl);
      const secret = uri.searchParams.get('secret');
      if (!secret) throw new Error('La URI TOTP no incluye el secreto.');
      const verify = await post(
        '/auth/mfa/verify',
        { code: authenticator.generate(secret) },
        tokens.accessToken,
      );
      const storedSecret = await prisma.mfaSecret.findUniqueOrThrow({
        where: { accountId: account.accountId },
      });
      const storedCodes = await prisma.mfaRecoveryCode.findMany({
        where: { accountId: account.accountId },
      });
      const mfa = app.get(MfaService);
      const isStoredCiphertext = storedSecret.secretEncrypted !== secret;
      const recoveryCodes = stringArray(
        responseBody(verify).recoveryCodes,
      );
      const allRecoveryCodesHashed = recoveryCodes.every(
        (code) =>
          storedCodes.some(
            (stored) => stored.codeHash === mfa.hashRecoveryCode(code),
          ),
      );

      expect(setup.status).toBe(200);
      expect(uri.protocol).toBe('otpauth:');
      expect(storedSecret.secretEncrypted.startsWith('v1.')).toBe(true);
      expect(isStoredCiphertext).toBe(true);
      expect(verify.status).toBe(200);
      expect(recoveryCodes.length).toBe(10);
      expect(storedCodes).toHaveLength(10);
      expect(allRecoveryCodesHashed).toBe(true);
    });

    it('exige un TOTP válido y consume el desafío MFA una sola vez', async () => {
      const account = await createAccount();
      const { secret } = await enableMfaFixture(account.accountId);
      const challengeResponse = await login(account);
      const challengeToken = responseBody(challengeResponse).challengeToken;
      if (typeof challengeToken !== 'string') {
        throw new Error('La respuesta de login no incluyó el desafío MFA.');
      }
      const invalid = await post('/auth/login/mfa', {
        challengeToken,
        code: '000000',
      });
      const validCode = authenticator.generate(secret);
      const completed = await post('/auth/login/mfa', {
        challengeToken,
        code: validCode,
      });
      const replay = await post('/auth/login/mfa', {
        challengeToken,
        code: validCode,
      });
      const hash = createHash('sha256')
        .update(challengeToken)
        .digest('hex');

      expect(challengeResponse.status).toBe(200);
      expect(responseBody(challengeResponse).mfaRequired).toBe(true);
      expect(invalid.status).toBe(400);
      expect(completed.status).toBe(200);
      expect(typeof responseBody(completed).accessToken).toBe('string');
      expect(replay.status).toBe(400);
      expect(
        (await prisma.mfaChallenge.findUniqueOrThrow({
          where: { tokenHash: hash },
        })).usedAt,
      ).not.toBeNull();
    });

    it('rechaza desafíos MFA expirados y consume códigos de recuperación una vez', async () => {
      const account = await createAccount();
      const { recoveryCodes } = await enableMfaFixture(account.accountId);
      const expiredChallenge = await login(account);
      const expiredToken = responseBody(expiredChallenge).challengeToken;
      if (typeof expiredToken !== 'string') {
        throw new Error('La respuesta de login no incluyó el desafío MFA.');
      }
      await prisma.mfaChallenge.updateMany({
        where: {
          tokenHash: createHash('sha256').update(expiredToken).digest('hex'),
        },
        data: { expiresAt: new Date(Date.now() - 1_000) },
      });
      const expired = await post('/auth/login/mfa', {
        challengeToken: expiredToken,
        code: recoveryCodes[0],
      });

      const firstChallenge = await login(account);
      const firstToken = responseBody(firstChallenge).challengeToken;
      if (typeof firstToken !== 'string') {
        throw new Error('La respuesta de login no incluyó el desafío MFA.');
      }
      const firstUse = await post('/auth/login/mfa', {
        challengeToken: firstToken,
        code: recoveryCodes[0],
      });
      const nextChallenge = await login(account);
      const nextChallengeToken = responseBody(nextChallenge).challengeToken;
      if (typeof nextChallengeToken !== 'string') {
        throw new Error('La respuesta de login no incluyó el desafío MFA.');
      }
      const replayCode = await post('/auth/login/mfa', {
        challengeToken: nextChallengeToken,
        code: recoveryCodes[0],
      });

      expect(expired.status).toBe(400);
      expect(firstUse.status).toBe(200);
      expect(replayCode.status).toBe(400);
      expect(
        (await prisma.mfaRecoveryCode.findUniqueOrThrow({
          where: {
            codeHash: app
              .get(MfaService)
              .hashRecoveryCode(recoveryCodes[0]),
          },
        })).usedAt,
      ).not.toBeNull();
    });

    it('regenera códigos e desactiva MFA con contraseña y segundo factor', async () => {
      const account = await createAccount();
      const { secret, recoveryCodes } = await enableMfaFixture(
        account.accountId,
      );
      const tokens = tokensFrom(await login(account));
      const regenerated = await post(
        '/auth/mfa/recovery-codes',
        { code: authenticator.generate(secret) },
        tokens.accessToken,
      );
      const oldCode = recoveryCodes[0];
      const oldCodeHash = app.get(MfaService).hashRecoveryCode(oldCode);
      const oldCodeStillExists = await prisma.mfaRecoveryCode.findUnique({
        where: { codeHash: oldCodeHash },
      });
      const disable = await post(
        '/auth/mfa/disable',
        {
          password: account.password,
          code: authenticator.generate(secret),
        },
        tokens.accessToken,
      );
      const protectedAfterDisable = await post(
        '/auth/mfa/setup',
        {},
        tokens.accessToken,
      );
      const regeneratedCodes = stringArray(
        responseBody(regenerated).recoveryCodes,
      );

      expect(regenerated.status).toBe(200);
      expect(regeneratedCodes).toHaveLength(10);
      expect(oldCodeStillExists).toBeNull();
      expect(disable.status).toBe(200);
      expect(protectedAfterDisable.status).toBe(401);
      expect(
        (await prisma.account.findUniqueOrThrow({
          where: { id: account.accountId },
        })).mfaEnabled,
      ).toBe(false);
    });

    it('completa la inscripción obligatoria antes de conceder una sesión', async () => {
      const account = await createAccount({ role: 'staff' });
      const challenge = await login(account);
      const enrollmentToken = responseBody(challenge).enrollmentToken;
      if (typeof enrollmentToken !== 'string') {
        throw new Error('La respuesta de login no incluyó el desafío.');
      }
      const setup = await post('/auth/mfa/enrollment/setup', {
        enrollmentToken,
      });
      const qrCodeUrl = responseBody(setup).qrCodeUrl;
      if (typeof qrCodeUrl !== 'string') {
        throw new Error('La configuración MFA no devolvió una URI TOTP.');
      }
      const secret = new URL(qrCodeUrl)
        .searchParams.get('secret');
      if (!secret) throw new Error('La URI TOTP no incluye el secreto.');
      const activation = await post('/auth/mfa/enrollment/verify', {
        enrollmentToken,
        code: authenticator.generate(secret),
      });
      const activationBody = responseBody(activation);
      const recoveryCodes = stringArray(activationBody.recoveryCodes);
      const loginAfterEnrollment = await login(account);
      const mfaChallengeToken =
        responseBody(loginAfterEnrollment).challengeToken;
      if (typeof mfaChallengeToken !== 'string') {
        throw new Error('La respuesta de login no incluyó el desafío MFA.');
      }
      const session = await post('/auth/login/mfa', {
        challengeToken: mfaChallengeToken,
        code: recoveryCodes[0],
      });

      const challengeBody = responseBody(challenge);
      expect(challengeBody.mfaSetupRequired).toBe(true);
      expect('accessToken' in challengeBody).toBe(false);
      expect(setup.status).toBe(200);
      expect(activation.status).toBe(200);
      expect(recoveryCodes.length).toBe(10);
      expect(responseBody(loginAfterEnrollment).mfaRequired).toBe(true);
      expect(session.status).toBe(200);
      expect(typeof responseBody(session).accessToken).toBe('string');
    });
  });
});
