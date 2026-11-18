import { IsString, Length, Matches } from 'class-validator';

export class MfaEnrollmentTokenDto {
  @IsString()
  @Length(64, 64)
  @Matches(/^[a-f0-9]{64}$/i)
  enrollmentToken!: string;
}
