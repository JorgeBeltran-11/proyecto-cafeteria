import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

export interface CreateClientProfileInput {
  fullName: string;
  email: string;
  phone?: string;
  preferences?: Record<string, unknown>;
  locale?: string;
}

export interface UpdateClientProfileInput {
  fullName?: string;
  phone?: string | null;
  preferences?: Record<string, unknown>;
  locale?: string;
}

@Injectable()
export class ClientesService {
  constructor(private readonly prisma: PrismaService) {}

  async createProfile(input: CreateClientProfileInput) {
    return this.prisma.clientProfile.create({
      data: {
        fullName: input.fullName.trim(),
        email: input.email.trim().toLowerCase(),
        phone: input.phone?.trim() || null,
        preferences: (input.preferences ?? {}) as Prisma.InputJsonValue,
        locale: input.locale ?? 'es-EC',
      },
    });
  }


  async createProfileInTransaction(
    input: CreateClientProfileInput,
    tx: Prisma.TransactionClient,
  ) {
    return tx.clientProfile.create({
      data: {
        fullName: input.fullName.trim(),
        email: input.email.trim().toLowerCase(),
        phone: input.phone?.trim() || null,
        preferences: (input.preferences ?? {}) as Prisma.InputJsonValue,
        locale: input.locale ?? 'es-EC',
      },
    });
  }
  async findById(id: string) {
    return this.prisma.clientProfile.findUnique({
      where: { id },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.clientProfile.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
  }

  async updateProfile(id: string, input: UpdateClientProfileInput) {
    const existing = await this.findById(id);

    if (!existing) {
      throw new NotFoundException('Perfil de cliente no encontrado');
    }

    return this.prisma.clientProfile.update({
      where: { id },
      data: {
        ...(input.fullName !== undefined && {
          fullName: input.fullName.trim(),
        }),
        ...(input.phone !== undefined && {
          phone: input.phone?.trim() || null,
        }),
        ...(input.preferences !== undefined && {
          preferences: input.preferences as Prisma.InputJsonValue,
        }),
        ...(input.locale !== undefined && {
          locale: input.locale,
        }),
      },
    });
  }

  async recordConsent(
    clientId: string,
    purpose: string,
    state: 'granted' | 'revoked',
    source: 'self-service' | 'admin' | 'legal' = 'self-service',
  ) {
    const client = await this.findById(clientId);

    if (!client) {
      throw new NotFoundException('Perfil de cliente no encontrado');
    }

    const now = new Date();

    return this.prisma.consentRecord.create({
      data: {
        clientId,
        purpose,
        state,
        source,
        effectiveFrom: now,
        effectiveTo: state === 'revoked' ? now : null,
      },
    });
  }


  async recordConsentInTransaction(
    clientId: string,
    purpose: string,
    tx: Prisma.TransactionClient,
  ) {
    return tx.consentRecord.create({
      data: {
        clientId,
        purpose,
        state: 'granted',
        source: 'self-service',
      },
    });
  }
  async getConsents(clientId: string) {
    const client = await this.findById(clientId);

    if (!client) {
      throw new NotFoundException('Perfil de cliente no encontrado');
    }

    return this.prisma.consentRecord.findMany({
      where: { clientId },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  async createDataRightsRequest(
    clientId: string,
    requestType:
      | 'access'
      | 'rectification'
      | 'deletion'
      | 'opposition'
      | 'portability',
  ) {
    const client = await this.findById(clientId);

    if (!client) {
      throw new NotFoundException('Perfil de cliente no encontrado');
    }

    return this.prisma.dataRightsRequest.create({
      data: {
        clientId,
        requestType,
        status: 'pending',
      },
    });
  }
}
