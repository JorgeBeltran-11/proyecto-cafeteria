import { Controller, Get, Header, HttpStatus, Res } from '@nestjs/common';
import type { HealthResponse } from '@cafeteria/shared';
import type { Response } from 'express';
import { HealthService } from './health.service';

@Controller()
export class HealthController {
  constructor(private readonly health: HealthService) {}

  /** 200 si todo está bien; 503 con el mismo cuerpo si la BD falla (contracts/health.openapi.yaml). */
  @Get('health')
  @Header('Cache-Control', 'no-store')
  async getHealth(
    @Res({ passthrough: true }) res: Response,
  ): Promise<HealthResponse> {
    const result = await this.health.check();
    if (result.status === 'error') {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }
    return result;
  }
}
