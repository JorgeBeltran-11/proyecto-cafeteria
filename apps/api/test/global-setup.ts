import { execSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

/**
 * Prepara una base de datos SQLite real y desechable para los tests HTTP:
 * crea un directorio temporal, apunta DATABASE_URL a test.db y aplica las migraciones.
 * Los workers de Jest heredan process.env, así que la API de los tests usa esta BD.
 */
export default function globalSetup(): void {
  const dir = mkdtempSync(join(tmpdir(), 'cafeteria-api-test-'));
  const dbPath = join(dir, 'test.db').replace(/\\/g, '/');
  process.env.DATABASE_URL = `file:${dbPath}`;

  execSync('pnpm exec prisma migrate deploy', {
    cwd: resolve(__dirname, '..'),
    env: process.env,
    stdio: 'pipe',
  });
}
