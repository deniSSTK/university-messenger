import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';
import { toDecimalInteger } from '../../../common/utils/number.transforms.js';
import {
  PAGINATION_DEFAULT_PAGE,
  PAGINATION_DEFAULT_LIMIT,
  PAGINATION_MIN_PAGE,
  PAGINATION_MAX_PAGE,
  PAGINATION_MIN_LIMIT,
  PAGINATION_MAX_LIMIT,
} from './pagination.constants.js';
import { PAGINATION_EXAMPLES } from './pagination.examples.js';

class PaginationRequestDto {
  @ApiPropertyOptional({
    type: 'integer',
    minimum: PAGINATION_MIN_PAGE,
    maximum: PAGINATION_MAX_PAGE,
    default: PAGINATION_DEFAULT_PAGE,
    example: PAGINATION_EXAMPLES.page,
    description:
      'Page number, starting at 1. Only decimal integers are accepted.',
  })
  @Transform(toDecimalInteger)
  @IsInt()
  @Min(PAGINATION_MIN_PAGE)
  @Max(PAGINATION_MAX_PAGE)
  page: number = PAGINATION_DEFAULT_PAGE;

  @ApiPropertyOptional({
    type: 'integer',
    minimum: PAGINATION_MIN_LIMIT,
    maximum: PAGINATION_MAX_LIMIT,
    default: PAGINATION_DEFAULT_LIMIT,
    example: PAGINATION_EXAMPLES.limit,
    description:
      'Maximum number of items in a page. Only decimal integers are accepted.',
  })
  @Transform(toDecimalInteger)
  @IsInt()
  @Min(PAGINATION_MIN_LIMIT)
  @Max(PAGINATION_MAX_LIMIT)
  limit: number = PAGINATION_DEFAULT_LIMIT;
}

export { PaginationRequestDto };
