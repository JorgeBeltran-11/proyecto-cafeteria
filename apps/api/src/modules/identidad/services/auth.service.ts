import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { ClientesService } from '../../clientes/services/clientes.service';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';
import { ConfirmEmailDto } from '../dto/confirm-email.dto';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { LoginMfaDto } from '../dto/login-mfa.dto';
import { MfaDisableDto } from '../dto/mfa-disable.dto';
import { MfaEnrollmentTokenDto } from '../dto/mfa-enrollment-token.dto';
import { MfaEnrollmentVerifyDto } from '../dto/mfa-enrollment-verify.dto';
import { MfaRecoveryCodesDto } from '../dto/mfa-recovery-codes.dto';
import { MfaVerifyDto } from '../dto/mfa-verify.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { PasswordService } from './password.service';
import { MailerService } from './mailer.service';
import { MfaService } from './mfa.service';

const REGISTER_MESSAGE =
  'Si los datos son válidos, recibirás instrucciones en tu correo electrónico.';
const FORGOT_PASSWORD_MESSAGE =
  'Si la cuenta puede recuperar su contraseña, recibirás instrucciones en tu correo electrónico.';
const RESET_PASSWORD_MESSAGE =
  'La contraseña se restableció correctamente. Inicia sesión con la nueva contraseña.';
const LOGIN_ERROR_MESSAGE = 'Credenciales incorrectas o cuenta no disponible.';
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TOKEN_TTL_MS = 30 * 60 * 1000;
const MFA_CHALLENGE_TTL_MS = 5 * 60 * 1000;
const MFA_CHALLENGE_TTL_SECONDS = MFA_CHALLENGE_TTL_MS / 1000;
const MFA_RECOVERY_CODE_PREFIX = 'recovery:v1:';
const MFA_INVALID_CHALLENGE_MESSAGE =
  'El desafío MFA no es válido o ha caducado.';
