import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { MfaFactorCodeDto } from './mfa-factor-code.dto';

export class MfaDisableDto extends MfaFactorCodeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password!: string;
}
