import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { createHash } from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { ClientesService } from '../../clientes/services/clientes.service';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { MailerService } from './mailer.service';

describe('AuthService - confirmEmail', () => {
  let service: AuthService;

  const token = 'a'.repeat(64);
  const tokenHash = createHash('sha256').update(token).digest('hex');

  const txMock = {
    emailVerificationToken: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    account: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const prismaMock = {
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    prismaMock.$transaction.mockImplementation(
      (callback: (tx: typeof txMock) => Promise<unknown>) =>
        callback(txMock),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ClientesService, useValue: {} },
        { provide: PasswordService, useValue: {} },
        { provide: MailerService, useValue: {} },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('confirma un token válido, lo consume y activa la cuenta', async () => {
    const verification = {
      id: 'verification-1',
      accountId: 'account-1',
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    };

    const account = {
      id: 'account-1',
      status: 'active',
      emailVerifiedAt: new Date(),
    };

    txMock.emailVerificationToken.findUnique.mockResolvedValue(verification);
    txMock.emailVerificationToken.updateMany.mockResolvedValue({ count: 1 });
    txMock.account.update.mockResolvedValue(account);

    const result = await service.confirmEmail({ token });

    expect(txMock.emailVerificationToken.findUnique).toHaveBeenCalledWith({
      where: { tokenHash },
    });

    expect(txMock.emailVerificationToken.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'verification-1',
        usedAt: null,
        expiresAt: expect.objectContaining({ gt: expect.any(Date) }),
      },
      data: { usedAt: expect.any(Date) },
    });

    expect(txMock.account.update).toHaveBeenCalledWith({
      where: { id: 'account-1' },
      data: {
        status: 'active',
        emailVerifiedAt: expect.any(Date),
      },
      select: {
        id: true,
        status: true,
        emailVerifiedAt: true,
      },
    });

    expect(result.account).toEqual(account);
    expect(result.message).toBe(
      'Correo electrónico confirmado correctamente.',
    );
  });

  it('responde correctamente si se vuelve a utilizar un token de una cuenta confirmada', async () => {
    const verification = {
      id: 'verification-1',
      accountId: 'account-1',
      usedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    };

    const account = {
      id: 'account-1',
      status: 'active',
      emailVerifiedAt: new Date(),
    };

    txMock.emailVerificationToken.findUnique.mockResolvedValue(verification);
    txMock.account.findUnique.mockResolvedValue(account);

    const result = await service.confirmEmail({ token });

    expect(txMock.account.findUnique).toHaveBeenCalledWith({
      where: { id: 'account-1' },
      select: {
        id: true,
        status: true,
        emailVerifiedAt: true,
      },
    });

    expect(result.account).toEqual(account);
    expect(result.message).toBe(
      'Este correo ya había sido confirmado. Tu cuenta está activa.',
    );

    expect(txMock.emailVerificationToken.updateMany).not.toHaveBeenCalled();
    expect(txMock.account.update).not.toHaveBeenCalled();
  });

  it('rechaza un token utilizado si la cuenta no está confirmada', async () => {
    txMock.emailVerificationToken.findUnique.mockResolvedValue({
      id: 'verification-1',
      accountId: 'account-1',
      usedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });

    txMock.account.findUnique.mockResolvedValue({
      id: 'account-1',
      status: 'pending_confirmation',
      emailVerifiedAt: null,
    });

    await expect(service.confirmEmail({ token })).rejects.toThrow(
      BadRequestException,
    );

    expect(txMock.emailVerificationToken.updateMany).not.toHaveBeenCalled();
    expect(txMock.account.update).not.toHaveBeenCalled();
  });

  it('rechaza un token inexistente', async () => {
    txMock.emailVerificationToken.findUnique.mockResolvedValue(null);

    await expect(service.confirmEmail({ token })).rejects.toThrow(
      BadRequestException,
    );

    expect(txMock.account.findUnique).not.toHaveBeenCalled();
    expect(txMock.emailVerificationToken.updateMany).not.toHaveBeenCalled();
    expect(txMock.account.update).not.toHaveBeenCalled();
  });

  it('rechaza un token caducado', async () => {
    txMock.emailVerificationToken.findUnique.mockResolvedValue({
      id: 'verification-1',
      accountId: 'account-1',
      usedAt: null,
      expiresAt: new Date(Date.now() - 60_000),
    });

    await expect(service.confirmEmail({ token })).rejects.toThrow(
      BadRequestException,
    );

    expect(txMock.emailVerificationToken.updateMany).not.toHaveBeenCalled();
    expect(txMock.account.update).not.toHaveBeenCalled();
  });

  it('rechaza el token si otro proceso ya lo consumió', async () => {
    txMock.emailVerificationToken.findUnique.mockResolvedValue({
      id: 'verification-1',
      accountId: 'account-1',
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });

    txMock.emailVerificationToken.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.confirmEmail({ token })).rejects.toThrow(
      BadRequestException,
    );

    expect(txMock.account.update).not.toHaveBeenCalled();
  });
});