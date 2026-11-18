import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AuthService } from '../services/auth.service';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

jest.mock('@nestjs/jwt', () => ({
  JwtService: class JwtService {},
}));

describe('AuthController recovery throttling', () => {
  it('limita las solicitudes a POST /auth/forgot-password', async () => {
    const auth = {
      forgotPassword: jest.fn().mockResolvedValue({ message: 'ok' }),
      resetPassword: jest.fn().mockResolvedValue({ message: 'ok' }),
    };
    const builder = Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 1 }])],
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: auth }],
    }).overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true });
    const moduleRef = await builder.compile();
    const app = moduleRef.createNestApplication<INestApplication<App>>();

    try {
      await app.init();
      const server = app.getHttpServer();

      await request(server)
        .post('/auth/forgot-password')
        .send({ email: 'person@example.com' })
        .expect(200);
      await request(server)
        .post('/auth/forgot-password')
        .send({ email: 'person@example.com' })
        .expect(429);

      expect(auth.forgotPassword).toHaveBeenCalledTimes(1);
    } finally {
      await app.close();
    }
  });

  it('limita las solicitudes a POST /auth/reset-password', async () => {
    const auth = {
      forgotPassword: jest.fn().mockResolvedValue({ message: 'ok' }),
      resetPassword: jest.fn().mockResolvedValue({ message: 'ok' }),
    };
    const builder = Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 1 }])],
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: auth }],
    }).overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true });
    const moduleRef = await builder.compile();
    const app = moduleRef.createNestApplication<INestApplication<App>>();

    try {
      await app.init();
      const server = app.getHttpServer();

      await request(server)
        .post('/auth/reset-password')
        .send({ token: 'token', password: 'StrongPassword123' })
        .expect(200);
      await request(server)
        .post('/auth/reset-password')
        .send({ token: 'token', password: 'StrongPassword123' })
        .expect(429);

      expect(auth.resetPassword).toHaveBeenCalledTimes(1);
    } finally {
      await app.close();
    }
  });

  it('limita los intentos a POST /auth/login/mfa', async () => {
    const auth = {
      completeMfaLogin: jest.fn().mockResolvedValue({ accessToken: 'ok' }),
    };
    const builder = Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 1 }])],
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: auth }],
    }).overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true });
    const moduleRef = await builder.compile();
    const app = moduleRef.createNestApplication<INestApplication<App>>();

    try {
      await app.init();
      const server = app.getHttpServer();
      const body = {
        challengeToken: 'a'.repeat(64),
        code: '123456',
      };

      await request(server).post('/auth/login/mfa').send(body).expect(200);
      await request(server).post('/auth/login/mfa').send(body).expect(429);

      expect(auth.completeMfaLogin).toHaveBeenCalledTimes(1);
    } finally {
      await app.close();
    }
  });
});
