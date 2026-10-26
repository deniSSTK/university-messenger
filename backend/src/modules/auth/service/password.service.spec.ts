import { PasswordService } from './password.service.js';

describe('PasswordService', () => {
  const service = new PasswordService();

  beforeAll(async () => service.onModuleInit());

  it('hashes with Argon2id and verifies only the correct password', async () => {
    const hash = await service.hash('correct-password');
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash).not.toContain('correct-password');
    expect(await service.verify('correct-password', hash)).toBe(true);
    expect(await service.verify('wrong-password', hash)).toBe(false);
  });

  it('uses a unique salt for each password hash', async () => {
    const first = await service.hash('correct-password');
    const second = await service.hash('correct-password');
    expect(first).not.toBe(second);
  });

  it('does not authenticate a missing user', async () => {
    expect(await service.verify('unused-password-for-timing')).toBe(false);
  });
});
