const { rmSync } = require('node:fs');
const { basename, isAbsolute, relative, resolve, sep } = require('node:path');
const { tmpdir } = require('node:os');

module.exports = function globalTeardown() {
  const configuredDir = process.env.CAFETERIA_API_TEST_DB_DIR;
  if (!configuredDir) return;

  const tempRoot = resolve(tmpdir());
  const testDir = resolve(configuredDir);
  const relativeDir = relative(tempRoot, testDir);

  if (
    !relativeDir ||
    relativeDir.startsWith(`..${sep}`) ||
    relativeDir === '..' ||
    isAbsolute(relativeDir) ||
    !basename(testDir).startsWith('cafeteria-api-test-')
  ) {
    throw new Error('La ruta de la base temporal E2E no es válida.');
  }

  rmSync(testDir, { recursive: true, force: true });
};