const MFA_INVALID_CODE_MESSAGE = 'El código MFA no es válido.';
const INVALID_PASSWORD_RESET_TOKEN_MESSAGE =
  'El enlace de restablecimiento no es válido o ha caducado.';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clientes: ClientesService,
    private readonly passwords: PasswordService,
    private readonly mailer: MailerService,
    private readonly mfa: MfaService,
    private readonly jwt: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const profile = await this.clientes.findByEmail(email);

    if (!profile) {
      throw new UnauthorizedException(LOGIN_ERROR_MESSAGE);
    }

    const account = await this.prisma.account.findUnique({
      where: { clientId: profile.id },
      select: {
        id: true,
        passwordHash: true,
        role: true,
        status: true,
        emailVerifiedAt: true,
        mfaEnabled: true,
      },
    });

    if (
      !account ||
      !(await this.passwords.verifyPassword(dto.password, account.passwordHash))
    ) {
      throw new UnauthorizedException(LOGIN_ERROR_MESSAGE);
    }

    if (account.status !== 'active' || !account.emailVerifiedAt) {
      throw new UnauthorizedException(LOGIN_ERROR_MESSAGE);
    }

    if (account.mfaEnabled) {
      return this.createMfaChallenge(account.id, 'login');
    }

    if (account.role === 'staff' || account.role === 'admin') {
      return this.createMfaChallenge(account.id, 'enrollment');
    }

    return this.createLoginSession(account.id, account.role);
  }

  async refresh(dto: RefreshTokenDto) {
    const tokenHash = createHash('sha256')
      .update(dto.refreshToken)
      .digest('hex');
    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const currentToken = await tx.refreshToken.findUnique({
        where: { tokenHash },
        select: {
          id: true,
          sessionId: true,
          familyId: true,
          expiresAt: true,
          revokedAt: true,
          replacedByTokenId: true,
          session: {
            select: {
              id: true,
              accountId: true,
              expiresAt: true,
              revokedAt: true,
              account: {
                select: {
                  id: true,
                  role: true,
                  status: true,
                  mfaEnabled: true,
                },
              },
            },
          },
        },
      });

      if (!currentToken) {
        return { kind: 'invalid' as const };
      }

      if (currentToken.revokedAt) {
        if (currentToken.replacedByTokenId) {
          await this.revokeRefreshFamily(
            tx,
            currentToken.familyId,
            currentToken.sessionId,
            now,
          );
          return { kind: 'reuse' as const };
        }

        return { kind: 'invalid' as const };
      }

      const session = currentToken.session;
      const account = session.account;

      if (
        currentToken.expiresAt <= now ||
        session.revokedAt ||
        session.expiresAt <= now ||
        account.status !== 'active' ||
        account.mfaEnabled
      ) {
        return { kind: 'invalid' as const };
      }

      const nextRefreshToken = randomBytes(32).toString('hex');
      const nextTokenHash = createHash('sha256')
        .update(nextRefreshToken)
        .digest('hex');
      const nextRefreshTokenId = randomUUID();

      const rotation = await tx.refreshToken.updateMany({
        where: {
          id: currentToken.id,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: {
          revokedAt: now,
          replacedByTokenId: nextRefreshTokenId,
        },
      });

      if (rotation.count !== 1) {
        const latestToken = await tx.refreshToken.findUnique({
          where: { id: currentToken.id },
          select: { revokedAt: true, replacedByTokenId: true },
        });

        if (latestToken?.revokedAt && latestToken.replacedByTokenId) {
          await this.revokeRefreshFamily(
            tx,
            currentToken.familyId,
            currentToken.sessionId,
            now,
          );
          return { kind: 'reuse' as const };
        }

        return { kind: 'invalid' as const };
      }

      const access = await this.createAccessToken(
        account.id,
        account.role,
        session.id,
        now,
      );

      await tx.refreshToken.create({
        data: {
          id: nextRefreshTokenId,
          sessionId: currentToken.sessionId,
          tokenHash: nextTokenHash,
          familyId: currentToken.familyId,
          expiresAt: session.expiresAt,
        },
      });

      return {
        kind: 'success' as const,
        accessToken: access.accessToken,
        expiresIn: access.expiresIn,
        refreshToken: nextRefreshToken,
      };
    });

    if (result.kind !== 'success') {
      throw new UnauthorizedException(
        'El refresh token no es válido o la sesión ha caducado.',
      );
    }

    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
    };
  }

  async completeMfaLogin(dto: LoginMfaDto) {
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const challenge = await this.findValidMfaChallenge(
        tx,
        dto.challengeToken,
        'login',
        now,
      );

      if (challenge.account.mfaEnabled !== true) {
        throw new BadRequestException(MFA_INVALID_CHALLENGE_MESSAGE);
      }

      await this.consumeSecondFactor(
        tx,
        challenge.accountId,
        dto.code,
        now,
      );
      await this.consumeMfaChallenge(tx, challenge.id, now);

      return this.createSessionInTransaction(
        tx,
        challenge.accountId,
        challenge.account.role,
        now,
      );
    });
  }

  async setupMfa(accountId: string) {
    const secret = this.mfa.generateSecret();
    const encryptedSecret = this.mfa.encryptSecret(secret);
    const provisioningUri = this.mfa.createProvisioningUri(
      accountId,
      secret,
    );

    await this.prisma.$transaction(async (tx) => {
      const account = await tx.account.findUnique({
        where: { id: accountId },
        select: { id: true, status: true, mfaEnabled: true },
      });

      if (!account || account.status !== 'active') {
        throw new UnauthorizedException('No autenticado.');
      }

      if (account.mfaEnabled) {
        throw new BadRequestException('MFA ya está activado.');
      }

      await this.upsertPendingMfaSecret(tx, accountId, encryptedSecret);
    });

    return {
      qrCodeUrl: provisioningUri,
      status: 'pending_activation' as const,
    };
  }

  async setupMfaForRequiredEnrollment(dto: MfaEnrollmentTokenDto) {
    const now = new Date();
    const secret = this.mfa.generateSecret();
    const encryptedSecret = this.mfa.encryptSecret(secret);

    return this.prisma.$transaction(async (tx) => {
      const challenge = await this.findValidMfaChallenge(
        tx,
        dto.enrollmentToken,
        'enrollment',
        now,
      );

      if (
        !this.isMfaRequiredRole(challenge.account.role) ||
        challenge.account.mfaEnabled
      ) {
        throw new BadRequestException(MFA_INVALID_CHALLENGE_MESSAGE);
      }

      await this.upsertPendingMfaSecret(
        tx,
        challenge.accountId,
        encryptedSecret,
      );

      return {
        qrCodeUrl: this.mfa.createProvisioningUri(
          challenge.accountId,
          secret,
        ),
        status: 'pending_activation' as const,
      };
    });
  }

  async verifyMfa(accountId: string, dto: MfaVerifyDto) {
    const recoveryCodes = await this.prisma.$transaction((tx) =>
      this.activateMfa(tx, accountId, dto.code, new Date()),
    );

    return { status: 'active' as const, recoveryCodes };
  }

  async verifyRequiredMfaEnrollment(dto: MfaEnrollmentVerifyDto) {
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const challenge = await this.findValidMfaChallenge(
        tx,
        dto.enrollmentToken,
        'enrollment',
        now,
      );

      if (
        !this.isMfaRequiredRole(challenge.account.role) ||
        challenge.account.mfaEnabled
      ) {
        throw new BadRequestException(MFA_INVALID_CHALLENGE_MESSAGE);
      }

      const recoveryCodes = await this.activateMfa(
        tx,
        challenge.accountId,
        dto.code,
        now,
      );
      await this.consumeMfaChallenge(tx, challenge.id, now);

      return { status: 'active' as const, recoveryCodes };
    });
  }

  async disableMfa(accountId: string, dto: MfaDisableDto) {
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      const account = await tx.account.findUnique({
        where: { id: accountId },
        select: {
          id: true,
          passwordHash: true,
          status: true,
          mfaEnabled: true,
        },
      });

      if (
        !account ||
        account.status !== 'active' ||
        !account.mfaEnabled ||
        !(await this.passwords.verifyPassword(
          dto.password,
          account.passwordHash,
        ))
      ) {
        throw new UnauthorizedException(
          'No se pudo completar la operación de seguridad.',
        );
      }

      await this.consumeSecondFactor(tx, accountId, dto.code, now);

      const disabled = await tx.account.updateMany({
        where: { id: accountId, status: 'active', mfaEnabled: true },
        data: { mfaEnabled: false },
      });
      if (disabled.count !== 1) {
        throw new BadRequestException('MFA ya no está activo.');
      }

      await tx.mfaSecret.updateMany({
        where: { accountId, status: 'active' },
        data: {
          status: 'disabled',
          enabledAt: null,
          lastVerifiedAt: null,
        },
      });
      await this.deleteRecoveryCodes(tx, accountId);
      await tx.mfaChallenge.updateMany({
        where: { accountId, usedAt: null },
        data: { usedAt: now },
      });
      await this.revokeAccountSessions(tx, accountId, now);
    });

    return { message: 'MFA se desactivó y las sesiones fueron revocadas.' };
  }

  async regenerateMfaRecoveryCodes(
    accountId: string,
    dto: MfaRecoveryCodesDto,
  ) {
    const recoveryCodes = await this.prisma.$transaction(async (tx) => {
      const account = await tx.account.findUnique({
        where: { id: accountId },
        select: { status: true, mfaEnabled: true },
      });

      if (
        !account ||
        account.status !== 'active' ||
        !account.mfaEnabled
      ) {
        throw new UnauthorizedException(
          'No se pudo completar la operación de seguridad.',
        );
      }

      await this.consumeSecondFactor(tx, accountId, dto.code, new Date());
      return this.replaceRecoveryCodes(tx, accountId);
    });

    return { status: 'active' as const, recoveryCodes };
  }

  async logout(accountId: string, sessionId: string) {
    const revokedAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      const session = await tx.userSession.findUnique({
        where: { id: sessionId },
        select: { accountId: true, revokedAt: true },
      });

      if (!session || session.accountId !== accountId) {
        throw new UnauthorizedException('No se pudo cerrar la sesión.');
      }

      if (!session.revokedAt) {
        await tx.userSession.updateMany({
          where: {
            id: sessionId,
            accountId,
            revokedAt: null,
          },
          data: { revokedAt },
        });
      }

      await tx.refreshToken.updateMany({
        where: { sessionId, revokedAt: null },
        data: { revokedAt },
      });
    });

    return { message: 'Sesión cerrada correctamente.' };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const email = dto.email.trim().toLowerCase();
    const profile = await this.clientes.findByEmail(email);

    if (!profile) {
      return { message: FORGOT_PASSWORD_MESSAGE };
    }

    const account = await this.prisma.account.findUnique({
      where: { clientId: profile.id },
      select: {
        id: true,
        status: true,
        emailVerifiedAt: true,
      },
    });

    if (!account || account.status !== 'active' || !account.emailVerifiedAt) {
      return { message: FORGOT_PASSWORD_MESSAGE };
    }

    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS);

    await this.prisma.passwordResetToken.create({
      data: {
        accountId: account.id,
        tokenHash,
        expiresAt,
      },
    });

    try {
      await this.mailer.sendPasswordReset(email, token);
    } catch {
      try {
        await this.prisma.passwordResetToken.updateMany({
          where: { tokenHash, usedAt: null },
          data: { usedAt: new Date() },
        });
      } catch {
        this.logger.error(
          'No se pudo invalidar un token de restablecimiento no entregado.',
        );
      }

      this.logger.error(
        'No se pudo enviar un correo de restablecimiento de contraseña.',
      );
    }

    return { message: FORGOT_PASSWORD_MESSAGE };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const tokenHash = createHash('sha256')
      .update(dto.token)
      .digest('hex');
    const now = new Date();
    const token = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        accountId: true,
        expiresAt: true,
        usedAt: true,
        account: {
          select: {
            status: true,
            emailVerifiedAt: true,
          },
        },
      },
    });

    if (
      !token ||
      token.usedAt ||
      token.expiresAt <= now ||
      token.account.status !== 'active' ||
      !token.account.emailVerifiedAt
    ) {
      throw new BadRequestException(INVALID_PASSWORD_RESET_TOKEN_MESSAGE);
    }

    const passwordHash = await this.passwords.hashPassword(dto.password);

    await this.prisma.$transaction(async (tx) => {
      const currentToken = await tx.passwordResetToken.findUnique({
        where: { tokenHash },
        select: {
          id: true,
          accountId: true,
          expiresAt: true,
          usedAt: true,
          account: {
            select: {
              status: true,
              emailVerifiedAt: true,
            },
          },
        },
      });

      if (
        !currentToken ||
        currentToken.usedAt ||
        currentToken.expiresAt <= now ||
        currentToken.account.status !== 'active' ||
        !currentToken.account.emailVerifiedAt
      ) {
        throw new BadRequestException(INVALID_PASSWORD_RESET_TOKEN_MESSAGE);
      }

      const consumed = await tx.passwordResetToken.updateMany({
        where: {
          id: currentToken.id,
          usedAt: null,
          expiresAt: { gt: now },
        },
        data: { usedAt: now },
      });

      if (consumed.count !== 1) {
        throw new BadRequestException(INVALID_PASSWORD_RESET_TOKEN_MESSAGE);
      }

      await tx.account.update({
        where: { id: currentToken.accountId },
        data: { passwordHash },
      });

      await tx.passwordResetToken.updateMany({
        where: {
          accountId: currentToken.accountId,
          id: { not: currentToken.id },
          usedAt: null,
          expiresAt: { gt: now },
        },
        data: { usedAt: now },
      });

      const sessions = await tx.userSession.findMany({
        where: { accountId: currentToken.accountId },
        select: { id: true },
      });

      await tx.userSession.updateMany({
        where: {
          accountId: currentToken.accountId,
          revokedAt: null,
        },
        data: { revokedAt: now },
      });

      await tx.refreshToken.updateMany({
        where: {
          sessionId: { in: sessions.map((session) => session.id) },
          revokedAt: null,
        },
        data: { revokedAt: now },
      });

      await tx.mfaChallenge.updateMany({
        where: { accountId: currentToken.accountId, usedAt: null },
        data: { usedAt: now },
      });
    });

    return { message: RESET_PASSWORD_MESSAGE };
  }

  private async createMfaChallenge(
    accountId: string,
    purpose: 'login' | 'enrollment',
  ) {
    const now = new Date();
    const challengeToken = randomBytes(32).toString('hex');
    const tokenHash = this.mfa.hashChallengeToken(challengeToken);

    await this.prisma.$transaction(async (tx) => {
      const account = await tx.account.findUnique({
        where: { id: accountId },
        select: {
          id: true,
          role: true,
          status: true,
          emailVerifiedAt: true,
          mfaEnabled: true,
        },
      });

      if (
        !account ||
        account.status !== 'active' ||
        !account.emailVerifiedAt
      ) {
        throw new UnauthorizedException(LOGIN_ERROR_MESSAGE);
      }

      if (purpose === 'login') {
        const secret = await tx.mfaSecret.findUnique({
          where: { accountId },
          select: { status: true },
        });
        if (!account.mfaEnabled || secret?.status !== 'active') {
          throw new UnauthorizedException(LOGIN_ERROR_MESSAGE);
        }
      } else if (
        account.mfaEnabled ||
        !this.isMfaRequiredRole(account.role)
      ) {
        throw new UnauthorizedException(LOGIN_ERROR_MESSAGE);
      }

      await tx.mfaChallenge.updateMany({
        where: {
          accountId,
          purpose,
          usedAt: null,
          expiresAt: { gt: now },
        },
        data: { usedAt: now },
      });

      await tx.mfaChallenge.create({
        data: {
          accountId,
          purpose,
          tokenHash,
          expiresAt: new Date(now.getTime() + MFA_CHALLENGE_TTL_MS),
        },
      });
    });

    if (purpose === 'login') {
      return {
        mfaRequired: true as const,
        challengeToken,
        expiresIn: MFA_CHALLENGE_TTL_SECONDS,
      };
    }

    return {
      mfaSetupRequired: true as const,
      enrollmentToken: challengeToken,
      expiresIn: MFA_CHALLENGE_TTL_SECONDS,
    };
  }

  private async findValidMfaChallenge(
    tx: Prisma.TransactionClient,
    challengeToken: string,
    purpose: 'login' | 'enrollment',
    now: Date,
  ) {
    const challenge = await tx.mfaChallenge.findUnique({
      where: { tokenHash: this.mfa.hashChallengeToken(challengeToken) },
      select: {
        id: true,
        accountId: true,
        purpose: true,
        expiresAt: true,
        usedAt: true,
        account: {
          select: {
            role: true,
            status: true,
            emailVerifiedAt: true,
            mfaEnabled: true,
          },
        },
      },
    });

    if (
      !challenge ||
      challenge.purpose !== purpose ||
      challenge.usedAt ||
      challenge.expiresAt <= now ||
      challenge.account.status !== 'active' ||
      !challenge.account.emailVerifiedAt
    ) {
      throw new BadRequestException(MFA_INVALID_CHALLENGE_MESSAGE);
    }

    return challenge;
  }

  private async consumeMfaChallenge(
    tx: Prisma.TransactionClient,
    challengeId: string,
    now: Date,
  ) {
    const consumed = await tx.mfaChallenge.updateMany({
      where: {
        id: challengeId,
        usedAt: null,
        expiresAt: { gt: now },
      },
      data: { usedAt: now },
    });

    if (consumed.count !== 1) {
      throw new BadRequestException(MFA_INVALID_CHALLENGE_MESSAGE);
    }
  }

  private async createLoginSession(accountId: string, role: string) {
    return this.prisma.$transaction((tx) =>
      this.createSessionInTransaction(tx, accountId, role, new Date()),
    );
  }

  private async createSessionInTransaction(
    tx: Prisma.TransactionClient,
    accountId: string,
    role: string,
    now: Date,
  ) {
    const sessionId = randomUUID();
    const familyId = randomUUID();
    const sessionExpiresAt = new Date(now.getTime() + REFRESH_TOKEN_TTL_MS);
    const refreshToken = randomBytes(32).toString('hex');
    const refreshTokenHash = createHash('sha256')
      .update(refreshToken)
      .digest('hex');
    const { accessToken, expiresIn } = await this.createAccessToken(
      accountId,
      role,
      sessionId,
      now,
    );

    await tx.userSession.create({
      data: {
        id: sessionId,
        accountId,
        expiresAt: sessionExpiresAt,
      },
    });
    await tx.refreshToken.create({
      data: {
        sessionId,
        tokenHash: refreshTokenHash,
        familyId,
        expiresAt: sessionExpiresAt,
      },
    });
    await tx.account.update({
      where: { id: accountId },
      data: { lastLoginAt: now },
    });

    return { accessToken, refreshToken, expiresIn };
  }

  private async upsertPendingMfaSecret(
    tx: Prisma.TransactionClient,
    accountId: string,
    encryptedSecret: string,
  ) {
    const current = await tx.mfaSecret.findUnique({
      where: { accountId },
      select: { status: true },
    });

    if (current?.status === 'active') {
      throw new BadRequestException('MFA ya está activado.');
    }

    await tx.mfaSecret.upsert({
      where: { accountId },
      create: {
        accountId,
        status: 'pending_activation',
        secretEncrypted: encryptedSecret,
      },
      update: {
        status: 'pending_activation',
        secretEncrypted: encryptedSecret,
        enabledAt: null,
        lastVerifiedAt: null,
      },
    });
  }

  private async activateMfa(
    tx: Prisma.TransactionClient,
    accountId: string,
    code: string,
    now: Date,
  ) {
    const account = await tx.account.findUnique({
      where: { id: accountId },
      select: { status: true, mfaEnabled: true },
    });
    const secretRecord = await tx.mfaSecret.findUnique({
      where: { accountId },
      select: {
        id: true,
        status: true,
        secretEncrypted: true,
        lastVerifiedAt: true,
      },
    });

    if (
      !account ||
      account.status !== 'active' ||
      account.mfaEnabled ||
      !secretRecord ||
      secretRecord.status !== 'pending_activation'
    ) {
      throw new BadRequestException(MFA_INVALID_CODE_MESSAGE);
    }

    const secret = this.mfa.decryptSecret(secretRecord.secretEncrypted);
    const counter = this.mfa.verifyTotp(secret, code, now);
    if (counter === null) {
      throw new BadRequestException(MFA_INVALID_CODE_MESSAGE);
    }

    const lastVerifiedAt = new Date(counter * 30_000);
    const enabled = await tx.account.updateMany({
      where: { id: accountId, status: 'active', mfaEnabled: false },
      data: { mfaEnabled: true },
    });
    if (enabled.count !== 1) {
      throw new BadRequestException(MFA_INVALID_CODE_MESSAGE);
    }

    const activated = await tx.mfaSecret.updateMany({
      where: {
        id: secretRecord.id,
        status: 'pending_activation',
        lastVerifiedAt: null,
      },
      data: {
        status: 'active',
        enabledAt: now,
        lastVerifiedAt,
      },
    });
    if (activated.count !== 1) {
      throw new BadRequestException(MFA_INVALID_CODE_MESSAGE);
    }

    await this.revokeAccountSessions(tx, accountId, now);
    return this.replaceRecoveryCodes(tx, accountId);
  }

  private async consumeSecondFactor(
    tx: Prisma.TransactionClient,
    accountId: string,
    code: string,
    now: Date,
  ) {
    if (this.mfa.isRecoveryCode(code)) {
      const recoveryCode = await tx.mfaRecoveryCode.findUnique({
        where: { codeHash: this.mfa.hashRecoveryCode(code) },
        select: {
          id: true,
          accountId: true,
          usedAt: true,
          expiresAt: true,
        },
      });

      if (
        !recoveryCode ||
        recoveryCode.accountId !== accountId ||
        recoveryCode.usedAt ||
        (recoveryCode.expiresAt && recoveryCode.expiresAt <= now)
      ) {
        throw new BadRequestException(MFA_INVALID_CODE_MESSAGE);
      }

      const consumed = await tx.mfaRecoveryCode.updateMany({
        where: {
          id: recoveryCode.id,
          accountId,
          usedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        data: { usedAt: now },
      });

      if (consumed.count !== 1) {
        throw new BadRequestException(MFA_INVALID_CODE_MESSAGE);
      }
      return;
    }

    const secretRecord = await tx.mfaSecret.findUnique({
      where: { accountId },
      select: { id: true, status: true, secretEncrypted: true },
    });
    if (!secretRecord || secretRecord.status !== 'active') {
      throw new BadRequestException(MFA_INVALID_CODE_MESSAGE);
    }

    const secret = this.mfa.decryptSecret(secretRecord.secretEncrypted);
    const counter = this.mfa.verifyTotp(secret, code, now);
    if (counter === null) {
      throw new BadRequestException(MFA_INVALID_CODE_MESSAGE);
    }

    const lastVerifiedAt = new Date(counter * 30_000);
    const consumed = await tx.mfaSecret.updateMany({
      where: {
        id: secretRecord.id,
        status: 'active',
        OR: [
          { lastVerifiedAt: null },
          { lastVerifiedAt: { lt: lastVerifiedAt } },
        ],
      },
      data: { lastVerifiedAt },
    });

    if (consumed.count !== 1) {
      throw new BadRequestException(MFA_INVALID_CODE_MESSAGE);
    }
  }

  private async replaceRecoveryCodes(
    tx: Prisma.TransactionClient,
    accountId: string,
  ) {
    const codes = this.mfa.generateRecoveryCodes();
    await this.deleteRecoveryCodes(tx, accountId);

    for (const code of codes) {
      await tx.mfaRecoveryCode.create({
        data: {
          accountId,
          codeHash: this.mfa.hashRecoveryCode(code),
        },
      });
    }

    return codes;
  }

  private async deleteRecoveryCodes(
    tx: Prisma.TransactionClient,
    accountId: string,
  ) {
    await tx.mfaRecoveryCode.deleteMany({
      where: {
        accountId,
        codeHash: { startsWith: MFA_RECOVERY_CODE_PREFIX },
      },
    });
  }

  private async revokeAccountSessions(
    tx: Prisma.TransactionClient,
    accountId: string,
    revokedAt: Date,
  ) {
    const sessions = await tx.userSession.findMany({
      where: { accountId },
      select: { id: true },
    });

    await tx.userSession.updateMany({
      where: { accountId, revokedAt: null },
      data: { revokedAt },
    });
    await tx.refreshToken.updateMany({
      where: {
        sessionId: { in: sessions.map((session) => session.id) },
        revokedAt: null,
      },
      data: { revokedAt },
    });
  }

  private isMfaRequiredRole(role: string): boolean {
    return role === 'staff' || role === 'admin';
  }

  private async createAccessToken(
    accountId: string,
    role: string,
    sessionId: string,
    now: Date,
  ) {
    const accessToken = await this.jwt.signAsync({
      sub: accountId,
      role,
      sid: sessionId,
    });
    const claims = this.jwt.decode<{ exp?: number } | string | null>(accessToken);

    if (!claims || typeof claims !== 'object' || typeof claims.exp !== 'number') {
      throw new ServiceUnavailableException(
        'No se pudo determinar la expiración del token de acceso.',
      );
    }

    const expiresIn = claims.exp - Math.floor(now.getTime() / 1000);
    if (!Number.isFinite(expiresIn) || expiresIn <= 0) {
      throw new ServiceUnavailableException(
        'La expiración del token de acceso no es válida.',
      );
    }

    return { accessToken, expiresIn };
  }

  private async revokeRefreshFamily(
    tx: Prisma.TransactionClient,
    familyId: string,
    sessionId: string,
    revokedAt: Date,
  ) {
    await tx.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt },
    });

    await tx.userSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt },
    });
  }

  async register(dto: RegisterDto) {
    this.mailer.assertConfigured();

    const email = dto.email.trim().toLowerCase();

    const existing = await this.clientes.findByEmail(email);
    if (existing) {
      return { message: REGISTER_MESSAGE };
    }

    const passwordHash = await this.passwords.hashPassword(dto.password);
    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    let profile: Awaited<
      ReturnType<ClientesService['registerClientProfile']>
    >;

    try {
      profile = await this.clientes.registerClientProfile({
        fullName: dto.fullName,
        email,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return { message: REGISTER_MESSAGE };
      }

      throw error;
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        const account = await tx.account.create({
          data: {
            clientId: profile.id,
            passwordHash,
            role: 'customer',
            status: 'pending_confirmation',
          },
        });

        await tx.emailVerificationToken.create({
          data: {
            accountId: account.id,
            tokenHash,
            expiresAt,
          },
        });
      });
    } catch (error) {
      // Antes de compensar, comprobar que la cuenta no llegó a crearse.
      // Clientes no consulta ni administra la tabla Account.
      let accountExists = true;

      try {
        const account = await this.prisma.account.findUnique({
          where: { clientId: profile.id },
          select: { id: true },
        });

        accountExists = account != null;
      } catch {
        // Si no podemos comprobarlo, no eliminamos el perfil.
        accountExists = true;
      }

      if (!accountExists) {
        try {
          await this.clientes.rollbackClientRegistration(profile.id, email);
        } catch {
          this.logger.error(
            'No se pudo revertir el registro incompleto del cliente.',
          );
        }
      }

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return { message: REGISTER_MESSAGE };
      }

      throw error;
    }

    try {
      await this.mailer.sendEmailVerification(email, token);
    } catch {
      throw new ServiceUnavailableException(
        'No fue posible enviar el correo. La cuenta quedó pendiente de confirmación.',
      );
    }

    return { message: REGISTER_MESSAGE };
  }

  async confirmEmail(dto: ConfirmEmailDto) {
    const tokenHash = createHash('sha256')
      .update(dto.token)
      .digest('hex');

    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      const verification = await tx.emailVerificationToken.findUnique({
        where: { tokenHash },
      });

      if (!verification) {
        throw new BadRequestException(
          'El enlace de confirmación no es válido o ha caducado.',
        );
      }

      if (verification.usedAt) {
        throw new BadRequestException(
          'El enlace de confirmación no es válido o ha caducado.',
        );
      }

      if (verification.expiresAt <= now) {
        throw new BadRequestException(
          'El enlace de confirmación no es válido o ha caducado.',
        );
      }

      // La condición evita que el mismo token se utilice dos veces.
      const consumed = await tx.emailVerificationToken.updateMany({
        where: {
          id: verification.id,
          usedAt: null,
          expiresAt: { gt: now },
        },
        data: {
          usedAt: now,
        },
      });

      if (consumed.count !== 1) {
        throw new BadRequestException(
          'El enlace de confirmación no es válido o ha caducado.',
        );
      }

      await tx.account.update({
        where: { id: verification.accountId },
        data: {
          status: 'active',
          emailVerifiedAt: now,
        },
      });
    });

    return { message: 'Correo electrónico confirmado correctamente.' };
  }
}
