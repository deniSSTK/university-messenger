import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Length, Matches } from 'class-validator';
import { PaginationRequestDto } from '../../../../../core/pagination/dto/pagination-request.dto.js';
import { trimLowercaseAndRemovePrefix } from '../../../../../common/utils/string.transforms.js';
import {
  USER_SEARCH_MIN_LENGTH,
  USER_SEARCH_MAX_LENGTH,
  USER_SEARCH_PATTERN,
} from './users.constants.js';
import { USERS_EXAMPLES } from './users.examples.js';

class SearchUsersRequestDto extends PaginationRequestDto {
  @ApiProperty({
    example: USERS_EXAMPLES.search,
    minLength: USER_SEARCH_MIN_LENGTH,
    pattern: `^\\s*@?[a-zA-Z0-9_]{${USER_SEARCH_MIN_LENGTH},${USER_SEARCH_MAX_LENGTH}}\\s*$`,
    description:
      'Required username prefix: 1–32 letters, digits or underscores after trimming, lowercasing and removing one optional leading @. Matching is case-insensitive.',
  })
  @Transform(trimLowercaseAndRemovePrefix('@'))
  @IsString()
  @Length(USER_SEARCH_MIN_LENGTH, USER_SEARCH_MAX_LENGTH)
  @Matches(USER_SEARCH_PATTERN)
  search!: string;
}

export { SearchUsersRequestDto };
