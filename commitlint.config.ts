import type { UserConfig } from '@commitlint/types';

/**
 * Conventional Commits con alcance obligatorio (constitución VII, research R12).
 * Formato: tipo(alcance): descripción — p. ej. "feat(api): añadir endpoint de salud".
 * Al crear un módulo nuevo, añade su nombre a scope-enum.
 */
const config: UserConfig = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-empty': [2, 'never'],
    'scope-enum': [
      2,
      'always',
      [
        'repo',
        'ci',
        'deps',
        'docs',
        'api',
        'web',
        'shared',
        'plataforma',
        'identidad',
        'catalogo',
        'carrito',
        'specs',
      ],
    ],
  },
};

export default config;
