const { execSync } = require('node:child_process');
const { mkdtempSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');

module.exports = function globalSetup() {
  const dir = mkdtempSync(join(tmpdir(), 'cafeteria-api-test-'));
  const dbPath = join(dir, 'test.db').replace(/\\/g, '/');
  process.env.CAFETERIA_API_TEST_DB_DIR = dir;
  process.env.DATABASE_URL = `file:${dbPath}`;

  execSync('pnpm exec prisma migrate deploy', {
    cwd: resolve(__dirname, '..'),
    env: process.env,
    stdio: 'pipe',
  });
};
