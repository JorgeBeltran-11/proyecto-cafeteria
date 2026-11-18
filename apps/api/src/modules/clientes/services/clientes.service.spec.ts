import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../prisma/prisma.service';
import { ClientesService } from './clientes.service';

describe('ClientesService', () => {
  let service: ClientesService;

  describe('registerClientProfile', () => {
    it('crea el perfil y registra el consentimiento en una transacción', async () => {
      transactionMock.clientProfile.create.mockResolvedValue({
        id: 'client-1',
        fullName: 'Leonardo Mendieta',
        email: 'leonardo@example.com',
      });

      transactionMock.consentRecord.create.mockResolvedValue({
        id: 'consent-1',
      });

      const result = await service.registerClientProfile({
        fullName: ' Leonardo Mendieta ',
        email: ' LEONARDO@EXAMPLE.COM ',
      });

      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);

      expect(transactionMock.clientProfile.create).toHaveBeenCalledWith({
        data: {
          fullName: 'Leonardo Mendieta',
          email: 'leonardo@example.com',
          phone: null,
          preferences: {},
          locale: 'es-EC',
        },
      });

      expect(transactionMock.consentRecord.create).toHaveBeenCalledWith({
        data: {
          clientId: 'client-1',
          purpose: 'privacy_policy',
          state: 'granted',
          source: 'self-service',
        },
      });

      expect(result.id).toBe('client-1');
    });

    it('propaga el error si falla el registro del consentimiento', async () => {
      transactionMock.clientProfile.create.mockResolvedValue({
        id: 'client-1',
        email: 'leonardo@example.com',
      });

      const consentError = new Error('Error al registrar consentimiento');
      transactionMock.consentRecord.create.mockRejectedValue(consentError);

      await expect(
        service.registerClientProfile({
          fullName: 'Leonardo Mendieta',
          email: 'leonardo@example.com',
        }),
      ).rejects.toBe(consentError);

      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('rollbackClientRegistration', () => {
    it('elimina el consentimiento y el perfil del registro incompleto', async () => {
      transactionMock.clientProfile.findUnique.mockResolvedValue({
        id: 'client-1',
        email: 'leonardo@example.com',
      });

      transactionMock.clientProfile.deleteMany.mockResolvedValue({
        count: 1,
      });

      const result = await service.rollbackClientRegistration(
        'client-1',
        ' LEONARDO@EXAMPLE.COM ',
      );

      expect(transactionMock.consentRecord.deleteMany).toHaveBeenCalledWith({
        where: { clientId: 'client-1' },
      });

      expect(transactionMock.clientProfile.deleteMany).toHaveBeenCalledWith({
        where: {
          id: 'client-1',
          email: 'leonardo@example.com',
        },
      });

      expect(result).toBe(true);
    });

    it('no elimina datos cuando el correo no coincide', async () => {
      transactionMock.clientProfile.findUnique.mockResolvedValue({
        id: 'client-1',
        email: 'otro@example.com',
      });

      const result = await service.rollbackClientRegistration(
        'client-1',
        'leonardo@example.com',
      );

      expect(transactionMock.consentRecord.deleteMany).not.toHaveBeenCalled();
      expect(transactionMock.clientProfile.deleteMany).not.toHaveBeenCalled();
      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
      expect(result).toBe(false);
    });
  });

  const transactionMock = {
    clientProfile: {
      create: jest.fn(),
      findUnique: jest.fn(),
      deleteMany: jest.fn(),
    },
    consentRecord: {
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
  };
  const prismaMock = {
    $transaction: jest.fn(),
    clientProfile: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    consentRecord: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    dataRightsRequest: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prismaMock.$transaction.mockImplementation(
      (callback) => callback(transactionMock),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientesService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<ClientesService>(ClientesService);
  });

  describe('createProfile', () => {
    it('normaliza el correo y prepara los datos del perfil', async () => {
      prismaMock.clientProfile.create.mockResolvedValue({
        id: 'client-1',
        fullName: 'Leonardo Mendieta',
        email: 'leonardo@example.com',
      });

      await service.createProfile({
        fullName: ' Leonardo Mendieta ',
        email: ' LEONARDO@EXAMPLE.COM ',
      });

      expect(prismaMock.clientProfile.create).toHaveBeenCalledWith({
        data: {
          fullName: 'Leonardo Mendieta',
          email: 'leonardo@example.com',
          phone: null,
          preferences: {},
          locale: 'es-EC',
        },
      });
    });
  });

  describe('findByEmail', () => {
    it('normaliza el correo antes de consultar', async () => {
      prismaMock.clientProfile.findUnique.mockResolvedValue(null);

      await service.findByEmail(' TEST@EXAMPLE.COM ');

      expect(prismaMock.clientProfile.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });
  });

  describe('updateProfile', () => {
    it('actualiza el perfil existente', async () => {
      prismaMock.clientProfile.findUnique.mockResolvedValue({
        id: 'client-1',
      });
      prismaMock.clientProfile.update.mockResolvedValue({
        id: 'client-1',
        fullName: 'Nuevo nombre',
      });

      await service.updateProfile('client-1', {
        fullName: 'Nuevo nombre',
      });

      expect(prismaMock.clientProfile.update).toHaveBeenCalledWith({
        where: { id: 'client-1' },
        data: { fullName: 'Nuevo nombre' },
      });
    });

    it('rechaza actualizar un perfil inexistente', async () => {
      prismaMock.clientProfile.findUnique.mockResolvedValue(null);

      await expect(
        service.updateProfile('inexistente', { fullName: 'Nuevo' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('recordConsent', () => {
    it('registra un consentimiento para un cliente existente', async () => {
      prismaMock.clientProfile.findUnique.mockResolvedValue({
        id: 'client-1',
      });
      prismaMock.consentRecord.create.mockResolvedValue({
        id: 'consent-1',
        clientId: 'client-1',
        purpose: 'marketing',
        state: 'granted',
      });

      await service.recordConsent('client-1', 'marketing', 'granted');

      expect(prismaMock.consentRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          clientId: 'client-1',
          purpose: 'marketing',
          state: 'granted',
          source: 'self-service',
          effectiveTo: null,
        }),
      });
    });

    it('rechaza registrar consentimiento para un cliente inexistente', async () => {
      prismaMock.clientProfile.findUnique.mockResolvedValue(null);

      await expect(
        service.recordConsent('inexistente', 'marketing', 'granted'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('createDataRightsRequest', () => {
    it('registra una solicitud de portabilidad', async () => {
      prismaMock.clientProfile.findUnique.mockResolvedValue({
        id: 'client-1',
      });
      prismaMock.dataRightsRequest.create.mockResolvedValue({
        id: 'request-1',
        clientId: 'client-1',
        requestType: 'portability',
        status: 'pending',
      });

      await service.createDataRightsRequest('client-1', 'portability');

      expect(prismaMock.dataRightsRequest.create).toHaveBeenCalledWith({
        data: {
          clientId: 'client-1',
          requestType: 'portability',
          status: 'pending',
        },
      });
    });
  });
});