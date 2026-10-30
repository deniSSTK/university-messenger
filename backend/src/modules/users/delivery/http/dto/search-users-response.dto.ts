import { ApiProperty } from '@nestjs/swagger';
import { PaginatedResponseDto } from '../../../../../common/delivery/http/dto/paginated-response.dto.js';
import { USERS_EXAMPLES } from './users.examples.js';

class UserSearchItemDto {
  @ApiProperty({ example: USERS_EXAMPLES.userId, format: 'uuid' })
  id!: string;

  @ApiProperty({ example: USERS_EXAMPLES.username })
  username!: string;

  @ApiProperty({ example: USERS_EXAMPLES.displayName })
  displayName!: string;
}

class SearchUsersResponseDto extends PaginatedResponseDto<UserSearchItemDto> {
  @ApiProperty({ type: () => UserSearchItemDto, isArray: true })
  declare items: UserSearchItemDto[];
}

export { UserSearchItemDto, SearchUsersResponseDto };
