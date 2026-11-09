import { ApiProperty } from '@nestjs/swagger';
import { UUID } from '../../../../../core/decorators/uuid.decorator.js';
import { AUTH_EXAMPLES, AUTH_USER_EXAMPLE } from './auth.examples.js';

class PublicUserDto {
  @UUID()
  id!: string;

  @ApiProperty({ example: AUTH_EXAMPLES.email, format: 'email' })
  email!: string;

  @ApiProperty({ example: AUTH_EXAMPLES.username })
  username!: string;

  @ApiProperty({ example: AUTH_EXAMPLES.displayName })
  displayName!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: null,
    description: 'Temporary signed S3 GET URL for the avatar.',
  })
  avatarUrl?: string | null;

  @ApiProperty({
    example: AUTH_EXAMPLES.createdAt,
    type: String,
    format: 'date-time',
  })
  createdAt!: Date;

  @ApiProperty({
    example: AUTH_EXAMPLES.updatedAt,
    type: String,
    format: 'date-time',
  })
  updatedAt!: Date;
}

class AuthResponseDto {
  @ApiProperty({ type: PublicUserDto, example: AUTH_USER_EXAMPLE })
  user!: PublicUserDto;

  @ApiProperty({ example: AUTH_EXAMPLES.accessToken })
  accessToken!: string;

  @ApiProperty({ example: AUTH_EXAMPLES.tokenType, enum: ['Bearer'] })
  tokenType!: string;

  @ApiProperty({
    example: AUTH_EXAMPLES.expiresIn,
    description: 'Access token lifetime in seconds.',
  })
  expiresIn!: number;
}

export { PublicUserDto, AuthResponseDto };
