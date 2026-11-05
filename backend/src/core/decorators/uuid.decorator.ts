import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { UUID_EXAMPLE } from '../examples/uuid.examples.js';

function UUID(): PropertyDecorator {
  return applyDecorators(
    ApiProperty({ type: String, format: 'uuid', example: UUID_EXAMPLE }),
    IsUUID(),
  );
}

export { UUID };
