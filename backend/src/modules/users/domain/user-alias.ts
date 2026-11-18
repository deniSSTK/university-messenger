import type { NicknameColor } from '@university-messenger/events';

type UserAlias = {
  targetUserId: string;
  nickname: string;
  color: NicknameColor;
};

export type { UserAlias };
