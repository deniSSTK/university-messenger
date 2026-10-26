import { Injectable, type OnModuleInit } from '@nestjs/common';
import * as argon2 from 'argon2';

@Injectable()
export class PasswordService implements OnModuleInit {
  private dummyHash!: string;

  async onModuleInit() {
    this.dummyHash = await this.hash('unused-password-for-timing');
  }

  hash(password: string) {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
  }

  async verify(password: string, passwordHash?: string) {
    const valid = await argon2.verify(passwordHash ?? this.dummyHash, password);
    return valid && passwordHash !== undefined;
  }
}
