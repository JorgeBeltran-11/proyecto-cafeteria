import { ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { authenticator } from 'otplib';
import { MfaService } from './mfa.service';

describe('MfaService', () => {
  const encryptionKey = Buffer.alloc(32, 7).toString('base64');
  const configMock = {
    get: jest.fn(),
  };
  let service: MfaService;

  beforeEach(async () => {
    jest.clearAllMocks();
    configMock.get.mockReturnValue(encryptionKey);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MfaService,
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();

    service = module.get<MfaService>(MfaService);
  });

  it('cifra el secreto con AES-GCM y puede descifrarlo', () => {
    const secret = service.generateSecret();
    const encryptedSecret = service.encryptSecret(secret);

    expect(encryptedSecret).not.toContain(secret);
    expect(service.decryptSecret(encryptedSecret)).toBe(secret);
  });

  it('rechaza un secreto cifrado si cambió el tag de autenticación', () => {
    const encryptedSecret = service.encryptSecret(service.generateSecret());
    const parts = encryptedSecret.split('.');
    parts[2] = `${parts[2][0] === 'A' ? 'B' : 'A'}${parts[2].slice(1)}`;

    expect(() => service.decryptSecret(parts.join('.'))).toThrow(
      ServiceUnavailableException,
    );
  });

  it('falla explícitamente si falta una clave AES-256 válida', () => {
    configMock.get.mockReturnValue('invalid-key');

    expect(() => service.encryptSecret(service.generateSecret())).toThrow(
      ServiceUnavailableException,
    );
  });

  it('genera y valida códigos TOTP de seis dígitos', () => {
    const secret = service.generateSecret();
    const now = new Date();
    const totp = authenticator.create({
      ...authenticator.allOptions(),
      epoch: now.getTime(),
      step: 30,
      digits: 6,
      window: 1,
    });
    const code = totp.generate(secret);

    expect(code).toMatch(/^\d{6}$/);
    expect(service.verifyTotp(secret, code, now)).toBe(
      Math.floor(now.getTime() / 30_000),
    );
    expect(service.verifyTotp(secret, 'abcdef', now)).toBeNull();
  });

  it('rechaza un código TOTP incorrecto', () => {
    const secret = service.generateSecret();
    const otherSecret = service.generateSecret();
    const now = new Date();
    const totp = authenticator.create({
      ...authenticator.allOptions(),
      epoch: now.getTime(),
      window: 1,
    });
    const wrongCode = totp.generate(otherSecret);

    expect(service.verifyTotp(secret, wrongCode, now)).toBeNull();
  });

  it('genera una URI otpauth y códigos de recuperación aleatorios', () => {
    const secret = service.generateSecret();
    const provisioningUri = service.createProvisioningUri(
      'account-1',
      secret,
    );
    const codes = service.generateRecoveryCodes();

    expect(provisioningUri).toMatch(/^otpauth:\/\/totp\//);
    expect(provisioningUri).toContain(secret);
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    expect(codes.every((code) => service.isRecoveryCode(code))).toBe(true);

    const codeHash = service.hashRecoveryCode(codes[0]);
    expect(codeHash).toMatch(/^recovery:v1:[a-f0-9]{64}$/);
    expect(codeHash).not.toContain(codes[0]);
  });
});
