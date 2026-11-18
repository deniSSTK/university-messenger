import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsString, IsUUID, Length } from 'class-validator';
import { NICKNAME_COLORS } from '@university-messenger/events';
import type { NicknameColor } from '@university-messenger/events';

const ALIAS_EXAMPLE = { nickname: 'Пелік', color: 'BLUE' } as const;

class AliasTargetDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  targetUserId!: string;
}

class SaveAliasDto {
  @ApiProperty({ example: ALIAS_EXAMPLE.nickname, minLength: 1, maxLength: 64 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 64)
  nickname!: string;

  @ApiProperty({ enum: NICKNAME_COLORS, example: ALIAS_EXAMPLE.color })
  @IsIn(NICKNAME_COLORS)
  color!: NicknameColor;
}

class UserAliasDto extends SaveAliasDto implements AliasTargetDto {
  @ApiProperty({ format: 'uuid' })
  targetUserId!: string;
}

export { AliasTargetDto, SaveAliasDto, UserAliasDto };
