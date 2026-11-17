import { Module } from '@nestjs/common';
import { ClientesModule } from '../clientes/clientes.module';
import { AuthController } from './controllers/auth.controller';
import { AuthService } from './services/auth.service';
import { MailerService } from './services/mailer.service';
import { PasswordService } from './services/password.service';

@Module({
  imports: [ClientesModule],
  controllers: [AuthController],
  providers: [PasswordService, MailerService, AuthService],
  exports: [PasswordService],
})
export class IdentidadModule {}
