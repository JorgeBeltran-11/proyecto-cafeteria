import { validate } from 'class-validator';
import { ResetPasswordDto } from './reset-password.dto';

describe('ResetPasswordDto', () => {
  it('rechaza una contraseña menor a 12 caracteres', async () => {
    const dto = Object.assign(new ResetPasswordDto(), {
      token: 'valid-reset-token',
      password: 'short',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('password');
  });
});
