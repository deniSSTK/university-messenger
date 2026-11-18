import { REACTION_TYPES } from '@university-messenger/events';
import type { ReactionType } from '@university-messenger/events';
import { ApiProperty } from '@nestjs/swagger';
import { IsIn, ValidateIf } from 'class-validator';
import { CHATS_EXAMPLES } from './chats.examples.js';

class SetReactionDto {
  @ApiProperty({
    enum: REACTION_TYPES,
    nullable: true,
    example: REACTION_TYPES[0],
  })
  @ValidateIf((_object: unknown, value: unknown) => value !== null)
  @IsIn(REACTION_TYPES)
  type!: ReactionType | null;
}
class ReactionCountDto {
  @ApiProperty({ enum: REACTION_TYPES, example: REACTION_TYPES[0] })
  type!: ReactionType;

  @ApiProperty({ example: CHATS_EXAMPLES.reactionCount, minimum: 1 })
  count!: number;
}
class ReactionStateDto {
  @ApiProperty({ example: CHATS_EXAMPLES.reactionVersion, minimum: 0 })
  reactionVersion!: number;

  @ApiProperty({ type: [ReactionCountDto] })
  reactions!: ReactionCountDto[];

  @ApiProperty({
    enum: REACTION_TYPES,
    nullable: true,
    example: REACTION_TYPES[0],
  })
  myReaction!: ReactionType | null;
}

export { ReactionStateDto, SetReactionDto };
