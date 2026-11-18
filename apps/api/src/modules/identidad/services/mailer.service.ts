import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);

  constructor(private readonly config: ConfigService) {}

  private isConsoleMode(): boolean {
    return (
      this.config.get<string>('MAIL_MODE') === 'console' &&
      this.config.get<string>('NODE_ENV') !== 'production'
    );
  }

  private getSettings() {
    const host = this.config.get<string>('MAIL_HOST');
    const user = this.config.get<string>('MAIL_USER');
    const password = this.config.get<string>('MAIL_PASSWORD');
    const from = this.config.get<string>('MAIL_FROM');
    const port = Number(this.config.get<string>('MAIL_PORT') ?? 587);
    const secure =
      this.config.get<string>('MAIL_SECURE')?.toLowerCase() === 'true';

    if (
      !host ||
      !user ||
      !password ||
      !from ||
      !Number.isInteger(port) ||
      port < 1 ||
      port > 65535
    ) {
      throw new ServiceUnavailableException(
        'El servicio de correo no está configurado correctamente.',
      );
    }

    return { host, user, password, from, port, secure };
  }

  assertConfigured(): void {
    if (this.isConsoleMode()) return;
    this.getSettings();
  }

  async sendEmailVerification(email: string, token: string): Promise<void> {
    const webOrigin = (
      this.config.get<string>('WEB_ORIGIN') ?? 'http://localhost:3000'
    ).replace(/\/$/, '');

    const confirmationUrl =
      `${webOrigin}/confirm-email?token=${encodeURIComponent(token)}`;

    if (this.isConsoleMode()) {
      this.logger.log(
        [
          'MODO DE DESARROLLO: no se envió un correo real.',
          `Destinatario: ${email}`,
          `Enlace de confirmación: ${confirmationUrl}`,
        ].join('\n'),
      );
      return;
    }

    const settings = this.getSettings();

    const transporter = nodemailer.createTransport({
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      auth: {
        user: settings.user,
        pass: settings.password,
      },
    });

    await transporter.sendMail({
      from: settings.from,
      to: email,
      subject: 'Confirma tu correo electrónico',
      text: [
        'Gracias por registrarte.',
        'Para confirmar tu correo, abre el siguiente enlace:',
        confirmationUrl,
        'Este enlace caduca en 24 horas.',
      ].join('\n\n'),
    });
  }

  async sendPasswordReset(email: string, token: string): Promise<void> {
    const webOrigin = (
      this.config.get<string>('WEB_ORIGIN') ?? 'http://localhost:3000'
    ).replace(/\/$/, '');
    const resetUrl =
      `${webOrigin}/reset-password?token=${encodeURIComponent(token)}`;

    if (this.isConsoleMode()) {
      this.logger.log(
        'MODO DE DESARROLLO: no se envió un correo de restablecimiento.',
      );
      return;
    }

    const settings = this.getSettings();
    const transporter = nodemailer.createTransport({
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      auth: {
        user: settings.user,
        pass: settings.password,
      },
    });

    await transporter.sendMail({
      from: settings.from,
      to: email,
      subject: 'Restablece tu contraseña',
      text: [
        'Recibimos una solicitud para restablecer tu contraseña.',
        'Para continuar, abre el siguiente enlace:',
        resetUrl,
        'Este enlace caduca en 30 minutos y solo se puede utilizar una vez.',
        'Si no solicitaste este cambio, puedes ignorar este mensaje.',
      ].join('\n\n'),
    });
  }
}