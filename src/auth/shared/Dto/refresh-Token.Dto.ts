import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';
export class RefreshTokenDto {
  @IsNotEmpty({
    message: 'refresh token is required',
  })
  @IsString({ message: 'must be a string' })
  @Transform(({ value }: { value: string }) => value.trim(), {
    toClassOnly: true,
  })
  refresh_Token!: string;

  @IsNotEmpty({ message: 'access token is required' })
  @IsString({ message: 'must be a string' })
  @Transform(({ value }: { value: string }) => value.trim(), {
    toClassOnly: true,
  })
  access_token!: string;
}
