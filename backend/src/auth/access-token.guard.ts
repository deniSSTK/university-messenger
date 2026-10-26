import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { isUUID } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service.js';
import { publicUserSelect, type AuthenticatedRequest } from './auth.types.js';

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const match = /^Bearer ([^\s]+)$/i.exec(
      request.headers.authorization ?? '',
    );
    if (!match) throw new UnauthorizedException();
    let claims: { sub?: unknown; sid?: unknown; type?: unknown; exp?: unknown };
    try {
      claims = await this.jwt.verifyAsync(match[1]);
    } catch {
      throw new UnauthorizedException();
    }
    if (
      !claims ||
      typeof claims !== 'object' ||
      claims.type !== 'access' ||
      typeof claims.exp !== 'number' ||
      typeof claims.sub !== 'string' ||
      !isUUID(claims.sub) ||
      typeof claims.sid !== 'string' ||
      !isUUID(claims.sid)
    )
      throw new UnauthorizedException();
    const session = await this.prisma.userSession.findFirst({
      where: {
        id: claims.sid,
        userId: claims.sub,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        user: { deletedAt: null },
      },
      select: { id: true, user: { select: publicUserSelect } },
    });
    if (!session) throw new UnauthorizedException();
    request.auth = { user: session.user, sessionId: session.id };
    return true;
  }
}
