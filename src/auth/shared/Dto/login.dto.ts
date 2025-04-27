import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsNotEmpty,
} from 'class-validator';
export class LoginUserDto {
  @IsNotEmpty({ message: 'email is require' })
  @Transform(({ value }: { value: string }) => value.trim(), {
    toClassOnly: true,
  })
  @IsEmail({}, { message: 'email must be a valid email' })
  email!: string;

  @IsNotEmpty({ message: 'password is require' })
  @IsString({ message: 'password" must be a string' })
  @MinLength(6, {
    message: 'The password must be at least 32 characters long.',
  })
  @MaxLength(32, { message: 'The password must be at most 32 characters.' })
  @Transform(({ value }: { value: string }) => value.trim(), {
    toClassOnly: true,
  })
  password!: string;
}
