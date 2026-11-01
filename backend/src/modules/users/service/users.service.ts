import type { UsersRepository } from '../domain/users.repository.js';
import type { SearchUsersInput, SearchUsersResult } from './users.types.js';

class UsersService {
  constructor(private readonly repository: UsersRepository) {}

  async search(input: SearchUsersInput): Promise<SearchUsersResult> {
    const result = await this.repository.findByUsernamePrefix({
      usernamePrefix: input.search,
      excludedUserId: input.currentUserId,
      offset: (input.page - 1) * input.limit,
      take: input.limit,
    });

    return {
      items: result.users.map((user) => ({
        id: user.id,
        username: user.username,
        displayName: user.displayName,
      })),
      page: input.page,
      limit: input.limit,
      total: result.total,
      totalPages: Math.ceil(result.total / input.limit),
    };
  }
}

export { UsersService };
