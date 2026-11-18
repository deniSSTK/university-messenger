import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, Length, MaxLength, ValidateIf } from 'class-validator';
import { Transform } from 'class-transformer';
import { trimString } from '../../../../../common/utils/string.transforms.js';
import { USERS_EXAMPLES } from './users.examples.js';
import { UUID } from '../../../../../core/decorators/uuid.decorator.js';
import { REACTION_TYPES } from '@university-messenger/events';
import type { ReactionType } from '@university-messenger/events';

class UpdateProfileDto {
  @ApiProperty({
    enum: REACTION_TYPES,
    example: REACTION_TYPES[0],
    required: false,
  })
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @IsIn(REACTION_TYPES)
  defaultReaction?: ReactionType;

  @ApiProperty({
    example: USERS_EXAMPLES.displayName,
    minLength: 1,
    maxLength: 64,
  })
  @Transform(trimString)
  @IsString()
  @Length(1, 64)
  displayName!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: null,
    maxLength: 349550,
    required: false,
    description:
      'PNG/JPEG/WebP data URL, at most 256 KiB decoded. Null removes the avatar; omit to preserve it.',
  })
  @ValidateIf(
    (_object: unknown, value: unknown) => value !== null && value !== undefined,
  )
  @IsString()
  @MaxLength(349550)
  avatarUrl?: string | null;
}
class ProfileResponseDto {
  @ApiProperty({ enum: REACTION_TYPES, example: REACTION_TYPES[0] })
  defaultReaction?: ReactionType;

  @UUID()
  id!: string;

  @ApiProperty({ example: USERS_EXAMPLES.username })
  username!: string;

  @ApiProperty({ example: USERS_EXAMPLES.displayName })
  displayName!: string;

  @ApiProperty({ type: String, nullable: true, example: null })
  avatarUrl?: string | null;
}

export { UpdateProfileDto, ProfileResponseDto };
