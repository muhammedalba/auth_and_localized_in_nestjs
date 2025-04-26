import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

export class resetCodeDto {
  @IsNotEmpty({
    message: i18nValidationMessage('validation.notFound', { message: 'COOL' }),
  })
  @IsString({
    message: i18nValidationMessage('validation.string', { message: 'COOL' }),
  })
  @MaxLength(6, {
    message: '6 characters max',
  })
  @MinLength(6, {
    message: '6 characters min',
  })
  resetCode!: string;
}
