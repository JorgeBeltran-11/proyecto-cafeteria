import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  AllowRevokedSession,
  AuthenticatedJwtUser,
  JwtAuthGuard,
} from '../guards/jwt-auth.guard';
import { AuthService } from '../services/auth.service';
import { LoginDto } from '../dto/login.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { RegisterDto } from '../dto/register.dto';
import { ConfirmEmailDto } from '../dto/confirm-email.dto';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { LoginMfaDto } from '../dto/login-mfa.dto';
import { MfaDisableDto } from '../dto/mfa-disable.dto';
import { MfaEnrollmentTokenDto } from '../dto/mfa-enrollment-token.dto';
import { MfaEnrollmentVerifyDto } from '../dto/mfa-enrollment-verify.dto';
import { MfaRecoveryCodesDto } from '../dto/mfa-recovery-codes.dto';
import { MfaVerifyDto } from '../dto/mfa-verify.dto';

@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Post('login/mfa')
  @HttpCode(HttpStatus.OK)
  completeMfaLogin(@Body() dto: LoginMfaDto) {
    return this.auth.completeMfaLogin(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshTokenDto) {
    return this.auth.refresh(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @AllowRevokedSession()
  logout(@Req() request: { user: AuthenticatedJwtUser }) {
    return this.auth.logout(request.user.sub, request.user.sid);
  }

  @Post('register')
  @HttpCode(HttpStatus.OK)
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('confirm-email')
  @HttpCode(HttpStatus.OK)
  confirmEmail(@Body() dto: ConfirmEmailDto) {
    return this.auth.confirmEmail(dto);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }

  @Post('mfa/setup')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  setupMfa(@Req() request: { user: AuthenticatedJwtUser }) {
    return this.auth.setupMfa(request.user.sub);
  }

  @Post('mfa/enrollment/setup')
  @HttpCode(HttpStatus.OK)
  setupMfaForRequiredEnrollment(@Body() dto: MfaEnrollmentTokenDto) {
    return this.auth.setupMfaForRequiredEnrollment(dto);
  }

  @Post('mfa/verify')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  verifyMfa(
    @Req() request: { user: AuthenticatedJwtUser },
    @Body() dto: MfaVerifyDto,
  ) {
    return this.auth.verifyMfa(request.user.sub, dto);
  }

  @Post('mfa/enrollment/verify')
  @HttpCode(HttpStatus.OK)
  verifyRequiredMfaEnrollment(@Body() dto: MfaEnrollmentVerifyDto) {
    return this.auth.verifyRequiredMfaEnrollment(dto);
  }

  @Post('mfa/disable')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  disableMfa(
    @Req() request: { user: AuthenticatedJwtUser },
    @Body() dto: MfaDisableDto,
  ) {
    return this.auth.disableMfa(request.user.sub, dto);
  }

  @Post('mfa/recovery-codes')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  regenerateMfaRecoveryCodes(
    @Req() request: { user: AuthenticatedJwtUser },
    @Body() dto: MfaRecoveryCodesDto,
  ) {
    return this.auth.regenerateMfaRecoveryCodes(request.user.sub, dto);
  }
}
