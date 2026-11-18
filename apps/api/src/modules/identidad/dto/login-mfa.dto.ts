import { IsString, Length, Matches } from 'class-validator';
import { MfaFactorCodeDto } from './mfa-factor-code.dto';

export class LoginMfaDto extends MfaFactorCodeDto {
  @IsString()
  @Length(64, 64)
  @Matches(/^[a-f0-9]{64}$/i)
  challengeToken!: string;
}
