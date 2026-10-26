import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, Matches, MaxLength } from 'class-validator';
import {
  trimString,
  trimAndLowercase,
} from '../../../../../common/utils/string.transforms.js';
import { AUTH_EXAMPLES } from './auth.examples.js';

class LoginDto {
  @ApiProperty({
    example: AUTH_EXAMPLES.email,
    format: 'email',
    maxLength: 254,
  })
  @Transform(trimString)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({
    example: AUTH_EXAMPLES.password,
    format: 'password',
    minLength: 8,
    maxLength: 128,
    writeOnly: true,
  })
  @IsString()
  @Length(8, 128)
  password!: string;
}

class RegisterDto extends LoginDto {
  @ApiProperty({
    example: AUTH_EXAMPLES.username,
    minLength: 3,
    maxLength: 32,
    pattern: '^[a-z0-9_]+$',
  })
  @Transform(trimAndLowercase)
  @IsString()
  @Length(3, 32)
  @Matches(/^[a-z0-9_]+$/)
  username!: string;

  @ApiProperty({
    example: AUTH_EXAMPLES.displayName,
    minLength: 1,
    maxLength: 80,
  })
  @Transform(trimString)
  @IsString()
  @Length(1, 80)
  displayName!: string;
}

export { LoginDto, RegisterDto };
