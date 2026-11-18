import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';
import { authenticator } from 'otplib';

const ISSUER = 'Proyecto Cafetería';
const ENCRYPTION_KEY_MESSAGE =
  'La clave de cifrado MFA no está configurada correctamente.';

@Injectable()
export class MfaService {
  constructor(private readonly config: ConfigService) {}

  generateSecret(): string {
    return authenticator.generateSecret(20);
  }

  createProvisioningUri(accountId: string, secret: string): string {
    return authenticator.keyuri(accountId, ISSUER, secret);
  }

  encryptSecret(secret: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.getEncryptionKey(), iv);
    const ciphertext = Buffer.concat([
      cipher.update(secret, 'utf8'),
      cipher.final(),
    ]);

    return [
      'v1',
      iv.toString('base64url'),
      cipher.getAuthTag().toString('base64url'),
      ciphertext.toString('base64url'),
    ].join('.');
  }

  decryptSecret(encryptedSecret: string): string {
    const [version, encodedIv, encodedTag, encodedCiphertext, ...extra] =
      encryptedSecret.split('.');
    const iv = Buffer.from(encodedIv ?? '', 'base64url');
    const tag = Buffer.from(encodedTag ?? '', 'base64url');
    const ciphertext = Buffer.from(encodedCiphertext ?? '', 'base64url');

    if (
      version !== 'v1' ||
      extra.length > 0 ||
      iv.length !== 12 ||
      tag.length !== 16 ||
      ciphertext.length === 0
    ) {
      throw new ServiceUnavailableException(
        'La configuración MFA no es válida.',
      );
    }

    const encryptionKey = this.getEncryptionKey();
    try {
      const decipher = createDecipheriv(
        'aes-256-gcm',
        encryptionKey,
        iv,
      );
      decipher.setAuthTag(tag);
      return Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new ServiceUnavailableException(
        'La configuración MFA no se pudo validar.',
      );
    }
  }

  verifyTotp(secret: string, code: string, now: Date): number | null {
    if (!/^\d{6}$/.test(code)) {
      return null;
    }

    const totp = authenticator.create({
      ...authenticator.allOptions(),
      epoch: now.getTime(),
      step: 30,
      digits: 6,
      window: [1, 0],
    });
    const delta = totp.checkDelta(code, secret);

    if (delta === null) {
      return null;
    }

    return Math.floor(now.getTime() / 30_000) + delta;
  }

  generateRecoveryCodes(): string[] {
    return Array.from({ length: 10 }, () => {
      const rawCode = randomBytes(16).toString('hex').toUpperCase();
      return rawCode.match(/.{1,8}/g)?.join('-') ?? rawCode;
    });
  }

  isRecoveryCode(code: string): boolean {
    return /^[A-F0-9]{8}(?:-[A-F0-9]{8}){3}$/i.test(code);
  }

  hashRecoveryCode(code: string): string {
    const normalized = code.replace(/-/g, '').toUpperCase();
    const hash = createHash('sha256').update(normalized).digest('hex');
    return `recovery:v1:${hash}`;
  }

  hashChallengeToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private getEncryptionKey(): Buffer {
    const encodedKey = this.config
      .get<string>('MFA_ENCRYPTION_KEY')
      ?.trim();

    if (!encodedKey) {
      throw new ServiceUnavailableException(ENCRYPTION_KEY_MESSAGE);
    }

    const key = Buffer.from(encodedKey, 'base64');
    if (key.length !== 32 || key.toString('base64') !== encodedKey) {
      throw new ServiceUnavailableException(ENCRYPTION_KEY_MESSAGE);
    }

    return key;
  }
}
