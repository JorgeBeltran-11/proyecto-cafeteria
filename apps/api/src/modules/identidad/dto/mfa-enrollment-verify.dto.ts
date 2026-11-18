import { IsString, Matches } from 'class-validator';
import { MfaEnrollmentTokenDto } from './mfa-enrollment-token.dto';

export class MfaEnrollmentVerifyDto extends MfaEnrollmentTokenDto {
  @IsString()
  @Matches(/^\d{6}$/)
  code!: string;
}
