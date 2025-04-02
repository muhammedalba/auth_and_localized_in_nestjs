import { Transform, TransformFnParams } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

export class FieldLocalizeDto {
  @IsNotEmpty()
  @Transform(({ value }: TransformFnParams) => {
    return typeof value === 'string' ? value.trim() : String(value).trim();
  })
  @IsString()
  ar!: string;
  @IsNotEmpty()
  @Transform(({ value }: TransformFnParams) => {
    return typeof value === 'string' ? value.trim() : String(value).trim();
  })
  @IsString()
  en!: string;
}
