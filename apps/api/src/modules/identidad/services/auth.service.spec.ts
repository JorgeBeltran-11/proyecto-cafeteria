import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { createHash } from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { ClientesService } from '../../clientes/services/clientes.service';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { MailerService } from './mailer.service';
import { Prisma } from '@prisma/client';

describe('AuthService', () => {
  let service: AuthService;

  const token = 'a'.repeat(64);
  const tokenHash = createHash('sha256').update(token).digest('hex');

  const txMock = {
    emailVerificationToken: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
    },
    account: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
  };

  const prismaMock = {
    $transaction: jest.fn(),
    account: {
      findUnique: jest.fn(),
    },
  };

  const clientesMock = {
    findByEmail: jest.fn(),
    registerClientProfile: jest.fn(),
    rollbackClientRegistration: jest.fn(),
  };

  const passwordsMock = {
    hashPassword: jest.fn(),
  };

  const mailerMock = {
    assertConfigured: jest.fn(),
    sendEmailVerification: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    clientesMock.findByEmail.mockResolvedValue(null);
    clientesMock.registerClientProfile.mockResolvedValue({
      id: 'client-1',
      email: 'leonardo@example.com',
    });
    passwordsMock.hashPassword.mockResolvedValue('argon2id-hash');
    mailerMock.assertConfigured.mockReturnValue(undefined);
    mailerMock.sendEmailVerification.mockResolvedValue(undefined);
    prismaMock.account.findUnique.mockResolvedValue(null);
    txMock.account.create.mockResolvedValue({
      id: 'account-1',
      clientId: 'client-1',
    });
    txMock.emailVerificationToken.create.mockResolvedValue({
      id: 'verification-1',
      accountId: 'account-1',
    });

    prismaMock.$transaction.mockImplementation(
      (callback: (tx: typeof txMock) => Promise<unknown>) =>
        callback(txMock),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ClientesService, useValue: clientesMock },
        { provide: PasswordService, useValue: passwordsMock },
        { provide: MailerService, useValue: mailerMock },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    const dto = {
      fullName: ' Leonardo Mendieta ',
      email: ' LEONARDO@EXAMPLE.COM ',
      password: 'UnaClaveSegura123',
      acceptsPrivacyPolicy: true,
    };

    it('registra el perfil, la cuenta y el token con una expiración de 30 minutos', async () => {
      const before = Date.now();
      const result = await service.register(dto);

      expect(clientesMock.findByEmail).toHaveBeenCalledWith(
        'leonardo@example.com',
      );
      expect(passwordsMock.hashPassword).toHaveBeenCalledWith(dto.password);
      expect(clientesMock.registerClientProfile).toHaveBeenCalledWith({
        fullName: dto.fullName,
        email: 'leonardo@example.com',
      });
      expect(txMock.account.create).toHaveBeenCalledWith({
        data: {
          clientId: 'client-1',
          passwordHash: 'argon2id-hash',
          role: 'customer',
          status: 'pending_confirmation',
        },
      });
      expect(txMock.emailVerificationToken.create).toHaveBeenCalledWith({
        data: {
          accountId: 'account-1',
          tokenHash: expect.any(String),
          expiresAt: expect.any(Date),
        },
      });

      const tokenData = txMock.emailVerificationToken.create.mock.calls[0][0]
        .data as { tokenHash: string; expiresAt: Date };
      expect(tokenData.tokenHash).toMatch(/^[a-f0-9]{64}$/);
      expect(tokenData.expiresAt.getTime()).toBeGreaterThanOrEqual(
        before + 30 * 60 * 1000,
      );
      expect(tokenData.expiresAt.getTime()).toBeLessThanOrEqual(
        Date.now() + 30 * 60 * 1000,
      );

      expect(mailerMock.sendEmailVerification).toHaveBeenCalledWith(
        'leonardo@example.com',
        expect.stringMatching(/^[a-f0-9]{64}$/),
      );
      expect(result.message).toBe(
        'Si los datos son válidos, recibirás instrucciones en tu correo electrónico.',
      );
    });

    it('devuelve una respuesta genérica si el perfil ya existe', async () => {
      clientesMock.findByEmail.mockResolvedValue({ id: 'existing-client' });

      const result = await service.register(dto);

      expect(result.message).toBe(
        'Si los datos son válidos, recibirás instrucciones en tu correo electrónico.',
      );
      expect(passwordsMock.hashPassword).not.toHaveBeenCalled();
      expect(clientesMock.registerClientProfile).not.toHaveBeenCalled();
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('compensa el perfil si falla la creación de la cuenta', async () => {
      txMock.account.create.mockRejectedValue(new Error('account failed'));

      await expect(service.register(dto)).rejects.toThrow('account failed');

      expect(prismaMock.account.findUnique).toHaveBeenCalledWith({
        where: { clientId: 'client-1' },
        select: { id: true },
      });
      expect(clientesMock.rollbackClientRegistration).toHaveBeenCalledWith(
        'client-1',
        'leonardo@example.com',
      );
    });

    it('revierte el registro y propaga el error si falla la cuenta y no existe una asociada', async () => {
      const originalError = new Error('account creation failed');
      txMock.account.create.mockRejectedValue(originalError);
      prismaMock.account.findUnique.mockResolvedValue(null);

      await expect(service.register(dto)).rejects.toBe(originalError);

      expect(clientesMock.registerClientProfile).toHaveBeenCalledWith({
        fullName: dto.fullName,
        email: 'leonardo@example.com',
      });
      expect(prismaMock.account.findUnique).toHaveBeenCalledWith({
        where: { clientId: 'client-1' },
        select: { id: true },
      });
      expect(clientesMock.rollbackClientRegistration).toHaveBeenCalledWith(
        'client-1',
        'leonardo@example.com',
      );
      expect(mailerMock.sendEmailVerification).not.toHaveBeenCalled();
    });

    it('compensa el perfil si falla la creación del token', async () => {
      txMock.emailVerificationToken.create.mockRejectedValue(
        new Error('token failed'),
      );

      await expect(service.register(dto)).rejects.toThrow('token failed');

      expect(clientesMock.rollbackClientRegistration).toHaveBeenCalledWith(
        'client-1',
        'leonardo@example.com',
      );
    });

    it('no compensa si ya existe una cuenta asociada', async () => {
      prismaMock.account.findUnique.mockResolvedValue({ id: 'account-1' });
      txMock.account.create.mockRejectedValue(new Error('account failed'));

      await expect(service.register(dto)).rejects.toThrow('account failed');

      expect(clientesMock.rollbackClientRegistration).not.toHaveBeenCalled();
    });

    it('no compensa si no puede comprobarse la existencia de la cuenta', async () => {
      prismaMock.account.findUnique.mockRejectedValue(
        new Error('database unavailable'),
      );
      txMock.account.create.mockRejectedValue(new Error('account failed'));

      await expect(service.register(dto)).rejects.toThrow('account failed');

      expect(clientesMock.rollbackClientRegistration).not.toHaveBeenCalled();
    });

    it('devuelve una respuesta genérica ante conflictos P2002', async () => {
      const conflict = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '6.19.3',
        },
      );
      txMock.account.create.mockRejectedValue(conflict);

      const result = await service.register(dto);

      expect(result.message).toBe(
        'Si los datos son válidos, recibirás instrucciones en tu correo electrónico.',
      );
    });

    it('mantiene la cuenta pendiente si falla el envío del correo', async () => {
      mailerMock.sendEmailVerification.mockRejectedValue(
        new Error('smtp unavailable'),
      );

      await expect(service.register(dto)).rejects.toThrow(
        'No fue posible enviar el correo.',
      );

      expect(clientesMock.rollbackClientRegistration).not.toHaveBeenCalled();
      expect(prismaMock.account.findUnique).not.toHaveBeenCalled();
    });

    it('valida la configuración del correo antes de registrar', async () => {
      mailerMock.assertConfigured.mockImplementation(() => {
        throw new Error('correo no configurado');
      });

      await expect(service.register(dto)).rejects.toThrow(
        'correo no configurado',
      );

      expect(clientesMock.findByEmail).not.toHaveBeenCalled();
    });
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