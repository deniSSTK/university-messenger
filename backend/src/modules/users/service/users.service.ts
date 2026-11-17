import { randomUUID } from 'node:crypto';
import type { ObjectStorage } from '../../media/domain/object-storage.port.js';
import { MediaUnavailableError } from '../../media/domain/object-storage.port.js';
import { avatarUrl } from '../../../common/utils/avatar-url.js';
import type { ProfileUpdateResult } from '../domain/profile.models.js';
import { InvalidProfileError } from '../domain/profile.models.js';
import { isAvatarDataUrl } from '../../../common/utils/image-data.js';
import type { UpdateProfileInput, ProfileResult } from './users.types.js';
import type { UsersRepository } from '../domain/users.repository.js';
import type { SearchUsersInput, SearchUsersResult } from './users.types.js';

class UsersService {
  constructor(
    private readonly repository: UsersRepository,
    private readonly storage?: ObjectStorage,
  ) {}

  async updateProfile(input: UpdateProfileInput): Promise<ProfileResult> {
    const displayName = input.displayName.trim();

    if (
      !displayName ||
      [...displayName].length > 64 ||
      (input.avatarUrl !== undefined &&
        input.avatarUrl !== null &&
        !isAvatarDataUrl(input.avatarUrl))
    ) {
      throw new InvalidProfileError(
        'Use a name of 1–64 characters and a PNG, JPEG or WebP avatar up to 256 KiB.',
      );
    }

    let key: string | null | undefined =
      input.avatarUrl === null ? null : undefined;

    if (input.avatarUrl) {
      if (!this.storage) {
        throw new MediaUnavailableError();
      }

      key = `avatars/${input.userId}/${randomUUID()}`;
      const separator = input.avatarUrl.indexOf(',');
      await this.storage.put({
        key,
        bytes: Buffer.from(input.avatarUrl.slice(separator + 1), 'base64'),
        mediaType: input.avatarUrl.slice(5, input.avatarUrl.indexOf(';')),
      });
    }

    let result: ProfileUpdateResult;

    try {
      result = await this.repository.updateProfile({
        userId: input.userId,
        displayName,
        ...(input.defaultReaction
          ? { defaultReaction: input.defaultReaction }
          : {}),
        ...(key !== undefined ? { avatarKey: key, avatarUrl: null } : {}),
      });
    } catch (error: unknown) {
      if (key && this.storage) {
        await this.storage.remove(key).catch(() => undefined);
      }

      throw error;
    }

    if (
      key !== undefined &&
      result.previousAvatarKey &&
      result.previousAvatarKey !== key &&
      this.storage
    ) {
      await this.storage
        .remove(result.previousAvatarKey)
        .catch(() => undefined);
    }

    return {
      id: result.profile.id,
      username: result.profile.username,
      displayName: result.profile.displayName,
      ...(result.profile.defaultReaction
        ? { defaultReaction: result.profile.defaultReaction }
        : {}),
      avatarUrl: (await avatarUrl(result.profile, this.storage)) ?? null,
    };
  }

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
