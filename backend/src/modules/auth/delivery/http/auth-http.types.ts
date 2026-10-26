import type { Request } from 'express';
import type { AuthContext } from '../../domain/auth.models.js';

type AuthenticatedRequest = Request & {
  auth: AuthContext;
};

export type { AuthenticatedRequest };
