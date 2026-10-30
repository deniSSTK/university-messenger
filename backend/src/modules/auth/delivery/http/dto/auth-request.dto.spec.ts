import { plainToInstance } from 'class-transformer';
import { LoginDto, RegisterDto } from './auth-request.dto.js';

describe('Auth DTO transformations', () => {
  it('trims email without changing its case during registration', () => {
    const dto = plainToInstance(RegisterDto, {
      email: ' Alice@Example.com ',
      username: ' ALICE ',
      displayName: ' Alice ',
      password: ' Example-password123 ',
    });

    expect(dto.email).toBe('Alice@Example.com');
    expect(dto.username).toBe('alice');
    expect(dto.displayName).toBe('Alice');
    expect(dto.password).toBe(' Example-password123 ');
  });

  it('preserves email case during login', () => {
    const dto = plainToInstance(LoginDto, { email: ' ALICE@EXAMPLE.COM ' });

    expect(dto.email).toBe('ALICE@EXAMPLE.COM');
  });
});
