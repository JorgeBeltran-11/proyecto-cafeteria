import { PasswordService } from './password.service';

describe('PasswordService', () => {
  let service: PasswordService;

  beforeEach(() => {
    service = new PasswordService();
  });

  it('debe generar un hash Argon2id diferente de la contraseña original', async () => {
    const password = 'ContraseñaSegura123!';
    const hash = await service.hashPassword(password);

    expect(hash).not.toBe(password);
    expect(hash.startsWith('$argon2id$')).toBe(true);
  });

  it('debe verificar una contraseña correcta', async () => {
    const password = 'ContraseñaSegura123!';
    const hash = await service.hashPassword(password);

    await expect(
      service.verifyPassword(password, hash),
    ).resolves.toBe(true);
  });

  it('debe rechazar una contraseña incorrecta', async () => {
    const hash = await service.hashPassword('ContraseñaSegura123!');

    await expect(
      service.verifyPassword('ContraseñaIncorrecta123!', hash),
    ).resolves.toBe(false);
  });

  it('debe rechazar un hash inválido sin lanzar una excepción', async () => {
    await expect(
      service.verifyPassword('ContraseñaSegura123!', 'hash-invalido'),
    ).resolves.toBe(false);
  });
});