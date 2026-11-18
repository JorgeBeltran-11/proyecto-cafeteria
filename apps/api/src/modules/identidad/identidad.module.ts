import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, type JwtSignOptions } from '@nestjs/jwt';
import { ClientesModule } from '../clientes/clientes.module';
import { AuthController } from './controllers/auth.controller';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthService } from './services/auth.service';
import { MailerService } from './services/mailer.service';
import { MfaService } from './services/mfa.service';
import { PasswordService } from './services/password.service';

@Module({
  imports: [
    ClientesModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: config.get<string>('JWT_ACCESS_TTL', '15m') as
            JwtSignOptions['expiresIn'],
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    PasswordService,
    MailerService,
    MfaService,
    AuthService,
    JwtAuthGuard,
  ],
  exports: [PasswordService],
})
export class IdentidadModule {}
