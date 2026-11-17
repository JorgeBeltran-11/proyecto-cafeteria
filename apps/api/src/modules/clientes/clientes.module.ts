import { Module } from '@nestjs/common';
import { ClientesService } from './services/clientes.service';

@Module({
  providers: [ClientesService],
  exports: [ClientesService],
})
export class ClientesModule {}