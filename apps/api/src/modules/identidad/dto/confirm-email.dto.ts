import {
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class ConfirmEmailDto {
  @IsString()
  @Length(64, 64)
  @Matches(/^[a-fA-F0-9]{64}$/)
  token!: string;
}
