import {
  RateLimit,
  RateLimitPeriod,
} from '../../../../core/rate-limit/rate-limit.decorator.js';
import { ApiServiceUnavailableResponse } from '@nestjs/swagger';
import {
  Body,
  Patch,
  BadRequestException,
  Delete,
  Put,
  Param,
  HttpCode,
  NotFoundException,
} from '@nestjs/common';
import { InvalidProfileError } from '../../domain/profile.models.js';
import { UpdateProfileDto, ProfileResponseDto } from './dto/profile.dto.js';
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
import {
  AliasTargetDto,
  SaveAliasDto,
  UserAliasDto,
} from './dto/user-alias.dto.js';

@ApiServiceUnavailableResponse({
  description: 'Object storage is temporarily unavailable.',
})
@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(AccessTokenGuard)
class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me/aliases')
  @RateLimit(60, RateLimitPeriod.MINUTE)
  @ApiOperation({ summary: 'List the signed-in user’s private nicknames' })
  @ApiOkResponse({ type: [UserAliasDto] })
  listAliases(@Req() request: AuthenticatedRequest): Promise<UserAliasDto[]> {
    return this.users.listAliases(request.auth.user.id);
  }

  @Put('me/aliases/:targetUserId')
  @RateLimit(30, RateLimitPeriod.MINUTE)
  @ApiOperation({ summary: 'Save a private nickname for another user' })
  @ApiOkResponse({ type: UserAliasDto })
  async saveAlias(
    @Param() params: AliasTargetDto,
    @Body() dto: SaveAliasDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<UserAliasDto> {
    const alias = await this.users.saveAlias(request.auth.user.id, {
      targetUserId: params.targetUserId,
      nickname: dto.nickname,
      color: dto.color,
    });

    if (!alias) {
      throw new NotFoundException('User not found.');
    }

    return alias;
  }

  @Delete('me/aliases/:targetUserId')
  @HttpCode(204)
  @RateLimit(30, RateLimitPeriod.MINUTE)
  @ApiOperation({ summary: 'Remove a private nickname' })
  async deleteAlias(
    @Param() params: AliasTargetDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this.users.deleteAlias(request.auth.user.id, params.targetUserId);
  }

  @Patch('me')
  @RateLimit(12, RateLimitPeriod.MINUTE)
  @ApiOperation({ summary: 'Update your display name and avatar' })
  @ApiOkResponse({ type: ProfileResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid name or avatar.' })
  @ApiUnauthorizedResponse({ description: 'Inactive session.' })
  async updateProfile(
    @Body() dto: UpdateProfileDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<ProfileResponseDto> {
    try {
      const result = await this.users.updateProfile({
        userId: request.auth.user.id,
        displayName: dto.displayName,
        avatarUrl: dto.avatarUrl,
        defaultReaction: dto.defaultReaction,
      });

      return {
        id: result.id,
        username: result.username,
        displayName: result.displayName,
        avatarUrl: result.avatarUrl,
        defaultReaction: result.defaultReaction,
      };
    } catch (error: unknown) {
      if (error instanceof InvalidProfileError) {
        throw new BadRequestException(error.message);
      }

      throw error;
    }
  }

  @Get()
  @RateLimit(90, RateLimitPeriod.MINUTE)
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
