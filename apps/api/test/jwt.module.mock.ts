import { DynamicModule, Module } from '@nestjs/common';

export class JwtService {
  async signAsync(): Promise<string> {
    return 'e2e-access-token';
  }

  decode() {
    return { exp: Math.floor(Date.now() / 1000) + 900 };
  }
}

@Module({})
export class JwtModule {
  static registerAsync(): DynamicModule {
    return {
      module: JwtModule,
      providers: [JwtService],
      exports: [JwtService],
    };
  }
}
