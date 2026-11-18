import type { ReactionType } from '@university-messenger/events';

type PublicUser = {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  defaultReaction?: ReactionType;
  avatarKey?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type AuthUser = PublicUser & {
  passwordHash: string;
  deletedAt: Date | null;
};

type Session = {
  id: string;
  expiresAt: Date;
};

type RefreshSession = Session & {
  user: PublicUser;
};

type ActiveSession = {
  id: string;
  user: PublicUser;
};

type AuthContext = {
  user: PublicUser;
  sessionId: string;
};

export type {
  PublicUser,
  AuthUser,
  Session,
  RefreshSession,
  ActiveSession,
  AuthContext,
};
