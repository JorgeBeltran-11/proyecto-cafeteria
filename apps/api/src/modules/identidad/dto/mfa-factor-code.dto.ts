import { IsString, Matches } from 'class-validator';

export class MfaFactorCodeDto {
  @IsString()
  @Matches(/^(?:\d{6}|(?:[A-F0-9]{8}-){3}[A-F0-9]{8})$/i)
  code!: string;
}
