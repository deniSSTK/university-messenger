import { UsersService } from './users.service.js';
import { InvalidProfileError } from '../domain/profile.models.js';
import type { UsersRepository } from '../domain/users.repository.js';

describe('UsersService', () => {
  const repository: jest.Mocked<UsersRepository> = {
    findByUsernamePrefix: jest.fn(),
    updateProfile: jest.fn(),
  };
  const service = new UsersService(repository);
  beforeEach(() => jest.clearAllMocks());

  it('maps username search and pagination without leaking repository data', async () => {
    repository.findByUsernamePrefix.mockResolvedValue({
      users: [{ id: 'other', username: 'alice', displayName: 'Alice' }],
      total: 21,
    });
    await expect(
      service.search({ currentUserId: 'me', search: 'al', page: 2, limit: 20 }),
    ).resolves.toEqual({
      items: [{ id: 'other', username: 'alice', displayName: 'Alice' }],
      page: 2,
      limit: 20,
      total: 21,
      totalPages: 2,
    });
    expect(repository.findByUsernamePrefix.mock.calls[0][0]).toEqual({
      usernamePrefix: 'al',
      excludedUserId: 'me',
      offset: 20,
      take: 20,
    });
  });

  it.each(['', '   ', 'x'.repeat(65)])(
    'rejects invalid profile names',
    async (displayName) => {
      await expect(
        service.updateProfile({ userId: 'me', displayName, avatarUrl: null }),
      ).rejects.toBeInstanceOf(InvalidProfileError);
      expect(repository.updateProfile.mock.calls).toHaveLength(0);
    },
  );

  it.each([
    'https://example.com/avatar.png',
    'data:image/svg+xml;base64,PHN2Zz4=',
    'data:image/png;base64,SGVsbG8=',
  ])(
    'rejects remote, active or incorrectly typed avatar content',
    async (avatarUrl) => {
      await expect(
        service.updateProfile({
          userId: 'me',
          displayName: 'Alice',
          avatarUrl,
        }),
      ).rejects.toBeInstanceOf(InvalidProfileError);
    },
  );

  it('trims display names and supports removing an avatar', async () => {
    repository.updateProfile.mockResolvedValue({
      previousAvatarKey: null,
      profile: {
        id: 'me',
        username: 'alice',
        displayName: 'Alice',
        avatarUrl: null,
      },
    });
    await expect(
      service.updateProfile({
        userId: 'me',
        displayName: '  Alice  ',
        avatarUrl: null,
      }),
    ).resolves.toMatchObject({ displayName: 'Alice', avatarUrl: null });
    expect(repository.updateProfile.mock.calls[0][0]).toEqual({
      userId: 'me',
      displayName: 'Alice',
      avatarUrl: null,
      avatarKey: null,
    });
  });
});
