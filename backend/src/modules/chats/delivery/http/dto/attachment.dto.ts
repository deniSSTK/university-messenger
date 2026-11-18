import { ApiProperty, ApiPropertyOptional, PickType } from '@nestjs/swagger';
import { IsBase64, IsString, IsUUID, Length, MaxLength } from 'class-validator';
import { FILE_EXAMPLES } from './attachment.examples.js';
import { ReplyTargetDto } from './reply-target.dto.js';
class SendAttachmentDto extends ReplyTargetDto {
  @ApiProperty({ example: FILE_EXAMPLES.name, maxLength: 255 })
  @IsString()
  @Length(1, 255)
  name!: string;

  @ApiProperty({ example: FILE_EXAMPLES.mediaType, maxLength: 127 })
  @IsString()
  @Length(1, 127)
  mediaType!: string;

  @ApiProperty({
    example: FILE_EXAMPLES.content,
    maxLength: 6990508,
    description: 'Base64 file content, at most 5 MiB decoded.',
  })
  @IsString()
  @IsBase64()
  @MaxLength(6990508)
  content!: string;
}
class SendVoiceDto extends PickType(SendAttachmentDto, [
  'mediaType',
  'content',
  'replyToId',
]) {
  @ApiProperty({ example: FILE_EXAMPLES.voiceId, format: 'uuid' })
  @IsUUID('4')
  id!: string;
}

class VoiceMetadataDto {
  @ApiProperty({ example: FILE_EXAMPLES.durationMs })
  durationMs!: number;

  @ApiProperty({ example: FILE_EXAMPLES.waveform, type: [Number] })
  waveform!: number[];
}

class AttachmentResponseDto {
  @ApiProperty({ example: FILE_EXAMPLES.name })
  name!: string;

  @ApiProperty({ example: FILE_EXAMPLES.mediaType })
  mediaType!: string;

  @ApiProperty({ example: FILE_EXAMPLES.content })
  content!: string;
}
class AttachmentMetadataDto {
  @ApiProperty({ example: FILE_EXAMPLES.name })
  name!: string;

  @ApiProperty({ example: FILE_EXAMPLES.mediaType })
  mediaType!: string;

  @ApiProperty({ example: FILE_EXAMPLES.size })
  size!: number;

  @ApiPropertyOptional({ type: VoiceMetadataDto })
  voice?: VoiceMetadataDto;
}

export {
  SendAttachmentDto,
  AttachmentResponseDto,
  AttachmentMetadataDto,
  SendVoiceDto,
};
