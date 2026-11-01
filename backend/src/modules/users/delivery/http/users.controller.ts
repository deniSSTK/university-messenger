import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AccessTokenGuard } from '../../../auth/delivery/http/guards/access-token.guard.js';
import type { AuthenticatedRequest } from '../../../auth/delivery/http/auth-http.types.js';
import { UsersService } from '../../service/users.service.js';
import { SearchUsersRequestDto } from './dto/search-users-request.dto.js';
import { SearchUsersResponseDto } from './dto/search-users-response.dto.js';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(AccessTokenGuard)
class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOperation({
    summary: 'Find other users by username prefix',
    description:
      'Excludes the current user and deleted users. Orders by username, then id, ascending. Empty and out-of-range pages return 200 with an empty items array.',
  })
  @ApiOkResponse({ type: SearchUsersResponseDto })
  @ApiBadRequestResponse({
    description:
      'Missing or invalid search, invalid pagination, arrays, objects or unexpected query parameters.',
  })
  @ApiUnauthorizedResponse({
    description:
      'Missing, invalid or expired access token or inactive session.',
  })
  async search(
    @Query() query: SearchUsersRequestDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<SearchUsersResponseDto> {
    const result = await this.users.search({
      currentUserId: request.auth.user.id,
      search: query.search,
      page: query.page,
      limit: query.limit,
    });

    return {
      items: result.items.map((user) => ({
        id: user.id,
        username: user.username,
        displayName: user.displayName,
      })),
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    };
  }
}

export { UsersController };
