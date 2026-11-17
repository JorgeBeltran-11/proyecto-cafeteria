import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../prisma/prisma.service';
import { ClientesService } from './clientes.service';

describe('ClientesService', () => {
  let service: ClientesService;

  const prismaMock = {
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

      await service.recordConsent(
        'client-1',
        'marketing',
        'granted',
      );

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

      await service.createDataRightsRequest(
        'client-1',
        'portability',
      );

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