import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsNotEmpty,
} from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

export class loginUserDto {
  @IsNotEmpty({
    message: i18nValidationMessage('validation.notFound', { message: 'COOL' }),
  })
  // @IsNotEmpty({ message: 'البريد الإلكتروني مطلوب' })
  @IsEmail({}, { message: 'البريد الإلكتروني غير صالح' })
  email!: string;

  @IsNotEmpty({ message: 'كلمة المرور مطلوبة' })
  @IsString({ message: 'يجب أن تكون كلمة المرور نصًا' })
  @MinLength(6, { message: 'يجب أن تكون كلمة المرور على الأقل 6 أحرف' })
  @MaxLength(32, { message: 'يجب أن تكون كلمة المرور على الأكثر 32 حرفًا' })
  password!: string;
}
