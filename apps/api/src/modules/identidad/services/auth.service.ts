import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { ClientesService } from '../../clientes/services/clientes.service';
import { RegisterDto } from '../dto/register.dto';
import { ConfirmEmailDto } from '../dto/confirm-email.dto';
import { PasswordService } from './password.service';
import { MailerService } from './mailer.service';

const REGISTER_MESSAGE =
  'Si los datos son válidos, recibirás instrucciones en tu correo electrónico.';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clientes: ClientesService,
    private readonly passwords: PasswordService,
    private readonly mailer: MailerService,
  ) {}

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

    const confirmation = await this.prisma.$transaction(async (tx) => {
      const verification = await tx.emailVerificationToken.findUnique({
        where: { tokenHash },
      });

      if (!verification) {
        throw new BadRequestException(
          'El enlace de confirmación no es válido o ha caducado.',
        );
      }

      // Si el token ya se utilizó, comprobar si confirmó correctamente la cuenta.
      if (verification.usedAt) {
        const account = await tx.account.findUnique({
          where: { id: verification.accountId },
          select: {
            id: true,
            status: true,
            emailVerifiedAt: true,
          },
        });

        if (account?.status === 'active' && account.emailVerifiedAt) {
          return { account, alreadyConfirmed: true };
        }

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

      const account = await tx.account.update({
        where: { id: verification.accountId },
        data: {
          status: 'active',
          emailVerifiedAt: now,
        },
        select: {
          id: true,
          status: true,
          emailVerifiedAt: true,
        },
      });

      return { account, alreadyConfirmed: false };
    });

    return {
      alreadyConfirmed: confirmation.alreadyConfirmed,
      message: confirmation.alreadyConfirmed
        ? 'Este correo ya había sido confirmado. Tu cuenta está activa.'
        : 'Correo electrónico confirmado correctamente.',
      account: confirmation.account,
    };
  }
}
