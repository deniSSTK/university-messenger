import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ACCESS_TOKEN_TTL, SESSION_TTL } from './auth.config.js';
import { LoginDto, RegisterDto } from './auth.dto.js';
import { publicUserSelect, type PublicUser } from './auth.types.js';
import { PasswordService } from './password.service.js';

const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');
const newToken = () => randomBytes(32).toString('base64url');

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const passwordHash = await this.passwords.hash(dto.password);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: dto.email,
            username: dto.username,
            displayName: dto.displayName,
            passwordHash,
          },
          select: publicUserSelect,
        });
        return this.createSession(tx, user);
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email or username already in use');
      }
      throw error;
    }
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    const valid = await this.passwords.verify(dto.password, user?.passwordHash);
    if (!user || !valid || user.deletedAt) {
      throw new UnauthorizedException('Invalid email or password');
    }
    // Recheck deletion in the transaction that creates the session.
    return this.prisma.$transaction(async (tx) => {
      const activeUser = await tx.user.findFirst({
        where: { id: user.id, deletedAt: null },
        select: publicUserSelect,
      });
      if (!activeUser)
        throw new UnauthorizedException('Invalid email or password');
      return this.createSession(tx, activeUser);
    });
  }

  async refresh(token: unknown) {
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const tokenHash = hashToken(token);
    const refreshToken = newToken();
    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const session = await tx.userSession.findFirst({
        where: {
          tokenHash,
          revokedAt: null,
          expiresAt: { gt: now },
          user: { deletedAt: null },
        },
        include: { user: { select: publicUserSelect } },
      });
      if (!session) throw new UnauthorizedException('Invalid refresh token');
      // Compare-and-swap prevents two requests from consuming the same refresh token.
      const result = await tx.userSession.updateMany({
        where: {
          id: session.id,
          tokenHash,
          revokedAt: null,
          expiresAt: { gt: now },
          user: { deletedAt: null },
        },
        data: { tokenHash: hashToken(refreshToken) },
      });
      if (result.count !== 1)
        throw new UnauthorizedException('Invalid refresh token');
      return this.tokens(
        session.user,
        session.id,
        refreshToken,
        session.expiresAt,
      );
    });
  }

  async logout(sessionId: string, userId: string) {
    await this.prisma.userSession.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async createSession(tx: Prisma.TransactionClient, user: PublicUser) {
    const refreshToken = newToken();
    const session = await tx.userSession.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + SESSION_TTL),
      },
    });
    return this.tokens(user, session.id, refreshToken, session.expiresAt);
  }

  private async tokens(
    user: PublicUser,
    sessionId: string,
    refreshToken: string,
    expiresAt: Date,
  ) {
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, sid: sessionId, type: 'access' },
      { jwtid: randomUUID() },
    );
    return {
      body: {
        user,
        accessToken,
        tokenType: 'Bearer',
        expiresIn: ACCESS_TOKEN_TTL,
      },
      refreshToken,
      expiresAt,
    };
  }
}
