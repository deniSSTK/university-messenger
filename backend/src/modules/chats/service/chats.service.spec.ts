import {
  CannotCreateChatWithSelfError,
  ChatNotFoundError,
  InvalidMessageCursorError,
  InvalidMessageTextError,
} from '../domain/chats.errors.js';
import type {
  IChatsRepository,
  IMessagesRepository,
} from '../domain/chats.repository.js';
import type { ChatMessage } from '../domain/chats.models.js';
import { ChatsService } from './chats.service.js';

describe('ChatsService', () => {
  let chatsRepository: jest.Mocked<IChatsRepository>;
  let messagesRepository: jest.Mocked<IMessagesRepository>;
  let service: ChatsService;

  beforeEach(() => {
    chatsRepository = {
      createOrFindPrivateChat: jest.fn(),
      findChat: jest.fn(),
      findChats: jest.fn(),
      isActiveMember: jest.fn(),
    };
    messagesRepository = {
      sendMessage: jest.fn(),
      findMessages: jest.fn(),
    };
    service = new ChatsService(chatsRepository, messagesRepository);
  });

  it('rejects a chat with the current user, ignoring UUID letter case', async () => {
    await expect(
      service.createChat({
        currentUserId: '550e8400-e29b-41d4-a716-446655440000',
        recipientId: '550E8400-E29B-41D4-A716-446655440000',
      }),
    ).rejects.toBeInstanceOf(CannotCreateChatWithSelfError);
    expect(chatsRepository.createOrFindPrivateChat.mock.calls).toHaveLength(0);
  });

  it('calculates the offset for paginated chat lists', async () => {
    chatsRepository.findChats.mockResolvedValue({ items: [], total: 25 });

    await expect(
      service.listChats({
        currentUserId: '550e8400-e29b-41d4-a716-446655440000',
        page: 2,
        limit: 10,
      }),
    ).resolves.toEqual({
      items: [],
      page: 2,
      limit: 10,
      total: 25,
      totalPages: 3,
    });
    expect(chatsRepository.findChats.mock.calls).toEqual([
      [
        {
          currentUserId: '550e8400-e29b-41d4-a716-446655440000',
          offset: 10,
          take: 10,
        },
      ],
    ]);
  });

  it.each(['', ' \n\t ', '🙂'.repeat(4001)])(
    'rejects blank or oversized message text %#',
    async (text) => {
      await expect(
        service.sendMessage({
          chatId: '9c858901-8a57-4791-81fe-4c455b099bc9',
          senderId: '550e8400-e29b-41d4-a716-446655440000',
          text,
        }),
      ).rejects.toBeInstanceOf(InvalidMessageTextError);
      expect(chatsRepository.isActiveMember.mock.calls).toHaveLength(0);
      expect(messagesRepository.sendMessage.mock.calls).toHaveLength(0);
    },
  );

  it.each([1, 4000])(
    'accepts message text with %i characters',
    async (length) => {
      const message: ChatMessage = {
        id: '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
        chatId: '9c858901-8a57-4791-81fe-4c455b099bc9',
        text: '🙂'.repeat(length),
        senderId: '550e8400-e29b-41d4-a716-446655440000',
        sender: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          username: 'alice',
          displayName: 'Alice',
        },
        createdAt: new Date('2026-10-30T12:30:00.000Z'),
        editedAt: null,
      };
      chatsRepository.isActiveMember.mockResolvedValue(true);
      messagesRepository.sendMessage.mockResolvedValue(message);

      await expect(
        service.sendMessage({
          chatId: message.chatId,
          senderId: '550e8400-e29b-41d4-a716-446655440000',
          text: message.text,
        }),
      ).resolves.toEqual(message);
      expect(messagesRepository.sendMessage.mock.calls[0][0].text).toBe(
        message.text,
      );
    },
  );

  it('blocks sending messages for inactive or foreign participants', async () => {
    chatsRepository.isActiveMember.mockResolvedValue(false);

    await expect(
      service.sendMessage({
        chatId: '9c858901-8a57-4791-81fe-4c455b099bc9',
        senderId: '550e8400-e29b-41d4-a716-446655440000',
        text: 'Hello',
      }),
    ).rejects.toBeInstanceOf(ChatNotFoundError);
    expect(messagesRepository.sendMessage.mock.calls).toHaveLength(0);
  });

  it('returns a cursor pointing to the oldest message in a non-final page', async () => {
    const newestMessage: ChatMessage = {
      id: '6ba7b811-9dad-41d1-80b4-00c04fd430c8',
      chatId: '9c858901-8a57-4791-81fe-4c455b099bc9',
      text: 'newest',
      senderId: '550e8400-e29b-41d4-a716-446655440000',
      sender: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        username: 'alice',
        displayName: 'Alice',
      },
      createdAt: new Date('2026-10-30T12:31:00.000Z'),
      editedAt: null,
    };
    const oldestMessage: ChatMessage = {
      ...newestMessage,
      id: '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
      createdAt: new Date('2026-10-30T12:30:00.000Z'),
    };
    messagesRepository.findMessages.mockResolvedValue({
      items: [newestMessage, oldestMessage],
      hasMore: true,
    });

    const result = await service.listMessages({
      chatId: '9c858901-8a57-4791-81fe-4c455b099bc9',
      cursor: undefined,
      limit: 2,
    });

    expect(result.items).toEqual([newestMessage, oldestMessage]);
    expect(result.nextCursor).not.toBeNull();

    if (!result.nextCursor) {
      throw new Error('Expected a cursor for the next history page');
    }

    expect(
      JSON.parse(Buffer.from(result.nextCursor, 'base64url').toString()),
    ).toEqual({
      createdAt: '2026-10-30T12:30:00.000Z',
      id: oldestMessage.id,
    });
    expect(messagesRepository.findMessages.mock.calls).toEqual([
      [
        {
          chatId: '9c858901-8a57-4791-81fe-4c455b099bc9',
          cursor: null,
          take: 2,
        },
      ],
    ]);
  });

  it('rejects malformed message cursors before querying the repository', async () => {
    await expect(
      service.listMessages({
        chatId: '9c858901-8a57-4791-81fe-4c455b099bc9',
        cursor: 'not-a-cursor',
        limit: 20,
      }),
    ).rejects.toBeInstanceOf(InvalidMessageCursorError);
    expect(messagesRepository.findMessages.mock.calls).toHaveLength(0);
  });
});
