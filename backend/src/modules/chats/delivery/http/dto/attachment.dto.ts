import { ApiProperty } from '@nestjs/swagger';
import { IsBase64, IsString, Length, MaxLength } from 'class-validator';
import { FILE_EXAMPLES } from './attachment.examples.js';
class SendAttachmentDto {
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
}

export { SendAttachmentDto, AttachmentResponseDto, AttachmentMetadataDto };
