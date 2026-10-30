import { ApiProperty } from '@nestjs/swagger';
import { PAGINATION_EXAMPLES } from './pagination.examples.js';
import {
  PAGINATION_MIN_PAGE,
  PAGINATION_MAX_PAGE,
  PAGINATION_MIN_LIMIT,
  PAGINATION_MAX_LIMIT,
} from './pagination.constants.js';

class PaginationMetaDto {
  @ApiProperty({
    type: 'integer',
    minimum: PAGINATION_MIN_PAGE,
    maximum: PAGINATION_MAX_PAGE,
    example: PAGINATION_EXAMPLES.page,
    description: 'Requested page, including when the page is empty.',
  })
  page!: number;

  @ApiProperty({
    type: 'integer',
    minimum: PAGINATION_MIN_LIMIT,
    maximum: PAGINATION_MAX_LIMIT,
    example: PAGINATION_EXAMPLES.limit,
  })
  limit!: number;

  @ApiProperty({
    type: 'integer',
    minimum: 0,
    example: PAGINATION_EXAMPLES.total,
    description: 'Total matches before applying pagination.',
  })
  total!: number;

  @ApiProperty({
    type: 'integer',
    minimum: 0,
    example: PAGINATION_EXAMPLES.totalPages,
    description: 'Math.ceil(total / limit); 0 when there are no matches.',
  })
  totalPages!: number;
}

export { PaginationMetaDto };
