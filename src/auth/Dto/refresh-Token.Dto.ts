import { IsNotEmpty, IsString } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
export class RefreshTokenDto {
  @IsNotEmpty({
    message: i18nValidationMessage('validation.notFound', { message: 'COOL' }),
  })
  @IsString({ message: 'must be a string' })
  refresh_Token!: string;
  @IsNotEmpty({ message: 'الرمز المتصل مطلوب' })
  @IsString({ message: 'must be a string' })
  access_token!: string;
}
